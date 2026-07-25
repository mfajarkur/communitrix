-- SQL Migration: Add 'HOST' role, is_community_host helper, and configure permissions

-- 1. Add 'HOST' to member_role enum
alter type public.member_role add value 'HOST';

-- 2. Create public.is_community_host helper function
create or replace function public.is_community_host(cid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.community_members cm
    where cm.community_id = cid
      and cm.profile_id = public.current_profile_id()
      and cm.role in ('ADMIN', 'HOST')
      and cm.is_active
  );
$$;

grant execute on function public.is_community_host to authenticated;

-- 3. Update public.add_guest_player check to allow hosts as well
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
  -- Get the caller profile id
  v_caller_profile_id := public.current_profile_id();
  if v_caller_profile_id is null then
    raise exception 'UNAUTHENTICATED' using message = 'Authentication required to add guest', errcode = '42501';
  end if;

  -- Caller must be at least community host or platform admin
  if not public.is_community_host(p_community_id) and not public.is_platform_admin() then
    raise exception 'UNAUTHORIZED' using message = 'Only hosts and admins can add guest players', errcode = '42501';
  end if;

  -- Create new guest profile (auth_user_id = null)
  insert into public.profiles (full_name)
  values (p_full_name)
  returning * into v_guest_profile;

  -- Join to community members (as guest MEMBER)
  insert into public.community_members (community_id, profile_id, role, is_active)
  values (p_community_id, v_guest_profile.id, 'MEMBER', true);

  return v_guest_profile;
end;
$$;
