-- Lets a user drag-reorder their communities in the switcher (community-nav.tsx), and makes the
-- first one in that order their "default" community — what the top-nav Community tab (/c
-- redirect route) lands on, replacing the old "whichever one I looked at last" cookie behavior
-- with an explicit, user-controlled default.

alter table public.community_members
  add column sort_order integer;

-- Backfill: preserve today's display order exactly (most-recently-joined first, same as the
-- switcher's current `.order('joined_at', { ascending: false })`) so nothing visually changes
-- until a user actually drags something.
with ranked as (
  select id, row_number() over (partition by profile_id order by joined_at desc) - 1 as rn
  from public.community_members
)
update public.community_members cm
set sort_order = ranked.rn
from ranked
where cm.id = ranked.id;

alter table public.community_members
  alter column sort_order set not null,
  alter column sort_order set default 0;

-- ─────────────── create_community: new memberships append at the end of the creator's order ───────────────
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
  v_created_count integer;
  v_next_sort_order integer;
begin
  v_profile_id := public.current_profile_id();
  if v_profile_id is null then
    raise exception 'Authentication required to create a community' using errcode = '42501';
  end if;

  select count(*) into v_created_count
  from public.communities
  where created_by = v_profile_id;

  if v_created_count >= 3 then
    raise exception 'Community creation limit reached (max 3). Upgrade to Communitrix Plus to create more.' using errcode = '42501';
  end if;

  insert into public.communities (name, slug, created_by)
  values (p_name, p_slug, v_profile_id)
  returning * into v_community;

  select coalesce(max(sort_order), -1) + 1 into v_next_sort_order
  from public.community_members
  where profile_id = v_profile_id;

  insert into public.community_members (community_id, profile_id, role, is_active, sort_order)
  values (v_community.id, v_profile_id, 'ADMIN', true, v_next_sort_order);

  return v_community;
end;
$$;

-- ─────────────── _grant_community_membership: new memberships append at the end ───────────────
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
  v_next_sort_order integer;
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

  select coalesce(max(sort_order), -1) + 1 into v_next_sort_order
  from public.community_members
  where profile_id = p_profile_id;

  insert into public.community_members (community_id, profile_id, role, is_active, sort_order)
  values (p_community_id, p_profile_id, 'MEMBER', true, v_next_sort_order)
  returning * into v_member;

  return v_member;
end;
$$;

-- ─────────────── reorder_communities ───────────────
-- community_members' UPDATE RLS policy (cm_update, 0006) only allows a community ADMIN to
-- update a row — a plain member has no column-scoped way to touch even their own sort_order via
-- the regular client. This is the sanctioned bypass: security definer, but the WHERE clause pins
-- every update to `profile_id = caller AND is_active = true`, so the caller can only ever
-- reorder their own active memberships, never anyone else's row or any other column.
create or replace function public.reorder_communities(
  p_community_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid;
begin
  v_profile_id := public.current_profile_id();
  if v_profile_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  update public.community_members cm
  set sort_order = ord.idx - 1
  from unnest(p_community_ids) with ordinality as ord(community_id, idx)
  where cm.community_id = ord.community_id
    and cm.profile_id = v_profile_id
    and cm.is_active = true;
end;
$$;

grant execute on function public.reorder_communities(uuid[]) to authenticated;
