-- SECURITY DEFINER functions to run with owner privilege, bypassing RLS internally.
-- This avoids infinite recursion loops in RLS policy evaluations.
-- Note: set search_path is set to public explicitly for security.

create or replace function public.current_profile_id()
returns uuid language sql stable security definer set search_path = public as $$
  select id from profiles where auth_user_id = auth.uid();
$$;

create or replace function public.is_community_member(cid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from community_members cm
    where cm.community_id = cid
      and cm.profile_id = public.current_profile_id()
      and cm.is_active
  );
$$;

create or replace function public.is_community_admin(cid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from community_members cm
    where cm.community_id = cid
      and cm.profile_id = public.current_profile_id()
      and cm.role = 'ADMIN' and cm.is_active
  );
$$;

create or replace function public.is_platform_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from platform_admins where profile_id = public.current_profile_id());
$$;

create or replace function public.is_session_participant(sid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from session_players sp
    where sp.session_id = sid and sp.profile_id = public.current_profile_id()
      and sp.status = 'ACTIVE'
  );
$$;

-- Secure schema: by default revoke execution from anon, and allow only authenticated users
revoke execute on all functions in schema public from anon;
grant execute on function public.current_profile_id, public.is_community_member,
  public.is_community_admin, public.is_platform_admin, public.is_session_participant
  to authenticated;
