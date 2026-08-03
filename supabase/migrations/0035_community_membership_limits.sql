-- Cap accounts at 3 created communities and 5 joined (active) communities.
-- Enforced inside these security-definer RPCs (not just client-side) since
-- that's the real trust boundary — a client-only check is trivially bypassed
-- by calling the RPC directly. Everything else in both functions is
-- byte-identical to the 0024 versions; only the limit-check blocks are new.
-- No new column/table/enum — Communitrix Plus itself is out of scope here,
-- this migration only adds the caps that will eventually gate it.

-- ─────────────── create_community (limit: 3 created) ───────────────
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

  insert into public.community_members (community_id, profile_id, role, is_active)
  values (v_community.id, v_profile_id, 'ADMIN', true);

  return v_community;
end;
$$;

-- ─────────────── join_community (limit: 5 active memberships) ───────────────
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
  v_joined_count integer;
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

  select * into v_member
  from public.community_members
  where community_id = v_community.id and profile_id = v_profile_id;

  -- Reactivating a previously-left membership must never be blocked by the
  -- cap — the limit check below only applies to genuinely new joins.
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
  where profile_id = v_profile_id and is_active = true;

  if v_joined_count >= 5 then
    raise exception 'Community join limit reached (max 5 active). Upgrade to Communitrix Plus to join more.' using errcode = '42501';
  end if;

  insert into public.community_members (community_id, profile_id, role, is_active)
  values (v_community.id, v_profile_id, 'MEMBER', true)
  returning * into v_member;

  return v_member;
end;
$$;
