-- Personal Quick Match resilience: track OPEN (still live, resumable) vs ENDED sessions,
-- and store enough state (config + round sit-outs) to fully resume an in-progress match if
-- the player loses connection or their phone dies mid-session.
alter table personal_quick_matches
  add column status text not null default 'ENDED' check (status in ('OPEN', 'ENDED')),
  add column config jsonb not null default '{}'::jsonb,
  add column round_sit_outs jsonb not null default '{}'::jsonb;

create index personal_quick_matches_status_idx on personal_quick_matches (profile_id, status);

create policy personal_quick_matches_update_own on personal_quick_matches for update to authenticated
  using (profile_id = public.current_profile_id())
  with check (profile_id = public.current_profile_id());
