-- SQL Migration 0044: Add Medals to player_rankings and new CP logic

-- 1. Add Medals Columns to player_rankings
alter table public.player_rankings
  add column if not exists gold_medals int not null default 0,
  add column if not exists silver_medals int not null default 0,
  add column if not exists bronze_medals int not null default 0;

-- 2. Drop obsolete calculate_cp_points function (we are moving it inside finalize_session)
drop function if exists public.calculate_cp_points(int, int);

-- 3. Update finalize_session to include sub penalties, net CP calculation, and medal forfeiture
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
  v_sport sport_type;
  v_voided_count int;
begin
  v_profile_id := public.current_profile_id();
  if v_profile_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select community_id, status, sport
  into v_community_id, v_status, v_sport
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
    ) values (
      v_community_id, v_profile_id, 'matches.auto_void', 'session', p_session_id,
      jsonb_build_object('voided_count', v_voided_count)
    );
  end if;

  update public.sessions
  set status = 'COMPLETED',
      completed_at = now()
  where id = p_session_id;

  declare
    v_active_season_id uuid;
    v_cp_reset_policy text;
    v_attendee_count int;
    v_standings_metric text;
    v_player record;
    
    v_sub_count int;
    v_base_cp numeric;
    v_penalty numeric;
    v_net_cp numeric;
    v_bonus_cp numeric;
    v_points numeric;
    
    v_medals_gold int;
    v_medals_silver int;
    v_medals_bronze int;
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
        
        -- 1. Count how many matches this player was substituted OUT of
        select count(*) into v_sub_count
        from public.match_players mp
        join public.matches m on mp.match_id = m.id
        where m.session_id = p_session_id
          and mp.profile_id = v_player.profile_id
          and mp.elo_profile_id is not null
          and mp.elo_profile_id != mp.profile_id;
          
        -- 2. Calculate Base and Penalty
        v_base_cp := 5;
        v_penalty := v_sub_count * 3;
        v_net_cp := v_base_cp - v_penalty;
        
        -- 3. Check Forfeiture Rule & Award Podium Bonuses
        if v_net_cp >= 0 then
          if v_player.rnk = 1 then
            v_bonus_cp := 3;
            v_medals_gold := 1;
            v_medals_silver := 0;
            v_medals_bronze := 0;
          elsif v_player.rnk = 2 then
            v_bonus_cp := 2;
            v_medals_gold := 0;
            v_medals_silver := 1;
            v_medals_bronze := 0;
          elsif v_player.rnk = 3 then
            v_bonus_cp := 1;
            v_medals_gold := 0;
            v_medals_silver := 0;
            v_medals_bronze := 1;
          else
            v_bonus_cp := 0;
            v_medals_gold := 0;
            v_medals_silver := 0;
            v_medals_bronze := 0;
          end if;
        else
          v_bonus_cp := 0;
          v_medals_gold := 0;
          v_medals_silver := 0;
          v_medals_bronze := 0;
        end if;
        
        v_points := v_net_cp + v_bonus_cp;

        -- 4. Insert Community Points
        insert into public.community_points (
          community_id, profile_id, session_id, points_awarded, session_rank, session_size, awarded_at, season_id
        )
        values (
          v_community_id, v_player.profile_id, p_session_id, v_points, v_player.rnk, v_attendee_count, now(), v_active_season_id
        )
        on conflict (community_id, profile_id, session_id) 
        do update set points_awarded = excluded.points_awarded; -- In case of backfill idempotency
        
        -- 5. Update player_rankings with Medals
        if (v_medals_gold > 0 or v_medals_silver > 0 or v_medals_bronze > 0) then
          update public.player_rankings
          set gold_medals = gold_medals + v_medals_gold,
              silver_medals = silver_medals + v_medals_silver,
              bronze_medals = bronze_medals + v_medals_bronze
          where community_id = v_community_id
            and profile_id = v_player.profile_id
            and sport = v_sport;
        end if;

      end loop;
    end if;
  end;

end;
$$;


-- 4. Backfill Medals (and reset CP to new rules) for all existing COMPLETED sessions
do $$
declare
  v_session record;
  v_player record;
  v_sub_count int;
  v_base_cp numeric;
  v_penalty numeric;
  v_net_cp numeric;
  v_bonus_cp numeric;
  v_points numeric;
  v_medals_gold int;
  v_medals_silver int;
  v_medals_bronze int;
begin
  -- Reset all medals to 0 before calculating
  update public.player_rankings
  set gold_medals = 0, silver_medals = 0, bronze_medals = 0;

  for v_session in
    select s.id as session_id, s.community_id, s.sport, s.standings_metric,
           (select count(*) from public.session_players sp where sp.session_id = s.id and sp.status = 'ACTIVE') as attendee_count,
           c.cp_reset_policy
    from public.sessions s
    join public.communities c on c.id = s.community_id
    where s.status = 'COMPLETED'
  loop
    if v_session.attendee_count > 0 then
      for v_player in
        select profile_id,
               row_number() over (
                 order by
                   case v_session.standings_metric
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
        where session_id = v_session.session_id and status = 'ACTIVE'
      loop
        
        -- Calculate subs
        select count(*) into v_sub_count
        from public.match_players mp
        join public.matches m on mp.match_id = m.id
        where m.session_id = v_session.session_id
          and mp.profile_id = v_player.profile_id
          and mp.elo_profile_id is not null
          and mp.elo_profile_id != mp.profile_id;
          
        v_base_cp := 5;
        v_penalty := v_sub_count * 3;
        v_net_cp := v_base_cp - v_penalty;
        
        if v_net_cp >= 0 then
          if v_player.rnk = 1 then
            v_bonus_cp := 3;
            v_medals_gold := 1;
            v_medals_silver := 0;
            v_medals_bronze := 0;
          elsif v_player.rnk = 2 then
            v_bonus_cp := 2;
            v_medals_gold := 0;
            v_medals_silver := 1;
            v_medals_bronze := 0;
          elsif v_player.rnk = 3 then
            v_bonus_cp := 1;
            v_medals_gold := 0;
            v_medals_silver := 0;
            v_medals_bronze := 1;
          else
            v_bonus_cp := 0;
            v_medals_gold := 0;
            v_medals_silver := 0;
            v_medals_bronze := 0;
          end if;
        else
          v_bonus_cp := 0;
          v_medals_gold := 0;
          v_medals_silver := 0;
          v_medals_bronze := 0;
        end if;
        
        v_points := v_net_cp + v_bonus_cp;

        -- Update CP back to the new formula for past sessions
        update public.community_points
        set points_awarded = v_points,
            session_rank = v_player.rnk
        where session_id = v_session.session_id
          and profile_id = v_player.profile_id;
          
        -- Update Medals in player_rankings
        if (v_medals_gold > 0 or v_medals_silver > 0 or v_medals_bronze > 0) then
          update public.player_rankings
          set gold_medals = gold_medals + v_medals_gold,
              silver_medals = silver_medals + v_medals_silver,
              bronze_medals = bronze_medals + v_medals_bronze
          where community_id = v_session.community_id
            and profile_id = v_player.profile_id
            and sport = v_session.sport;
        end if;

      end loop;
    end if;
  end loop;
end;
$$;
