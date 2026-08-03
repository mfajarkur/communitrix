# Communitrix Padel/Tennis Scoring Ruleset & Specification

This document defines the official scoring, matchmaking, sit-out, and leaderboard rules for **Communitrix**. All match generation engines, scoring calculation functions, and leaderboard rankings strictly follow these specifications.

---

## 0. Shared Core Concepts

### 0.1 Rally Scoring & Equal Split
- **Rally Scoring**: Every rally won yields 1 point, regardless of server.
- **Configurable Match Target**: Default is **24 points** per match (configurable per session: 12, 16, 21, 24, 32 points).
- **Match Type (`sessions.match_type`)**: Padel is always Doubles (2 vs 2) — enforced by a DB check constraint. Tennis can be either Doubles or Singles (1 v 1), chosen by the host at session creation; the session wizard only offers the choice for Tennis. Quick Match and Offline mode always play Doubles today, regardless of sport.
- **Equal Point Distribution (Doubles only)**: Both players in Team A receive Team A's final points; both players in Team B receive Team B's final points.
  - *Example*: Final score `18 - 14` $\rightarrow$ Team A players receive **+18** each; Team B players receive **+14** each. In Singles, the single player on each side simply receives that side's score directly.

### 0.2 Round Lifecycle Gate
- Round $N+1$ **cannot** be generated until Round $N$ is 100% completed (all matches in Round $N$ must have final scores).

---

## 1. Game Modes Specification

### 1.1 Americano (Individual)
- **Rotation**: Partner rotates every round. Every player partners with every other player over the tournament course.
- **Schedule Basis**: **Ranking-Agnostic / Pure Combinatorial**. Player scores never affect Americano match pairings.
- **Partner Constraint**: Hard constraint — no two players may partner together more than once.

### 1.2 Mexicano (Individual)
- **Rotation**: Partners & opponents are re-formed every round based on **live cumulative rankings**.
- **Sequential Only**: Round $N+1$ is generated *only after* Round $N$ finishes and rankings update.
- **Proximity-Based Court Grouping**:
  - The engine prioritizes players with fewer real matches played (*bye priority*).
  - To prevent large rank gaps (e.g. Rank #1 playing with Rank #8), courts are formed by **clustering players closest to each other in overall standings rank (Proximity Clustering)**.
- **Temporal Rank Team Pairing**:
  - Within each court of 4 proximity-clustered players, players are ordered 1 to 4 relative to each other (*temporal rank*).
  - Matchup: **Temporal Rank 1 + Rank 4** vs **Temporal Rank 2 + Rank 3** (default).
  - If repeat partner avoidance is active and Rank 1 & 4 paired in the previous round, switches to **1 + 3 vs 2 + 4**.
- **Round 1 Initial Seeding**: Seeded by initial Elo rating or deterministic random shuffle.

### 1.3 Team Americano (Fixed Pairs)
- **Rotation**: Fixed pairs (teams do not rotate partners). Teams rotate opponents in a round-robin schedule.
- **Schedule Basis**: Ranking-agnostic round-robin schedule between fixed teams.

### 1.4 Team Mexicano (Fixed Pairs)
- **Rotation**: Fixed pairs (teams do not rotate partners).
- **Pairing Basis**: Live team rankings after each round. Rank 1 vs Rank 2 $\rightarrow$ Court 1, Rank 3 vs Rank 4 $\rightarrow$ Court 2 (Swiss-system format).

---

## 2. Bye & Sit-Out Priority System

When total players/teams exceed court capacity ($4 \times \text{Courts}$ for Individual, $\text{Courts}$ for Team modes), excess entities sit out ("Bye") for that round.

### 2.1 Sit-Out Priority Order (Who Plays vs Who Sits Out)
1. **Fewer Real Matches Played**: Players/teams with fewer real matches played get **highest priority to play** (cannot be forced to sit out).
2. **Longest Bye Interval**: Player/team with the longest time since their last bye round gets priority to play.
3. **Lower Cumulative Points**: Players/teams with lower points get priority to play (opportunity to catch up).
4. **Deterministic Random Seed**: Fixed seed tie-breaker.

### 2.2 Bye Point Award Formula
- **Default Formula**:
  $$\text{Bye Point} = \frac{\text{Target Points Per Match}}{2}$$
  - *Example*: For a 24-point target match, sitting out awards **12 bye points**.
- Bye points are permanently recorded for that round and added to `cumulative_points`.

---

## 3. Leaderboard Ranking & Tie-Breakers

Standings are calculated using the following deterministic tie-breaker hierarchy:

1. **Total Points / Wins** (depending on session config: `POINT` or `WIN`).
2. **Point Differential** ($\text{Points Won} - \text{Points Lost}$).
3. **Matches Played** (fewer matches played ranks higher when points are tied).
4. **Head-to-Head Result**.
5. **Alphabetical / Seed Order**.

---

## 4. Role-Based Access Control (RBAC) Hierarchy

The community management system enforces a strict 3-tier permission model:

| Permission / Action | MEMBER | HOST | ADMIN |
|---|:---:|:---:|:---:|
| **View Community & Leaderboards** | ✅ | ✅ | ✅ |
| **Share Community Code & Link** | ✅ | ✅ | ✅ |
| **Create Game Sessions (`/sessions/new`)** | ❌ | ✅ | ✅ |
| **Add Guest Players to Sessions/Community** | ❌ | ✅ | ✅ |
| **Approve Community Join Requests** | ❌ | ✅ | ✅ |
| **Change Community Badge/Logo/Banner** | ❌ | ❌ | ✅ |
| **Assign Member Roles (Admin/Host/Member)** | ❌ | ❌ | ✅ |
| **Remove Members from Community** | ❌ | ❌ | ✅ |
| **Approve Profile Claim Requests** | ❌ | ❌ | ✅ |

---

## 5. Elo & Skill Rating Adjustments

Formula version 2 (`carry_rule_enabled = true` in `rating_formula_versions`) is the currently-active version — every match created since is scored with 5.1 and 5.1a below. Matches created before formula version 2 shipped keep scoring under the raw-average, flat-split formula forever (even on replay after a void/amend), per `matches.formula_version`.

### 5.1 Effective Team Rating (`GAP_PENALTY_FRACTION = 0.25`)
To prevent lopsided team pairing expectations where a high-Elo player is paired with a lower-Elo player, expected score calculations adjust team ratings using internal gap dampening:
$$\text{Effective Elo} = \text{Team Avg Elo} - 0.25 \times |\text{Elo}_{\text{Player 1}} - \text{Elo}_{\text{Player 2}}|$$

### 5.1a Carry Rule — per-partner delta split (`GAP_REFERENCE = 150`)
Instead of both partners on a team receiving the identical team-level delta, it's split between them based on their own internal Elo gap — the lower-rated partner keeps more of a win and loses less of a loss:
$$\text{skew} = \min\left(\frac{|\text{Elo}_{\text{high}} - \text{Elo}_{\text{low}}|}{150},\ 1.0\right)$$
$$\text{lowerShare} = \begin{cases} 0.5 + 0.1 \times \text{skew} & \text{team won} \\ 1 - (0.5 + 0.15 \times \text{skew}) & \text{team lost or drew} \end{cases}$$
The lower-rated partner receives `teamDelta × lowerShare`; the higher-rated partner receives the remainder (`teamDelta - lowerDelta`, not independently rounded, so the pair always sums exactly to `teamDelta` and the zero-sum invariant across all 4 players holds regardless of rounding). Singles matches are unaffected — there's no partner to split with.

### 5.2 Skill Rating — WON'T BUILD (display-only estimate ships instead)
The admin-judgment Skill Rating system described in `communitrix-elo-adjustment-brief.md` Patch 6 (an admin-assigned $1.00$–$7.00$ value, plus `review_flagged`/`review_flagged_at` drift and carry-overperformance review triggers) was never built, and — as of this decision — never will be. Confirmed directly against the live database that none of it exists (`player_rankings` has no `review_flagged`, `review_flagged_at`, or `skill_rating_official` column). This is a deliberate product decision, not a backlog item; see the brief's own top-of-file correction and section 7.

What ships instead, permanently: the "Skill Rating" shown on community leaderboards (`community-tabs.tsx`) is a **client-side derived display value**, computed on the fly from the player's current `elo_rating` — `1.0 + max(0, (elo_rating - 800) / 250)` — with no admin input, no stored column, and no review-flagging of any kind. Treat it as a cosmetic Elo-to-1–7-scale conversion, not a separate rating system.

### 5.3 Session Delta Cap — removed
An earlier draft defined `SESSION_DELTA_CAP = 60` (intended to cap a player's total Elo swing within a single session) but never enforced it anywhere. The constant has been deleted from `src/lib/elo/constants.ts` — there is no per-session delta cap, by deliberate decision, not oversight.

---

## 6. Community Points (CP) Engine

Community Points (CP) are participation rewards computed upon session finalization (`finalize_session`):

- **Session Size $N \ge 10$**:
  - Rank 1: **100 CP**
  - Rank 2: **75 CP**
  - Rank 3: **50 CP**
  - Rank 4: **20 CP**
  - Rank $5 \dots N$: Linear decay from 20 down to floor 8 CP.
- **Session Size $N < 10$**:
  - Rank 1: **75 CP**
  - Rank 2: **50 CP**
  - Rank 3: **25 CP**
  - Rank $4 \dots N$: Flat **10 CP**.
- Reset Policy: Configurable per community (`never` or `seasonal`). Admin can initiate new seasons via `start_new_cp_season` — the RPC works as of `0029_community_points.sql`, but no UI control calls it yet.

---

## 7. Codebase Engine Alignment

TheCommunitrix matchmaking and rating engine under `src/lib/` and `supabase/migrations/` implements these rules:
- `src/lib/matchmaking/americano.ts`: Combinatorial schedule generator for Americano.
- `src/lib/matchmaking/mexicano.ts`: Dynamic proximity-clustered rank generator with temporal $1+4 \text{ vs } 2+3$ pairing.
- `src/lib/elo/calculate.ts`: TypeScript Elo engine with Effective Team Rating and Carry Rule (formula_version >= 2).
- `supabase/migrations/0028_carry_rule_and_effective_team_rating.sql`: `formula_version`/`rating_formula_versions`, `split_team_delta`, and the matching updates to `submit_match_score`, `persist_round`, and `replay_ratings` — the live implementation.
- `supabase/migrations/0029_community_points.sql`: `community_points`, `community_point_seasons`, `communities.cp_reset_policy`, `calculate_cp_points`, `start_new_cp_season`, and the CP-awarding block in `finalize_session` — the live implementation.
- `supabase/migrations/0032_session_match_type.sql`: wires `sessions.match_type` (existed since the original schema, but `start_session` never had a parameter for it) into `start_session`, plus a `src/server/actions/round.actions.ts` fix so round generation actually reads it instead of hardcoding Doubles. `persist_round`/`submit_match_score`/`replay_ratings` (0028) and the matchmaking engines (`americano.ts`/`mexicano.ts`) already handled Singles correctly — only the entry points were missing.
- `supabase/migrations/0018_elo_adjustments_and_cp.sql`: confirmed **not applied to the live database at all** — none of its tables/columns/functions ever existed (`calculate_match_delta`, the original `formula_version`/`rating_formula_versions`, `skill_rating_official`, and the original `community_points`/`community_point_seasons`/`start_new_cp_season`, since superseded by `0028`/`0029` above). Skill Rating (section 5.2's `skill_rating_official` etc.) is the one remaining piece of 0018 with no live implementation. See `communitrix-elo-adjustment-brief.md` section 0.
