-- Fixes a bug in 0029: row_number() returns bigint, but calculate_cp_points takes int.
-- Postgres allows an implicit bigint->int cast for assignments/inserts (that's why the
-- community_points INSERT two lines below worked fine) but NOT for function-call argument
-- matching, which only considers IMPLICIT-category casts — bigint->int is ASSIGNMENT-category,
-- so the direct call failed with "function calculate_cp_points(bigint, integer) does not exist".
-- First hit live when a real Offline session finalized (0030) and actually exercised this path
-- for the first time — the CP formula's own unit test only ever passed literal ints directly,
-- and finalize_session's earlier RPC checks in this session's history never got far enough to
-- reach this call. Body is otherwise identical to 0029's finalize_session; only the cast at the
-- calculate_cp_points call site changes.

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

  -- Compute and award Community Points for this session (Patch 7). Purely a participation
  -- reward, fully separate from Elo — never used for matchmaking or rating.
  declare
    v_active_season_id uuid;
    v_cp_reset_policy   text;
    v_standings_metric  standings_metric;
    v_attendee_count    int;
    v_player            record;
    v_points            numeric;
  begin
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

    if v_attendee_count > 0 then
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
        insert into public.community_points (
          community_id, profile_id, session_id, points_awarded, session_rank, session_size, awarded_at, season_id
        )
        values (
          v_community_id, v_player.profile_id, p_session_id, v_points, v_player.rnk, v_attendee_count, now(), v_active_season_id
        );
      end loop;
    end if;
  end;

end;
$$;
