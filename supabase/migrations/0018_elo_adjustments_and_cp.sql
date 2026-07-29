-- Migration 0018: Elo & Skill Rating Adjustments, Community Points (CP) Engine, and Host RLS Fix

-- ─────────────── 1. Rating Formula Versions ───────────────
alter table public.matches
  add column if not exists formula_version int not null default 1;

create table if not exists public.rating_formula_versions (
  version int primary key,
  description text not null,
  carry_rule_enabled boolean not null default false,
  new_vs_new_dampening_enabled boolean not null default false,
  activated_at timestamptz not null default now()
);

insert into public.rating_formula_versions (version, description, carry_rule_enabled, new_vs_new_dampening_enabled)
values (1, 'Original formula: flat split within team, no opponent-based dampening', false, false)
on conflict (version) do nothing;

-- ─────────────── 2. Skill Rating & Review Flag Columns ───────────────
alter table public.player_rankings
  add column if not exists skill_rating_official numeric(4,2) not null default 1.00,
  add column if not exists skill_rating_set_by_admin_id uuid references public.profiles(id),
  add column if not exists skill_rating_assessed_at timestamptz,
  add column if not exists elo_at_last_assessment numeric(7,2),
  add column if not exists review_flagged boolean not null default false,
  add column if not exists review_flagged_at timestamptz,
  add column if not exists external_proof_url text;

create table if not exists public.carry_pattern_tracking (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  community_id uuid not null references public.communities(id) on delete cascade,
  sport sport_type not null,
  extreme_gap_matches_played int not null default 0,
  extreme_gap_wins int not null default 0,
  expected_wins_sum numeric(6,3) not null default 0,
  primary key (profile_id, community_id, sport)
);

-- ─────────────── 3. Community Points (CP) Tables & Helper ───────────────
alter table public.communities
  add column if not exists cp_reset_policy text not null default 'never'
    check (cp_reset_policy in ('never', 'seasonal'));

create table if not exists public.community_point_seasons (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  is_active boolean not null default true
);

create table if not exists public.community_points (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  session_id uuid not null references public.sessions(id) on delete cascade,
  season_id uuid references public.community_point_seasons(id) on delete cascade,
  points_awarded numeric(8,2) not null,
  session_rank int not null,
  session_size int not null,
  awarded_at timestamptz not null default now()
);

-- CP payout calculation function (podium + cliff at N=10 + linear decay)
create or replace function public.calculate_cp_points(
  p_rank int,
  p_attendee_count int
)
returns numeric
language plpgsql
immutable
as $$
declare
  v_field_pos int;
  v_field_size int;
  v_decay_frac numeric;
begin
  if p_attendee_count >= 10 then
    if p_rank = 1 then return 100.0;
    elsif p_rank = 2 then return 75.0;
    elsif p_rank = 3 then return 50.0;
    elsif p_rank = 4 then return 20.0;
    else
      v_field_pos := p_rank - 5;
      v_field_size := greatest(p_attendee_count - 5, 1);
      v_decay_frac := v_field_pos::numeric / v_field_size::numeric;
      return round(20.0 - (12.0 * v_decay_frac), 2);
    end if;
  else
    if p_rank = 1 then return 75.0;
    elsif p_rank = 2 then return 50.0;
    elsif p_rank = 3 then return 25.0;
    else return 10.0;
    end if;
  end if;
end;
$$;

-- RPC to start a new CP season (Admin only)
create or replace function public.start_new_cp_season(p_community_id uuid)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_caller uuid := public.current_profile_id();
  v_caller_role member_role;
  v_new_season_id uuid;
begin
  if v_caller is null then
    raise exception 'UNAUTHENTICATED' using errcode = '42501';
  end if;

  select role into v_caller_role from public.community_members
  where community_id = p_community_id and profile_id = v_caller and is_active;

  if v_caller_role is distinct from 'ADMIN' then
    raise exception 'UNAUTHORIZED'
      using message = 'Only community ADMIN can start a new CP season', errcode = '42501';
  end if;

  update public.community_point_seasons
    set is_active = false, ends_at = now()
  where community_id = p_community_id and is_active = true;

  insert into public.community_point_seasons (community_id, starts_at, is_active)
  values (p_community_id, now(), true)
  returning id into v_new_season_id;

  return v_new_season_id;
end;
$$;

-- ─────────────── 4. Shared Match Delta Calculation ───────────────
drop type if exists public.match_delta_result cascade;
create type public.match_delta_result as (
  delta numeric,
  expected_a numeric,
  mov numeric,
  k_factor_avg numeric,
  player_ks numeric[]
);

create or replace function public.calculate_match_delta(
  p_avg_elo_a numeric,
  p_avg_elo_b numeric,
  p_score_a int,
  p_score_b int,
  p_scoring_type scoring_type,
  p_points_mode points_mode,
  p_max_score_target int,
  p_all_players_matches_played int[],
  p_format_damping numeric,
  p_formula_version int default 1,
  p_team_a_elos numeric[] default '{}',
  p_team_b_elos numeric[] default '{}'
)
returns public.match_delta_result
language plpgsql
immutable
as $$
declare
  v_internal_gap_a numeric := 0;
  v_internal_gap_b numeric := 0;
  v_eff_elo_a numeric;
  v_eff_elo_b numeric;
  v_expected_a numeric;
  v_w_a numeric;
  v_margin int;
  v_denom int;
  v_m numeric;
  v_mov numeric;
  v_player_ks numeric[] := '{}';
  v_k numeric;
  v_matches_played int;
  v_k_avg numeric;
  v_delta numeric;
begin
  -- Patch 9: Effective Team Rating calculation (GAP_PENALTY_FRACTION = 0.25)
  if array_length(p_team_a_elos, 1) = 2 then
    v_internal_gap_a := abs(p_team_a_elos[1] - p_team_a_elos[2]);
  end if;
  v_eff_elo_a := p_avg_elo_a - (0.25 * v_internal_gap_a);

  if array_length(p_team_b_elos, 1) = 2 then
    v_internal_gap_b := abs(p_team_b_elos[1] - p_team_b_elos[2]);
  end if;
  v_eff_elo_b := p_avg_elo_b - (0.25 * v_internal_gap_b);

  v_expected_a := 1.0 / (1.0 + power(10.0, (v_eff_elo_b - v_eff_elo_a) / 400.0));

  if p_score_a > p_score_b then
    v_w_a := 1.0;
  elsif p_score_b > p_score_a then
    v_w_a := 0.0;
  else
    v_w_a := 0.5;
  end if;

  v_margin := abs(p_score_a - p_score_b);
  v_denom := p_max_score_target;
  if p_scoring_type = 'POINTS' and p_points_mode = 'TIMED' then
    v_denom := greatest(p_score_a + p_score_b, 1);
  end if;
  if v_denom <= 0 then v_denom := 1; end if;
  v_m := least(greatest(v_margin::numeric / v_denom, 0.0), 1.0);
  v_mov := 1.0 + 0.5 * v_m;

  foreach v_matches_played in array p_all_players_matches_played loop
    v_k := (case when v_matches_played < 10 then 48.00 else 24.00 end) * p_format_damping;
    v_player_ks := v_player_ks || v_k;
  end loop;

  select avg(val) into v_k_avg from unnest(v_player_ks) as val;

  v_delta := round(v_k_avg * v_mov * (v_w_a - v_expected_a), 2);

  return (v_delta, v_expected_a, v_mov, v_k_avg, v_player_ks)::public.match_delta_result;
end;
$$;

-- ─────────────── 5. Drop amend_match_score (Patch 3) ───────────────
drop function if exists public.amend_match_score(uuid, int, int, text);

-- ─────────────── 6. Refactor submit_match_score to use calculate_match_delta & Drift Triggers ───────────────
create or replace function public.submit_match_score(
  p_match_id uuid,
  p_score_a int,
  p_score_b int
)
returns void
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
  v_team_a_elos numeric[] := '{}';
  v_team_b_elos numeric[] := '{}';
  v_delta_res public.match_delta_result;
  v_delta numeric;
  
  v_player_id uuid;
  v_player_elo_before numeric;
  v_player_delta numeric;
  v_player_elo_after numeric;
  v_drift numeric;
  v_last_assessed_elo numeric;
  
  v_players_a uuid[] := '{}';
  v_players_b uuid[] := '{}';
  v_all_players uuid[] := '{}';
  v_all_matches_played int[] := '{}';
  v_matches_played_prev int;
  v_idx int;
  
  v_outcome_a text;
  v_outcome_b text;
  v_points_for_a int;
  v_points_against_a int;
  v_points_for_b int;
  v_points_against_b int;
  
  v_wins_a int := 0;
  v_losses_a int := 0;
  v_draws_a int := 0;
  v_wins_b int := 0;
  v_losses_b int := 0;
  v_draws_b int := 0;

  v_rec record;
begin
  v_profile_id := public.current_profile_id();
  if v_profile_id is null then
    raise exception 'UNAUTHENTICATED' using message = 'Authentication required to submit scores', errcode = '42501';
  end if;

  select session_id, community_id, status, elo_applied, coalesce(formula_version, 1)
  into v_session_id, v_community_id, v_status, v_elo_applied, v_formula_version
  from public.matches
  where id = p_match_id
  for update;

  if not found then
    raise exception 'NOT_FOUND' using message = 'Match not found', errcode = 'P0002';
  end if;

  if v_elo_applied then
    return;
  end if;

  if p_score_a < 0 or p_score_b < 0 then
    raise exception 'VALIDATION_ERROR' using message = 'Scores cannot be negative', errcode = '22003';
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

  v_playing_slots := least(floor(v_attendee_count / v_players_per_match), v_court_count) * v_players_per_match;
  if v_rounds_planned is not null then
    v_expected_matches := floor(v_rounds_planned * (v_playing_slots::numeric / greatest(v_attendee_count, 1)));
  else
    v_expected_matches := floor((v_court_count * v_players_per_match::numeric / greatest(v_attendee_count, 1)) * 8);
  end if;
  if v_expected_matches < 1 then v_expected_matches := 1; end if;

  v_format_damping := 1.0 / sqrt(v_expected_matches::numeric);

  -- Collect players
  for v_rec in (
    select mp.profile_id, mp.team, coalesce(pr.elo_rating, 1000.00) as elo_rating, coalesce(pr.total_matches, 0) as total_matches
    from public.match_players mp
    left join public.player_rankings pr
      on pr.profile_id = mp.profile_id
     and pr.community_id = v_community_id
     and pr.sport = v_sport
    where mp.match_id = p_match_id
    order by mp.team, mp.created_at
  ) loop
    if v_rec.team = 'A' then
      v_players_a := v_players_a || v_rec.profile_id;
      v_team_a_elos := v_team_a_elos || v_rec.elo_rating;
    else
      v_players_b := v_players_b || v_rec.profile_id;
      v_team_b_elos := v_team_b_elos || v_rec.elo_rating;
    end if;
    v_all_players := v_all_players || v_rec.profile_id;
    v_all_matches_played := v_all_matches_played || v_rec.total_matches;
  end loop;

  select avg(val) into v_avg_elo_a from unnest(v_team_a_elos) as val;
  select avg(val) into v_avg_elo_b from unnest(v_team_b_elos) as val;

  -- Call shared calculate_match_delta
  v_delta_res := public.calculate_match_delta(
    v_avg_elo_a, v_avg_elo_b,
    p_score_a, p_score_b,
    v_scoring_type, v_points_mode, v_max_score_target,
    v_all_matches_played, v_format_damping,
    v_formula_version, v_team_a_elos, v_team_b_elos
  );

  v_delta := v_delta_res.delta;

  -- Update Match outcomes
  if p_score_a > p_score_b then
    v_outcome_a := 'WIN'; v_outcome_b := 'LOSS';
    v_wins_a := 1; v_losses_b := 1;
  elsif p_score_b > p_score_a then
    v_outcome_a := 'LOSS'; v_outcome_b := 'WIN';
    v_losses_a := 1; v_wins_b := 1;
  else
    v_outcome_a := 'DRAW'; v_outcome_b := 'DRAW';
    v_draws_a := 1; v_draws_b := 1;
  end if;

  update public.matches
  set score_a = p_score_a,
      score_b = p_score_b,
      status = 'COMPLETED',
      elo_applied = true,
      completed_at = now()
  where id = p_match_id;

  -- Apply Elo & Player Rankings updates for each player
  v_idx := 1;
  foreach v_player_id in array v_all_players loop
    v_player_elo_before := (case when v_idx <= array_length(v_players_a, 1) then v_team_a_elos[v_idx] else v_team_b_elos[v_idx - array_length(v_players_a, 1)] end);
    v_player_delta := (case when v_idx <= array_length(v_players_a, 1) then v_delta else -v_delta end);
    v_player_elo_after := round(v_player_elo_before + v_player_delta, 2);

    insert into public.player_rankings (community_id, profile_id, sport, elo_rating, total_matches, wins, losses, draws, elo_at_last_assessment)
    values (v_community_id, v_player_id, v_sport, v_player_elo_after, 1,
            (case when v_idx <= array_length(v_players_a, 1) then v_wins_a else v_wins_b end),
            (case when v_idx <= array_length(v_players_a, 1) then v_losses_a else v_losses_b end),
            (case when v_idx <= array_length(v_players_a, 1) then v_draws_a else v_draws_b end),
            v_player_elo_before)
    on conflict (community_id, profile_id, sport)
    do update set
      elo_rating = v_player_elo_after,
      total_matches = public.player_rankings.total_matches + 1,
      wins = public.player_rankings.wins + (case when v_idx <= array_length(v_players_a, 1) then v_wins_a else v_wins_b end),
      losses = public.player_rankings.losses + (case when v_idx <= array_length(v_players_a, 1) then v_losses_a else v_losses_b end),
      draws = public.player_rankings.draws + (case when v_idx <= array_length(v_players_a, 1) then v_draws_a else v_draws_b end),
      updated_at = now();

    -- Patch 6: Check REVIEW_THRESHOLD = 100 drift for skill rating admin review
    select elo_at_last_assessment into v_last_assessed_elo
    from public.player_rankings
    where community_id = v_community_id and profile_id = v_player_id and sport = v_sport;

    v_drift := v_player_elo_after - coalesce(v_last_assessed_elo, 1000.00);
    if abs(v_drift) >= 100.00 then
      update public.player_rankings
      set review_flagged = true,
          review_flagged_at = now()
      where community_id = v_community_id and profile_id = v_player_id and sport = v_sport
        and review_flagged = false;
    end if;

    v_idx := v_idx + 1;
  end loop;

  -- Update Session Players stats
  for v_idx in 1..array_length(v_players_a, 1) loop
    update public.session_players
    set session_wins = session_wins + v_wins_a,
        session_points_for = session_points_for + p_score_a,
        session_points_against = session_points_against + p_score_b,
        updated_at = now()
    where session_id = v_session_id and profile_id = v_players_a[v_idx];
  end loop;

  for v_idx in 1..array_length(v_players_b, 1) loop
    update public.session_players
    set session_wins = session_wins + v_wins_b,
        session_points_for = session_points_for + p_score_b,
        session_points_against = session_points_against + p_score_a,
        updated_at = now()
    where session_id = v_session_id and profile_id = v_players_b[v_idx];
  end loop;

end;
$$;

-- ─────────────── 7. Refactor finalize_session to Award Community Points (CP) ───────────────
create or replace function public.finalize_session(
  p_session_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid;
  v_community_id uuid;
  v_status session_status;
  v_unfinished_matches_count int;

  v_active_season_id uuid;
  v_cp_reset_policy text;
  v_standings_metric standings_metric;
  v_attendee_count int;
  v_player record;
  v_points numeric;
begin
  v_profile_id := public.current_profile_id();
  if v_profile_id is null then
    raise exception 'UNAUTHENTICATED' using message = 'Authentication required', errcode = '42501';
  end if;

  select community_id, status
  into v_community_id, v_status
  from public.sessions
  where id = p_session_id
  for update;

  if not found then
    raise exception 'NOT_FOUND' using message = 'Session not found', errcode = 'P0002';
  end if;

  if v_status = 'COMPLETED' then
    return;
  end if;

  select count(*) into v_unfinished_matches_count
  from public.matches
  where session_id = p_session_id
    and status not in ('COMPLETED', 'VOIDED');

  if v_unfinished_matches_count > 0 then
    raise exception 'UNFINISHED_MATCHES' using message = 'Cannot finalize session with unfinished matches. Score or void all courts first.', errcode = '45000';
  end if;

  update public.sessions
  set status = 'COMPLETED',
      completed_at = now()
  where id = p_session_id;

  -- Compute & Award Community Points (CP)
  select cp_reset_policy into v_cp_reset_policy
  from public.communities where id = v_community_id;

  v_active_season_id := null;
  if v_cp_reset_policy = 'seasonal' then
    select id into v_active_season_id from public.community_point_seasons
    where community_id = v_community_id and is_active = true
    order by starts_at desc limit 1;
  end if;

  select standings_metric into v_standings_metric
  from public.sessions where id = p_session_id;

  select count(*) into v_attendee_count
  from public.session_players
  where session_id = p_session_id and status = 'ACTIVE';

  for v_player in
    select profile_id,
           row_number() over (
             order by
               case v_standings_metric
                 when 'AVG_POINT_DIFF' then
                   (session_points_for - session_points_against)::numeric
                     / nullif(matches_played, 0)
                 when 'TOTAL_POINTS' then session_points_for::numeric
                 when 'WINS' then session_wins::numeric
               end desc nulls last,
               seed_elo desc,
               profile_id asc
           ) as rnk
    from public.session_players
    where session_id = p_session_id and status = 'ACTIVE'
  loop
    v_points := public.calculate_cp_points(v_player.rnk::int, v_attendee_count);
    insert into public.community_points
      (community_id, profile_id, session_id, season_id, points_awarded, session_rank, session_size, awarded_at)
    values
      (v_community_id, v_player.profile_id, p_session_id, v_active_season_id, v_points, v_player.rnk, v_attendee_count, now());
  end loop;

end;
$$;

-- ─────────────── 8. Fix sessions_insert RLS Policy to Allow HOST ───────────────
drop policy if exists "sessions_insert" on public.sessions;
create policy "sessions_insert" on public.sessions
  for insert
  with check (
    public.is_community_host(community_id)
  );
