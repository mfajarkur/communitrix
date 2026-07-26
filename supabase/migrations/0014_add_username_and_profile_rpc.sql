-- Migration 0014: Add username to profiles + update_my_profile RPC

-- 1. Add username column (nullable initially, unique, format-constrained)
alter table public.profiles
  add column if not exists username text unique
    check (
      username is null or (
        char_length(username) between 3 and 30
        and username ~ '^[a-z0-9_]+$'
      )
    );

-- 2. RPC: check if a username is available (for real-time validation)
create or replace function public.check_username_available(p_username text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not exists (
    select 1 from public.profiles
    where lower(username) = lower(p_username)
      and auth_user_id <> auth.uid()
  );
$$;

grant execute on function public.check_username_available(text) to authenticated;

-- 3. RPC: update own profile (display_name, username, avatar_url)
create or replace function public.update_my_profile(
  p_display_name text default null,
  p_username     text default null,
  p_avatar_url   text default null
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid;
  v_result     public.profiles;
begin
  v_profile_id := public.current_profile_id();
  if v_profile_id is null then
    raise exception 'UNAUTHENTICATED' using errcode = '42501';
  end if;

  -- Validate username format if provided
  if p_username is not null then
    if char_length(p_username) < 3 or char_length(p_username) > 30 then
      raise exception 'USERNAME_LENGTH' using message = 'Username must be between 3 and 30 characters', errcode = '22023';
    end if;
    if p_username !~ '^[a-z0-9_]+$' then
      raise exception 'USERNAME_FORMAT' using message = 'Username can only contain lowercase letters, numbers, and underscores', errcode = '22023';
    end if;
    -- Check uniqueness (excluding self)
    if exists (
      select 1 from public.profiles
      where lower(username) = lower(p_username)
        and id <> v_profile_id
    ) then
      raise exception 'USERNAME_TAKEN' using message = 'This username is already taken', errcode = '23505';
    end if;
  end if;

  update public.profiles set
    display_name = coalesce(p_display_name, display_name),
    username     = coalesce(p_username, username),
    avatar_url   = coalesce(p_avatar_url, avatar_url),
    updated_at   = now()
  where id = v_profile_id
  returning * into v_result;

  return v_result;
end;
$$;

grant execute on function public.update_my_profile(text, text, text) to authenticated;

-- 4. RPC: get own profile with community memberships
create or replace function public.get_my_profile_with_communities()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'profile', row_to_json(p),
    'communities', (
      select jsonb_agg(jsonb_build_object(
        'id', c.id,
        'name', c.name,
        'slug', c.slug,
        'sport', c.default_sport,
        'role', cm.role,
        'joined_at', cm.joined_at
      ) order by cm.joined_at desc)
      from public.community_members cm
      join public.communities c on c.id = cm.community_id
      where cm.profile_id = p.id and cm.is_active
    )
  )
  from public.profiles p
  where p.auth_user_id = auth.uid();
$$;

grant execute on function public.get_my_profile_with_communities() to authenticated;
