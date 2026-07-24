-- ─────────────── Tenancy ───────────────
create table communities (
  id            uuid primary key default gen_random_uuid(),
  name          text not null check (char_length(name) between 2 and 60),
  slug          text not null unique check (slug ~ '^[a-z0-9-]{3,40}$'),
  logo_url      text,
  join_code     text not null unique default upper(substr(md5(gen_random_uuid()::text),1,8)),
  join_code_enabled boolean not null default true,
  default_sport sport_type not null default 'PADEL',
  settings      jsonb not null default '{}'::jsonb,
  created_by    uuid,                       -- profiles.id, FK added after profiles
  created_at    timestamptz not null default now()
);

-- profiles is NOT keyed on auth.users. Guests have auth_user_id = null.
create table profiles (
  id             uuid primary key default gen_random_uuid(),
  auth_user_id   uuid unique references auth.users(id) on delete set null,
  is_guest       boolean not null generated always as (auth_user_id is null) stored,
  full_name      text not null check (char_length(full_name) between 1 and 60),
  display_name   text,
  avatar_url     text,
  preferred_hand text check (preferred_hand in ('LEFT','RIGHT')),
  preferred_side text check (preferred_side in ('DRIVE','REVES','BOTH')),  -- padel
  claim_token    text unique,               -- issued when an admin invites a guest to claim
  created_by     uuid references profiles(id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

alter table communities add constraint communities_created_by_fkey
  foreign key (created_by) references profiles(id);

create table community_members (
  id           uuid primary key default gen_random_uuid(),
  community_id uuid not null references communities(id) on delete cascade,
  profile_id   uuid not null references profiles(id) on delete cascade,
  role         member_role not null default 'MEMBER',
  is_active    boolean not null default true,
  joined_at    timestamptz not null default now(),
  unique (community_id, profile_id)
);

create table platform_admins (               -- super admins; keep tiny
  profile_id uuid primary key references profiles(id) on delete cascade
);

-- ─────────────── Ratings ───────────────
create table player_rankings (
  id             uuid primary key default gen_random_uuid(),
  community_id   uuid not null references communities(id) on delete cascade,
  profile_id     uuid not null references profiles(id) on delete cascade,
  sport          sport_type not null,
  elo_rating     numeric(7,2) not null default 1000.00,
  elo_peak       numeric(7,2) not null default 1000.00,
  total_matches  int not null default 0 check (total_matches >= 0),
  total_wins     int not null default 0,
  total_losses   int not null default 0,
  total_draws    int not null default 0,
  points_for     int not null default 0,
  points_against int not null default 0,
  is_provisional boolean not null generated always as (total_matches < 10) stored,
  last_played_at timestamptz,
  rating_version int not null default 1,
  updated_at     timestamptz not null default now(),
  unique (community_id, profile_id, sport)
);

-- ─────────────── Sessions ───────────────
create table sessions (
  id                uuid primary key default gen_random_uuid(),
  community_id      uuid not null references communities(id) on delete cascade,
  session_name      text not null,
  sport             sport_type not null,
  match_type        match_type not null default 'DOUBLES',
  format            session_format not null,
  scoring_type      scoring_type not null,
  points_mode       points_mode not null default 'FIRST_TO_TARGET',
  tie_policy        tie_policy not null default 'ALLOW_DRAW',
  max_score_target  int not null check (max_score_target between 1 and 99),
  court_count       int not null default 1 check (court_count between 1 and 12),
  rounds_planned    int check (rounds_planned between 1 and 30),
  standings_metric  standings_metric not null default 'AVG_POINT_DIFF',
  elo_enabled       boolean not null default true,
  status            session_status not null default 'DRAFT',
  scheduled_for     timestamptz,
  started_at        timestamptz,
  completed_at      timestamptz,
  created_by        uuid not null references profiles(id),
  created_at        timestamptz not null default now(),
  constraint sessions_padel_is_doubles check (sport <> 'PADEL' or match_type = 'DOUBLES'),
  constraint sessions_points_mode_valid check (scoring_type = 'POINTS' or points_mode = 'FIRST_TO_TARGET')
);

create table session_players (
  id              uuid primary key default gen_random_uuid(),
  session_id      uuid not null references sessions(id) on delete cascade,
  community_id    uuid not null references communities(id) on delete cascade,
  profile_id      uuid not null references profiles(id) on delete cascade,
  status          attendance not null default 'ACTIVE',
  seed_elo        numeric(7,2) not null,      -- snapshot at session start; seeding is stable
  joined_round    int not null default 1,
  withdrawn_round int,
  matches_played  int not null default 0,
  sit_out_count   int not null default 0,
  last_sit_out_round int,
  session_points_for     int not null default 0,
  session_points_against int not null default 0,
  session_wins    int not null default 0,
  session_losses  int not null default 0,
  session_draws   int not null default 0,
  unique (session_id, profile_id)
);

create table rounds (
  id           uuid primary key default gen_random_uuid(),
  session_id   uuid not null references sessions(id) on delete cascade,
  community_id uuid not null references communities(id) on delete cascade,
  round_number int not null check (round_number > 0),
  status       round_status not null default 'PENDING',
  generated_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (session_id, round_number)
);

create table matches (
  id             uuid primary key default gen_random_uuid(),
  session_id     uuid not null references sessions(id) on delete cascade,
  round_id       uuid not null references rounds(id) on delete cascade,
  community_id   uuid not null references communities(id) on delete cascade,
  round_number   int not null,
  court_number   int not null check (court_number > 0),
  team_a_score   int check (team_a_score >= 0),
  team_b_score   int check (team_b_score >= 0),
  winner_side    team_side,
  is_draw        boolean not null default false,
  status         match_status not null default 'SCHEDULED',
  elo_applied    boolean not null default false,
  void_reason    text,
  client_request_id text,                      -- idempotency key from the courtside client
  submitted_by   uuid references profiles(id),
  submitted_at   timestamptz,
  completed_at   timestamptz,
  amended_at     timestamptz,
  amended_by     uuid references profiles(id),
  created_at     timestamptz not null default now(),
  unique (round_id, court_number),
  unique (session_id, client_request_id),
  constraint matches_scores_together check (
    (team_a_score is null) = (team_b_score is null)
  ),
  constraint matches_completed_has_scores check (
    status <> 'COMPLETED' or (team_a_score is not null and team_b_score is not null)
  )
);

create table match_players (
  id           uuid primary key default gen_random_uuid(),
  match_id     uuid not null references matches(id) on delete cascade,
  session_id   uuid not null references sessions(id) on delete cascade,
  community_id uuid not null references communities(id) on delete cascade,
  profile_id   uuid not null references profiles(id) on delete cascade,
  team         team_side not null,
  slot         int not null check (slot in (1,2)),
  elo_before   numeric(7,2),
  elo_delta    numeric(6,2),
  elo_after    numeric(7,2),
  k_factor     numeric(5,2),
  rating_version int,
  unique (match_id, profile_id),
  unique (match_id, team, slot)
);

create table audit_log (
  id           bigint generated always as identity primary key,
  community_id uuid,
  actor_profile_id uuid,
  action       text not null,          -- 'MATCH_AMENDED','PLAYER_WITHDRAWN','RATINGS_REPLAYED', ...
  entity       text not null,
  entity_id    uuid,
  payload      jsonb,
  created_at   timestamptz not null default now()
);

-- ─────────────── Views ───────────────
create or replace view v_leaderboard
with (security_invoker = true) as
select r.community_id, r.sport, r.profile_id, p.full_name, p.avatar_url,
       r.elo_rating, r.total_matches, r.total_wins, r.total_losses,
       case when r.total_matches = 0 then null
            else round(100.0 * r.total_wins / r.total_matches, 1) end as win_rate,
       r.is_provisional,
       rank() over (partition by r.community_id, r.sport order by r.elo_rating desc) as rank
from player_rankings r join profiles p on p.id = r.profile_id;
