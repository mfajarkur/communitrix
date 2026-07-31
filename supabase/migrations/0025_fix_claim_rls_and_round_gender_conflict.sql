-- Migration 0025: four more fixes from the community-feature audit.
--
-- 1. guest_claim_requests SELECT policy was `using (true)` — any authenticated user could
--    read every claim request across every community. Replaced with: the requester can see
--    their own request, and a host/admin (or platform admin) can see requests for a
--    community they administer.
--
-- 2. persist_round only guarded against re-creating the same round number — a host could
--    generate round N+1 while round N still had unscored matches (bypassable via the
--    disabled-button-only client check, worse for Mexicano's standings-driven pairing).
--    Now blocks generating round N unless round N-1's matches are all COMPLETED or VOIDED.
--
-- 3. add_guest_player's gender is set via a separate `profiles` UPDATE from the Next.js layer,
--    gated by an RLS policy that only allows ADMIN (not HOST) — so a HOST adding a guest with
--    a gender selected had it silently dropped. Gender is now set directly inside
--    add_guest_player (security definer, same transaction as profile creation), removing the
--    RLS mismatch entirely.
--
-- 4. submit_match_score's idempotency guard (`if v_elo_applied then return; end if;`) silently
--    no-ops a second host's *different* score for an already-scored match, and the caller had
--    no way to distinguish "just applied" from "someone beat you to it". Now returns boolean:
--    true if this call actually applied the score, false if it was already scored.

-- ─────────────── guest_claim_requests RLS ───────────────
drop policy if exists "Authenticated users can view claim requests" on public.guest_claim_requests;

create policy "guest_claim_requests_select_own_or_admin"
  on public.guest_claim_requests for select to authenticated
  using (
    requester_profile_id = public.current_profile_id()
    or exists (
      select 1 from public.community_members cm
      where cm.community_id = guest_claim_requests.community_id
        and cm.profile_id = public.current_profile_id()
        and cm.role::text in ('ADMIN', 'HOST')
        and cm.is_active
    )
    or public.is_platform_admin()
  );

-- ─────────────── persist_round: block generating a round before the previous one is scored ───────────────
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

  insert into public.rounds (session_id, community_id, round_number, status)
  values (p_session_id, v_community_id, p_round_number, 'ACTIVE')
  returning id into v_round_id;

  for v_match in select * from jsonb_array_elements(p_matches) loop
    v_court_num := (v_match->>'courtNumber')::int;

    v_team_a := array(select jsonb_array_elements_text(v_match->'teamA')::uuid);
    v_team_b := array(select jsonb_array_elements_text(v_match->'teamB')::uuid);

    insert into public.matches (session_id, round_id, community_id, round_number, court_number, status)
    values (p_session_id, v_round_id, v_community_id, p_round_number, v_court_num, 'IN_PROGRESS')
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

-- ─────────────── add_guest_player: accept gender directly, no more RLS-gated follow-up update ───────────────
create or replace function public.add_guest_player(
  p_community_id uuid,
  p_full_name text,
  p_gender text default null
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_profile_id uuid;
  v_guest_profile public.profiles;
begin
  v_caller_profile_id := public.current_profile_id();
  if v_caller_profile_id is null then
    raise exception 'Authentication required to add guest' using errcode = '42501';
  end if;

  if not public.is_community_host(p_community_id) and not public.is_platform_admin() then
    raise exception 'Only hosts and admins can add guest players' using errcode = '42501';
  end if;

  if p_gender is not null and p_gender not in ('MALE', 'FEMALE') then
    raise exception 'Gender must be MALE or FEMALE' using errcode = '22023';
  end if;

  insert into public.profiles (full_name, gender)
  values (p_full_name, p_gender)
  returning * into v_guest_profile;

  insert into public.community_members (community_id, profile_id, role, is_active)
  values (p_community_id, v_guest_profile.id, 'MEMBER', true);

  return v_guest_profile;
end;
$$;

-- ─────────────── submit_match_score: return whether this call actually applied the score ───────────────
-- Postgres won't let CREATE OR REPLACE change a function's return type (void -> boolean here),
-- so the old signature has to be dropped first.
drop function if exists public.submit_match_score(uuid, int, int);

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

  v_profile_id uuid;
  v_attendee_count int;
  v_players_per_match int;
  v_playing_slots int;
  v_expected_matches int;
  v_format_damping numeric;

  v_avg_elo_a numeric;
  v_avg_elo_b numeric;
  v_expected_a numeric;
  v_w_a numeric;
  v_margin int;
  v_denom int;
  v_m numeric;
  v_mov numeric;

  v_k_factor_avg numeric;
  v_delta numeric;

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

  select session_id, community_id, status, elo_applied
  into v_session_id, v_community_id, v_status, v_elo_applied
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

  select avg(elo_before) into v_avg_elo_a
  from public.match_players
  where match_id = p_match_id and team = 'A';

  select avg(elo_before) into v_avg_elo_b
  from public.match_players
  where match_id = p_match_id and team = 'B';

  v_expected_a := 1.0 / (1.0 + power(10.0, (v_avg_elo_b - v_avg_elo_a) / 400.0));

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

  for v_idx in 1..array_length(v_players_a, 1) loop
    v_player_id := v_players_a[v_idx];
    select elo_before into v_player_elo_before
    from public.match_players
    where match_id = p_match_id and profile_id = v_player_id;

    v_player_delta := v_delta;
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

    v_player_delta := -v_delta;
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
