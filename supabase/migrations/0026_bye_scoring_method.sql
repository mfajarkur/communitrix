-- Ports bye-point config from Quick Match's local-only state to community sessions. The wizard
-- already shows a "Bye Scoring Method" selector for community sessions too (not gated on
-- isGuestDemoMode), but nothing persisted the choice — sessions.bye_scoring_method didn't exist,
-- so start_session silently discarded it. See docs/bye-point-brief.md for the formulas this
-- config selects between (PLAYER_AVERAGE vs HALF_N).

create type bye_scoring_method as enum ('PLAYER_AVERAGE', 'HALF_N');

alter table public.sessions
  add column bye_scoring_method bye_scoring_method not null default 'PLAYER_AVERAGE';

-- ─────────────── start_session: accept + persist bye_scoring_method ───────────────
-- New trailing parameter changes the function's argument-type signature, so the old 10-arg
-- overload must be dropped first — CREATE OR REPLACE with a different arg list creates a second
-- overloaded function instead of replacing the original (same gotcha as submit_match_score in
-- migration 0025).
drop function if exists public.start_session(uuid, text, session_format, sport_type, scoring_type, points_mode, int, int, int, uuid[]);

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
  p_bye_scoring_method bye_scoring_method default 'PLAYER_AVERAGE'
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
    max_score_target, court_count, rounds_planned, bye_scoring_method, status, started_at, created_by
  )
  values (
    p_community_id, p_name, p_sport, p_format, p_scoring_type, p_points_mode,
    p_max_score_target, p_court_count, p_rounds_planned, p_bye_scoring_method, 'ACTIVE', v_profile_id
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
