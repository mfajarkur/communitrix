-- Personal (profile-scoped) Quick Match history.
-- Deliberately NOT reusing sessions/rounds/matches/match_players: those tables all have
-- NOT NULL community_id and feed the ELO/player_rankings RPCs. Personal Quick Match is a
-- casual, no-ELO match played outside any community, so it gets its own lightweight table.
create table personal_quick_matches (
  id             uuid primary key default gen_random_uuid(),
  profile_id     uuid not null references profiles(id) on delete cascade,
  activity_name  text not null,
  sport          sport_type not null,
  game_type      text not null,        -- AMERICANO / MEXICANO / TEAM_AMERICANO / TEAM_MEXICANO
  scoring_system text not null,        -- POINTS / GENERAL
  point_target   text not null,
  players        jsonb not null default '[]'::jsonb,   -- PlayerRegistration[]
  matches        jsonb not null default '[]'::jsonb,   -- Match[]
  standings      jsonb not null default '[]'::jsonb,   -- final sorted PlayerStanding[]
  created_at     timestamptz not null default now()
);

create index personal_quick_matches_profile_id_idx on personal_quick_matches (profile_id, created_at desc);

alter table personal_quick_matches enable row level security;

create policy personal_quick_matches_select_own on personal_quick_matches for select to authenticated
  using (profile_id = public.current_profile_id());

create policy personal_quick_matches_insert_own on personal_quick_matches for insert to authenticated
  with check (profile_id = public.current_profile_id());

create policy personal_quick_matches_delete_own on personal_quick_matches for delete to authenticated
  using (profile_id = public.current_profile_id());
