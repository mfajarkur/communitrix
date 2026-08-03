-- Team Americano/Mexicano ("fixed pairs") used to collapse each team into one synthetic guest
-- profile (see wizard-form.tsx's old handleAddTeam), so the two real humans on a team were never
-- individually recorded in match_players/session_players and their own Elo never moved. Fixes
-- that by recording which two real session_players are fixed together, so scheduling can treat
-- a pair as one scheduling unit while the actual match/court data — and therefore Elo — always
-- reflects the two real players. No changes needed to persist_round/submit_match_score/
-- replay_ratings: they already handle an arbitrary number of real players per team generically.

alter table public.session_players
  add column fixed_partner_profile_id uuid references public.profiles(id);

drop function if exists public.start_session(uuid, text, session_format, sport_type, scoring_type, points_mode, int, int, int, uuid[], bye_scoring_method, text, match_type);

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
  p_match_type match_type default 'DOUBLES',
  p_fixed_pairs jsonb default null
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
  v_pair jsonb;
  v_pair_a uuid;
  v_pair_b uuid;
  v_paired_count int;
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

  if p_match_type = 'SINGLES' and array_length(p_attendee_ids, 1) < 2 then
    raise exception 'Singles sessions require at least 2 players' using errcode = '45000';
  end if;

  if p_match_type = 'DOUBLES' and array_length(p_attendee_ids, 1) < 4 then
    raise exception 'Doubles sessions require at least 4 players' using errcode = '45000';
  end if;

  -- Fixed pairs must exactly partition the attendee list — every attendee in exactly one pair,
  -- no stragglers, no player double-booked into two teams.
  if p_fixed_pairs is not null then
    select count(*) * 2 into v_paired_count
    from jsonb_array_elements(p_fixed_pairs);

    if v_paired_count <> array_length(p_attendee_ids, 1) then
      raise exception 'Fixed pairs must cover every attendee exactly once' using errcode = '45000';
    end if;
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

  if p_fixed_pairs is not null then
    for v_pair in select * from jsonb_array_elements(p_fixed_pairs) loop
      v_pair_a := (v_pair->>0)::uuid;
      v_pair_b := (v_pair->>1)::uuid;

      update public.session_players
      set fixed_partner_profile_id = v_pair_b
      where session_id = v_session_id and profile_id = v_pair_a;

      update public.session_players
      set fixed_partner_profile_id = v_pair_a
      where session_id = v_session_id and profile_id = v_pair_b;
    end loop;
  end if;

  return v_session_id;
end;
$$;
