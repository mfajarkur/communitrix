-- SQL Migration: ELO Recalculation, Amend Score, Void Match, and Audit Logging

-- 1. Replay Ratings function: resets and recalculates all Elo ratings chronologically for a community and sport
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
  
  v_players_a uuid[];
  v_players_b uuid[];
  v_all_players uuid[];
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

  -- Query all COMPLETED matches in chronological order of completion
  for v_match in
    select id, session_id, team_a_score, team_b_score
    from public.matches
    where community_id = p_community_id
      and sport = p_sport
      and status = 'COMPLETED'
    order by completed_at asc, id asc
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
    v_avg_elo_a := 0;
    v_avg_elo_b := 0;

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

      v_avg_elo_a := v_avg_elo_a + v_player_elo_before;

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

    v_avg_elo_a := v_avg_elo_a / array_length(v_players_a, 1);

    for v_idx in 1..array_length(v_players_b, 1) loop
      v_player_id := v_players_b[v_idx];
      
      select elo_rating, total_matches into v_player_elo_before, v_matches_played_prev
      from public.player_rankings
      where community_id = p_community_id and profile_id = v_player_id and sport = p_sport;

      if not found then
        v_player_elo_before := 1000.00;
        v_matches_played_prev := 0;
      end if;

      v_avg_elo_b := v_avg_elo_b + v_player_elo_before;

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

    v_avg_elo_b := v_avg_elo_b / array_length(v_players_b, 1);

    -- Expected score E_A
    v_expected_a := 1.0 / (1.0 + power(10.0, (v_avg_elo_b - v_avg_elo_a) / 400.0));

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

    -- Team A updates
    for v_idx in 1..array_length(v_players_a, 1) loop
      v_player_id := v_players_a[v_idx];
      select elo_before into v_player_elo_before
      from public.match_players
      where match_id = v_match.id and profile_id = v_player_id;

      v_player_delta := v_delta;
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

      v_player_delta := -v_delta;
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

-- 2. Amend Match Score: Updates a match's score and triggers a full Elo ratings recalculation
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
  -- Auth check
  v_profile_id := public.current_profile_id();
  if v_profile_id is null then
    raise exception 'UNAUTHENTICATED' using message = 'Authentication required', errcode = '42501';
  end if;

  -- Lock match and fetch details
  select community_id, sport, session_id, team_a_score, team_b_score
  into v_community_id, v_sport, v_session_id, v_old_score_a, v_old_score_b
  from public.matches
  where id = p_match_id
  for update;

  if not found then
    raise exception 'NOT_FOUND' using message = 'Match not found', errcode = 'P0002';
  end if;

  -- Admin permission guard
  if not public.is_community_admin(v_community_id) then
    raise exception 'FORBIDDEN' using message = 'Only community administrators can amend scores', errcode = '42501';
  end if;

  -- Update score
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

  -- Replay ratings
  perform public.replay_ratings(v_community_id, v_sport);

  -- Log action in audit trail
  insert into public.audit_log (
    community_id,
    actor_profile_id,
    action,
    entity_type,
    entity_id,
    payload
  )
  values (
    v_community_id,
    v_profile_id,
    'MATCH_AMENDED',
    'MATCH',
    p_match_id,
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

-- 3. Void Match: Cancels a match and recalculates ELO ratings omitting the voided match
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
  -- Auth check
  v_profile_id := public.current_profile_id();
  if v_profile_id is null then
    raise exception 'UNAUTHENTICATED' using message = 'Authentication required', errcode = '42501';
  end if;

  -- Lock match and fetch details
  select community_id, sport, session_id, status
  into v_community_id, v_sport, v_session_id, v_old_status
  from public.matches
  where id = p_match_id
  for update;

  if not found then
    raise exception 'NOT_FOUND' using message = 'Match not found', errcode = 'P0002';
  end if;

  -- Admin permission guard
  if not public.is_community_admin(v_community_id) then
    raise exception 'FORBIDDEN' using message = 'Only community administrators can void matches', errcode = '42501';
  end if;

  -- Void match row
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

  -- Replay ratings
  perform public.replay_ratings(v_community_id, v_sport);

  -- Log action in audit trail
  insert into public.audit_log (
    community_id,
    actor_profile_id,
    action,
    entity_type,
    entity_id,
    payload
  )
  values (
    v_community_id,
    v_profile_id,
    'MATCH_VOIDED',
    'MATCH',
    p_match_id,
    jsonb_build_object(
      'old_status', v_old_status,
      'reason', p_reason
    )
  );

end;
$$;
