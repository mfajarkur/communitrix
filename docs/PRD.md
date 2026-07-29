# Communitrix — Technical PRD v2.0
### Multi-Community, Multi-Sport Racket Analytics Platform
**Audience:** AI coding agents (Cursor / Claude Code / v0) + human reviewers
**Status:** Development-ready draft. Sections marked `⚠ DECISION` require a human answer before the affected module is built.

---

## 0. How to use this document (instructions for the coding agent)

1. **Build order is non-negotiable.** Follow §14 Implementation Sequence. Do not scaffold UI before the schema and RLS migrations exist and pass their pgTAP tests.
2. **Postgres is the source of truth for ratings.** Never compute or write `elo_rating` from application code. All rating mutations go through the `SECURITY DEFINER` functions in §7.
3. **Never call Supabase with the service-role key from anything reachable by a browser.** The admin client (§6.4) is importable only from files under `src/server/**` and `src/app/api/**`.
4. When a spec here conflicts with a convenient shortcut, implement the spec and leave a `// SPEC: §x.y` comment.
5. Anything not specified here is an open question — ask, do not invent business rules.

---

## 1. Critique of PRD v1 (what changed and why)

The original brief is a good product sketch but is not buildable as written. The following defects were found and are corrected in this version. Read this section before the schema — several tables changed shape because of it.

| # | Defect in v1 | Impact | Fix (section) |
|---|---|---|---|
| 1 | **Elo normalization is not comparable across scoring types.** `S_A = ScoreA/(ScoreA+ScoreB)` gives S=1.00 for a 4–0 tennis-games win but only 0.58 for a 21–15 points win. Identical dominance, wildly different rating movement. | Ratings are not comparable between formats; the leaderboard is meaningless when a community plays both. | §8.2 — outcome/margin decomposition |
| 2 | **K=32 per match with 8–12 matches per Americano session.** A single evening can move a player ±200 points. | Rating is noise, not signal. | §8.4 — session-load-aware K + per-session cap |
| 3 | **Per-player expected score breaks zero-sum.** If each of 4 players gets their own `E`, the pool inflates or deflates every match. | Rating drift across the community over months. | §8.3 — team-level delta, applied symmetrically |
| 4 | **No `session_players` table.** v1 has no record of who is *attending*. Matchmaking, sit-outs, drop-outs, and standings all need it. | Matchmaking is unimplementable. | §5 `session_players` |
| 5 | **No court count.** 12 players and 1 court ≠ 12 players and 3 courts. | Round generation produces impossible schedules. | `sessions.court_count` |
| 6 | **Tennis is assumed to be doubles.** v1 hardcodes 4 players per match. | Singles tennis cannot be recorded. | `sessions.match_type` |
| 7 | **`profiles.id references auth.users`** — a hard dependency on every player having an account. Real padel groups always have a guest who never signs up. | Admin cannot add the fourth player. Blocks adoption. | §5 `profiles.auth_user_id` (nullable) + guest claim flow |
| 8 | **No idempotency on score submission.** A double-tap on a flaky courtside connection applies Elo twice. | Corrupted ratings, no way to detect it. | `matches.client_request_id` + `elo_applied` guard |
| 9 | **"Admin can edit any match score"** with no recompute path. Elo is order-dependent; editing round 2 invalidates rounds 3–10. | Silent data corruption. | §8.6 deterministic replay |
| 10 | **`community_members` RLS will infinitely recurse** if its policy queries `community_members`. This is the single most common Supabase multi-tenant failure. | Every query returns `infinite recursion detected in policy`. | §6.2 `SECURITY DEFINER` helpers |
| 11 | **Supabase JS cannot open a multi-statement transaction.** Writing a score + 4 rating rows + audit rows from a Server Action is 6 separate round-trips with no atomicity. | Partial writes on any failure. | §7 — score+Elo is one RPC |
| 12 | **Standings by total points is unfair when players sit out.** In an odd-numbered Mexicano, whoever sits out fewest rounds tops the ladder regardless of skill. | Mexicano seeding is wrong from round 2 onward. | §9.4 — per-match normalized standings |
| 13 | **Ties are undefined.** `POINTS_BASED` to a target can't tie, but *timed* and *fixed-total* Americano rounds (the common real format) can. | Undefined behavior at the most-used code path. | `sessions.points_mode` + `tie_policy` |
| 14 | No `communities.join_code`, no invite flow, no way for a second user to reach a community. | The multi-tenant feature is unreachable. | §5, §7 `join_community` |
| 15 | Chicken-and-egg on community creation: RLS blocks inserting the first `community_members` row for a community you are not yet a member of. | `create community` fails in production, works in local no-RLS dev. | §7 `create_community` RPC |

**Confidence:** Defects 1–9, 12–15 are logic/design issues verifiable by inspection — [High confidence]. Defect 10 (RLS recursion) and 11 (no client-side transactions) are Supabase platform behaviors as of my knowledge; both are long-standing but **verify against current Supabase docs** before relying on the exact error text — [Medium-High confidence].

---

## 2. Product scope

### 2.1 In scope (v1.0)
- Multi-tenant communities with isolated leaderboards, members, and session history.
- Two sports: `PADEL`, `TENNIS`. Independent rating per (community × profile × sport).
- Two session formats: `AMERICANO`, `MEXICANO`.
- Courtside live scoring on mobile, with realtime propagation to spectators.
- Elo engine with full audit trail and deterministic recomputation.
- Guest players (no account) managed by community admins.

### 2.2 Explicitly out of scope (v1.0)
Record these as non-goals so the agent does not build them: cross-community global rankings, payments/court booking, point-by-point live tracking, video, chat, native mobile apps, team/fixed-pair tournaments (`Team Americano`), knockout brackets, push notifications.

### 2.3 Primary user journeys
1. **Organizer:** create community → invite 12 members → create Thursday Mexicano session → mark 11 attendees → generate round 1 → monitor → finalize.
2. **Player courtside:** open session on phone → see my court + partner → enter final score → confirm → see rating delta.
3. **Spectator/member:** open leaderboard → see live standings update without refresh.

### 2.4 Role-Based Access Control (RBAC) Specification
1. **MEMBER** (Lowest Level):
   - View community pages, feed, leaderboards, and player profiles.
   - Share community join code and community profile links.
2. **HOST** (Middle Level):
   - All Member capabilities.
   - Create game sessions (`/c/[slug]/sessions/new`).
   - Add guest players to sessions and community.
   - Approve community join requests.
3. **ADMIN** (Highest Level):
   - All Host capabilities.
   - Edit community badge/logo/banner and profile settings.
   - Assign member roles/levels (`ADMIN`, `HOST`, `MEMBER`).
   - Remove members from community (`is_active = false`).
   - Approve/reject guest profile claim requests (`guest_claim_requests`).

---

## 3. Domain glossary

| Term | Definition |
|---|---|
| **Community** | Tenant boundary. All ratings, sessions, and membership are scoped to it. |
| **Profile** | A person. May or may not be linked to an `auth.users` row (guests are not). |
| **Session** | One organized play event: one sport, one format, one date, N attendees, C courts, R rounds. |
| **Round** | A synchronized slate of matches; all matches in round *n* must complete before round *n+1* is generated. |
| **Match** | One scored contest on one court within one round. |
| **Sit-out** | An attendee not assigned to a match in a given round. |
| **Rating** | Community-scoped, sport-scoped Elo. Not portable across communities. |
| **Session points** | Points scored inside a session, used only for Mexicano ladder seeding and session standings. Distinct from Elo. |

---

## 4. Tech stack (pinned)

| Layer | Choice | Notes |
|---|---|---|
| Framework | **Next.js 16.x (App Router)** | Current stable line is 16.2.x as of mid-2026. Turbopack is the default bundler. React 19. — [Medium-High confidence; pin the exact patch at install time via `npm view next version`] |
| Request interception | **`proxy.ts`** (project root or `src/`) | ⚠ Next.js 16 renamed `middleware.ts` → `proxy.ts`, with the export renamed `middleware` → `proxy`, and it now runs on the Node.js runtime. `middleware.ts` still works but is deprecated. Codemod: `npx @next/codemod@latest rename-middleware-to-proxy .` — [High confidence, confirmed in the Next.js 16 release notes] |
| Language | TypeScript 5.x, `strict: true` | |
| Styling | Tailwind CSS v4 + shadcn/ui | ⚠ Verify the shadcn/Tailwind v4 install path at scaffold time. |
| Backend | **Supabase** (Postgres 15+, Auth, Realtime, Storage) | |
| Supabase client | `@supabase/supabase-js` + **`@supabase/ssr`** | `@supabase/auth-helpers-*` is deprecated — do not use it. |
| Env keys | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (new `sb_publishable_…` format; older projects use `NEXT_PUBLIC_SUPABASE_ANON_KEY`), `SUPABASE_SERVICE_ROLE_KEY` (server-only) | Supabase has moved toward publishable/secret key naming; check the project's Connect dialog for which applies. — [Medium confidence, verify live] |
| Validation | Zod (shared between client forms and server actions) | |
| Client state | Zustand (courtside scorer draft only) + Supabase Realtime | No Redux. No TanStack Query in v1 — see §10.5. |
| Charts | Recharts | Rating trend lines. |
| Testing | Vitest (pure logic), pgTAP (RLS + RPC), Playwright (2 critical flows) | |
| Hosting | Vercel | |

> **Version discipline:** all version claims above are time-sensitive. Before scaffolding, run `npx create-next-app@latest --help` and check `supabase.com/docs` — do not trust these pins blindly.

---

## 5. Project directory structure

```
communitrix/
├── src/
│   ├── proxy.ts                          # Next 16: replaces middleware.ts. Refreshes Supabase
│   │                                     # session cookies ONLY. No authorization logic here.
│   ├── app/
│   │   ├── layout.tsx                    # html/body, ThemeProvider, Toaster
│   │   ├── globals.css
│   │   ├── error.tsx  not-found.tsx
│   │   │
│   │   ├── (marketing)/
│   │   │   └── page.tsx                  # public landing
│   │   │
│   │   ├── (auth)/
│   │   │   ├── layout.tsx
│   │   │   ├── login/page.tsx
│   │   │   ├── signup/page.tsx
│   │   │   ├── claim/[token]/page.tsx     # guest profile → real account claim
│   │   │   └── auth/
│   │   │       ├── callback/route.ts      # PKCE code exchange
│   │   │       └── signout/route.ts
│   │   │
│   │   └── (app)/
│   │       ├── layout.tsx                 # requires auth; renders app shell
│   │       ├── onboarding/page.tsx        # first-run: complete profile
│   │       ├── communities/
│   │       │   ├── page.tsx               # my communities
│   │       │   ├── new/page.tsx
│   │       │   └── join/page.tsx          # enter join code
│   │       │
│   │       └── c/[communitySlug]/
│   │           ├── layout.tsx             # loads community + my role → CommunityProvider
│   │           ├── page.tsx               # dashboard: active session, recent results
│   │           ├── leaderboard/
│   │           │   └── [sport]/page.tsx   # /leaderboard/padel
│   │           ├── players/
│   │           │   └── [profileId]/page.tsx   # profile, per-sport stats, trend, match log
│   │           ├── members/page.tsx       # admin: roles, add guest, remove
│   │           ├── sessions/
│   │           │   ├── page.tsx           # history + active
│   │           │   ├── new/page.tsx       # session wizard
│   │           │   └── [sessionId]/
│   │           │       ├── layout.tsx     # session shell + RealtimeSessionProvider
│   │           │       ├── page.tsx       # live board: current round, all courts
│   │           │       ├── standings/page.tsx
│   │           │       ├── rounds/[roundNumber]/page.tsx
│   │           │       ├── players/page.tsx        # attendance / withdraw
│   │           │       └── m/[matchId]/page.tsx    # COURTSIDE SCORER (mobile-first)
│   │           └── settings/page.tsx
│   │
│   ├── components/
│   │   ├── ui/                            # shadcn primitives (button, dialog, sheet, …)
│   │   ├── layout/                        # AppShell, CommunitySwitcher, BottomNav, ThemeToggle
│   │   └── features/
│   │       ├── community/                 # CommunityCard, JoinCodeDialog, MemberRow, RoleBadge
│   │       ├── session/                   # SessionWizard, RoundBoard, CourtCard, SitOutList,
│   │       │                              # AttendanceSheet, WithdrawDialog, FinalizeDialog
│   │       ├── scoring/                   # ScorePad, ScoreStepper, TeamPanel, SubmitBar,
│   │       │                              # ConfirmScoreSheet, OfflineBanner
│   │       ├── leaderboard/               # LeaderboardTable, RankDelta, EloBadge, ProvisionalTag
│   │       └── player/                    # PlayerAvatar, EloTrendChart, MatchHistoryList, StatTiles
│   │
│   ├── server/                            # SERVER-ONLY. Never imported by a client component.
│   │   ├── actions/
│   │   │   ├── community.actions.ts
│   │   │   ├── member.actions.ts
│   │   │   ├── session.actions.ts
│   │   │   ├── round.actions.ts
│   │   │   ├── match.actions.ts
│   │   │   └── profile.actions.ts
│   │   ├── queries/                       # cached read paths for RSC
│   │   │   ├── community.queries.ts
│   │   │   ├── session.queries.ts
│   │   │   ├── leaderboard.queries.ts
│   │   │   └── player.queries.ts
│   │   ├── guards.ts                      # requireUser, requireMember, requireCommunityAdmin
│   │   └── result.ts                      # ActionResult<T> discriminated union
│   │
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts                  # createBrowserClient
│   │   │   ├── server.ts                  # createServerClient (cookies)
│   │   │   ├── admin.ts                   # service-role. import 'server-only' at top.
│   │   │   └── proxy.ts                   # helper used by /src/proxy.ts
│   │   ├── elo/
│   │   │   ├── constants.ts               # K values, caps, RATING_VERSION
│   │   │   ├── normalize.ts               # score → outcome + margin
│   │   │   ├── calculate.ts               # pure Elo (mirror of SQL, for preview + tests)
│   │   │   └── vectors.ts                 # golden test vectors shared with pgTAP
│   │   ├── matchmaking/
│   │   │   ├── types.ts
│   │   │   ├── americano.ts               # partner-rotation scheduler
│   │   │   ├── mexicano.ts                # ladder pairing
│   │   │   ├── sitout.ts                  # fairness queue
│   │   │   ├── standings.ts               # session standings + tiebreaks
│   │   │   └── rng.ts                     # seeded deterministic PRNG
│   │   ├── validation/
│   │   │   ├── schemas.ts                 # Zod schemas, shared client+server
│   │   │   └── score.ts                   # per points_mode score legality
│   │   ├── realtime/channels.ts           # channel name builders
│   │   └── utils/{format,slug,date,cn}.ts
│   │
│   ├── hooks/
│   │   ├── use-realtime-session.ts        # subscribes to matches+rounds for a session
│   │   ├── use-realtime-rankings.ts
│   │   ├── use-score-draft.ts             # Zustand store, survives tab backgrounding
│   │   ├── use-online-status.ts
│   │   └── use-community-role.ts
│   │
│   ├── types/
│   │   ├── database.types.ts              # GENERATED — never hand-edit
│   │   └── domain.ts                      # hand-written app types
│   └── config/{sports,formats,site}.ts
│
├── supabase/
│   ├── config.toml
│   ├── migrations/
│   │   ├── 0001_extensions.sql
│   │   ├── 0002_enums.sql
│   │   ├── 0003_tables.sql
│   │   ├── 0004_indexes.sql
│   │   ├── 0005_helper_functions.sql      # SECURITY DEFINER auth helpers
│   │   ├── 0006_rls_policies.sql
│   │   ├── 0007_rpc_community.sql
│   │   ├── 0008_rpc_session.sql
│   │   ├── 0009_rpc_scoring_elo.sql       # submit_match_score, apply_elo, replay
│   │   ├── 0010_triggers.sql
│   │   ├── 0011_realtime_publication.sql
│   │   └── 0012_seed_dev.sql
│   └── tests/                             # pgTAP
│       ├── rls_isolation.test.sql
│       ├── elo_vectors.test.sql
│       └── idempotency.test.sql
│
├── tests/
│   ├── unit/{elo,americano,mexicano,standings,sitout}.test.ts
│   └── e2e/{session-flow,courtside-scoring}.spec.ts
│
├── scripts/gen-types.sh                   # supabase gen types typescript --linked
├── .env.local.example
└── package.json
```

**Rules the agent must follow for this tree**
- `src/server/**` and `src/lib/supabase/admin.ts` start with `import 'server-only'`.
- Client components never import from `src/server/**` except a Server Action reference passed as a prop.
- `src/lib/elo/**` and `src/lib/matchmaking/**` are **pure functions**: no I/O, no Supabase import, no `Date.now()` (pass timestamps in). This is what makes them testable and deterministic.

---

## 6. Data model

### 6.1 Enums (`0002_enums.sql`)

```sql
create type sport_type      as enum ('PADEL','TENNIS');
create type match_type      as enum ('SINGLES','DOUBLES');
create type session_format  as enum ('AMERICANO','MEXICANO');
create type scoring_type    as enum ('POINTS','GAMES');
create type points_mode     as enum ('FIRST_TO_TARGET','FIXED_TOTAL','TIMED');
create type tie_policy      as enum ('ALLOW_DRAW','GOLDEN_POINT','WIN_BY_TWO');
create type session_status  as enum ('DRAFT','ACTIVE','PAUSED','COMPLETED','CANCELLED');
create type round_status    as enum ('PENDING','ACTIVE','COMPLETED');
create type match_status    as enum ('SCHEDULED','IN_PROGRESS','AWAITING_CONFIRM','COMPLETED','VOIDED');
create type team_side       as enum ('A','B');
create type member_role     as enum ('ADMIN','MEMBER');
create type attendance      as enum ('ACTIVE','WITHDRAWN','NO_SHOW');
create type standings_metric as enum ('AVG_POINT_DIFF','TOTAL_POINTS','WINS');
```

### 6.2 Tables (`0003_tables.sql`)

> **Denormalization is deliberate.** `community_id` is repeated on `sessions`, `rounds`, `matches`, and `match_players` even though it is reachable by join. This keeps every RLS policy a single-column check against an indexed value instead of a 3-table join evaluated per row. Enforce consistency with triggers (§6.5), not with hope.

```sql
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
-- win_rate is DERIVED, never stored: total_wins::numeric / nullif(total_matches,0)

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
  action       text not null,          -- 'MATCH_AMENDED','PLAYER_WITHDRAWN','RATINGS_REPLAYED', …
  entity       text not null,
  entity_id    uuid,
  payload      jsonb,
  created_at   timestamptz not null default now()
);
```

### 6.3 Indexes (`0004_indexes.sql`)

```sql
create index on community_members (profile_id) where is_active;
create index on community_members (community_id, role);
create index on player_rankings (community_id, sport, elo_rating desc);
create index on sessions (community_id, status, scheduled_for desc);
create index on session_players (session_id, status);
create index on matches (session_id, round_number, court_number);
create index on matches (community_id, completed_at) where status = 'COMPLETED';
create index on match_players (profile_id, community_id);
create index on match_players (session_id);
create index on profiles (auth_user_id);
```

### 6.4 Views

```sql
create view v_leaderboard as
select r.community_id, r.sport, r.profile_id, p.full_name, p.avatar_url,
       r.elo_rating, r.total_matches, r.total_wins, r.total_losses,
       case when r.total_matches = 0 then null
            else round(100.0 * r.total_wins / r.total_matches, 1) end as win_rate,
       r.is_provisional,
       rank() over (partition by r.community_id, r.sport order by r.elo_rating desc) as rank
from player_rankings r join profiles p on p.id = r.profile_id;
```
Views inherit the RLS of their base tables only if created with `security_invoker = true` (Postgres 15+). **Set it explicitly** — a plain view runs as its owner and will leak across tenants.

### 6.5 Consistency triggers (`0010_triggers.sql`)
- `trg_denorm_community_id` — BEFORE INSERT on `rounds`/`matches`/`match_players`/`session_players`: populate `community_id` from the parent session; raise if a caller-supplied value disagrees.
- `trg_profiles_updated_at`, `trg_rankings_updated_at`.
- `trg_block_direct_ranking_write` — BEFORE INSERT/UPDATE/DELETE on `player_rankings`: raise unless `current_setting('app.elo_engine', true) = 'on'`. Only the Elo RPC sets that GUC. This is the last line of defence against a stray `.update({elo_rating})` in application code.

---

## 7. Row Level Security

### 7.1 The recursion problem (read this first)
A policy on `community_members` that queries `community_members` recurses and every query fails. The fix is a `SECURITY DEFINER` function, which bypasses RLS inside its own body.

```sql
-- 0005_helper_functions.sql
create or replace function public.current_profile_id()
returns uuid language sql stable security definer set search_path = public as $$
  select id from profiles where auth_user_id = auth.uid();
$$;

create or replace function public.is_community_member(cid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from community_members cm
    where cm.community_id = cid
      and cm.profile_id = public.current_profile_id()
      and cm.is_active
  );
$$;

create or replace function public.is_community_admin(cid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from community_members cm
    where cm.community_id = cid
      and cm.profile_id = public.current_profile_id()
      and cm.role = 'ADMIN' and cm.is_active
  );
$$;

create or replace function public.is_platform_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from platform_admins where profile_id = public.current_profile_id());
$$;

create or replace function public.is_session_participant(sid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from session_players sp
    where sp.session_id = sid and sp.profile_id = public.current_profile_id()
      and sp.status = 'ACTIVE'
  );
$$;

revoke execute on all functions in schema public from anon;
grant execute on function public.current_profile_id, public.is_community_member,
  public.is_community_admin, public.is_platform_admin, public.is_session_participant
  to authenticated;
```

Every `SECURITY DEFINER` function **must** set `search_path` explicitly. Without it the function is a privilege-escalation vector.

### 7.2 Policy matrix

| Table | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| `communities` | member, or platform admin | via `create_community` RPC only | community admin | platform admin only |
| `profiles` | self, or any profile sharing ≥1 community, or platform admin | self on signup; guests via RPC | self, or admin of a community the guest belongs to (guests only) | nobody (soft-handle instead) |
| `community_members` | members of the same community | via `join_community` / `add_member` RPC | community admin (role changes); cannot demote the last admin | community admin, not self-last-admin |
| `player_rankings` | community members | **engine only** | **engine only** | cascade only |
| `sessions` | community members | community admin | community admin | community admin while `DRAFT` |
| `session_players` | community members | community admin, or self-join if session allows | community admin | community admin before round 1 |
| `rounds` | community members | RPC only | RPC only | RPC only |
| `matches` | community members | RPC only | RPC only (`submit_match_score` / `amend`) | never |
| `match_players` | community members | RPC only | RPC only | cascade only |
| `audit_log` | community admin | trigger/RPC only | never | never |

### 7.3 Policy DDL (representative — implement all of §7.2 in this shape)

```sql
alter table communities        enable row level security;
alter table profiles           enable row level security;
alter table community_members  enable row level security;
alter table player_rankings    enable row level security;
alter table sessions           enable row level security;
alter table session_players    enable row level security;
alter table rounds             enable row level security;
alter table matches            enable row level security;
alter table match_players      enable row level security;
alter table audit_log          enable row level security;

-- communities
create policy communities_select on communities for select to authenticated
  using (public.is_community_member(id) or public.is_platform_admin());
create policy communities_update on communities for update to authenticated
  using (public.is_community_admin(id)) with check (public.is_community_admin(id));
-- no INSERT policy: creation is only possible through create_community()

-- community_members  (non-recursive thanks to the helper)
create policy cm_select on community_members for select to authenticated
  using (public.is_community_member(community_id));
create policy cm_update on community_members for update to authenticated
  using (public.is_community_admin(community_id))
  with check (public.is_community_admin(community_id));
create policy cm_delete on community_members for delete to authenticated
  using (public.is_community_admin(community_id)
         or profile_id = public.current_profile_id());   -- leave a community

-- profiles
create policy profiles_select on profiles for select to authenticated
  using (
    id = public.current_profile_id()
    or exists (
      select 1 from community_members a
      join community_members b on a.community_id = b.community_id
      where a.profile_id = public.current_profile_id() and b.profile_id = profiles.id
    )
    or public.is_platform_admin()
  );
create policy profiles_update_self on profiles for update to authenticated
  using (id = public.current_profile_id()) with check (id = public.current_profile_id());

-- player_rankings: readable, never client-writable
create policy rankings_select on player_rankings for select to authenticated
  using (public.is_community_member(community_id));

-- sessions
create policy sessions_select on sessions for select to authenticated
  using (public.is_community_member(community_id));
create policy sessions_insert on sessions for insert to authenticated
  with check (public.is_community_admin(community_id));
create policy sessions_update on sessions for update to authenticated
  using (public.is_community_admin(community_id))
  with check (public.is_community_admin(community_id));

-- matches: read for members; all writes go through RPC (no insert/update policy at all)
create policy matches_select on matches for select to authenticated
  using (public.is_community_member(community_id));
```

**Deliberate design point:** `matches` has *no* INSERT/UPDATE policy. Scoring is not "update a row" — it is a transaction that also mutates ratings, standings, and audit rows. Denying direct DML forces every write through `submit_match_score()`, which is where the invariants live. If you later grant a direct UPDATE policy for convenience, you have reopened defect #8 and #9 from §1.

### 7.4 RLS test obligations (pgTAP, `supabase/tests/rls_isolation.test.sql`)
Each must be an explicit failing-then-passing test:
1. User in community A cannot `select` a session, match, or ranking of community B.
2. `MEMBER` cannot insert a session.
3. Any client `update player_rankings set elo_rating = 9999` fails.
4. Any client `insert into matches` fails.
5. `select` on `community_members` does not raise `infinite recursion`.
6. Anonymous role has zero rows on every table.
7. A guest profile is visible to co-members of its community and invisible to everyone else.

---

## 8. Server-side API surface

### 8.1 Division of labour (the key architectural call)

| Concern | Where it runs | Why |
|---|---|---|
| Round generation / matchmaking | **TypeScript**, in a Server Action | Combinatorial search with seeded randomness; miserable in plpgsql, trivial to unit-test in TS. Output is persisted by one RPC that takes the whole round as JSON and inserts it atomically. |
| Elo application | **plpgsql `SECURITY DEFINER`** | Read-modify-write across 4 ranking rows + match + standings must be one transaction. The Supabase JS client cannot open a transaction across statements, so any TS implementation is non-atomic by construction. |
| Elo *preview* ("what would I gain?") | TypeScript (`lib/elo/calculate.ts`) | Read-only, no writes. Must produce byte-identical results to the SQL — enforced by shared golden vectors in `lib/elo/vectors.ts` + `elo_vectors.test.sql`. |

⚠ **Tradeoff, stated honestly:** this duplicates the Elo formula in two languages. The alternative — TS-only, with an RPC that accepts precomputed deltas — is simpler but lets any caller with a session forge rating changes. The duplication is contained (one pure function, ~40 lines) and pinned by shared test vectors. Accept it, or drop the client-side preview feature and keep one implementation.

### 8.2 Postgres RPCs (`SECURITY DEFINER`, all `set search_path = public`)

| Function | Signature | Guarantees |
|---|---|---|
| `create_community` | `(p_name text, p_slug text) → communities` | Creates community + `ADMIN` membership row in one txn. Solves the RLS chicken-and-egg. |
| `join_community` | `(p_join_code text) → community_members` | Rate-limited; rejects if code disabled; idempotent if already a member. |
| `add_guest_player` | `(p_community_id uuid, p_full_name text) → profiles` | Admin-only. Creates guest profile + membership + zeroed rankings. |
| `issue_claim_token` | `(p_profile_id uuid) → text` | Admin-only. One-time token so a guest can bind an auth account. |
| `claim_profile` | `(p_token text) → profiles` | Binds `auth.uid()` to the guest profile; merges nothing (see §11 E9). |
| `start_session` | `(p_session_id uuid, p_profile_ids uuid[]) → sessions` | Snapshots `seed_elo` for every attendee, sets `ACTIVE`. Rejects if attendee count < players-per-match. |
| `persist_round` | `(p_session_id uuid, p_round_number int, p_matches jsonb) → rounds` | Inserts round + matches + match_players atomically. Rejects if the previous round is incomplete or the round already exists (idempotent by `(session_id, round_number)`). |
| `submit_match_score` | `(p_match_id uuid, p_a int, p_b int, p_client_request_id text) → matches` | **The critical one.** Validates legality (§9.5), sets score, computes and applies Elo, updates `session_players` standings and `player_rankings`, writes `match_players` audit, sets `elo_applied`. Idempotent on `client_request_id`; no-ops if `elo_applied` is already true. |
| `amend_match_score` | `(p_match_id uuid, p_a int, p_b int, p_reason text) → void` | Admin-only. Reverses the affected match, rewrites the score, then calls `replay_ratings` from that match forward. Writes `audit_log`. |
| `void_match` | `(p_match_id uuid, p_reason text) → void` | Admin-only. Reverses Elo if applied, marks `VOIDED`, excludes from standings. |
| `withdraw_session_player` | `(p_session_id uuid, p_profile_id uuid, p_policy text) → void` | `p_policy ∈ {VOID_ROUND, KEEP_PARTIAL}`. See §11 E3. |
| `replay_ratings` | `(p_community_id uuid, p_sport sport_type, p_from timestamptz) → int` | Resets rankings to the state before `p_from`, then re-applies every `COMPLETED` match in `(completed_at, id)` order. Returns matches replayed. Advisory-locked per (community, sport). |
| `finalize_session` | `(p_session_id uuid) → sessions` | Rejects if any match is not `COMPLETED`/`VOIDED`. Sets `COMPLETED`, freezes standings. |
| `recalculate_session_standings` | `(p_session_id uuid) → void` | Rebuilds `session_players` aggregates from `matches`. Repair tool; also called by amend/void. |

All RPCs begin with an authorization guard (`if not is_community_admin(...) then raise exception 'FORBIDDEN' end if;`) — `SECURITY DEFINER` bypasses RLS, so the check must be explicit and is the only thing standing between a member and admin powers.

### 8.3 Next.js Server Actions (`src/server/actions/*.ts`)

Every action: `'use server'` → auth guard → Zod parse → RPC call → `revalidateTag` → return `ActionResult<T>`. Never throw raw Postgres errors to the client.

```ts
type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: 'UNAUTHENTICATED'|'FORBIDDEN'|'VALIDATION'|'CONFLICT'|'NOT_FOUND'|'UNKNOWN';
      message: string; fieldErrors?: Record<string,string[]> };
```

**community.actions.ts**
- `createCommunityAction(input: {name, slug})`
- `updateCommunityAction(communityId, patch)`
- `rotateJoinCodeAction(communityId)`
- `joinCommunityAction(joinCode)`

**member.actions.ts**
- `addGuestPlayerAction(communityId, fullName)`
- `issueClaimTokenAction(profileId)` → returns claim URL
- `changeMemberRoleAction(communityId, profileId, role)` — blocks demoting the last admin
- `removeMemberAction(communityId, profileId)`

**session.actions.ts**
- `createSessionAction(communityId, config)` — validates the config matrix in §9.5
- `setAttendanceAction(sessionId, profileIds)`
- `startSessionAction(sessionId)`
- `withdrawPlayerAction(sessionId, profileId, policy)`
- `addLatePlayerAction(sessionId, profileId)`
- `finalizeSessionAction(sessionId)`
- `cancelSessionAction(sessionId)`

**round.actions.ts**
- `generateNextRoundAction(sessionId)` — **the matchmaking entry point.** Loads session + attendees + history, runs `lib/matchmaking/*`, calls `persist_round`. Guarded by an advisory lock on `session_id` so two admins tapping simultaneously cannot create round 3 twice.
- `previewNextRoundAction(sessionId)` — same computation, no persistence.
- `regenerateRoundAction(sessionId, roundNumber)` — only if no match in that round has a score.

**match.actions.ts**
- `submitMatchScoreAction(matchId, {a, b, clientRequestId})`
- `amendMatchScoreAction(matchId, {a, b, reason})`
- `voidMatchAction(matchId, reason)`
- `startMatchAction(matchId)` — `SCHEDULED → IN_PROGRESS`, for the live board

**profile.actions.ts**
- `updateProfileAction(patch)`, `uploadAvatarAction(file)`, `claimProfileAction(token)`

### 8.4 Route handlers (`src/app/api/**`) — only where an action cannot be used
- `auth/callback/route.ts` — PKCE exchange (must be a route handler)
- `auth/signout/route.ts`
- `api/cron/close-stale-sessions/route.ts` — Vercel Cron; auto-`PAUSED` sessions idle > 12h. Protect with `CRON_SECRET`.

---

## 9. State management & data fetching

### 9.1 The rule
**Server Components read. Server Actions write. Realtime only patches what is already on screen.** No client-side data library in v1.

### 9.2 Read path
- All initial page data is fetched in RSC via `createServerClient` (`src/lib/supabase/server.ts`), inside functions in `src/server/queries/*`.
- Leaderboards and player profiles are cacheable; tag them:
  - `leaderboard:{communityId}:{sport}`
  - `session:{sessionId}`
  - `player:{profileId}:{communityId}:{sport}`
- Every mutating action calls `revalidateTag` for the tags it invalidates. `submit_match_score` invalidates the session tag **and** the leaderboard tag for that community+sport.
- Live session pages are dynamic (`export const dynamic = 'force-dynamic'`) — they are behind auth and change every few minutes.

⚠ Next.js 16 changed caching defaults and introduced explicit caching primitives (`use cache` / cacheComponents). **Verify current semantics before relying on tag revalidation behavior** — [Medium confidence]. If in doubt, start with `force-dynamic` everywhere and add caching only to the leaderboard once it is measured as a bottleneck.

### 9.3 Write path
1. Client component calls the Server Action directly (no fetch, no API route).
2. Action guards → validates → RPC.
3. On success the action returns the new state *and* revalidates. The component applies an optimistic update via `useOptimistic` for the score pad, and reconciles on the returned value.

### 9.4 Realtime
Subscribe with the **browser** client (`createBrowserClient`) — Realtime respects RLS on `postgres_changes`, so a subscriber only receives rows they could have selected. Add the tables to the publication in `0011_realtime_publication.sql` and set `replica identity full` on `matches` so `old` values are present in UPDATE payloads.

| Channel | Table filter | Consumer |
|---|---|---|
| `session:{sessionId}:matches` | `matches` where `session_id=eq.{id}` | live board, court cards |
| `session:{sessionId}:rounds` | `rounds` where `session_id=eq.{id}` | "round 3 is ready" banner |
| `community:{id}:rankings:{sport}` | `player_rankings` where `community_id=eq.{id}` | leaderboard live deltas |

Implementation notes:
- One channel per page, unsubscribed in the effect cleanup. Do not open a channel per court card.
- Realtime is a **patch mechanism, not a source of truth.** On reconnect, refetch the round from the server rather than trusting accumulated events.
- ⚠ `postgres_changes` with RLS has known throughput limits at scale, and Supabase has been steering high-frequency use cases toward Broadcast (including broadcasting from database triggers). For a session with ≤6 courts this is a non-issue; **verify current guidance before scaling** — [Medium confidence].

### 9.5 Client state (deliberately small)
- **Zustand** — one store: the courtside score draft (`matchId`, `a`, `b`, `clientRequestId`, `dirty`). It must survive a screen lock or accidental navigation, so persist it to `sessionStorage`.
- **React Context** — `CommunityProvider` (id, slug, my role) and `RealtimeSessionProvider`. Both hold identity/config, not server data.
- **`useOptimistic`** — score submission and round advance.
- **No TanStack Query in v1.** Add it only if you build the offline queue in §11 E10; at that point its mutation retry/persistence is worth the dependency, and not before.

### 9.6 Offline reality check
Padel courts have bad wifi. Minimum viable resilience:
- The score pad works fully offline (local state), disables submit, and shows a persistent "Not connected — your score is saved on this phone" banner.
- `clientRequestId` is generated when the pad opens, not when submit is tapped, so a retry after a timeout is provably the same submission.
- On reconnect, auto-retry once, then show a manual "Send score" button. Never silently resubmit more than once.

---

## 10. Elo engine specification

**All constants live in `lib/elo/constants.ts` and a `rating_config` row; never inline them.**

### 10.1 Rating scope
Rating key = `(community_id, profile_id, sport)`. Base 1000.00. Ratings are **not** comparable across communities; the UI must never show a cross-community ranking.

### 10.2 Outcome and margin (fixes defect #1)
Decompose the result instead of using a raw score ratio.

```
W_A = 1.0 if team A wins, 0.0 if team B wins, 0.5 if draw

margin  = |score_A - score_B|
denom   = FIRST_TO_TARGET : max_score_target
          FIXED_TOTAL     : max_score_target
          TIMED           : max(score_A + score_B, 1)
          GAMES           : max_score_target
m       = clamp(margin / denom, 0, 1)          -- normalized dominance, comparable across formats

MoV     = 1 + MARGIN_WEIGHT * m                 -- MARGIN_WEIGHT = 0.5  → MoV ∈ [1.0, 1.5]
```
A 21–15 points win and a 4–3 games win now both produce `m ≈ 0.29 / 0.25` instead of `0.58` vs `0.57`-vs-`1.00` incoherence.

⚠ There is a known refinement in public Elo variants where the margin multiplier is damped for heavy favorites to remove autocorrelation (a strong team beating a weak team by a lot should not be rewarded as much). I am not going to state a specific published formula from memory — **if you want that refinement, verify the exact form from the source before implementing it.** [Low confidence on any specific coefficient; the general technique is well established.]

### 10.3 Expected score and delta (fixes defect #3)
```
Elo_A = mean(rating of team A players)      -- singles: the one player
Elo_B = mean(rating of team B players)
E_A   = 1 / (1 + 10^((Elo_B - Elo_A) / 400))

Δ     = K_eff * MoV * (W_A - E_A)

apply +Δ to EVERY player on team A
apply -Δ to EVERY player on team B
```
Identical delta to both partners keeps the pool exactly zero-sum. Partner-differentiated credit ("the weaker partner gains more") is a v2 idea and must be normalized to sum to zero if introduced — flag it as `⚠ DECISION` rather than improvising.

### 10.4 K-factor (fixes defect #2)
```
K_base            = 24
K_provisional     = 48        (first 10 rated matches for that community+sport)
FORMAT_DAMPING    = 1 / sqrt(expected_matches_per_player_this_session)
                    -- Americano/Mexicano evenings are 6–12 matches; damping ≈ 0.29–0.41
K_eff             = (is_provisional ? K_provisional : K_base) * FORMAT_DAMPING
SESSION_DELTA_CAP = ±60       (net change per player per session, applied at finalize)
```
Without damping, a 10-match Americano evening at K=32 can swing a player ±250 — noise, not measurement. With damping the same evening moves a settled player roughly ±25–45.

`expected_matches_per_player_this_session` = `rounds_planned × (playing_slots / attendee_count)`, floored at 1. If `rounds_planned` is null, use `court_count × players_per_match / attendee_count × 8`.

### 10.5 Invariants (assert these in tests)
1. `sum(elo_delta) = 0` for every completed match.
2. `elo_after = elo_before + elo_delta` on every `match_players` row.
3. `player_rankings.elo_rating` equals the `elo_after` of that player's most recent completed match.
4. `total_matches = total_wins + total_losses + total_draws`.
5. A match with `status <> 'COMPLETED'` has `elo_applied = false` and null deltas.
6. Applying the same `client_request_id` twice changes nothing.

### 10.6 Amendments and replay (fixes defect #9)
Elo is order-dependent, so an edited round-2 score invalidates every later rating.

```
amend_match_score(match, a, b, reason):
  advisory_lock(community_id, sport)
  t0 = match.completed_at
  snapshot rankings state as of t0
    (from the earliest match_players.elo_before at or after t0)
  update the match score
  replay_ratings(community_id, sport, t0):
     for each COMPLETED match with completed_at >= t0
     ordered by (completed_at, id)          -- deterministic tiebreak on id
       recompute Δ from CURRENT ratings, rewrite match_players, update rankings
  recalculate_session_standings(affected sessions)
  audit_log('RATINGS_REPLAYED', {matches: n, trigger: match_id})
```
Ordering by `(completed_at, id)` is what makes replay reproducible. Two matches finished in the same millisecond must still order identically on every run — hence the id tiebreak.

Replay cost is O(matches since t0). At community scale (thousands of matches) this is fine synchronously; if a community exceeds ~20k matches, move replay to a background job and mark the leaderboard `RECALCULATING`.

### 10.7 What Elo does *not* do
Session standings (§11.4) are computed from session points and are **independent** of Elo. Mexicano seeds from standings, not from Elo, after round 1. Do not conflate them — v1 of the brief left this ambiguous.

---

## 11. Matchmaking specification

### 11.1 Inputs
```ts
type RoundInput = {
  sessionId: string;
  roundNumber: number;
  format: 'AMERICANO' | 'MEXICANO';
  playersPerMatch: 2 | 4;
  courtCount: number;
  attendees: Attendee[];        // status ACTIVE only
  history: PastPairing[];       // partner + opponent counts so far
  standings: StandingRow[];     // for MEXICANO, round >= 2
  seed: string;                 // `${sessionId}:${roundNumber}` — deterministic
};
```
Output is a `PlannedRound` of `{courtNumber, teamA: [ids], teamB: [ids]}` plus `sitOuts: [ids]`.

### 11.2 Capacity (fixes defect #5)
```
playingSlots = min(floor(activeCount / playersPerMatch), courtCount) * playersPerMatch
sitOutCount  = activeCount - playingSlots
```
If `playingSlots === 0` the round cannot be generated → return a domain error, never an empty round.

### 11.3 Sit-out fairness (answers "odd number of players")
Odd or non-divisible counts are the normal case, not an exception. Selection order for who sits out:

```
sort ascending by:
  1. sit_out_count            (fewest sit-outs sits out first)
  2. -matches_played          (most matches played sits out first)
  3. last_sit_out_round asc   (longest since last sit-out is protected)
  4. seededRandom(seed, profileId)   -- deterministic tiebreak, never Math.random()
take the first `sitOutCount` players
```
Hard constraint: **no player sits out two consecutive rounds** while any other eligible player has sat out fewer times. Assert this in a unit test with N=5,6,7,9,11,13 across 10 rounds — the maximum spread in `sit_out_count` at the end of any run must be ≤ 1.

Also: a player who sits out gets `matches_played` unchanged, which is exactly why standings must normalize per match (§11.4).

### 11.4 Session standings (fixes defect #12)
```
default metric AVG_POINT_DIFF:
  score = (session_points_for - session_points_against) / max(matches_played, 1)

tiebreak chain:
  1. metric value
  2. session_wins
  3. head-to-head point differential between the tied players
  4. seed_elo
  5. seededRandom(seed, profileId)    -- guarantees a total order, always
```
Using totals instead of averages hands the top of the ladder to whoever sat out least. Make the metric configurable (`sessions.standings_metric`) but default to the normalized one.

### 11.5 Americano
Goal: over the session, every player partners every other player as close to equally as possible, and repeats opponents as little as possible.

- **N divisible by 4, single "round-robin" case:** for N=8 a perfect schedule exists where each player partners each other exactly once across 7 rounds. Prefer a precomputed table for N ∈ {4, 8, 12, 16} — deterministic, provably fair, zero search.
- **General case (any N, any court count):** greedy + local search.

```
cost(assignment) =
    W_PARTNER  * Σ (partnerCount[a][b])^2          // W_PARTNER  = 10
  + W_OPPONENT * Σ (opponentCount[a][b])^2         // W_OPPONENT = 3
  + W_BALANCE  * Σ |eloTeamA - eloTeamB| / 100     // W_BALANCE  = 1 (0 for pure social mode)

algorithm:
  candidates = 200 seeded-random shuffles of the playing pool
  for each: chunk into courts, pick the intra-court pairing (3 options per court of 4)
            that minimizes cost, then run 2-opt swaps between courts until no improvement
  return argmin cost
```
Squaring the counts is what forces *spread* rather than merely low totals — one player partnered 3× is worse than three players partnered once each.

Determinism is mandatory: same `seed` + same history ⇒ same round. Regenerating a round must not reshuffle unless the admin explicitly asks.

### 11.6 Mexicano
```
round 1: sort attendees by seed_elo desc
round n: sort attendees by session standings (§11.4)

then, walking down the ordered playing pool in groups of 4:
  court 1 ← ranks 1,2,3,4     pairing  (1 + 4)  vs  (2 + 3)
  court 2 ← ranks 5,6,7,8     pairing  (5 + 8)  vs  (6 + 7)
  …
```
The 1+4 / 2+3 pairing is the standard Mexicano balance rule; it keeps each court's two teams close in strength. Optional soft constraint: if the same pairing occurred in the previous round, swap to 1+3 / 2+4 — make this a config flag `avoid_repeat_partner`, off by default (turning it on breaks the pure Mexicano ladder and some communities will object).

Sit-outs are removed from the pool **before** grouping, using §11.3, so courts are always full.

### 11.7 Singles (tennis)
`playersPerMatch = 2`. Americano singles = rotating opponents, `partnerCount` term drops out of the cost function. Mexicano singles pairs ranks 1v2, 3v4, … Everything else is unchanged.

---

## 12. Edge cases — required behaviors

Every row here needs a test. `⚠ DECISION` rows need your answer before implementation.

| # | Scenario | Required behavior |
|---|---|---|
| **E1** | **Odd / non-divisible attendee count** (5, 7, 9, 11 …) | Sit-out queue per §11.3. Sit-outs are recorded (`sit_out_count++`), earn no session points, play no match. Standings normalize per match. Max sit-out spread ≤ 1 at session end. |
| **E2** | Attendees < playersPerMatch | `start_session` rejects with `INSUFFICIENT_PLAYERS`. Padel needs ≥ 4, tennis singles ≥ 2. |
| **E3** | **Player withdraws mid-session** | Set `session_players.status='WITHDRAWN'`, `withdrawn_round = current`. Completed matches stand and keep their Elo — they were really played. For any of their **in-progress** matches, the admin picks: `VOID_ROUND` (match → `VOIDED`, no Elo, no standings, round regenerates without them) or `SUBSTITUTE` (a sit-out takes the slot; the match restarts at 0–0 and `match_players` is rewritten before any score exists). Never allow substitution after a score is submitted — amend or void instead. |
| **E4** | Player withdraws and returns | New attendance row is not created; flip status back to `ACTIVE` and set `joined_round` to current. Their sit-out fairness counters carry over. |
| **E5** | Late arrival after round 1 | `addLatePlayerAction`. `seed_elo` snapshotted on arrival. Standings use per-match averages so they are not artificially top or bottom; they are ineligible for "most matches" awards. |
| **E6** | **Tie in POINTS mode** | Depends on `points_mode`: `FIRST_TO_TARGET` — a tie is *illegal input*, reject at validation. `FIXED_TOTAL` (e.g. every match is exactly 24 points) and `TIMED` — a tie is legal; behavior follows `tie_policy`: `ALLOW_DRAW` → `is_draw=true`, `W_A=0.5`, both get a draw; `GOLDEN_POINT` → submit is blocked, UI demands one more point; `WIN_BY_TWO` → blocked until the margin is ≥ 2. |
| **E7** | Tie in GAMES mode | Same rules; race-to-N cannot tie. Reject equal scores. |
| **E8** | **Tie in the leaderboard** | Rank by `elo_rating desc`, then `total_wins desc`, then `total_matches asc` (fewer matches for the same rating = better), then `full_name`. Ties in `rank()` are displayed as joint rank (T3). |
| **E9** | Guest player later creates an account | `claim_profile(token)` binds `auth_user_id` to the existing guest profile — history and rating are preserved. If they *also* signed up separately first, do **not** auto-merge two profiles; require admin action and log it. Automatic merge of rating histories is out of scope for v1. |
| **E10** | Score submitted twice (double-tap / retry) | `client_request_id` unique per session + `elo_applied` guard. Second call returns the first result, changes nothing. |
| **E11** | Two devices submit different scores for the same match | First write wins; second gets `CONFLICT` with the stored score and an "this match already has a score — request an amendment" path. Do not last-write-wins a rating-bearing value. |
| **E12** | Two admins tap "next round" simultaneously | `pg_advisory_xact_lock(hashtext(session_id))` in `persist_round` + unique `(session_id, round_number)`. Second call returns the existing round. |
| **E13** | Admin edits a score from round 2 of 9 | §10.6 replay. Show a confirmation naming how many matches and players will be recomputed. |
| **E14** | Session abandoned (rain, injury) | `cancelSessionAction`. ⚠ DECISION: does cancelling **reverse** the Elo of already-completed matches, or keep it? Default recommendation: **keep** — those matches were played. |
| **E15** | Session never finalized | Cron auto-`PAUSED` after 12h idle; only an admin can finalize or cancel. Never auto-finalize with unfinished matches. |
| **E16** | Player removed from the community entirely | Soft: `community_members.is_active=false`. Keep `player_rankings` and match history (deleting them corrupts everyone else's opponent history). Hide from the default leaderboard behind a "show inactive" toggle. |
| **E17** | Two communities, same person | Two independent ratings, one profile. Correct and intended. The UI must always label which community a rating belongs to. |
| **E18** | Score exceeding the target | `FIRST_TO_TARGET`: winner's score must equal the target exactly unless `tie_policy='WIN_BY_TWO'`, in which case `winner ≥ target` and `winner - loser ≥ 2`. `FIXED_TOTAL`: `a + b` must equal the target exactly. `TIMED`: any non-negative pair, capped at 99. |
| **E19** | Negative or absurd score | Zod: integers, 0..99. Postgres: `check (score >= 0)`. Both layers, always. |
| **E20** | Player in two matches in one round | Structurally impossible if generation is correct — assert it anyway in `persist_round` and raise. Silent duplication would double-count Elo. |
| **E21** | Rating drifts below 0 | Floor at 100. Clamp inside the engine and record the clamped delta in `match_players` so invariant #2 still holds. |
| **E22** | Community deleted | `on delete cascade` throughout. ⚠ DECISION: hard delete or soft (`archived_at`)? Recommendation: soft, with a 30-day purge. |

---

## 13. UI / UX specification

### 13.1 Non-negotiables
- **Thumb-first.** The courtside scorer must be usable one-handed, standing, in Jakarta afternoon sun, with sweaty hands. Primary targets ≥ 56px. No dropdowns for scores — steppers and a number pad.
- **Contrast over aesthetics** on the scorer screen. Assume direct sunlight: minimum 7:1 on the score digits.
- **Never lose a score.** Draft persists locally before any network call.
- **Dark mode** is default on session screens (evening play), system-following elsewhere.

### 13.2 Screen inventory (build in this order)
1. `c/[slug]/sessions/[id]/m/[matchId]` — **the scorer.** Team panels top/bottom, giant score, +/- steppers, submit bar pinned to the bottom safe area, confirm sheet showing the projected Elo change before commit.
2. `c/[slug]/sessions/[id]` — live board: one card per court (players, live score, status), sit-out list, "generate round N+1" (admin only, disabled until all courts report).
3. `c/[slug]/leaderboard/[sport]` — rank, name, Elo, W-L, win rate, provisional tag, delta-since-last-session arrow.
4. `c/[slug]/sessions/new` — wizard: sport → format → scoring → target → courts → attendees. Show a live preview: "11 players, 2 courts → 8 play, 3 sit out each round."
5. `c/[slug]/players/[id]` — stat tiles, Elo trend chart, match log with per-match delta.
6. Community dashboard, members, settings.

### 13.3 Copy rules
Label controls by what happens: "Send score", not "Submit". The action keeps its name through the flow — "Send score" produces "Score sent". Errors say what went wrong and what to do: "This match already has a score (21–17). Ask an admin to amend it." Empty states are invitations: "No sessions yet — create the first one."

### 13.4 Feedback
- Toast on score sent, with the rating delta: `+7.2 → 1042.8`.
- Green/red rating deltas, with a shape or arrow as well as color (colorblind safety).
- Optimistic score display with a subtle pending state; on failure, revert and show the retry bar.

---

## 14. Implementation sequence

| Phase | Deliverable | Done when |
|---|---|---|
| 0 | Repo, Next 16 + Tailwind + shadcn, Supabase local, `proxy.ts` session refresh, login/signup | A logged-in user sees an empty `/communities` |
| 1 | Migrations 0001–0006 (enums, tables, indexes, helpers, RLS) + pgTAP RLS suite | All 7 tests in §7.4 pass |
| 2 | `create_community`, `join_community`, `add_guest_player` + community CRUD UI | Two accounts in two communities cannot see each other's data |
| 3 | **Pure logic, no UI:** `lib/elo/*` and `lib/matchmaking/*` with full Vitest coverage | Fairness + invariant tests in §10.5 / §11.3 pass |
| 4 | Session wizard, attendance, `start_session`, `persist_round`, round generation | A 11-player / 2-court Mexicano generates 9 fair rounds in a script |
| 5 | `submit_match_score` + Elo in plpgsql, idempotency tests, golden vectors matching TS | SQL and TS agree on every vector |
| 6 | Courtside scorer + live board + Realtime | Two phones see each other's scores within 2s |
| 7 | Leaderboard, player profile, trend chart | — |
| 8 | Amend / void / replay, audit log, admin tools | Amending round 2 of 9 reproduces correct final ratings |
| 9 | Offline resilience, cron, Playwright E2E | — |

**Do not** start phase 6 before phase 5's tests pass. Scoring UI built on an unverified rating engine is the most expensive rework in this project.

---

## 15. Open decisions (⚠ answer before the affected phase)

1. **Guest players** — confirm the decoupled `profiles` model (§5). It is the single biggest deviation from PRD v1 and it changes auth, RLS, and the profile page. If you say "accounts only", revert `profiles.id` to `references auth.users` and drop E9.
2. **Cancelled sessions** (E14) — keep or reverse Elo?
3. **K-factor / damping constants** (§10.4) — 24 / 48 / ±60 are defensible starting values, not measured ones. Ratings feel wrong for the first month regardless; agree now that you will re-tune once and replay, rather than tuning continuously.
4. **Margin weight** — is a blowout worth more rating than a narrow win at all? Some communities prefer pure win/loss. `MARGIN_WEIGHT = 0` makes it so.
5. **Elo preview on the scorer** — keep it (and accept the dual TS/SQL implementation, §8.1) or drop it?
6. **Sport list** — is a third sport (pickleball) plausible within a year? If yes, keep `sport_type` as an enum but plan the migration; if likely, use a lookup table instead of an enum now.
7. **Community deletion** (E22) — hard or soft?
8. **`avoid_repeat_partner` in Mexicano** (§11.6) — default off?

---

## 16. Explicit non-guarantees in this document

- Version pins in §4 are as of mid-2026 and go stale fast. Re-verify `next`, `@supabase/ssr`, Tailwind, and shadcn install paths at scaffold time.
- Supabase Realtime scaling behavior, the publishable/anon key naming transition, and Next.js 16 caching semantics are all areas where the ecosystem moved recently — **verify from primary docs**, do not trust this document or a model's memory.
- The Elo constants are engineering judgment, not empirical calibration for padel Americano specifically. No public dataset was consulted.
- The `1+4 vs 2+3` Mexicano pairing and the "partner everyone once" Americano property are widely used community conventions; there is no single normative governing-body specification for either format. If your community plays a local variant, the variant wins.