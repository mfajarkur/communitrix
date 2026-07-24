-- RPC Functions for Sessions and Rounds Matchmaking
-- Covers start_session and persist_round with concurrency locks

-- ─────────────── 1. start_session ───────────────
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
  -- Get current authenticated profile
  v_profile_id := public.current_profile_id();
  if v_profile_id is null then
    raise exception 'UNAUTHENTICATED' using message = 'Authentication required to start a session', errcode = '42501';
  end if;

  -- Validate attendee count
  if array_length(p_attendee_ids, 1) is null then
    raise exception 'INSUFFICIENT_PLAYERS' using message = 'A session must have at least one attendee', errcode = '45000';
  end if;

  if p_sport = 'PADEL' and array_length(p_attendee_ids, 1) < 4 then
    raise exception 'INSUFFICIENT_PLAYERS' using message = 'Padel sessions require at least 4 players', errcode = '45000';
  end if;

  if p_format = 'AMERICANO' and p_sport = 'TENNIS' and array_length(p_attendee_ids, 1) < 2 then
    raise exception 'INSUFFICIENT_PLAYERS' using message = 'Tennis sessions require at least 2 players', errcode = '45000';
  end if;

  -- Insert session
  insert into public.sessions (
    community_id,
    session_name,
    sport,
    format,
    scoring_type,
    points_mode,
    max_score_target,
    court_count,
    rounds_planned,
    status,
    started_at,
    created_by
  )
  values (
    p_community_id,
    p_name,
    p_sport,
    p_format,
    p_scoring_type,
    p_points_mode,
    p_max_score_target,
    p_court_count,
    p_rounds_planned,
    'ACTIVE',
    now(),
    v_profile_id
  )
  returning id into v_session_id;

  -- Insert session players
  foreach v_attendee_id in array p_attendee_ids loop
    -- Get or default the player's seed Elo
    select elo_rating into v_seed_elo
    from public.player_rankings
    where community_id = p_community_id
      and profile_id = v_attendee_id
      and sport = p_sport;

    if not found then
      v_seed_elo := 1000.00;
    end if;

    insert into public.session_players (
      session_id,
      community_id,
      profile_id,
      status,
      seed_elo,
      joined_round,
      matches_played,
      sit_out_count
    )
    values (
      v_session_id,
      p_community_id,
      v_attendee_id,
      'ACTIVE',
      v_seed_elo,
      1,
      0,
      0
    );
  end loop;

  return v_session_id;
end;
$$;

-- ─────────────── 2. persist_round ───────────────
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
  -- Concurrency check: Lock on session ID to prevent double taps
  perform pg_advisory_xact_lock(hashtext(p_session_id::text));

  -- Get current user profile
  v_profile_id := public.current_profile_id();
  if v_profile_id is null then
    raise exception 'UNAUTHENTICATED' using message = 'Authentication required', errcode = '42501';
  end if;

  -- Fetch session details
  select community_id into v_community_id
  from public.sessions
  where id = p_session_id;

  if not found then
    raise exception 'NOT_FOUND' using message = 'Session not found', errcode = 'P0002';
  end if;

  -- Return existing round ID if already created (E12 idempotence)
  select id into v_round_id
  from public.rounds
  where session_id = p_session_id and round_number = p_round_number;

  if found then
    return v_round_id;
  end if;

  -- Create new round
  insert into public.rounds (
    session_id,
    community_id,
    round_number,
    status
  )
  values (
    p_session_id,
    v_community_id,
    p_round_number,
    'PLAYING'
  )
  returning id into v_round_id;

  -- Insert matches and players
  for v_match in select * from jsonb_array_elements(p_matches) loop
    v_court_num := (v_match->>'courtNumber')::int;
    
    -- Extract team player IDs
    v_team_a := array(select jsonb_array_elements_text(v_match->'teamA')::uuid);
    v_team_b := array(select jsonb_array_elements_text(v_match->'teamB')::uuid);

    -- Insert match
    insert into public.matches (
      session_id,
      round_id,
      community_id,
      round_number,
      court_number,
      status
    )
    values (
      p_session_id,
      v_round_id,
      v_community_id,
      p_round_number,
      v_court_num,
      'PLAYING'
    )
    returning id into v_match_id;

    -- Insert Team A players
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

      insert into public.match_players (
        match_id,
        session_id,
        community_id,
        profile_id,
        team,
        slot,
        elo_before
      )
      values (
        v_match_id,
        p_session_id,
        v_community_id,
        v_player_id,
        'A',
        v_idx,
        v_elo
      );

      -- Update matches_played counter for active players
      update public.session_players
      set matches_played = matches_played + 1
      where session_id = p_session_id and profile_id = v_player_id;
    end loop;

    -- Insert Team B players
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

      insert into public.match_players (
        match_id,
        session_id,
        community_id,
        profile_id,
        team,
        slot,
        elo_before
      )
      values (
        v_match_id,
        p_session_id,
        v_community_id,
        v_player_id,
        'B',
        v_idx,
        v_elo
      );

      -- Update matches_played counter for active players
      update public.session_players
      set matches_played = matches_played + 1
      where session_id = p_session_id and profile_id = v_player_id;
    end loop;
  end loop;

  -- Process sit outs
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
