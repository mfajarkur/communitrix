-- finalize_session used to hard-reject ending a session if any match was still unscored
-- ("Cannot finalize session with unfinished matches. Score or void all courts first."),
-- forcing a host to manually void every outstanding court one at a time before they could end.
-- A host should be able to end a session whenever they want. Matches left IN_PROGRESS at that
-- point (persist_round always creates them with null scores and elo_applied=false — there is no
-- "partially scored" state, submit_match_score sets both scores in one atomic call) have never
-- contributed to Elo/CP, so auto-voiding them is a pure status/bookkeeping change, not a
-- data-mutating one — no replay_ratings recompute needed, unlike a real void_match call on an
-- already-COMPLETED match.

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
  v_voided_count int;
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

  if not public.is_community_host(v_community_id) and not public.is_platform_admin() then
    raise exception 'Only a community host or admin can finalize a session' using errcode = '42501';
  end if;

  if v_status = 'COMPLETED' then
    return;
  end if;

  update public.matches
  set status = 'VOIDED',
      void_reason = 'Auto-voided: session ended while this match was still unscored',
      amended_at = now(),
      amended_by = v_profile_id
  where session_id = p_session_id
    and status not in ('COMPLETED', 'VOIDED');

  get diagnostics v_voided_count = row_count;

  if v_voided_count > 0 then
    insert into public.audit_log (
      community_id, actor_profile_id, action, entity, entity_id, payload
    )
    values (
      v_community_id, v_profile_id, 'SESSION_FINALIZED_WITH_AUTO_VOID', 'SESSION', p_session_id,
      jsonb_build_object('voided_match_count', v_voided_count)
    );
  end if;

  update public.sessions
  set status = 'COMPLETED',
      completed_at = now()
  where id = p_session_id;

  -- Compute and award Community Points for this session (Patch 7) — unchanged from 0031.
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
