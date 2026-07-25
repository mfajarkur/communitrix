-- RPC Functions for Match Scoring and ELO Updates

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
  
  -- Elo calculation vars
  v_avg_elo_a numeric;
  v_avg_elo_b numeric;
  v_expected_a numeric;
  v_w_a numeric;
  v_margin int;
  v_denom int;
  v_m numeric;
  v_mov numeric;
  
  -- K-factor and delta
  v_k_factor_avg numeric;
  v_delta numeric;
  
  -- Player processing loops
  v_player_id uuid;
  v_player_elo_before numeric;
  v_is_prov boolean;
  v_player_k numeric;
  v_matches_played_prev int;
  v_player_delta numeric;
  v_player_elo_after numeric;
  
  -- Team players
  v_players_a uuid[] := '{}';
  v_players_b uuid[] := '{}';
  v_all_players uuid[] := '{}';
  v_player_ks numeric[] := '{}';
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
begin
  -- 1. Get current authenticated user profile
  v_profile_id := public.current_profile_id();
  if v_profile_id is null then
    raise exception 'UNAUTHENTICATED' using message = 'Authentication required to submit scores', errcode = '42501';
  end if;

  -- 2. Lock the match row and fetch details (E11 concurrency check)
  select session_id, community_id, status, elo_applied
  into v_session_id, v_community_id, v_status, v_elo_applied
  from public.matches
  where id = p_match_id
  for update;

  if not found then
    raise exception 'NOT_FOUND' using message = 'Match not found', errcode = 'P0002';
  end if;

  -- 3. Idempotency Guard (E10)
  if v_elo_applied then
    return;
  end if;

  -- 4. Validate scores (E19)
  if p_score_a < 0 or p_score_b < 0 then
    raise exception 'VALIDATION_ERROR' using message = 'Scores cannot be negative', errcode = '22003';
  end if;

  -- 5. Fetch Session and format constraints
  select sport, scoring_type, points_mode, max_score_target, court_count, rounds_planned, match_type
  into v_sport, v_scoring_type, v_points_mode, v_max_score_target, v_court_count, v_rounds_planned, v_match_type
  from public.sessions
  where id = v_session_id;

  -- Attendee count
  select count(*) into v_attendee_count
  from public.session_players
  where session_id = v_session_id and status = 'ACTIVE';

  -- 6. Players per match
  if v_sport = 'TENNIS' and v_match_type = 'SINGLES' then
    v_players_per_match := 2;
  else
    v_players_per_match := 4;
  end if;

  -- Format Damping
  v_playing_slots := least(floor(v_attendee_count::numeric / v_players_per_match), v_court_count) * v_players_per_match;
  if v_rounds_planned is not null then
    v_expected_matches := floor(v_rounds_planned * (v_playing_slots::numeric / greatest(v_attendee_count, 1)));
  else
    v_expected_matches := floor((v_court_count * v_players_per_match::numeric / greatest(v_attendee_count, 1)) * 8);
  end if;
  v_expected_matches := greatest(v_expected_matches, 1);
  v_format_damping := 1.0 / sqrt(v_expected_matches);

  -- 7. Load players
  v_players_a := array(
    select profile_id from public.match_players where match_id = p_match_id and team = 'A' order by slot
  );
  v_players_b := array(
    select profile_id from public.match_players where match_id = p_match_id and team = 'B' order by slot
  );
  v_all_players := v_players_a || v_players_b;

  -- 8. Compute team averages for Elo Expectation (E_A)
  select avg(elo_before) into v_avg_elo_a
  from public.match_players
  where match_id = p_match_id and team = 'A';

  select avg(elo_before) into v_avg_elo_b
  from public.match_players
  where match_id = p_match_id and team = 'B';

  v_expected_a := 1.0 / (1.0 + power(10.0, (v_avg_elo_b - v_avg_elo_a) / 400.0));

  -- 9. Determine outcome (W_A)
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

  -- 10. Margin of Victory (MoV)
  v_margin := abs(p_score_a - p_score_b);
  v_denom := v_max_score_target;
  if v_scoring_type = 'POINTS' and v_points_mode = 'TIMED' then
    v_denom := greatest(p_score_a + p_score_b, 1);
  end if;
  if v_denom <= 0 then
    v_denom := 1;
  end if;
  v_m := least(greatest(v_margin::numeric / v_denom, 0.0), 1.0);
  v_mov := 1.0 + 0.5 * v_m; -- MARGIN_WEIGHT = 0.5

  -- 11. Calculate K_eff for each player and take the average
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

  -- Average K-factor to enforce zero-sum invariant
  select avg(val) into v_k_factor_avg
  from unnest(v_player_ks) as val;

  -- 12. Delta calculation
  v_delta := round(v_k_factor_avg * v_mov * (v_w_a - v_expected_a), 2);

  -- 13. Apply deltas and save in match_players
  -- Team A
  for v_idx in 1..array_length(v_players_a, 1) loop
    v_player_id := v_players_a[v_idx];
    select elo_before into v_player_elo_before
    from public.match_players
    where match_id = p_match_id and profile_id = v_player_id;
    
    v_player_delta := v_delta;
    v_player_elo_after := greatest(v_player_elo_before + v_player_delta, 100.00); -- E21 floor at 100
    
    update public.match_players
    set elo_delta = v_player_delta,
        elo_after = v_player_elo_after,
        k_factor = v_player_ks[v_idx]
    where match_id = p_match_id and profile_id = v_player_id;

    -- Update global player rankings
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

    -- Update session players standing details
    update public.session_players
    set session_points_for = session_points_for + p_score_a,
        session_points_against = session_points_against + p_score_b,
        session_wins = session_wins + v_wins_a,
        session_losses = session_losses + v_losses_a,
        session_draws = session_draws + v_draws_a
    where session_id = v_session_id and profile_id = v_player_id;
  end loop;

  -- Team B
  for v_idx in 1..array_length(v_players_b, 1) loop
    v_player_id := v_players_b[v_idx];
    select elo_before into v_player_elo_before
    from public.match_players
    where match_id = p_match_id and profile_id = v_player_id;

    v_player_delta := -v_delta;
    v_player_elo_after := greatest(v_player_elo_before + v_player_delta, 100.00); // E21 floor at 100

    update public.match_players
    set elo_delta = v_player_delta,
        elo_after = v_player_elo_after,
        k_factor = v_player_ks[array_length(v_players_a, 1) + v_idx]
    where match_id = p_match_id and profile_id = v_player_id;

    -- Update global player rankings
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

    -- Update session players standing details
    update public.session_players
    set session_points_for = session_points_for + p_score_b,
        session_points_against = session_points_against + p_score_a,
        session_wins = session_wins + v_wins_b,
        session_losses = session_losses + v_losses_b,
        session_draws = session_draws + v_draws_b
    where session_id = v_session_id and profile_id = v_player_id;
  end loop;

  -- 14. Update match details
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
