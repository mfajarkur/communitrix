# Padel/Tennis Scoring App — Match-up Rules Specification
### Modes: Americano, Mexicano, Team Americano, Team Mexicano

You are implementing the match-up generation engine for a padel/tennis scoring app.
This document defines the exact rules for all four modes. Follow these rules precisely.
Where a rule is marked `DEFAULT (configurable)`, implement it as the default behavior but
expose it as a setting rather than hardcoding it.

---

## 0. Shared Concepts (apply to all 4 modes)

### 0.1 Scoring format
- Rally scoring: every rally won = 1 point, regardless of who served.
- Match target: a fixed point total per match (common values: 16, 21, 24, 32). Must be
  configurable per tournament, default 24.
- Each match is 2 vs 2 (doubles).
- Match points are split identically to every member of a team based on final score.
  Example: match ends 18–14 → both winners get +18 each, both losers get +14 each.

### 0.2 Required data model (per entity — a player in Individual modes, a fixed pair in
Team modes)

```
Entity {
  id
  cumulative_points        // total points accumulated across the tournament
  matches_played           // count of REAL matches played (byes NOT counted here)
  bye_count                // number of times this entity has received a bye
  last_bye_round           // round number of most recent bye (null if never)
  partner_history: []      // (Individual modes only) list of entity ids already partnered with
  opponent_history: []     // list of entity ids already played against
}
```

`matches_played` and `last_bye_round` are the fields used to enforce the "fewer matches
played gets priority to play" rule in Section 5.

### 0.3 Round lifecycle (applies to all modes)
```
Round {
  round_number
  matches: [ {court, teamA, teamB, scoreA, scoreB, status: pending|final} ]
  byes: [entity_id]        // entities sitting out this round
  status: in_progress | completed
}
```
A round is `completed` only when every match in it has `status: final` (or is explicitly
marked as a forfeit with a score). This status gate is critical for Mexicano/Team Mexicano
(see Section 2.2).

---

## 1. MODE: AMERICANO (Individual)

### 1.1 Definition
Partners rotate every round. The goal is that every player partners with every other
player exactly once over the course of the tournament (achievable exactly when player
count is a multiple of 4). Points are tracked per individual player, not per fixed pair.

### 1.2 Match-up generation — ranking-agnostic
This is the core rule you must implement correctly: **ranking/points must never be an
input to Americano schedule generation.** The schedule is purely combinatorial.

**Algorithm:**
1. Treat this as a variant of the Social Golfer Problem / round-robin partner scheduling.
2. Hard constraint: two players may never be paired as partners `(A,B)` more than once.
3. Soft constraint (best-effort, lower priority than #2): avoid repeating an opponent
   matchup `(A vs B)` more than necessary.
4. If player count `N` is a multiple of 4: total matches = `N × (N-1) / 4`, played across
   `N-1` rounds, and every player partners with every other player exactly once.
5. If `N` is not a multiple of 4, or exceeds `courts × 4`: some players sit out each round.
   Use the bye-selection algorithm in Section 5 to choose who sits out, applied fairly
   across rounds so no one sits out more than once before everyone has sat out at least
   once.

### 1.3 Pre-computed vs. rolling generation
- `DEFAULT (configurable)`: generate the **entire schedule upfront** for the full roster
  before round 1 starts. This is the classical, correct implementation of Americano and
  should be the default when the roster is fixed at tournament start.
- **Dynamic roster exception**: if players can join late or leave mid-tournament (common
  in a live app), pre-computing the whole schedule is not possible. In that case:
  - Only generate **one round at a time** ("rolling generation").
  - Before generating round `N+1`, recompute the active roster.
  - Never repeat a partner pairing that has already occurred, checking `partner_history`.
  - When the active roster count doesn't divide evenly into `courts × 4`, apply the
    bye-priority rule in Section 5 to select who sits out — this is where "fewer matches
    played → priority to play" actually matters for Americano. It does **not** apply when
    the schedule is fully pre-computed with a static roster, because bye distribution is
    already balanced by the combinatorial structure.

### 1.4 Variants
- **Mixed Americano**: every team must be 1 male + 1 female. Apply this as an additional
  hard constraint in the pairing algorithm (step 1.2.2).

---

## 2. MODE: MEXICANO (Individual)

### 2.1 Definition
Partners and opponents are re-formed every round based on **live cumulative ranking**.
Players close in ranking are grouped together, so matches get progressively tighter as
the tournament progresses.

### 2.2 Hard rule: round N+1 cannot be generated until round N is completed
This is non-negotiable and is the key structural difference from Americano:
1. Round `N+1` generation must be blocked in the UI/API until `round[N].status ==
   completed` (i.e., every match has a final score, per Section 0.3).
2. Once round N is complete, recompute `cumulative_points` and re-sort the ranking.
3. Then form round `N+1` groups using the algorithm below.
4. Unlike Americano, Mexicano's schedule can never be pre-computed beyond the current
   round, by definition — implement this as always sequential/round-by-round generation.

### 2.3 Group formation algorithm (run after each round completes)
1. **Filter active players** for this round: exclude anyone forced to sit out per Section
   5 bye rules (apply bye-priority BEFORE ranking sort — see 2.3 note below).
2. Sort remaining active players by `cumulative_points` descending. Tie-break order:
   a. Lower `matches_played` ranks higher (see Section 5).
   b. Head-to-head result if available.
   c. Deterministic random (fixed seed per round, for reproducibility/debuggability).
3. Split the sorted list into groups of 4, in order: ranks 1–4 → top court, ranks 5–8 →
   next court, etc.
4. Within each group of 4, form teams as **rank1 + rank4 vs rank2 + rank3**.
   `DEFAULT (configurable)`. This is the most common convention because it minimizes the
   ranking gap between the two teams. An alternative variant used by some organizers is
   `rank1+rank3 vs rank2+rank4` — expose this as a toggle if you want flexibility, but
   default to `1+4 vs 2+3`.
5. Mexicano has **no anti-repeat constraint** by design — pairing is purely
   ranking-driven, unlike Americano. Do not add a "avoid repeat partner" soft constraint
   here unless explicitly requested as a custom variant, since it can conflict with
   ranking accuracy (e.g., forcing the two top-ranked players apart when they should
   logically be matched against each other).

**Important ordering**: step 1 (bye filtering) must run before step 2 (ranking sort).
The bye-priority rule (Section 5) determines *who plays this round*; ranking then
determines *how the players who ARE playing get grouped*.

### 2.4 Round 1 (no ranking data yet)
Choose one, and apply consistently for the whole tournament:
- **Option A**: manual seeding — organizer assigns an initial skill estimate per player,
  used only for round 1 grouping.
- **Option B**: fully random assignment for round 1; ranking-based logic starts from
  round 2 onward.
`DEFAULT (configurable)`: Option B (random) is simpler to implement and requires no extra
input step from the organizer.

---

## 3. MODE: TEAM AMERICANO

### 3.1 Definition
Same rotation philosophy as Americano, but **pairs/teams are fixed** from registration —
there is no partner rotation. What rotates is the **opponent**: every team plays every
other team once (round-robin between teams).

### 3.2 Match-up generation
1. Treat each fixed team as a single entity. Use a standard round-robin scheduling
   algorithm between entities (simpler than Section 1.2, since partner combinatorics are
   irrelevant — partners are already fixed).
2. Total matches for `T` teams: `T × (T-1) / 2` (every team plays every other team once).
3. Like Americano, this schedule is ranking-agnostic and ideally generated upfront. Apply
   the same rolling-regeneration exception as Section 1.3 if the roster of teams is
   dynamic.
4. If `T` is odd, one team sits out per round, rotated fairly. Use Section 5's
   bye-priority rule, applied to `matches_played` at the team level.

---

## 4. MODE: TEAM MEXICANO

### 4.1 Definition
Same as Mexicano, but the entity is a fixed team rather than an individual. Match-ups
between teams are determined by **live team ranking**, recalculated after every round.

### 4.2 Rules
Identical structure to Section 2, but simpler — no need to form 1+4 vs 2+3 sub-groupings:
1. Round N+1 cannot be generated until round N is fully completed (same as 2.2).
2. Sort active teams by `cumulative_points` descending, same tie-break order as 2.3.2.
3. Pair teams for matches: rank1 vs rank2, rank3 vs rank4, etc. (one match per court).
   This is effectively a simple Swiss-system pairing.
4. If `T` is odd, one team sits out per round; select using Section 5's bye-priority
   rule at the team level.

---

## 5. BYE SYSTEM & PLAY-PRIORITY RULE (applies to all 4 modes)

### 5.1 When a bye occurs
Whenever the number of active entities needing a match slot in a round exceeds available
capacity (`courts × 4` for Individual modes, `courts` for Team modes), the excess
entities must sit out ("bye") that round.

### 5.2 Selecting who sits out (priority order)
Apply this ordered priority list to decide who plays vs. who byes each round:

1. **Primary rule**: entities with the LOWEST `matches_played` (real matches only, byes
   excluded) get priority to play. This is the core fairness rule — a player/team that
   has played fewer real matches should never be sidelined again while others with more
   matches played are still playing.
2. **Tie-break 1**: entity with the longest time since `last_bye_round` (i.e., hasn't sat
   out recently) gets priority to play — prevents anyone from sitting out twice before
   everyone else has sat out once.
3. **Tie-break 2** `DEFAULT (configurable)`: entity with lower `cumulative_points` gets
   priority to play, so players who are behind on ranking get more chances to catch up.
4. **Final tie-break**: deterministic random with a fixed seed (reproducible for
   debugging/audit).

**Mode-specific interaction:**
- **Americano / Team Americano**: this priority rule is only actively invoked when the
  roster changes dynamically mid-tournament (Section 1.3 / 3.2.3). If the full schedule
  was pre-computed with a static roster, bye distribution is already inherently balanced
  by the round-robin structure — no manual intervention needed.
- **Mexicano / Team Mexicano**: this rule MUST run before the ranking sort in Section
  2.3/4.2. Sequence: (a) filter which entities play this round using the bye-priority
  rule, (b) then sort the remaining entities by ranking to form groups/pairings.

### 5.3 Bye point formula
`DEFAULT (configurable) — this is a design convention, not a verified industry standard.`
No official federation or governing body defines a standardized bye-point formula; every
scoring app that implements one uses its own convention. Treating a bye as equivalent to
a "draw" (splitting the match total evenly) is the most common and mathematically
sensible approach:

```
bye_point = target_points_per_match / 2
```

Example: if the match target is 24 points, `bye_point = 12` is awarded to every entity
sitting out that round.

If match length is variable (e.g., time-based rather than a fixed point target), use
instead:

```
bye_point = average_total_points_across_completed_matches_so_far / 2
```

computed from the average combined score (both teams summed) of all matches completed in
the tournament up to that round.

**Implement only one of these two formulas per tournament — never mix them**, or
`cumulative_points` comparisons across rounds will not be apples-to-apples.

### 5.4 How bye points interact with real match points later
1. `bye_point` awarded in a given round is a permanent log entry for that round (kept for
   audit trail — never delete it).
2. When the entity eventually plays a real match in a later round, do **not** retroactively
   remove or "replace" the earlier bye_point — there is no real match score to replace it
   with, since no match was actually played in that round.
3. Recommended interpretation (`DEFAULT`): treat `bye_point` as **provisional but
   additive**. It stays part of `cumulative_points` permanently. Track a separate
   `is_provisional` flag on the entity (true until they have played ≥1 real match) purely
   for UI purposes (e.g., showing a "provisional standing" badge) — this flag does NOT
   remove or adjust the bye_point value itself.
4. If your product requirement is genuinely different from this (e.g., you want the bye
   point to be a placeholder that gets literally overwritten by something else), that
   needs a different data model — flag this explicitly before implementation, since the
   "provisional/additive" model above is the only mathematically coherent interpretation
   of "replace bye points with real points" (there's no real match in the bye round to
   generate a replacement score from).

---

## 6. Quick-Reference Comparison Table

| Aspect | Americano | Mexicano | Team Americano | Team Mexicano |
|---|---|---|---|---|
| Entity | Individual | Individual | Fixed team | Fixed team |
| Partner | Rotates every round | Rotates every round | Fixed from start | Fixed from start |
| Match-up driver | Combinatorial (unique pairing) | Live ranking | Combinatorial (round-robin between teams) | Live ranking between teams |
| Can pre-compute full schedule? | Yes (default, static roster) | No — always sequential | Yes (default, static roster) | No — always sequential |
| Must wait for previous round to finish? | No (unless roster changes) | **Yes, always** | No (unless roster changes) | **Yes, always** |
| Anti-repeat opponent constraint | Best-effort | None (pure ranking) | Given by round-robin structure | None (pure ranking) |

---

## 7. Implementation Checklist

- [ ] Bye point formula: `target_points/2` or `average_so_far/2` — pick one, do not mix.
- [ ] Mexicano pairing pattern: `1+4 vs 2+3` (default) or `1+3 vs 2+4` — make configurable.
- [ ] Mexicano round 1: random (default) or manual seeding — implement one consistently.
- [ ] Americano/Team Americano: confirm whether roster is static (pre-compute whole
      schedule) or dynamic (rolling generation with live bye-priority) — this determines
      engine complexity significantly, decide before building.
- [ ] Ranking tie-break order when points are exactly equal: confirm head-to-head →
      matches_played → random seed order matches product intent.
- [ ] Round-completion gate: enforce server-side (not just UI-side) that round N+1 cannot
      be generated while round N has any `status: pending` match — this is a data
      integrity rule for Mexicano/Team Mexicano, not just a UX nicety.
