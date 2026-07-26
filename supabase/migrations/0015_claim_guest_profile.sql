-- Migration 0015: RPC for claiming/merging guest profile into real user profile

create or replace function public.claim_guest_profile(
  p_guest_profile_id uuid,
  p_target_profile_id uuid default null
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_profile_id uuid;
  v_effective_target_id uuid;
  v_guest_profile public.profiles;
  v_target_profile public.profiles;
  v_rec record;
begin
  v_caller_profile_id := public.current_profile_id();
  if v_caller_profile_id is null then
    raise exception 'UNAUTHENTICATED' using message = 'Authentication required', errcode = '42501';
  end if;

  v_effective_target_id := coalesce(p_target_profile_id, v_caller_profile_id);

  -- 1. Validate guest profile
  select * into v_guest_profile
  from public.profiles
  where id = p_guest_profile_id;

  if not found then
    raise exception 'NOT_FOUND' using message = 'Guest profile not found', errcode = 'P0002';
  end if;

  if not v_guest_profile.is_guest then
    raise exception 'INVALID_PROFILE' using message = 'Specified profile is not a guest profile', errcode = '22023';
  end if;

  -- 2. Validate target profile
  select * into v_target_profile
  from public.profiles
  where id = v_effective_target_id;

  if not found or v_target_profile.is_guest then
    raise exception 'INVALID_TARGET' using message = 'Target profile must be a registered non-guest user', errcode = '22023';
  end if;

  -- 3. Authorization: caller must be target user OR host/admin of a community guest belongs to
  if v_caller_profile_id <> v_effective_target_id then
    if not exists (
      select 1 from public.community_members cm_guest
      join public.community_members cm_caller on cm_caller.community_id = cm_guest.community_id
      where cm_guest.profile_id = p_guest_profile_id
        and cm_caller.profile_id = v_caller_profile_id
        and cm_caller.role::text in ('ADMIN', 'HOST')
        and cm_caller.is_active
    ) and not public.is_platform_admin() then
      raise exception 'UNAUTHORIZED' using message = 'Only the user or community host/admin can claim guest profiles', errcode = '42501';
    end if;
  end if;

  -- 4. Transfer rankings
  for v_rec in
    select * from public.player_rankings where profile_id = p_guest_profile_id
  loop
    if exists (
      select 1 from public.player_rankings
      where community_id = v_rec.community_id
        and profile_id = v_effective_target_id
        and sport = v_rec.sport
    ) then
      -- Target already has ranking in this community & sport: merge stats
      update public.player_rankings set
        total_matches  = total_matches + v_rec.total_matches,
        total_wins     = total_wins + v_rec.total_wins,
        total_losses   = total_losses + v_rec.total_losses,
        total_draws    = total_draws + v_rec.total_draws,
        points_for     = points_for + v_rec.points_for,
        points_against = points_against + v_rec.points_against,
        elo_rating     = greatest(elo_rating, v_rec.elo_rating),
        elo_peak       = greatest(elo_peak, v_rec.elo_peak),
        last_played_at = greatest(last_played_at, v_rec.last_played_at),
        updated_at     = now()
      where community_id = v_rec.community_id
        and profile_id = v_effective_target_id
        and sport = v_rec.sport;

      delete from public.player_rankings where id = v_rec.id;
    else
      -- Target doesn't have ranking yet: re-assign ranking record
      update public.player_rankings set
        profile_id = v_effective_target_id,
        updated_at = now()
      where id = v_rec.id;
    end if;
  end loop;

  -- 5. Re-assign session players (ignore duplicates if target was also in session)
  update public.session_players
  set profile_id = v_effective_target_id
  where profile_id = p_guest_profile_id
    and not exists (
      select 1 from public.session_players sp2
      where sp2.session_id = session_players.session_id
        and sp2.profile_id = v_effective_target_id
    );

  delete from public.session_players where profile_id = p_guest_profile_id;

  -- 6. Re-assign match players
  update public.match_players
  set profile_id = v_effective_target_id
  where profile_id = p_guest_profile_id
    and not exists (
      select 1 from public.match_players mp2
      where mp2.match_id = match_players.match_id
        and mp2.profile_id = v_effective_target_id
    );

  delete from public.match_players where profile_id = p_guest_profile_id;

  -- 7. Re-assign created_by / submitted_by in sessions and rounds
  update public.sessions set created_by = v_effective_target_id where created_by = p_guest_profile_id;
  update public.rounds set submitted_by = v_effective_target_id where submitted_by = p_guest_profile_id;
  update public.rounds set amended_by = v_effective_target_id where amended_by = p_guest_profile_id;

  -- 8. Delete guest's community membership (target is already member or joins)
  delete from public.community_members where profile_id = p_guest_profile_id;

  -- 9. Delete guest profile
  delete from public.profiles where id = p_guest_profile_id;

  return v_target_profile;
end;
$$;

grant execute on function public.claim_guest_profile(uuid, uuid) to authenticated;
