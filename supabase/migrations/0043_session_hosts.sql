-- SQL Migration 0043: Session Hosts & Community Roles simplification (ADMIN, MEMBER)

-- 1. Create table public.session_hosts
create table if not exists public.session_hosts (
  session_id uuid not null references public.sessions(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (session_id, profile_id)
);

alter table public.session_hosts enable row level security;

create policy session_hosts_select on public.session_hosts for select to authenticated using (true);
create policy session_hosts_insert on public.session_hosts for insert to authenticated with check (true);
create policy session_hosts_delete on public.session_hosts for delete to authenticated using (true);

-- 2. Migrate existing 'HOST' role in community_members to 'MEMBER'
update public.community_members set role = 'MEMBER' where role = 'HOST';

-- 3. Populate default session hosts for all existing sessions using created_by
insert into public.session_hosts (session_id, profile_id)
select s.id, s.created_by
from public.sessions s
where s.created_by is not null
on conflict do nothing;

-- 4. Helper function: is_session_host
create or replace function public.is_session_host(p_session_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.sessions s
    join public.community_members cm on cm.community_id = s.community_id
    where s.id = p_session_id
      and cm.profile_id = public.current_profile_id()
      and cm.role = 'ADMIN'
      and cm.is_active
  )
  or exists (
    select 1 from public.session_hosts sh
    where sh.session_id = p_session_id
      and sh.profile_id = public.current_profile_id()
  )
  or public.is_platform_admin();
$$;

grant execute on function public.is_session_host to authenticated;

-- 5. Helper function: update is_community_host to check admin or platform admin
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
      and cm.role = 'ADMIN'
      and cm.is_active
  ) or public.is_platform_admin();
$$;

grant execute on function public.is_community_host to authenticated;

-- 6. RPC: add_session_host
create or replace function public.add_session_host(
  p_session_id uuid,
  p_target_profile_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_community_id uuid;
begin
  select community_id into v_community_id
  from public.sessions
  where id = p_session_id;

  if not found then
    raise exception 'Session not found' using errcode = 'P0002';
  end if;

  if not public.is_session_host(p_session_id) and not public.is_community_admin(v_community_id) and not public.is_platform_admin() then
    raise exception 'Unauthorized to assign session host' using errcode = '42501';
  end if;

  insert into public.session_hosts (session_id, profile_id)
  values (p_session_id, p_target_profile_id)
  on conflict do nothing;

  return true;
end;
$$;

grant execute on function public.add_session_host to authenticated;

-- 7. RPC: remove_session_host
create or replace function public.remove_session_host(
  p_session_id uuid,
  p_target_profile_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_community_id uuid;
begin
  select community_id into v_community_id
  from public.sessions
  where id = p_session_id;

  if not found then
    raise exception 'Session not found' using errcode = 'P0002';
  end if;

  if not public.is_session_host(p_session_id) and not public.is_community_admin(v_community_id) and not public.is_platform_admin() then
    raise exception 'Unauthorized to remove session host' using errcode = '42501';
  end if;

  delete from public.session_hosts
  where session_id = p_session_id
    and profile_id = p_target_profile_id;

  return true;
end;
$$;

grant execute on function public.remove_session_host to authenticated;
