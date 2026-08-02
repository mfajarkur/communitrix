-- Implements Community Points (CP, Patch 7 in docs/communitrix-elo-adjustment-brief.md section 9)
-- — a participation/activity reward that's fully separate from Elo, awarded per-session at
-- finalize_session time. community-tabs.tsx already reads/displays a `cpMap` built from a
-- `community_points` table and already has wiki text describing this exact formula, and
-- session.actions.ts already has a `startNewCpSeasonAction` calling `start_new_cp_season` — none
-- of that has ever worked, because (per the correction in migration 0028) migration
-- 0018_elo_adjustments_and_cp.sql, which this was originally meant to ship in, was never applied
-- to the live database. This migration creates the whole feature fresh.

-- ─────────────── 1. Tables ───────────────
create table public.community_points (
  id             uuid primary key default gen_random_uuid(),
  community_id   uuid not null references public.communities(id) on delete cascade,
  profile_id     uuid not null references public.profiles(id) on delete cascade,
  session_id     uuid not null references public.sessions(id) on delete cascade,
  points_awarded numeric(8,2) not null,
  session_rank   int not null,
  session_size   int not null,
  awarded_at     timestamptz not null default now(),
  season_id      uuid
  -- Lifetime total per player = sum(points_awarded), no running total column, to avoid a
  -- second source of truth — sum on read (see community-tabs.tsx's existing cpMap).
);

alter table public.communities
  add column cp_reset_policy text not null default 'never'
    check (cp_reset_policy in ('never', 'seasonal'));

create table public.community_point_seasons (
  id           uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  starts_at    timestamptz not null default now(),
  ends_at      timestamptz,
  is_active    boolean not null default true
);

alter table public.community_points
  add constraint community_points_season_id_fkey
  foreign key (season_id) references public.community_point_seasons(id);

create index community_points_community_profile_idx
  on public.community_points (community_id, profile_id);

-- ─────────────── 2. RLS — same "community member can read" pattern as every other table in
-- 0006_rls_policies.sql. Both tables are only ever written by finalize_session/
-- start_new_cp_season (SECURITY DEFINER, bypasses RLS for their own writes), so no
-- insert/update/delete policy is needed for regular users.
alter table public.community_points        enable row level security;
alter table public.community_point_seasons enable row level security;

create policy community_points_select on public.community_points for select to authenticated
  using (public.is_community_member(community_id));

create policy community_point_seasons_select on public.community_point_seasons for select to authenticated
  using (public.is_community_member(community_id));

-- ─────────────── 3. calculate_cp_points: podium + cliff + decay, tiered by session size ───────────────
create or replace function public.calculate_cp_points(p_rank int, p_session_size int)
returns numeric
language plpgsql
immutable
set search_path = public
as $$
declare
  v_field_position int;
  v_field_size int;
  v_decay_fraction numeric;
begin
  if p_session_size >= 10 then
    if p_rank = 1 then
      return 100;
    elsif p_rank = 2 then
      return 75;
    elsif p_rank = 3 then
      return 50;
    elsif p_rank = 4 then
      return 20;
    else
      v_field_position := p_rank - 5;
      v_field_size := greatest(p_session_size - 5, 1);
      v_decay_fraction := least(greatest(v_field_position::numeric / v_field_size, 0.0), 1.0);
      return round(20 - (20 - 8) * v_decay_fraction, 2);
    end if;
  else
    -- N < 10 (including small sessions below the brief's documented 4-player floor — the same
    -- flat-10 tail naturally covers any rank beyond the podium regardless of exact size).
    if p_rank = 1 then
      return 75;
    elsif p_rank = 2 then
      return 50;
    elsif p_rank = 3 then
      return 25;
    else
      return 10;
    end if;
  end if;
end;
$$;

-- ─────────────── 4. start_new_cp_season: admin-only, ends the current season and starts a new one ───────────────
create or replace function public.start_new_cp_season(p_community_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid;
  v_new_season_id uuid;
begin
  v_profile_id := public.current_profile_id();
  if v_profile_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not public.is_community_admin(p_community_id) then
    raise exception 'Only a community administrator can start a new CP season' using errcode = '42501';
  end if;

  update public.community_point_seasons
  set is_active = false, ends_at = now()
  where community_id = p_community_id and is_active = true;

  insert into public.community_point_seasons (community_id, starts_at, is_active)
  values (p_community_id, now(), true)
  returning id into v_new_season_id;

  return v_new_season_id;
end;
$$;

-- ─────────────── 5. finalize_session: award CP after finalizing ───────────────
-- Body is otherwise identical to the live version (0024) — only the new CP block at the end
-- (a nested declare/begin/end, same structure as originally drafted in the brief) is added.
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
        v_points := public.calculate_cp_points(v_player.rnk, v_attendee_count);
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
