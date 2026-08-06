-- 0045_remove_joined_community_limit.sql
-- Remove the 5-community join limit. Created limit (3) remains untouched in create_community.

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

  select coalesce(max(sort_order), -1) + 1 into v_next_sort_order
  from public.community_members
  where profile_id = p_profile_id;

  insert into public.community_members (community_id, profile_id, role, is_active, sort_order)
  values (p_community_id, p_profile_id, 'MEMBER', true, v_next_sort_order)
  returning * into v_member;

  return v_member;
end;
$$;
