-- Communities get a Public/Private flag and a persistent invite token, replacing typed join
-- codes as the primary way a second user reaches a community. Public communities are
-- discoverable by name via search_public_communities; private ones are only reachable via their
-- invite link (get_community_by_invite_token + the new request_join_community(uuid, uuid)
-- overload). join_code/join_code_enabled and the existing join_community/
-- request_join_community(text) RPCs are left untouched — only the UI surfacing them is removed,
-- this migration adds a parallel path rather than replacing the old one.

alter table public.communities
  add column is_public boolean not null default false,
  add column invite_token uuid not null unique default gen_random_uuid();

-- ─────────────── search_public_communities ───────────────
-- communities_select RLS only allows members to see a row (0006), so "browse public
-- communities" can't be a direct table query — this security-definer RPC is the sanctioned
-- bypass, deliberately returning only a safe subset of fields for is_public = true rows the
-- caller isn't already a member of.
create or replace function public.search_public_communities(
  p_query text
)
returns table (
  id uuid,
  name text,
  slug text,
  logo_url text,
  default_sport sport_type,
  member_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.id, c.name, c.slug, c.logo_url, c.default_sport,
    (select count(*) from community_members cm where cm.community_id = c.id and cm.is_active) as member_count
  from communities c
  where c.is_public = true
    and c.name ilike '%' || p_query || '%'
    and not exists (
      select 1 from community_members cm
      where cm.community_id = c.id
        and cm.profile_id = public.current_profile_id()
        and cm.is_active
    )
  order by c.name asc
  limit 20;
$$;

grant execute on function public.search_public_communities(text) to authenticated;

-- ─────────────── get_community_by_invite_token ───────────────
-- No is_public filter — the token itself is the authorization, so this must resolve private
-- communities too (that's the whole point of an invite link).
--
-- Reads description via to_jsonb(...)->>'description', falling back to settings->>'description',
-- rather than v_community.description directly: some deployments of this schema never picked up
-- 0019_add_description_column.sql, and updateCommunityInfoAction already has to handle the same
-- ambiguity (description can live in the real column or in the settings jsonb) — this mirrors
-- that same fallback instead of assuming the column exists.
create or replace function public.get_community_by_invite_token(
  p_token uuid
)
returns table (
  id uuid,
  name text,
  slug text,
  logo_url text,
  description text,
  default_sport sport_type,
  member_count bigint,
  is_public boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_community public.communities;
  v_json jsonb;
begin
  select * into v_community from communities c where c.invite_token = p_token;

  if v_community is null then
    raise exception 'Invite link not found' using errcode = 'P0002';
  end if;

  v_json := to_jsonb(v_community);

  return query
  select
    v_community.id, v_community.name, v_community.slug, v_community.logo_url,
    coalesce(v_json->>'description', v_community.settings->>'description'),
    v_community.default_sport,
    (select count(*) from community_members cm where cm.community_id = v_community.id and cm.is_active),
    v_community.is_public;
end;
$$;

grant execute on function public.get_community_by_invite_token(uuid) to authenticated;

-- ─────────────── request_join_community(uuid, uuid): new overload ───────────────
-- Coexists with request_join_community(text) — Postgres resolves by argument types. Same
-- JOINED/PENDING branching as the text overload (settings.require_join_approval, same
-- community_join_requests table, same _grant_community_membership helper from 0036), just
-- authorized by public visibility or a matching invite token instead of a typed code.
create or replace function public.request_join_community(
  p_community_id uuid,
  p_invite_token uuid default null
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

  select * into v_community from communities where id = p_community_id;

  if v_community is null then
    raise exception 'Community not found' using errcode = 'P0002';
  end if;

  -- coalesce(..., false) matters here: `invite_token = p_invite_token` evaluates to SQL NULL
  -- when p_invite_token is null (the default for a plain public-search join with no token at
  -- all), and `if not (NULL) then` is treated as false in PL/pgSQL — silently skipping this
  -- check entirely and letting a private community be joined with no token. Caught by the
  -- verification script's "no token" case, not by inspection.
  if not (v_community.is_public or coalesce(v_community.invite_token = p_invite_token, false)) then
    raise exception 'Not authorized to join this community' using errcode = '42501';
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

grant execute on function public.request_join_community(uuid, uuid) to authenticated;
