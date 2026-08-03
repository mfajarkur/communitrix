-- Wires up sessions.match_type (SINGLES/DOUBLES enum, already existed since 0003_tables.sql
-- with a 'DOUBLES' default and a check constraint forcing Padel to always be DOUBLES) to
-- start_session, which never had a parameter for it — every session silently got the column
-- default regardless of what the host actually wanted. The rest of the backend was already
-- built for this: persist_round/submit_match_score/replay_ratings all read match_type and
-- branch playersPerMatch accordingly (supabase/migrations/0028), and the TS matchmaking
-- engines (americano.ts/mexicano.ts) already handle playersPerMatch=2 as 1v1 courts. Only the
-- entry point (this function) and the client-side round generator (round.actions.ts, fixed in
-- the same commit as this migration) were missing the wiring.

drop function if exists public.start_session(uuid, text, session_format, sport_type, scoring_type, points_mode, int, int, int, uuid[], bye_scoring_method, text);

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
  p_attendee_ids uuid[],
  p_bye_scoring_method bye_scoring_method default 'PLAYER_AVERAGE',
  p_session_mode text default 'ONLINE',
  p_match_type match_type default 'DOUBLES'
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

  if not public.is_community_host(p_community_id) and not public.is_platform_admin() then
    raise exception 'Only a community host or admin can start a session' using errcode = '42501';
  end if;

  if p_session_mode not in ('ONLINE', 'OFFLINE') then
    raise exception 'Invalid session_mode: must be ONLINE or OFFLINE' using errcode = '22023';
  end if;

  if p_sport = 'PADEL' and p_match_type = 'SINGLES' then
    raise exception 'Padel sessions must be Doubles' using errcode = '45000';
  end if;

  if array_length(p_attendee_ids, 1) is null then
    raise exception 'A session must have at least one attendee' using errcode = '45000';
  end if;

  -- Replaces the old sport/format-specific minimum checks (Padel<4, Tennis Americano<2) with a
  -- single rule keyed on match_type, which also fixes a pre-existing gap where Tennis Mexicano
  -- Doubles had no minimum-attendee check at all.
  if p_match_type = 'SINGLES' and array_length(p_attendee_ids, 1) < 2 then
    raise exception 'Singles sessions require at least 2 players' using errcode = '45000';
  end if;

  if p_match_type = 'DOUBLES' and array_length(p_attendee_ids, 1) < 4 then
    raise exception 'Doubles sessions require at least 4 players' using errcode = '45000';
  end if;

  insert into public.sessions (
    community_id, session_name, sport, format, scoring_type, points_mode,
    max_score_target, court_count, rounds_planned, bye_scoring_method, session_mode, match_type,
    status, started_at, created_by
  )
  values (
    p_community_id, p_name, p_sport, p_format, p_scoring_type, p_points_mode,
    p_max_score_target, p_court_count, p_rounds_planned, p_bye_scoring_method, p_session_mode, p_match_type,
    'ACTIVE', now(), v_profile_id
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
