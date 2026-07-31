-- Migration 0024: fixes three issues found in a full community-feature audit.
--
-- 1. Malformed RAISE syntax. The pattern `raise exception 'CODE' using message = '...',
--    errcode = '...'` is invalid PL/pgSQL (you can't supply both a positional format-string
--    message and MESSAGE= in USING) — confirmed live: calling a function that hits one of
--    these raised "RAISE option already specified: MESSAGE" instead of the intended message.
--    Every affected function below is recreated with the format-string message as the sole
--    message source; the vestigial leading "CODE" identifiers (never consumed by any caller)
--    are dropped.
--
-- 2. claim_guest_profile let a self-claim (p_target_profile_id omitted) skip authorization
--    entirely, letting any authenticated user hijack any guest profile's match history/ELO
--    from any community. The only legitimate caller (resolve_guest_claim) always passes an
--    explicit, different target profile id, so the "claiming for yourself" bypass is removed
--    — the host/admin-of-a-shared-community (or platform admin) check is now unconditional.
--
-- 3. start_session, persist_round, submit_match_score, and finalize_session only checked that
--    the caller was authenticated, not that they were a community Host/Admin — the role gate
--    only existed in the Next.js server-action layer, bypassable via a direct RPC call. Each
--    now calls is_community_host(), matching the requireCommunityHost() gate already used by
--    every one of these actions' callers in src/server/actions/{session,round}.actions.ts.
--
-- Note: migration 0018_elo_adjustments_and_cp.sql rewrites submit_match_score/finalize_session
-- with column names that don't exist in this schema (score_a/score_b instead of
-- team_a_score/team_b_score, etc.) and was never applied — this migration recreates the
-- 0009/0010 versions that are actually live, not 0018's.

-- ─────────────── create_community (0007) ───────────────
create or replace function public.create_community(
  p_name text,
  p_slug text
)
returns public.communities
language plpgsql
security definer
set search_path = public
as $$
declare
  v_community public.communities;
  v_profile_id uuid;
begin
  v_profile_id := public.current_profile_id();
  if v_profile_id is null then
    raise exception 'Authentication required to create a community' using errcode = '42501';
  end if;

  insert into public.communities (name, slug, created_by)
  values (p_name, p_slug, v_profile_id)
  returning * into v_community;

  insert into public.community_members (community_id, profile_id, role, is_active)
  values (v_community.id, v_profile_id, 'ADMIN', true);

  return v_community;
end;
$$;

-- ─────────────── join_community (0007) ───────────────
create or replace function public.join_community(
  p_join_code text
)
returns public.community_members
language plpgsql
security definer
set search_path = public
as $$
declare
  v_community public.communities;
  v_profile_id uuid;
  v_member public.community_members;
begin
  v_profile_id := public.current_profile_id();
  if v_profile_id is null then
    raise exception 'Authentication required to join a community' using errcode = '42501';
  end if;

  select * into v_community
  from public.communities
  where upper(join_code) = upper(p_join_code);

  if v_community is null then
    raise exception 'Community not found for this join code' using errcode = 'P0002';
  end if;

  if not v_community.join_code_enabled then
    raise exception 'Join code is disabled for this community' using errcode = '42501';
  end if;

  select * into v_member
  from public.community_members
  where community_id = v_community.id and profile_id = v_profile_id;

  if v_member is not null then
    if not v_member.is_active then
      update public.community_members
      set is_active = true, joined_at = now()
      where id = v_member.id
      returning * into v_member;
    end if;
    return v_member;
  end if;

  insert into public.community_members (community_id, profile_id, role, is_active)
  values (v_community.id, v_profile_id, 'MEMBER', true)
  returning * into v_member;

  return v_member;
end;
$$;

-- ─────────────── add_guest_player (live version, from 0013) ───────────────
create or replace function public.add_guest_player(
  p_community_id uuid,
  p_full_name text
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

  insert into public.profiles (full_name)
  values (p_full_name)
  returning * into v_guest_profile;

  insert into public.community_members (community_id, profile_id, role, is_active)
  values (p_community_id, v_guest_profile.id, 'MEMBER', true);

  return v_guest_profile;
end;
$$;

-- ─────────────── start_session (0008) ───────────────
create or replace function public.start_session(
  p_community_id uuid,
  p_name text,
  p_format session_format,
  p_sport sport_type,
  p_scoring_type scoring_type,
  p_points_mode points_mode,
  p_max_score_target int,
  p_rounds_planned int,
  p_court_count int,
  p_attendee_ids uuid[]
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session_id uuid;
  v_profile_id uuid;
  v_attendee_id uuid;
  v_seed_elo numeric(7,2);
begin
  v_profile_id := public.current_profile_id();
  if v_profile_id is null then
    raise exception 'Authentication required to start a session' using errcode = '42501';
  end if;

  -- Host/Admin gate — previously only enforced by the Next.js server-action layer.
  if not public.is_community_host(p_community_id) and not public.is_platform_admin() then
    raise exception 'Only a community host or admin can start a session' using errcode = '42501';
  end if;

  if array_length(p_attendee_ids, 1) is null then
    raise exception 'A session must have at least one attendee' using errcode = '45000';
  end if;

  if p_sport = 'PADEL' and array_length(p_attendee_ids, 1) < 4 then
    raise exception 'Padel sessions require at least 4 players' using errcode = '45000';
  end if;

  if p_format = 'AMERICANO' and p_sport = 'TENNIS' and array_length(p_attendee_ids, 1) < 2 then
    raise exception 'Tennis sessions require at least 2 players' using errcode = '45000';
  end if;

  insert into public.sessions (
    community_id, session_name, sport, format, scoring_type, points_mode,
    max_score_target, court_count, rounds_planned, status, started_at, created_by
  )
  values (
    p_community_id, p_name, p_sport, p_format, p_scoring_type, p_points_mode,
    p_max_score_target, p_court_count, p_rounds_planned, 'ACTIVE', now(), v_profile_id
  )
  returning id into v_session_id;

  foreach v_attendee_id in array p_attendee_ids loop
    select elo_rating into v_seed_elo
    from public.player_rankings
    where community_id = p_community_id
      and profile_id = v_attendee_id
      and sport = p_sport;

    if not found then
      v_seed_elo := 1000.00;
    end if;

    insert into public.session_players (
      session_id, community_id, profile_id, status, seed_elo, joined_round, matches_played, sit_out_count
    )
    values (
      v_session_id, p_community_id, v_attendee_id, 'ACTIVE', v_seed_elo, 1, 0, 0
    );
  end loop;

  return v_session_id;
end;
$$;

-- ─────────────── persist_round (0008) ───────────────
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

  -- Host/Admin gate — previously only enforced by the Next.js server-action layer.
  if not public.is_community_host(v_community_id) and not public.is_platform_admin() then
    raise exception 'Only a community host or admin can persist a round' using errcode = '42501';
  end if;

  select id into v_round_id
  from public.rounds
  where session_id = p_session_id and round_number = p_round_number;

  if found then
    return v_round_id;
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

-- ─────────────── submit_match_score (0009) ───────────────
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

  -- Host/Admin gate — previously only enforced by the Next.js server-action layer.
  if not public.is_community_host(v_community_id) and not public.is_platform_admin() then
    raise exception 'Only a community host or admin can submit scores' using errcode = '42501';
  end if;

  if v_elo_applied then
    return;
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

end;
$$;

-- ─────────────── finalize_session (0010) ───────────────
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
begin
  v_profile_id := public.current_profile_id();
  if v_profile_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select community_id, status
  into v_community_id, v_status
  from public.sessions
  where id = p_session_id
  for update;

  if not found then
    raise exception 'Session not found' using errcode = 'P0002';
  end if;

  -- Host/Admin gate — previously only enforced by the Next.js server-action layer.
  if not public.is_community_host(v_community_id) and not public.is_platform_admin() then
    raise exception 'Only a community host or admin can finalize a session' using errcode = '42501';
  end if;

  if v_status = 'COMPLETED' then
    return;
  end if;

  select count(*) into v_unfinished_matches_count
  from public.matches
  where session_id = p_session_id
    and status not in ('COMPLETED', 'VOIDED');

  if v_unfinished_matches_count > 0 then
    raise exception 'Cannot finalize session with unfinished matches. Score or void all courts first.' using errcode = '45000';
  end if;

  update public.sessions
  set status = 'COMPLETED',
      completed_at = now()
  where id = p_session_id;

end;
$$;

-- ─────────────── amend_match_score (0011) — RAISE syntax fix only, auth already correct ───────────────
create or replace function public.amend_match_score(
  p_match_id uuid,
  p_score_a int,
  p_score_b int,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid;
  v_community_id uuid;
  v_sport sport_type;
  v_session_id uuid;
  v_old_score_a int;
  v_old_score_b int;
begin
  v_profile_id := public.current_profile_id();
  if v_profile_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select community_id, sport, session_id, team_a_score, team_b_score
  into v_community_id, v_sport, v_session_id, v_old_score_a, v_old_score_b
  from public.matches
  where id = p_match_id
  for update;

  if not found then
    raise exception 'Match not found' using errcode = 'P0002';
  end if;

  if not public.is_community_admin(v_community_id) then
    raise exception 'Only community administrators can amend scores' using errcode = '42501';
  end if;

  update public.matches
  set team_a_score = p_score_a,
      team_b_score = p_score_b,
      winner_side = case when p_score_a > p_score_b then 'A'::team_side when p_score_b > p_score_a then 'B'::team_side else null end,
      is_draw = (p_score_a = p_score_b),
      status = 'COMPLETED',
      elo_applied = true,
      amended_at = now(),
      amended_by = v_profile_id
  where id = p_match_id;

  perform public.replay_ratings(v_community_id, v_sport);

  insert into public.audit_log (
    community_id, actor_profile_id, action, entity, entity_id, payload
  )
  values (
    v_community_id, v_profile_id, 'MATCH_AMENDED', 'MATCH', p_match_id,
    jsonb_build_object(
      'old_score_a', v_old_score_a,
      'old_score_b', v_old_score_b,
      'new_score_a', p_score_a,
      'new_score_b', p_score_b,
      'reason', p_reason
    )
  );

end;
$$;

-- ─────────────── void_match (0011) — RAISE syntax fix only, auth already correct ───────────────
create or replace function public.void_match(
  p_match_id uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid;
  v_community_id uuid;
  v_sport sport_type;
  v_session_id uuid;
  v_old_status match_status;
begin
  v_profile_id := public.current_profile_id();
  if v_profile_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select community_id, sport, session_id, status
  into v_community_id, v_sport, v_session_id, v_old_status
  from public.matches
  where id = p_match_id
  for update;

  if not found then
    raise exception 'Match not found' using errcode = 'P0002';
  end if;

  if not public.is_community_admin(v_community_id) then
    raise exception 'Only community administrators can void matches' using errcode = '42501';
  end if;

  update public.matches
  set status = 'VOIDED',
      team_a_score = null,
      team_b_score = null,
      winner_side = null,
      is_draw = null,
      elo_applied = false,
      amended_at = now(),
      amended_by = v_profile_id
  where id = p_match_id;

  perform public.replay_ratings(v_community_id, v_sport);

  insert into public.audit_log (
    community_id, actor_profile_id, action, entity, entity_id, payload
  )
  values (
    v_community_id, v_profile_id, 'MATCH_VOIDED', 'MATCH', p_match_id,
    jsonb_build_object('old_status', v_old_status, 'reason', p_reason)
  );

end;
$$;

-- ─────────────── update_my_profile (0014) — RAISE syntax fix only ───────────────
create or replace function public.update_my_profile(
  p_display_name text default null,
  p_username     text default null,
  p_avatar_url   text default null
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid;
  v_result     public.profiles;
begin
  v_profile_id := public.current_profile_id();
  if v_profile_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if p_username is not null then
    if char_length(p_username) < 3 or char_length(p_username) > 30 then
      raise exception 'Username must be between 3 and 30 characters' using errcode = '22023';
    end if;
    if p_username !~ '^[a-z0-9_]+$' then
      raise exception 'Username can only contain lowercase letters, numbers, and underscores' using errcode = '22023';
    end if;
    if exists (
      select 1 from public.profiles
      where lower(username) = lower(p_username)
        and id <> v_profile_id
    ) then
      raise exception 'This username is already taken' using errcode = '23505';
    end if;
  end if;

  update public.profiles set
    display_name = coalesce(p_display_name, display_name),
    username     = coalesce(p_username, username),
    avatar_url   = coalesce(p_avatar_url, avatar_url),
    updated_at   = now()
  where id = v_profile_id
  returning * into v_result;

  return v_result;
end;
$$;

-- ─────────────── claim_guest_profile (0015) — RAISE syntax fix + self-claim auth bypass fix ───────────────
create or replace function public.claim_guest_profile(
  p_guest_profile_id uuid,
  p_target_profile_id uuid default null
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_profile_id uuid;
  v_effective_target_id uuid;
  v_guest_profile public.profiles;
  v_target_profile public.profiles;
  v_rec record;
begin
  v_caller_profile_id := public.current_profile_id();
  if v_caller_profile_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  v_effective_target_id := coalesce(p_target_profile_id, v_caller_profile_id);

  select * into v_guest_profile
  from public.profiles
  where id = p_guest_profile_id;

  if not found then
    raise exception 'Guest profile not found' using errcode = 'P0002';
  end if;

  if not v_guest_profile.is_guest then
    raise exception 'Specified profile is not a guest profile' using errcode = '22023';
  end if;

  select * into v_target_profile
  from public.profiles
  where id = v_effective_target_id;

  if not found or v_target_profile.is_guest then
    raise exception 'Target profile must be a registered non-guest user' using errcode = '22023';
  end if;

  -- Authorization: caller must be host/admin of a community the guest belongs to (or platform
  -- admin) — unconditionally, even for a "self-claim". The only legitimate caller
  -- (resolve_guest_claim) always passes an explicit target different from itself; a bare
  -- self-claim with no host/admin relationship to the guest is exactly the bug being fixed
  -- here, so there is no more "claiming for myself" exemption from this check.
  if not exists (
    select 1 from public.community_members cm_guest
    join public.community_members cm_caller on cm_caller.community_id = cm_guest.community_id
    where cm_guest.profile_id = p_guest_profile_id
      and cm_caller.profile_id = v_caller_profile_id
      and cm_caller.role::text in ('ADMIN', 'HOST')
      and cm_caller.is_active
  ) and not public.is_platform_admin() then
    raise exception 'Only the community host/admin can claim guest profiles' using errcode = '42501';
  end if;

  for v_rec in
    select * from public.player_rankings where profile_id = p_guest_profile_id
  loop
    if exists (
      select 1 from public.player_rankings
      where community_id = v_rec.community_id
        and profile_id = v_effective_target_id
        and sport = v_rec.sport
    ) then
      update public.player_rankings set
        total_matches  = total_matches + v_rec.total_matches,
        total_wins     = total_wins + v_rec.total_wins,
        total_losses   = total_losses + v_rec.total_losses,
        total_draws    = total_draws + v_rec.total_draws,
        points_for     = points_for + v_rec.points_for,
        points_against = points_against + v_rec.points_against,
        elo_rating     = greatest(elo_rating, v_rec.elo_rating),
        elo_peak       = greatest(elo_peak, v_rec.elo_peak),
        last_played_at = greatest(last_played_at, v_rec.last_played_at),
        updated_at     = now()
      where community_id = v_rec.community_id
        and profile_id = v_effective_target_id
        and sport = v_rec.sport;

      delete from public.player_rankings where id = v_rec.id;
    else
      update public.player_rankings set
        profile_id = v_effective_target_id,
        updated_at = now()
      where id = v_rec.id;
    end if;
  end loop;

  update public.session_players
  set profile_id = v_effective_target_id
  where profile_id = p_guest_profile_id
    and not exists (
      select 1 from public.session_players sp2
      where sp2.session_id = session_players.session_id
        and sp2.profile_id = v_effective_target_id
    );

  delete from public.session_players where profile_id = p_guest_profile_id;

  update public.match_players
  set profile_id = v_effective_target_id
  where profile_id = p_guest_profile_id
    and not exists (
      select 1 from public.match_players mp2
      where mp2.match_id = match_players.match_id
        and mp2.profile_id = v_effective_target_id
    );

  delete from public.match_players where profile_id = p_guest_profile_id;

  update public.sessions set created_by = v_effective_target_id where created_by = p_guest_profile_id;
  update public.matches set submitted_by = v_effective_target_id where submitted_by = p_guest_profile_id;
  update public.matches set amended_by = v_effective_target_id where amended_by = p_guest_profile_id;

  delete from public.community_members where profile_id = p_guest_profile_id;

  delete from public.profiles where id = p_guest_profile_id;

  return v_target_profile;
end;
$$;

-- ─────────────── request_guest_claim (0016) — RAISE syntax fix only ───────────────
create or replace function public.request_guest_claim(
  p_guest_profile_id uuid,
  p_community_id uuid
)
returns public.guest_claim_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_profile_id uuid;
  v_guest_profile public.profiles;
  v_request public.guest_claim_requests;
begin
  v_caller_profile_id := public.current_profile_id();
  if v_caller_profile_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.community_members
    where community_id = p_community_id
      and profile_id = v_caller_profile_id
      and is_active
  ) then
    raise exception 'Must be a member of the community to claim guest profiles' using errcode = '42501';
  end if;

  select * into v_guest_profile
  from public.profiles
  where id = p_guest_profile_id and is_guest = true;

  if not found then
    raise exception 'Specified profile is not a valid guest profile' using errcode = '22023';
  end if;

  insert into public.guest_claim_requests (
    community_id, guest_profile_id, requester_profile_id, status
  )
  values (
    p_community_id, p_guest_profile_id, v_caller_profile_id, 'PENDING'
  )
  on conflict (community_id, guest_profile_id, requester_profile_id)
  do update set status = 'PENDING', created_at = now()
  returning * into v_request;

  return v_request;
end;
$$;

-- ─────────────── resolve_guest_claim (0016) — RAISE syntax fix only ───────────────
create or replace function public.resolve_guest_claim(
  p_request_id uuid,
  p_action text
)
returns public.guest_claim_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_profile_id uuid;
  v_request public.guest_claim_requests;
  v_result public.guest_claim_requests;
begin
  v_caller_profile_id := public.current_profile_id();
  if v_caller_profile_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select * into v_request
  from public.guest_claim_requests
  where id = p_request_id and status = 'PENDING';

  if not found then
    raise exception 'Pending claim request not found' using errcode = 'P0002';
  end if;

  if not public.is_community_admin(v_request.community_id) and not public.is_platform_admin() then
    raise exception 'Only community administrators can resolve claim requests' using errcode = '42501';
  end if;

  if p_action = 'APPROVE' then
    perform public.claim_guest_profile(v_request.guest_profile_id, v_request.requester_profile_id);

    update public.guest_claim_requests set
      status = 'APPROVED',
      resolved_at = now(),
      resolved_by = v_caller_profile_id
    where id = p_request_id
    returning * into v_result;

    update public.guest_claim_requests set
      status = 'REJECTED',
      resolved_at = now(),
      resolved_by = v_caller_profile_id
    where guest_profile_id = v_request.guest_profile_id
      and id <> p_request_id
      and status = 'PENDING';

  elsif p_action = 'REJECT' then
    update public.guest_claim_requests set
      status = 'REJECTED',
      resolved_at = now(),
      resolved_by = v_caller_profile_id
    where id = p_request_id
    returning * into v_result;
  else
    raise exception 'Action must be APPROVE or REJECT' using errcode = '22023';
  end if;

  return v_result;
end;
$$;
