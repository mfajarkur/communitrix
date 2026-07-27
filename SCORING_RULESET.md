# Communitrix Padel/Tennis Scoring Ruleset & Specification

This document defines the official scoring, matchmaking, sit-out, and leaderboard rules for **Communitrix**. All match generation engines, scoring calculation functions, and leaderboard rankings strictly follow these specifications.

---

## 0. Shared Core Concepts

### 0.1 Rally Scoring & Equal Split
- **Rally Scoring**: Every rally won yields 1 point, regardless of server.
- **Configurable Match Target**: Default is **24 points** per match (configurable per session: 12, 16, 21, 24, 32 points).
- **Doubles Play (2 vs 2)**: Every match is played as 2 vs 2.
- **Equal Point Distribution**: Both players in Team A receive Team A's final points; both players in Team B receive Team B's final points.
  - *Example*: Final score `18 - 14` $\rightarrow$ Team A players receive **+18** each; Team B players receive **+14** each.

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
- **Court Grouping**: Ranks 1–4 $\rightarrow$ Court 1, Ranks 5–8 $\rightarrow$ Court 2, etc.
- **Team Pairing**: Top Court $\rightarrow$ **Rank 1 + Rank 4** vs **Rank 2 + Rank 3** (default).
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
1. **Fewer Real Matches Played**: Players/teams with fewer real matches played get **highest priority to play**.
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

## 4. Codebase Engine Alignment

TheCommunitrix matchmaking engine under `src/lib/matchmaking/` implements these rules:
- `src/lib/matchmaking/americano.ts`: Combinatorial schedule generator for Americano.
- `src/lib/matchmaking/mexicano.ts`: Dynamic rank-based generator using $1+4 \text{ vs } 2+3$ pairing.
- `src/lib/matchmaking/sitout.ts`: Implements priority sit-out selection based on matches played & last bye round.
- `src/lib/matchmaking/standings.ts`: Computes cumulative scores, differentials, and rankings.
