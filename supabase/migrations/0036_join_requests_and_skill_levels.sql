-- Member management: join-request approval (opt-in per community) and self-reported skill
-- levels with admin-approved level-ups. Both follow the exact PENDING/APPROVED/REJECTED
-- request-table pattern already proven by guest_claim_requests (0016) — one request table,
-- one member-facing request_* RPC, one admin-facing resolve_* RPC each.

-- ─────────────── 1. community_members.skill_level ───────────────
alter table public.community_members
  add column skill_level text check (skill_level in ('BEGINNER', 'INTERMEDIATE', 'ADVANCED'));

-- ─────────────── 2. community_join_requests ───────────────
create table public.community_join_requests (
  id           uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  profile_id   uuid not null references public.profiles(id) on delete cascade,
  status       text not null default 'PENDING' check (status in ('PENDING', 'APPROVED', 'REJECTED')),
  created_at   timestamptz not null default now(),
  resolved_at  timestamptz,
  resolved_by  uuid references public.profiles(id),
  unique (community_id, profile_id)
);

alter table public.community_join_requests enable row level security;

create policy "Authenticated users can view join requests"
  on public.community_join_requests for select to authenticated using (true);

create policy "Users can request to join"
  on public.community_join_requests for insert to authenticated
  with check (profile_id = public.current_profile_id());

create policy "Admins can update join requests"
  on public.community_join_requests for update to authenticated
  using (
    exists (
      select 1 from public.community_members cm
      where cm.community_id = community_join_requests.community_id
        and cm.profile_id = public.current_profile_id()
        and cm.role::text in ('ADMIN', 'HOST')
        and cm.is_active
    ) or public.is_platform_admin()
  );

-- ─────────────── 3. skill_level_requests ───────────────
create table public.skill_level_requests (
  id               uuid primary key default gen_random_uuid(),
  community_id     uuid not null references public.communities(id) on delete cascade,
  profile_id       uuid not null references public.profiles(id) on delete cascade,
  current_level    text check (current_level in ('BEGINNER', 'INTERMEDIATE', 'ADVANCED')),
  requested_level  text not null check (requested_level in ('BEGINNER', 'INTERMEDIATE', 'ADVANCED')),
  status           text not null default 'PENDING' check (status in ('PENDING', 'APPROVED', 'REJECTED')),
  created_at       timestamptz not null default now(),
  resolved_at      timestamptz,
  resolved_by      uuid references public.profiles(id)
);

-- Partial (not plain) unique index — history accumulates across resolved requests, only one
-- PENDING request per member per community at a time is blocked.
create unique index skill_level_requests_one_pending_per_member
  on public.skill_level_requests (community_id, profile_id)
  where status = 'PENDING';

alter table public.skill_level_requests enable row level security;

create policy "Authenticated users can view skill level requests"
  on public.skill_level_requests for select to authenticated using (true);

create policy "Users can request skill level"
  on public.skill_level_requests for insert to authenticated
  with check (profile_id = public.current_profile_id());

create policy "Admins can update skill level requests"
  on public.skill_level_requests for update to authenticated
  using (
    exists (
      select 1 from public.community_members cm
      where cm.community_id = skill_level_requests.community_id
        and cm.profile_id = public.current_profile_id()
        and cm.role::text in ('ADMIN', 'HOST')
        and cm.is_active
    ) or public.is_platform_admin()
  );

-- ─────────────── 4. _grant_community_membership: shared internal helper ───────────────
-- Reactivate-or-insert-with-5-active-cap logic, extracted out of join_community (0035) so it
-- can be reused for an explicit target profile — join_community always grants to the caller
-- themselves, but resolve_join_request's APPROVE branch grants to the *requester*, who is a
-- different profile than the admin calling it. Not granted to `authenticated` — only reachable
-- from other security-definer functions in this file, never directly over the API.
create or replace function public._grant_community_membership(
  p_community_id uuid,
  p_profile_id uuid
)
returns public.community_members
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member public.community_members;
  v_joined_count integer;
begin
  select * into v_member
  from public.community_members
  where community_id = p_community_id and profile_id = p_profile_id;

  if v_member is not null then
    if not v_member.is_active then
      update public.community_members
      set is_active = true, joined_at = now()
      where id = v_member.id
      returning * into v_member;
    end if;
    return v_member;
  end if;

  select count(*) into v_joined_count
  from public.community_members
  where profile_id = p_profile_id and is_active = true;

  if v_joined_count >= 5 then
    raise exception 'Community join limit reached (max 5 active). Upgrade to Communitrix Plus to join more.' using errcode = '42501';
  end if;

  insert into public.community_members (community_id, profile_id, role, is_active)
  values (p_community_id, p_profile_id, 'MEMBER', true)
  returning * into v_member;

  return v_member;
end;
$$;

-- ─────────────── 5. join_community: unchanged behavior, now via the shared helper ───────────────
create or replace function public.join_community(
  p_join_code text
)
returns public.community_members
language plpgsql
security definer
set search_path = public
as $$
declare
  v_community public.communities;
  v_profile_id uuid;
begin
  v_profile_id := public.current_profile_id();
  if v_profile_id is null then
    raise exception 'Authentication required to join a community' using errcode = '42501';
  end if;

  select * into v_community
  from public.communities
  where upper(join_code) = upper(p_join_code);

  if v_community is null then
    raise exception 'Community not found for this join code' using errcode = 'P0002';
  end if;

  if not v_community.join_code_enabled then
    raise exception 'Join code is disabled for this community' using errcode = '42501';
  end if;

  return public._grant_community_membership(v_community.id, v_profile_id);
end;
$$;

-- ─────────────── 6. request_join_community: the new public entry point ───────────────
-- Communities that haven't opted into settings.require_join_approval keep today's instant-join
-- behavior (delegates straight to join_community). Communities that have opted in get a
-- PENDING request instead. Returns a discriminated jsonb so the one client call can tell which
-- happened: {"status": "JOINED", ...} or {"status": "PENDING", ...}.
create or replace function public.request_join_community(
  p_join_code text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_community public.communities;
  v_profile_id uuid;
  v_require_approval boolean;
  v_member public.community_members;
  v_request public.community_join_requests;
begin
  v_profile_id := public.current_profile_id();
  if v_profile_id is null then
    raise exception 'Authentication required to join a community' using errcode = '42501';
  end if;

  select * into v_community
  from public.communities
  where upper(join_code) = upper(p_join_code);

  if v_community is null then
    raise exception 'Community not found for this join code' using errcode = 'P0002';
  end if;

  if not v_community.join_code_enabled then
    raise exception 'Join code is disabled for this community' using errcode = '42501';
  end if;

  v_require_approval := coalesce((v_community.settings->>'require_join_approval')::boolean, false);

  if not v_require_approval then
    v_member := public._grant_community_membership(v_community.id, v_profile_id);
    return jsonb_build_object(
      'status', 'JOINED',
      'community', jsonb_build_object('id', v_community.id, 'slug', v_community.slug, 'name', v_community.name),
      'member', to_jsonb(v_member)
    );
  end if;

  if exists (
    select 1 from public.community_members
    where community_id = v_community.id and profile_id = v_profile_id and is_active = true
  ) then
    raise exception 'You are already a member of this community' using errcode = '23505';
  end if;

  insert into public.community_join_requests (community_id, profile_id, status)
  values (v_community.id, v_profile_id, 'PENDING')
  on conflict (community_id, profile_id)
  do update set status = 'PENDING', created_at = now(), resolved_at = null, resolved_by = null
  returning * into v_request;

  return jsonb_build_object(
    'status', 'PENDING',
    'community', jsonb_build_object('id', v_community.id, 'slug', v_community.slug, 'name', v_community.name),
    'request', to_jsonb(v_request)
  );
end;
$$;

grant execute on function public.request_join_community(text) to authenticated;

-- ─────────────── 7. resolve_join_request ───────────────
create or replace function public.resolve_join_request(
  p_request_id uuid,
  p_action text
)
returns public.community_join_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_profile_id uuid;
  v_request public.community_join_requests;
  v_result public.community_join_requests;
begin
  v_caller_profile_id := public.current_profile_id();
  if v_caller_profile_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select * into v_request
  from public.community_join_requests
  where id = p_request_id and status = 'PENDING';

  if not found then
    raise exception 'Pending join request not found' using errcode = 'P0002';
  end if;

  if not public.is_community_admin(v_request.community_id) and not public.is_platform_admin() then
    raise exception 'Only community administrators can resolve join requests' using errcode = '42501';
  end if;

  if p_action = 'APPROVE' then
    perform public._grant_community_membership(v_request.community_id, v_request.profile_id);

    update public.community_join_requests set
      status = 'APPROVED', resolved_at = now(), resolved_by = v_caller_profile_id
    where id = p_request_id
    returning * into v_result;

  elsif p_action = 'REJECT' then
    update public.community_join_requests set
      status = 'REJECTED', resolved_at = now(), resolved_by = v_caller_profile_id
    where id = p_request_id
    returning * into v_result;
  else
    raise exception 'Action must be APPROVE or REJECT' using errcode = '22023';
  end if;

  return v_result;
end;
$$;

grant execute on function public.resolve_join_request(uuid, text) to authenticated;

-- ─────────────── 8. request_skill_level ───────────────
create or replace function public.request_skill_level(
  p_community_id uuid,
  p_requested_level text
)
returns public.skill_level_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid;
  v_current_level text;
  v_levels text[] := array['BEGINNER', 'INTERMEDIATE', 'ADVANCED'];
  v_current_rank int;
  v_requested_rank int;
  v_request public.skill_level_requests;
begin
  v_profile_id := public.current_profile_id();
  if v_profile_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if p_requested_level not in ('BEGINNER', 'INTERMEDIATE', 'ADVANCED') then
    raise exception 'Invalid skill level' using errcode = '22023';
  end if;

  select skill_level into v_current_level
  from public.community_members
  where community_id = p_community_id and profile_id = v_profile_id and is_active = true;

  if not found then
    raise exception 'Must be an active member of the community to request a skill level' using errcode = '42501';
  end if;

  v_current_rank := coalesce(array_position(v_levels, v_current_level), 0);
  v_requested_rank := array_position(v_levels, p_requested_level);

  if v_requested_rank <= v_current_rank then
    raise exception 'Requested level must be higher than your current level' using errcode = '22023';
  end if;

  begin
    insert into public.skill_level_requests (community_id, profile_id, current_level, requested_level, status)
    values (p_community_id, v_profile_id, v_current_level, p_requested_level, 'PENDING')
    returning * into v_request;
  exception
    when unique_violation then
      raise exception 'You already have a pending skill level request for this community' using errcode = '23505';
  end;

  return v_request;
end;
$$;

grant execute on function public.request_skill_level(uuid, text) to authenticated;

-- ─────────────── 9. resolve_skill_level_request ───────────────
create or replace function public.resolve_skill_level_request(
  p_request_id uuid,
  p_action text
)
returns public.skill_level_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_profile_id uuid;
  v_request public.skill_level_requests;
  v_result public.skill_level_requests;
begin
  v_caller_profile_id := public.current_profile_id();
  if v_caller_profile_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select * into v_request
  from public.skill_level_requests
  where id = p_request_id and status = 'PENDING';

  if not found then
    raise exception 'Pending skill level request not found' using errcode = 'P0002';
  end if;

  if not public.is_community_admin(v_request.community_id) and not public.is_platform_admin() then
    raise exception 'Only community administrators can resolve skill level requests' using errcode = '42501';
  end if;

  if p_action = 'APPROVE' then
    update public.community_members
    set skill_level = v_request.requested_level
    where community_id = v_request.community_id and profile_id = v_request.profile_id;

    update public.skill_level_requests set
      status = 'APPROVED', resolved_at = now(), resolved_by = v_caller_profile_id
    where id = p_request_id
    returning * into v_result;

  elsif p_action = 'REJECT' then
    update public.skill_level_requests set
      status = 'REJECTED', resolved_at = now(), resolved_by = v_caller_profile_id
    where id = p_request_id
    returning * into v_result;
  else
    raise exception 'Action must be APPROVE or REJECT' using errcode = '22023';
  end if;

  return v_result;
end;
$$;

grant execute on function public.resolve_skill_level_request(uuid, text) to authenticated;
