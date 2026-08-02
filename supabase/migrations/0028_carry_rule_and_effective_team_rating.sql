-- Implements Patch 5 (Carry Rule) and Patch 9 (Effective Team Rating) from
-- docs/communitrix-elo-adjustment-brief.md as formula_version 2. Every player on a team
-- currently gets the exact same Elo delta regardless of their own rating relative to their
-- partner — this splits it based on the internal gap between partners, and fixes the expected-
-- score calculation to use each team's effective (gap-penalized) rating instead of a raw
-- average, so a lopsided team isn't scored as if it were as strong as its average implies.
--
-- Note: migration 0018_elo_adjustments_and_cp.sql (formula_version, rating_formula_versions,
-- calculate_match_delta, Skill Rating, Community Points) was found NOT to have actually been
-- applied to this database — none of its tables/columns/functions exist live, despite the file
-- being present in this repo and later migrations (0024, 0025) assuming a schema that doesn't
-- include it. This migration creates formula_version/rating_formula_versions fresh; it does not
-- assume anything from 0018 already exists.
--
-- Old matches (formula_version = 1, the default) are completely unaffected — they keep using
-- the flat split and raw-average expected score forever, including on replay via void/amend,
-- so historical results never silently shift when this ships.

-- ─────────────── 1. formula_version tracking ───────────────
alter table public.matches
  add column formula_version int not null default 1;

create table public.rating_formula_versions (
  version           int primary key,
  description       text not null,
  carry_rule_enabled boolean not null default false,
  activated_at      timestamptz not null default now()
);

insert into public.rating_formula_versions (version, description, carry_rule_enabled) values
  (1, 'Original formula: flat split within team, raw team-average expected score', false),
  (2, 'Effective Team Rating (internal-gap-adjusted expected score) + Carry Rule (partner delta split by internal Elo gap)', true);

-- ─────────────── 2. split_team_delta: shared per-player split helper ───────────────
-- Returns an array the same length as p_elos (1 for singles, 2 for doubles), in the same
-- player order, summing to exactly p_team_delta. Only one side is rounded — the other is
-- derived by subtraction — so the pair always sums exactly, preserving the zero-sum invariant
-- across all 4 players even after independent per-player rounding.
create or replace function public.split_team_delta(
  p_elos numeric[],
  p_team_delta numeric,
  p_is_winning boolean,
  p_formula_version int
)
returns numeric[]
language plpgsql
immutable
set search_path = public
as $$
declare
  v_gap_reference constant numeric := 150;
  v_skew numeric;
  v_lower_share numeric;
  v_lower_idx int;
  v_higher_idx int;
  v_result numeric[] := '{}';
  v_i int;
begin
  if p_formula_version < 2 or array_length(p_elos, 1) is null or array_length(p_elos, 1) < 2 then
    for v_i in 1..coalesce(array_length(p_elos, 1), 1) loop
      v_result := v_result || p_team_delta;
    end loop;
    return v_result;
  end if;

  if p_elos[1] <= p_elos[2] then
    v_lower_idx := 1;
    v_higher_idx := 2;
  else
    v_lower_idx := 2;
    v_higher_idx := 1;
  end if;

  v_skew := least(abs(p_elos[1] - p_elos[2]) / v_gap_reference, 1.0);
  v_lower_share := case
    when p_is_winning then 0.5 + v_skew * 0.1
    else 1 - (0.5 + v_skew * 0.15)
  end;

  v_result[v_lower_idx] := round(p_team_delta * v_lower_share, 2);
  v_result[v_higher_idx] := p_team_delta - v_result[v_lower_idx];
  return v_result;
end;
$$;

-- ─────────────── 3. persist_round: assign formula_version at match creation ───────────────
-- New matches always get the currently-active version. Turning Carry Rule off again later
-- (if ever needed) is just inserting version 3 with carry_rule_enabled=false, no code deploy.
create or replace function public.persist_round(
  p_session_id uuid,
  p_round_number int,
  p_matches jsonb,
  p_sit_outs uuid[]
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_round_id uuid;
  v_community_id uuid;
  v_profile_id uuid;
  v_unfinished_prev_count int;
  v_match jsonb;
  v_match_id uuid;
  v_team_a uuid[];
  v_team_b uuid[];
  v_player_id uuid;
  v_court_num int;
  v_elo numeric(7,2);
  v_idx int;
  v_formula_version int;
begin
  perform pg_advisory_xact_lock(hashtext(p_session_id::text));

  v_profile_id := public.current_profile_id();
  if v_profile_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select community_id into v_community_id
  from public.sessions
  where id = p_session_id;

  if not found then
    raise exception 'Session not found' using errcode = 'P0002';
  end if;

  if not public.is_community_host(v_community_id) and not public.is_platform_admin() then
    raise exception 'Only a community host or admin can persist a round' using errcode = '42501';
  end if;

  select id into v_round_id
  from public.rounds
  where session_id = p_session_id and round_number = p_round_number;

  if found then
    return v_round_id;
  end if;

  -- Previous round must be fully scored (or voided) before a new one can be created — was
  -- previously only enforced by a disabled button client-side.
  if p_round_number > 1 then
    select count(*) into v_unfinished_prev_count
    from public.matches
    where session_id = p_session_id
      and round_number = p_round_number - 1
      and status not in ('COMPLETED', 'VOIDED');

    if v_unfinished_prev_count > 0 then
      raise exception 'Round % has % unfinished match(es) — score or void them before starting the next round', p_round_number - 1, v_unfinished_prev_count
        using errcode = '45000';
    end if;
  end if;

  select coalesce(max(version), 1) into v_formula_version from public.rating_formula_versions;

  insert into public.rounds (session_id, community_id, round_number, status)
  values (p_session_id, v_community_id, p_round_number, 'ACTIVE')
  returning id into v_round_id;

  for v_match in select * from jsonb_array_elements(p_matches) loop
    v_court_num := (v_match->>'courtNumber')::int;

    v_team_a := array(select jsonb_array_elements_text(v_match->'teamA')::uuid);
    v_team_b := array(select jsonb_array_elements_text(v_match->'teamB')::uuid);

    insert into public.matches (session_id, round_id, community_id, round_number, court_number, status, formula_version)
    values (p_session_id, v_round_id, v_community_id, p_round_number, v_court_num, 'IN_PROGRESS', v_formula_version)
    returning id into v_match_id;

    for v_idx in 1..array_length(v_team_a, 1) loop
      v_player_id := v_team_a[v_idx];

      select elo_rating into v_elo
      from public.player_rankings
      where community_id = v_community_id
        and profile_id = v_player_id
        and sport = (select sport from public.sessions where id = p_session_id);

      if not found then
        v_elo := 1000.00;
      end if;

      insert into public.match_players (match_id, session_id, community_id, profile_id, team, slot, elo_before)
      values (v_match_id, p_session_id, v_community_id, v_player_id, 'A', v_idx, v_elo);

      update public.session_players
      set matches_played = matches_played + 1
      where session_id = p_session_id and profile_id = v_player_id;
    end loop;

    for v_idx in 1..array_length(v_team_b, 1) loop
      v_player_id := v_team_b[v_idx];

      select elo_rating into v_elo
      from public.player_rankings
      where community_id = v_community_id
        and profile_id = v_player_id
        and sport = (select sport from public.sessions where id = p_session_id);

      if not found then
        v_elo := 1000.00;
      end if;

      insert into public.match_players (match_id, session_id, community_id, profile_id, team, slot, elo_before)
      values (v_match_id, p_session_id, v_community_id, v_player_id, 'B', v_idx, v_elo);

      update public.session_players
      set matches_played = matches_played + 1
      where session_id = p_session_id and profile_id = v_player_id;
    end loop;
  end loop;

  if p_sit_outs is not null then
    foreach v_player_id in array p_sit_outs loop
      update public.session_players
      set sit_out_count = sit_out_count + 1,
          last_sit_out_round = p_round_number
      where session_id = p_session_id and profile_id = v_player_id;
    end loop;
  end if;

  return v_round_id;
end;
$$;

-- ─────────────── 4. submit_match_score: effective team rating + Carry Rule split ───────────────
create or replace function public.submit_match_score(
  p_match_id uuid,
  p_score_a int,
  p_score_b int
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session_id uuid;
  v_community_id uuid;
  v_sport sport_type;
  v_scoring_type scoring_type;
  v_points_mode points_mode;
  v_max_score_target int;
  v_rounds_planned int;
  v_court_count int;
  v_match_type match_type;
  v_status match_status;
  v_elo_applied boolean;
  v_formula_version int;

  v_profile_id uuid;
  v_attendee_count int;
  v_players_per_match int;
  v_playing_slots int;
  v_expected_matches int;
  v_format_damping numeric;

  v_avg_elo_a numeric;
  v_avg_elo_b numeric;
  v_internal_gap_a numeric;
  v_internal_gap_b numeric;
  v_eff_elo_a numeric;
  v_eff_elo_b numeric;
  v_expected_a numeric;
  v_w_a numeric;
  v_margin int;
  v_denom int;
  v_m numeric;
  v_mov numeric;

  v_k_factor_avg numeric;
  v_delta numeric;
  v_team_a_deltas numeric[];
  v_team_b_deltas numeric[];

  v_player_id uuid;
  v_player_elo_before numeric;
  v_is_prov boolean;
  v_player_k numeric;
  v_matches_played_prev int;
  v_player_delta numeric;
  v_player_elo_after numeric;

  v_players_a uuid[] := '{}';
  v_players_b uuid[] := '{}';
  v_all_players uuid[] := '{}';
  v_team_a_elos numeric[];
  v_team_b_elos numeric[];
  v_player_ks numeric[] := '{}';
  v_idx int;

  v_outcome_a text;
  v_outcome_b text;

  v_wins_a int := 0;
  v_losses_a int := 0;
  v_draws_a int := 0;
  v_wins_b int := 0;
  v_losses_b int := 0;
  v_draws_b int := 0;
begin
  v_profile_id := public.current_profile_id();
  if v_profile_id is null then
    raise exception 'Authentication required to submit scores' using errcode = '42501';
  end if;

  select session_id, community_id, status, elo_applied, formula_version
  into v_session_id, v_community_id, v_status, v_elo_applied, v_formula_version
  from public.matches
  where id = p_match_id
  for update;

  if not found then
    raise exception 'Match not found' using errcode = 'P0002';
  end if;

  if not public.is_community_host(v_community_id) and not public.is_platform_admin() then
    raise exception 'Only a community host or admin can submit scores' using errcode = '42501';
  end if;

  -- Idempotency guard — also doubles as "someone else already scored this match" detection:
  -- the caller gets `false` back instead of silently no-oping with no way to tell the two
  -- cases apart.
  if v_elo_applied then
    return false;
  end if;

  if p_score_a < 0 or p_score_b < 0 then
    raise exception 'Scores cannot be negative' using errcode = '22003';
  end if;

  select sport, scoring_type, points_mode, max_score_target, court_count, rounds_planned, match_type
  into v_sport, v_scoring_type, v_points_mode, v_max_score_target, v_court_count, v_rounds_planned, v_match_type
  from public.sessions
  where id = v_session_id;

  select count(*) into v_attendee_count
  from public.session_players
  where session_id = v_session_id and status = 'ACTIVE';

  if v_sport = 'TENNIS' and v_match_type = 'SINGLES' then
    v_players_per_match := 2;
  else
    v_players_per_match := 4;
  end if;

  v_playing_slots := least(floor(v_attendee_count::numeric / v_players_per_match), v_court_count) * v_players_per_match;
  if v_rounds_planned is not null then
    v_expected_matches := floor(v_rounds_planned * (v_playing_slots::numeric / greatest(v_attendee_count, 1)));
  else
    v_expected_matches := floor((v_court_count * v_players_per_match::numeric / greatest(v_attendee_count, 1)) * 8);
  end if;
  v_expected_matches := greatest(v_expected_matches, 1);
  v_format_damping := 1.0 / sqrt(v_expected_matches);

  v_players_a := array(
    select profile_id from public.match_players where match_id = p_match_id and team = 'A' order by slot
  );
  v_players_b := array(
    select profile_id from public.match_players where match_id = p_match_id and team = 'B' order by slot
  );
  v_all_players := v_players_a || v_players_b;

  select array_agg(elo_before order by slot) into v_team_a_elos
  from public.match_players where match_id = p_match_id and team = 'A';
  select array_agg(elo_before order by slot) into v_team_b_elos
  from public.match_players where match_id = p_match_id and team = 'B';

  select avg(x) into v_avg_elo_a from unnest(v_team_a_elos) x;
  select avg(x) into v_avg_elo_b from unnest(v_team_b_elos) x;

  -- Effective Team Rating (formula_version >= 2 only) — a team with a big internal Elo gap is
  -- scored as weaker than its raw average implies, since opponents can specifically target the
  -- weaker partner. Formula_version 1 matches (and any historical match, even replayed later)
  -- always use the raw average, unchanged.
  if v_formula_version >= 2 then
    v_internal_gap_a := case when array_length(v_team_a_elos, 1) = 2 then abs(v_team_a_elos[1] - v_team_a_elos[2]) else 0 end;
    v_internal_gap_b := case when array_length(v_team_b_elos, 1) = 2 then abs(v_team_b_elos[1] - v_team_b_elos[2]) else 0 end;
    v_eff_elo_a := v_avg_elo_a - 0.25 * v_internal_gap_a;
    v_eff_elo_b := v_avg_elo_b - 0.25 * v_internal_gap_b;
  else
    v_eff_elo_a := v_avg_elo_a;
    v_eff_elo_b := v_avg_elo_b;
  end if;

  v_expected_a := 1.0 / (1.0 + power(10.0, (v_eff_elo_b - v_eff_elo_a) / 400.0));

  if p_score_a > p_score_b then
    v_w_a := 1.0;
    v_outcome_a := 'WIN';
    v_outcome_b := 'LOSS';
    v_wins_a := 1;
    v_losses_b := 1;
  elsif p_score_b > p_score_a then
    v_w_a := 0.0;
    v_outcome_a := 'LOSS';
    v_outcome_b := 'WIN';
    v_losses_a := 1;
    v_wins_b := 1;
  else
    v_w_a := 0.5;
    v_outcome_a := 'DRAW';
    v_outcome_b := 'DRAW';
    v_draws_a := 1;
    v_draws_b := 1;
  end if;

  v_margin := abs(p_score_a - p_score_b);
  v_denom := v_max_score_target;
  if v_scoring_type = 'POINTS' and v_points_mode = 'TIMED' then
    v_denom := greatest(p_score_a + p_score_b, 1);
  end if;
  if v_denom <= 0 then
    v_denom := 1;
  end if;
  v_m := least(greatest(v_margin::numeric / v_denom, 0.0), 1.0);
  v_mov := 1.0 + 0.5 * v_m;

  for v_idx in 1..array_length(v_all_players, 1) loop
    v_player_id := v_all_players[v_idx];

    select total_matches into v_matches_played_prev
    from public.player_rankings
    where community_id = v_community_id and profile_id = v_player_id and sport = v_sport;

    if not found then
      v_matches_played_prev := 0;
    end if;

    v_is_prov := (v_matches_played_prev < 10);
    if v_is_prov then
      v_player_k := 48.00 * v_format_damping;
    else
      v_player_k := 24.00 * v_format_damping;
    end if;

    v_player_ks := v_player_ks || v_player_k;
  end loop;

  select avg(val) into v_k_factor_avg
  from unnest(v_player_ks) as val;

  v_delta := round(v_k_factor_avg * v_mov * (v_w_a - v_expected_a), 2);

  -- Carry Rule (formula_version >= 2): split each team's delta between partners by their own
  -- internal Elo gap instead of giving both the identical flat value. v1 (and singles) return
  -- the same value for every player, unchanged from before.
  v_team_a_deltas := public.split_team_delta(v_team_a_elos, v_delta, (v_w_a = 1.0), v_formula_version);
  v_team_b_deltas := public.split_team_delta(v_team_b_elos, -v_delta, (v_w_a = 0.0), v_formula_version);

  for v_idx in 1..array_length(v_players_a, 1) loop
    v_player_id := v_players_a[v_idx];
    select elo_before into v_player_elo_before
    from public.match_players
    where match_id = p_match_id and profile_id = v_player_id;

    v_player_delta := v_team_a_deltas[v_idx];
    v_player_elo_after := greatest(v_player_elo_before + v_player_delta, 100.00);

    update public.match_players
    set elo_delta = v_player_delta,
        elo_after = v_player_elo_after,
        k_factor = v_player_ks[v_idx]
    where match_id = p_match_id and profile_id = v_player_id;

    insert into public.player_rankings (
      community_id, profile_id, sport, elo_rating, elo_peak,
      total_matches, total_wins, total_losses, total_draws,
      points_for, points_against, last_played_at
    )
    values (
      v_community_id, v_player_id, v_sport, v_player_elo_after, v_player_elo_after,
      1, v_wins_a, v_losses_a, v_draws_a,
      p_score_a, p_score_b, now()
    )
    on conflict (community_id, profile_id, sport) do update
    set elo_rating = excluded.elo_rating,
        elo_peak = greatest(player_rankings.elo_peak, excluded.elo_rating),
        total_matches = player_rankings.total_matches + 1,
        total_wins = player_rankings.total_wins + v_wins_a,
        total_losses = player_rankings.total_losses + v_losses_a,
        total_draws = player_rankings.total_draws + v_draws_a,
        points_for = player_rankings.points_for + p_score_a,
        points_against = player_rankings.points_against + p_score_b,
        last_played_at = now();

    update public.session_players
    set session_points_for = session_points_for + p_score_a,
        session_points_against = session_points_against + p_score_b,
        session_wins = session_wins + v_wins_a,
        session_losses = session_losses + v_losses_a,
        session_draws = session_draws + v_draws_a
    where session_id = v_session_id and profile_id = v_player_id;
  end loop;

  for v_idx in 1..array_length(v_players_b, 1) loop
    v_player_id := v_players_b[v_idx];
    select elo_before into v_player_elo_before
    from public.match_players
    where match_id = p_match_id and profile_id = v_player_id;

    v_player_delta := v_team_b_deltas[v_idx];
    v_player_elo_after := greatest(v_player_elo_before + v_player_delta, 100.00);

    update public.match_players
    set elo_delta = v_player_delta,
        elo_after = v_player_elo_after,
        k_factor = v_player_ks[array_length(v_players_a, 1) + v_idx]
    where match_id = p_match_id and profile_id = v_player_id;

    insert into public.player_rankings (
      community_id, profile_id, sport, elo_rating, elo_peak,
      total_matches, total_wins, total_losses, total_draws,
      points_for, points_against, last_played_at
    )
    values (
      v_community_id, v_player_id, v_sport, v_player_elo_after, v_player_elo_after,
      1, v_wins_b, v_losses_b, v_draws_b,
      p_score_b, p_score_a, now()
    )
    on conflict (community_id, profile_id, sport) do update
    set elo_rating = excluded.elo_rating,
        elo_peak = greatest(player_rankings.elo_peak, excluded.elo_rating),
        total_matches = player_rankings.total_matches + 1,
        total_wins = player_rankings.total_wins + v_wins_b,
        total_losses = player_rankings.total_losses + v_losses_b,
        total_draws = player_rankings.total_draws + v_draws_b,
        points_for = player_rankings.points_for + p_score_b,
        points_against = player_rankings.points_against + p_score_a,
        last_played_at = now();

    update public.session_players
    set session_points_for = session_points_for + p_score_b,
        session_points_against = session_points_against + p_score_a,
        session_wins = session_wins + v_wins_b,
        session_losses = session_losses + v_losses_b,
        session_draws = session_draws + v_draws_b
    where session_id = v_session_id and profile_id = v_player_id;
  end loop;

  update public.matches
  set team_a_score = p_score_a,
      team_b_score = p_score_b,
      winner_side = case when p_score_a > p_score_b then 'A'::team_side when p_score_b > p_score_a then 'B'::team_side else null end,
      is_draw = (p_score_a = p_score_b),
      status = 'COMPLETED',
      elo_applied = true,
      completed_at = now(),
      submitted_at = now(),
      submitted_by = v_profile_id
  where id = p_match_id;

  return true;
end;
$$;

-- ─────────────── 5. replay_ratings: effective team rating + Carry Rule, per-match formula_version ───────────────
-- Also fixes a pre-existing bug found while adding this: the loop filtered on "m.sport" but
-- matches has no sport column at all (sport lives on sessions) — every call to this function
-- (and therefore void_match / amend_match_score, which both call it) has been failing with
-- "column sport does not exist" since 0011 first shipped it, unrelated to formula_version.
create or replace function public.replay_ratings(
  p_community_id uuid,
  p_sport sport_type
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match record;
  v_session_id uuid;
  v_match_type match_type;
  v_scoring_type scoring_type;
  v_points_mode points_mode;
  v_max_score_target int;
  v_rounds_planned int;
  v_court_count int;

  v_attendee_count int;
  v_players_per_match int;
  v_playing_slots int;
  v_expected_matches int;
  v_format_damping numeric;

  v_avg_elo_a numeric;
  v_avg_elo_b numeric;
  v_internal_gap_a numeric;
  v_internal_gap_b numeric;
  v_eff_elo_a numeric;
  v_eff_elo_b numeric;
  v_expected_a numeric;
  v_w_a numeric;
  v_margin int;
  v_denom int;
  v_m numeric;
  v_mov numeric;
  v_k_factor_avg numeric;
  v_delta numeric;
  v_team_a_deltas numeric[];
  v_team_b_deltas numeric[];

  v_player_id uuid;
  v_player_elo_before numeric;
  v_is_prov boolean;
  v_player_k numeric;
  v_matches_played_prev int;
  v_player_delta numeric;
  v_player_elo_after numeric;

  v_players_a uuid[];
  v_players_b uuid[];
  v_all_players uuid[];
  v_team_a_elos numeric[];
  v_team_b_elos numeric[];
  v_player_ks numeric[];
  v_idx int;

  v_wins_a int;
  v_losses_a int;
  v_draws_a int;
  v_wins_b int;
  v_losses_b int;
  v_draws_b int;
begin
  -- Lock community/sport row to serialize recalculations
  perform pg_advisory_xact_lock(hashtext(p_community_id::text), hashtext(p_sport::text));

  -- Reset player rankings for the community and sport
  update public.player_rankings
  set elo_rating = 1000.00,
      elo_peak = 1000.00,
      total_matches = 0,
      total_wins = 0,
      total_losses = 0,
      total_draws = 0,
      points_for = 0,
      points_against = 0
  where community_id = p_community_id and sport = p_sport;

  -- Reset session players aggregates for affected sessions
  update public.session_players sp
  set session_points_for = 0,
      session_points_against = 0,
      session_wins = 0,
      session_losses = 0,
      session_draws = 0
  from public.sessions s
  where sp.session_id = s.id
    and s.community_id = p_community_id
    and s.sport = p_sport;

  -- Query all COMPLETED matches in chronological order of completion. Joins sessions for sport
  -- (matches itself has no sport column — this join is the fix for the bug noted above).
  for v_match in
    select m.id, m.session_id, m.team_a_score, m.team_b_score, m.formula_version
    from public.matches m
    join public.sessions s on s.id = m.session_id
    where m.community_id = p_community_id
      and s.sport = p_sport
      and m.status = 'COMPLETED'
    order by m.completed_at asc, m.id asc
  loop
    v_session_id := v_match.session_id;

    -- Fetch session details
    select scoring_type, points_mode, max_score_target, court_count, rounds_planned, match_type
    into v_scoring_type, v_points_mode, v_max_score_target, v_court_count, v_rounds_planned, v_match_type
    from public.sessions
    where id = v_session_id;

    -- Attendee count for dynamic K-damping
    select count(*) into v_attendee_count
    from public.session_players
    where session_id = v_session_id and status = 'ACTIVE';

    if p_sport = 'TENNIS' and v_match_type = 'SINGLES' then
      v_players_per_match := 2;
    else
      v_players_per_match := 4;
    end if;

    v_playing_slots := least(floor(v_attendee_count::numeric / v_players_per_match), v_court_count) * v_players_per_match;
    if v_rounds_planned is not null then
      v_expected_matches := floor(v_rounds_planned * (v_playing_slots::numeric / greatest(v_attendee_count, 1)));
    else
      v_expected_matches := floor((v_court_count * v_players_per_match::numeric / greatest(v_attendee_count, 1)) * 8);
    end if;
    v_expected_matches := greatest(v_expected_matches, 1);
    v_format_damping := 1.0 / sqrt(v_expected_matches);

    -- Load player arrays
    v_players_a := array(
      select profile_id from public.match_players where match_id = v_match.id and team = 'A' order by slot
    );
    v_players_b := array(
      select profile_id from public.match_players where match_id = v_match.id and team = 'B' order by slot
    );
    v_all_players := v_players_a || v_players_b;

    v_player_ks := '{}';
    v_team_a_elos := '{}';
    v_team_b_elos := '{}';

    -- Update elo_before in match_players table using the current state in player_rankings
    for v_idx in 1..array_length(v_players_a, 1) loop
      v_player_id := v_players_a[v_idx];

      select elo_rating, total_matches into v_player_elo_before, v_matches_played_prev
      from public.player_rankings
      where community_id = p_community_id and profile_id = v_player_id and sport = p_sport;

      if not found then
        v_player_elo_before := 1000.00;
        v_matches_played_prev := 0;
      end if;

      v_team_a_elos := v_team_a_elos || v_player_elo_before;

      -- Update elo_before row
      update public.match_players
      set elo_before = v_player_elo_before
      where match_id = v_match.id and profile_id = v_player_id;

      v_is_prov := (v_matches_played_prev < 10);
      if v_is_prov then
        v_player_k := 48.00 * v_format_damping;
      else
        v_player_k := 24.00 * v_format_damping;
      end if;
      v_player_ks := v_player_ks || v_player_k;
    end loop;

    select avg(x) into v_avg_elo_a from unnest(v_team_a_elos) x;

    for v_idx in 1..array_length(v_players_b, 1) loop
      v_player_id := v_players_b[v_idx];

      select elo_rating, total_matches into v_player_elo_before, v_matches_played_prev
      from public.player_rankings
      where community_id = p_community_id and profile_id = v_player_id and sport = p_sport;

      if not found then
        v_player_elo_before := 1000.00;
        v_matches_played_prev := 0;
      end if;

      v_team_b_elos := v_team_b_elos || v_player_elo_before;

      -- Update elo_before row
      update public.match_players
      set elo_before = v_player_elo_before
      where match_id = v_match.id and profile_id = v_player_id;

      v_is_prov := (v_matches_played_prev < 10);
      if v_is_prov then
        v_player_k := 48.00 * v_format_damping;
      else
        v_player_k := 24.00 * v_format_damping;
      end if;
      v_player_ks := v_player_ks || v_player_k;
    end loop;

    select avg(x) into v_avg_elo_b from unnest(v_team_b_elos) x;

    -- Effective Team Rating — gated on THIS match's own formula_version, not the currently
    -- active one, so a match originally played under v1 replays under v1 forever.
    if v_match.formula_version >= 2 then
      v_internal_gap_a := case when array_length(v_team_a_elos, 1) = 2 then abs(v_team_a_elos[1] - v_team_a_elos[2]) else 0 end;
      v_internal_gap_b := case when array_length(v_team_b_elos, 1) = 2 then abs(v_team_b_elos[1] - v_team_b_elos[2]) else 0 end;
      v_eff_elo_a := v_avg_elo_a - 0.25 * v_internal_gap_a;
      v_eff_elo_b := v_avg_elo_b - 0.25 * v_internal_gap_b;
    else
      v_eff_elo_a := v_avg_elo_a;
      v_eff_elo_b := v_avg_elo_b;
    end if;

    -- Expected score E_A
    v_expected_a := 1.0 / (1.0 + power(10.0, (v_eff_elo_b - v_eff_elo_a) / 400.0));

    -- Outcome
    v_wins_a := 0; v_losses_a := 0; v_draws_a := 0;
    v_wins_b := 0; v_losses_b := 0; v_draws_b := 0;

    if v_match.team_a_score > v_match.team_b_score then
      v_w_a := 1.0;
      v_wins_a := 1;
      v_losses_b := 1;
    elsif v_match.team_b_score > v_match.team_a_score then
      v_w_a := 0.0;
      v_losses_a := 1;
      v_wins_b := 1;
    else
      v_w_a := 0.5;
      v_draws_a := 1;
      v_draws_b := 1;
    end if;

    -- MoV
    v_margin := abs(v_match.team_a_score - v_match.team_b_score);
    v_denom := v_max_score_target;
    if v_scoring_type = 'POINTS' and v_points_mode = 'TIMED' then
      v_denom := greatest(v_match.team_a_score + v_match.team_b_score, 1);
    end if;
    if v_denom <= 0 then v_denom := 1; end if;
    v_m := least(greatest(v_margin::numeric / v_denom, 0.0), 1.0);
    v_mov := 1.0 + 0.5 * v_m;

    -- Average K-factor
    select avg(val) into v_k_factor_avg
    from unnest(v_player_ks) as val;

    v_delta := round(v_k_factor_avg * v_mov * (v_w_a - v_expected_a), 2);

    v_team_a_deltas := public.split_team_delta(v_team_a_elos, v_delta, (v_w_a = 1.0), v_match.formula_version);
    v_team_b_deltas := public.split_team_delta(v_team_b_elos, -v_delta, (v_w_a = 0.0), v_match.formula_version);

    -- Team A updates
    for v_idx in 1..array_length(v_players_a, 1) loop
      v_player_id := v_players_a[v_idx];
      select elo_before into v_player_elo_before
      from public.match_players
      where match_id = v_match.id and profile_id = v_player_id;

      v_player_delta := v_team_a_deltas[v_idx];
      v_player_elo_after := greatest(v_player_elo_before + v_player_delta, 100.00);

      update public.match_players
      set elo_delta = v_player_delta,
          elo_after = v_player_elo_after,
          k_factor = v_player_ks[v_idx]
      where match_id = v_match.id and profile_id = v_player_id;

      -- Update rankings
      insert into public.player_rankings (
        community_id, profile_id, sport, elo_rating, elo_peak,
        total_matches, total_wins, total_losses, total_draws,
        points_for, points_against, last_played_at
      )
      values (
        p_community_id, v_player_id, p_sport, v_player_elo_after, v_player_elo_after,
        1, v_wins_a, v_losses_a, v_draws_a,
        v_match.team_a_score, v_match.team_b_score, now()
      )
      on conflict (community_id, profile_id, sport) do update
      set elo_rating = excluded.elo_rating,
          elo_peak = greatest(player_rankings.elo_peak, excluded.elo_rating),
          total_matches = player_rankings.total_matches + 1,
          total_wins = player_rankings.total_wins + v_wins_a,
          total_losses = player_rankings.total_losses + v_losses_a,
          total_draws = player_rankings.total_draws + v_draws_a,
          points_for = player_rankings.points_for + v_match.team_a_score,
          points_against = player_rankings.points_against + v_match.team_b_score,
          last_played_at = now();

      -- Update session stats
      update public.session_players
      set session_points_for = session_points_for + v_match.team_a_score,
          session_points_against = session_points_against + v_match.team_b_score,
          session_wins = session_wins + v_wins_a,
          session_losses = session_losses + v_losses_a,
          session_draws = session_draws + v_draws_a
      where session_id = v_session_id and profile_id = v_player_id;
    end loop;

    -- Team B updates
    for v_idx in 1..array_length(v_players_b, 1) loop
      v_player_id := v_players_b[v_idx];
      select elo_before into v_player_elo_before
      from public.match_players
      where match_id = v_match.id and profile_id = v_player_id;

      v_player_delta := v_team_b_deltas[v_idx];
      v_player_elo_after := greatest(v_player_elo_before + v_player_delta, 100.00);

      update public.match_players
      set elo_delta = v_player_delta,
          elo_after = v_player_elo_after,
          k_factor = v_player_ks[array_length(v_players_a, 1) + v_idx]
      where match_id = v_match.id and profile_id = v_player_id;

      -- Update rankings
      insert into public.player_rankings (
        community_id, profile_id, sport, elo_rating, elo_peak,
        total_matches, total_wins, total_losses, total_draws,
        points_for, points_against, last_played_at
      )
      values (
        p_community_id, v_player_id, p_sport, v_player_elo_after, v_player_elo_after,
        1, v_wins_b, v_losses_b, v_draws_b,
        v_match.team_b_score, v_match.team_a_score, now()
      )
      on conflict (community_id, profile_id, sport) do update
      set elo_rating = excluded.elo_rating,
          elo_peak = greatest(player_rankings.elo_peak, excluded.elo_rating),
          total_matches = player_rankings.total_matches + 1,
          total_wins = player_rankings.total_wins + v_wins_b,
          total_losses = player_rankings.total_losses + v_losses_b,
          total_draws = player_rankings.total_draws + v_draws_b,
          points_for = player_rankings.points_for + v_match.team_b_score,
          points_against = player_rankings.points_against + v_match.team_a_score,
          last_played_at = now();

      -- Update session stats
      update public.session_players
      set session_points_for = session_points_for + v_match.team_b_score,
          session_points_against = session_points_against + v_match.team_a_score,
          session_wins = session_wins + v_wins_b,
          session_losses = session_losses + v_losses_b,
          session_draws = session_draws + v_draws_b
      where session_id = v_session_id and profile_id = v_player_id;
    end loop;

    -- Update matches row to ensure elo_applied is synced
    update public.matches
    set elo_applied = true
    where id = v_match.id;

  end loop;
end;
$$;
