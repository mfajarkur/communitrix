-- Enable Row Level Security (RLS) on all tables
alter table communities        enable row level security;
alter table profiles           enable row level security;
alter table community_members  enable row level security;
alter table platform_admins    enable row level security;
alter table player_rankings    enable row level security;
alter table sessions           enable row level security;
alter table session_players    enable row level security;
alter table rounds             enable row level security;
alter table matches            enable row level security;
alter table match_players      enable row level security;
alter table audit_log          enable row level security;

-- ─────────────── 1. communities ───────────────
create policy communities_select on communities for select to authenticated
  using (public.is_community_member(id) or public.is_platform_admin());

create policy communities_update on communities for update to authenticated
  using (public.is_community_admin(id))
  with check (public.is_community_admin(id));

create policy communities_delete on communities for delete to authenticated
  using (public.is_platform_admin());

-- ─────────────── 2. profiles ───────────────
create policy profiles_select on profiles for select to authenticated
  using (
    auth_user_id = auth.uid()
    or id = public.current_profile_id()
    or exists (
      select 1 from community_members a
      join community_members b on a.community_id = b.community_id
      where a.profile_id = public.current_profile_id() and b.profile_id = profiles.id
    )
    or public.is_platform_admin()
  );

create policy profiles_insert_self on profiles for insert to authenticated
  with check (auth_user_id = auth.uid());

create policy profiles_update_self on profiles for update to authenticated
  using (id = public.current_profile_id())
  with check (id = public.current_profile_id());

create policy profiles_update_guest on profiles for update to authenticated
  using (
    is_guest = true
    and exists (
      select 1 from community_members admin_cm
      join community_members guest_cm on admin_cm.community_id = guest_cm.community_id
      where admin_cm.profile_id = public.current_profile_id()
        and admin_cm.role = 'ADMIN'
        and admin_cm.is_active
        and guest_cm.profile_id = profiles.id
    )
  )
  with check (
    is_guest = true
    and exists (
      select 1 from community_members admin_cm
      join community_members guest_cm on admin_cm.community_id = guest_cm.community_id
      where admin_cm.profile_id = public.current_profile_id()
        and admin_cm.role = 'ADMIN'
        and admin_cm.is_active
        and guest_cm.profile_id = profiles.id
    )
  );

-- ─────────────── 3. community_members ───────────────
create policy cm_select on community_members for select to authenticated
  using (public.is_community_member(community_id));

create policy cm_update on community_members for update to authenticated
  using (public.is_community_admin(community_id))
  with check (public.is_community_admin(community_id));

create policy cm_delete on community_members for delete to authenticated
  using (
    public.is_community_admin(community_id)
    or profile_id = public.current_profile_id()
  );

-- ─────────────── 4. platform_admins ───────────────
create policy platform_admins_select on platform_admins for select to authenticated
  using (public.is_platform_admin() or profile_id = public.current_profile_id());

-- ─────────────── 5. player_rankings ───────────────
create policy rankings_select on player_rankings for select to authenticated
  using (public.is_community_member(community_id));

-- ─────────────── 6. sessions ───────────────
create policy sessions_select on sessions for select to authenticated
  using (public.is_community_member(community_id));

create policy sessions_insert on sessions for insert to authenticated
  with check (public.is_community_admin(community_id));

create policy sessions_update on sessions for update to authenticated
  using (public.is_community_admin(community_id))
  with check (public.is_community_admin(community_id));

create policy sessions_delete on sessions for delete to authenticated
  using (public.is_community_admin(community_id) and status = 'DRAFT');

-- ─────────────── 7. session_players ───────────────
create policy session_players_select on session_players for select to authenticated
  using (public.is_community_member(community_id));

create policy session_players_insert on session_players for insert to authenticated
  with check (
    public.is_community_admin(community_id)
    or (
      profile_id = public.current_profile_id()
      and public.is_community_member(community_id)
      and exists (
        select 1 from communities c
        where c.id = community_id
          and coalesce((c.settings->>'allow_session_self_join')::boolean, false) = true
      )
    )
  );

create policy session_players_update on session_players for update to authenticated
  using (public.is_community_admin(community_id))
  with check (public.is_community_admin(community_id));

create policy session_players_delete on session_players for delete to authenticated
  using (
    public.is_community_admin(community_id)
    and not exists (
      select 1 from rounds r
      where r.session_id = session_players.session_id
    )
  );

-- ─────────────── 8. rounds ───────────────
create policy rounds_select on rounds for select to authenticated
  using (public.is_community_member(community_id));

-- ─────────────── 9. matches ───────────────
create policy matches_select on matches for select to authenticated
  using (public.is_community_member(community_id));

-- ─────────────── 10. match_players ───────────────
create policy match_players_select on match_players for select to authenticated
  using (public.is_community_member(community_id));

-- ─────────────── 11. audit_log ───────────────
create policy audit_log_select on audit_log for select to authenticated
  using (public.is_community_admin(community_id));
