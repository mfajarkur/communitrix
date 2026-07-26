-- Migration 0016: Table and RPCs for Guest Claim Approval Workflow

-- 1. Create table guest_claim_requests
create table if not exists public.guest_claim_requests (
  id                   uuid primary key default gen_random_uuid(),
  community_id         uuid not null references public.communities(id) on delete cascade,
  guest_profile_id     uuid not null references public.profiles(id) on delete cascade,
  requester_profile_id uuid not null references public.profiles(id) on delete cascade,
  status               text not null default 'PENDING' check (status in ('PENDING', 'APPROVED', 'REJECTED')),
  created_at           timestamptz not null default now(),
  resolved_at          timestamptz,
  resolved_by          uuid references public.profiles(id),
  unique (community_id, guest_profile_id, requester_profile_id)
);

-- Enable RLS
alter table public.guest_claim_requests enable row level security;

-- Policies for guest_claim_requests
create policy "Authenticated users can view claim requests"
  on public.guest_claim_requests for select to authenticated using (true);

create policy "Users can request claims"
  on public.guest_claim_requests for insert to authenticated
  with check (requester_profile_id = public.current_profile_id());

create policy "Hosts and Admins can update claim requests"
  on public.guest_claim_requests for update to authenticated
  using (
    exists (
      select 1 from public.community_members cm
      where cm.community_id = guest_claim_requests.community_id
        and cm.profile_id = public.current_profile_id()
        and cm.role::text in ('ADMIN', 'HOST')
        and cm.is_active
    ) or public.is_platform_admin()
  );

-- 2. RPC: request_guest_claim
create or replace function public.request_guest_claim(
  p_guest_profile_id uuid,
  p_community_id uuid
)
returns public.guest_claim_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_profile_id uuid;
  v_guest_profile public.profiles;
  v_request public.guest_claim_requests;
begin
  v_caller_profile_id := public.current_profile_id();
  if v_caller_profile_id is null then
    raise exception 'UNAUTHENTICATED' using message = 'Authentication required', errcode = '42501';
  end if;

  -- Check caller is member of community
  if not exists (
    select 1 from public.community_members
    where community_id = p_community_id
      and profile_id = v_caller_profile_id
      and is_active
  ) then
    raise exception 'UNAUTHORIZED' using message = 'Must be a member of the community to claim guest profiles', errcode = '42501';
  end if;

  -- Validate guest profile
  select * into v_guest_profile
  from public.profiles
  where id = p_guest_profile_id and is_guest = true;

  if not found then
    raise exception 'INVALID_GUEST' using message = 'Specified profile is not a valid guest profile', errcode = '22023';
  end if;

  -- Insert or return existing pending request
  insert into public.guest_claim_requests (
    community_id,
    guest_profile_id,
    requester_profile_id,
    status
  )
  values (
    p_community_id,
    p_guest_profile_id,
    v_caller_profile_id,
    'PENDING'
  )
  on conflict (community_id, guest_profile_id, requester_profile_id)
  do update set status = 'PENDING', created_at = now()
  returning * into v_request;

  return v_request;
end;
$$;

grant execute on function public.request_guest_claim(uuid, uuid) to authenticated;

-- 3. RPC: resolve_guest_claim
create or replace function public.resolve_guest_claim(
  p_request_id uuid,
  p_action text -- 'APPROVE' or 'REJECT'
)
returns public.guest_claim_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_profile_id uuid;
  v_request public.guest_claim_requests;
  v_result public.guest_claim_requests;
begin
  v_caller_profile_id := public.current_profile_id();
  if v_caller_profile_id is null then
    raise exception 'UNAUTHENTICATED' using message = 'Authentication required', errcode = '42501';
  end if;

  select * into v_request
  from public.guest_claim_requests
  where id = p_request_id and status = 'PENDING';

  if not found then
    raise exception 'NOT_FOUND' using message = 'Pending claim request not found', errcode = 'P0002';
  end if;

  -- Check caller is admin/host of community
  if not public.is_community_host(v_request.community_id) and not public.is_platform_admin() then
    raise exception 'UNAUTHORIZED' using message = 'Only hosts and admins can resolve claim requests', errcode = '42501';
  end if;

  if p_action = 'APPROVE' then
    -- Execute merge via claim_guest_profile
    perform public.claim_guest_profile(v_request.guest_profile_id, v_request.requester_profile_id);

    -- Update request status
    update public.guest_claim_requests set
      status = 'APPROVED',
      resolved_at = now(),
      resolved_by = v_caller_profile_id
    where id = p_request_id
    returning * into v_result;

    -- Also reject any other pending requests for this same guest profile
    update public.guest_claim_requests set
      status = 'REJECTED',
      resolved_at = now(),
      resolved_by = v_caller_profile_id
    where guest_profile_id = v_request.guest_profile_id
      and id <> p_request_id
      and status = 'PENDING';

  elsif p_action = 'REJECT' then
    update public.guest_claim_requests set
      status = 'REJECTED',
      resolved_at = now(),
      resolved_by = v_caller_profile_id
    where id = p_request_id
    returning * into v_result;
  else
    raise exception 'INVALID_ACTION' using message = 'Action must be APPROVE or REJECT', errcode = '22023';
  end if;

  return v_result;
end;
$$;

grant execute on function public.resolve_guest_claim(uuid, text) to authenticated;
