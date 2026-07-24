-- Migration 0007: RPC functions for Community operations

-- ─────────────── 1. create_community ───────────────
create or replace function public.create_community(
  p_name text,
  p_slug text
)
returns public.communities
language plpgsql
security definer
set search_path = public
as $$
declare
  v_community public.communities;
  v_profile_id uuid;
begin
  -- Get the current authenticated profile ID
  v_profile_id := public.current_profile_id();
  if v_profile_id is null then
    raise exception 'UNAUTHENTICATED' using message = 'Authentication required to create a community', errcode = '42501';
  end if;

  -- Insert the new community
  insert into public.communities (name, slug, created_by)
  values (p_name, p_slug, v_profile_id)
  returning * into v_community;

  -- Insert the ADMIN membership row for the creator
  insert into public.community_members (community_id, profile_id, role, is_active)
  values (v_community.id, v_profile_id, 'ADMIN', true);

  return v_community;
end;
$$;

-- ─────────────── 2. join_community ───────────────
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
  v_member public.community_members;
begin
  -- Get the current authenticated profile ID
  v_profile_id := public.current_profile_id();
  if v_profile_id is null then
    raise exception 'UNAUTHENTICATED' using message = 'Authentication required to join a community', errcode = '42501';
  end if;

  -- Locate the community by code (case-insensitive)
  select * into v_community
  from public.communities
  where upper(join_code) = upper(p_join_code);

  if v_community is null then
    raise exception 'NOT_FOUND' using message = 'Community not found for this join code', errcode = 'P0002';
  end if;

  -- Verify if the join code is enabled
  if not v_community.join_code_enabled then
    raise exception 'FORBIDDEN' using message = 'Join code is disabled for this community', errcode = '42501';
  end if;

  -- Check if they are already a member (idempotency check)
  select * into v_member
  from public.community_members
  where community_id = v_community.id and profile_id = v_profile_id;

  if v_member is not null then
    -- Reactivate membership if they were previously inactive
    if not v_member.is_active then
      update public.community_members
      set is_active = true, joined_at = now()
      where id = v_member.id
      returning * into v_member;
    end if;
    return v_member;
  end if;

  -- Insert the member row (role is default 'MEMBER')
  insert into public.community_members (community_id, profile_id, role, is_active)
  values (v_community.id, v_profile_id, 'MEMBER', true)
  returning * into v_member;

  return v_member;
end;
$$;

-- ─────────────── 3. add_guest_player ───────────────
create or replace function public.add_guest_player(
  p_community_id uuid,
  p_full_name text
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_profile_id uuid;
  v_guest_profile public.profiles;
begin
  -- Get the current authenticated caller profile ID
  v_caller_profile_id := public.current_profile_id();
  if v_caller_profile_id is null then
    raise exception 'UNAUTHENTICATED' using message = 'Authentication required to add a guest player', errcode = '42501';
  end if;

  -- Authorization check: Caller must be community admin or platform admin
  if not public.is_community_admin(p_community_id) and not public.is_platform_admin() then
    raise exception 'FORBIDDEN' using message = 'Only community administrators can add guest players', errcode = '42501';
  end if;

  -- Create the guest profile (auth_user_id is NULL)
  insert into public.profiles (full_name, created_by)
  values (p_full_name, v_caller_profile_id)
  returning * into v_guest_profile;

  -- Add membership row for the guest player inside the community
  insert into public.community_members (community_id, profile_id, role, is_active)
  values (p_community_id, v_guest_profile.id, 'MEMBER', true);

  -- Initialize zeroed player rankings for all sports
  insert into public.player_rankings (community_id, profile_id, sport, elo_rating, elo_peak)
  values 
    (p_community_id, v_guest_profile.id, 'PADEL', 1000.00, 1000.00),
    (p_community_id, v_guest_profile.id, 'TENNIS', 1000.00, 1000.00);

  return v_guest_profile;
end;
$$;

-- Revoke execute from anon and grant to authenticated
revoke execute on function public.create_community(text, text) from anon;
grant execute on function public.create_community(text, text) to authenticated;

revoke execute on function public.join_community(text) from anon;
grant execute on function public.join_community(text) to authenticated;

revoke execute on function public.add_guest_player(uuid, text) from anon;
grant execute on function public.add_guest_player(uuid, text) to authenticated;
