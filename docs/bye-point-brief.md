# Technical Brief: Bye Point Mechanism (Dummy Score) — Mexicano Format

## 1. Context & Purpose

A Mexicano/Americano padel scoring app needs to handle **byes**: when the number of active players in a round isn't evenly divisible by 4, some players have to sit out that round.

Since Mexicano's ranking system relies on cumulative scores per round to determine next-round pairings, a player on bye needs a **temporary dummy/placeholder score** for that round so the ranking calculation isn't skewed. This value is later **replaced (overwritten)** with the actual score once that player actually plays a match.

This brief defines: when a bye is triggered, how the dummy score is calculated (3 configurable options), how the data state is managed, when and how the dummy is replaced with a real score, the required scheduling-priority rule, and edge cases that must be handled.

---

## 2. Terminology

| Term | Definition |
|---|---|
| `N` | Total points contested in a single match (points target per match, e.g. 16/21/24/32). Set in tournament configuration, constant throughout the event. |
| Round | One cycle of matches; in each round, a subset of players plays (groups of 4 = 1 court), the rest are on bye. |
| Bye | Status of a player who doesn't get a court/match in a given round. |
| Dummy Score / Placeholder Score | A temporary score value assigned to a bye player for that round, used for provisional standings calculation. |
| Actual Score | The real score from a match the player genuinely played. |
| Replacement | The process of overwriting a dummy score with the actual score once it becomes available. |

---

## 3. Configuration Schema (Required in Match Setup)

Add the following configuration fields to the **Match Configuration / Tournament Settings** screen:

```json
{
  "byeScoringMethod": "PLAYER_AVERAGE" | "HALF_N",
  "byeFallbackStrategy": "PLAYER_HISTORICAL_AVERAGE_THEN_NEUTRAL",  // used only if PLAYER_AVERAGE is selected and the player has no in-tournament history yet
  "byeHalfNRounding": "ROUND_UP" | "ROUND_DOWN" | "ROUND_NEAREST",  // only relevant if HALF_N is selected and N is odd (no effect when N is even)
  "byeAffectsNextRoundPairing": true,  // FIXED, not a toggle — see Section 7 (decision already final)
  "byePlayerSchedulingPriority": true  // FIXED — players with fewer matches played MUST be prioritized to play next round, see Section 7b
}
```

**Default (application-level, not just a UI suggestion)**: `byeScoringMethod = PLAYER_AVERAGE`. `HALF_N` is offered as the only alternative, for organizers who explicitly want a simple, non-adaptive, predictable dummy score instead of a personalized one.

**`byeHalfNRounding` default**: `ROUND_NEAREST` (round-half-up convention). This setting has **no effect when N is even** (N/2 is already an exact integer), and only matters when N is odd (e.g. N=21 → N/2=10.5).

UI: present this as a single toggle/switch — "Use each player's own average score" (default, ON) vs. "Use half of the match's total points" (alternative) — rather than a 3-way radio button as in earlier drafts. Simpler mental model for the organizer: adaptive vs. fixed.

---

## 4. Bye Trigger Conditions

A bye is assigned to a player when, at the start of generating round N:

1. The number of active players (not eliminated/not withdrawn) `mod 4 != 0`, OR
2. The number of active players exceeds available court capacity (`active > courts × 4`).

The system must:
- Determine how many players are on bye this round: `byeCount = active_players - (available_courts × 4)`, subject to fair rotation rules (see Section 8.1).
- Determine **who** is on bye using the priority-based selection algorithm in Section 7b (this replaces any separate "fair rotation" logic — priority selection already ensures fairness through match-count tracking).

---

## 5. Formulas & Definitions for the 3 Options

All calculated results **must be rounded to an integer** (points can't be fractional).

### Default — `PLAYER_AVERAGE`: player's own actual-score average, with layered fallback
- Formula:
  ```
  actualScoresList = all actual scores belonging to this player from PREVIOUS rounds
                      (ONLY entries with status ACTUAL, never PLACEHOLDER/dummy)

  IF actualScoresList is NOT empty:
      dummyScore = round(sum(actualScoresList) / count(actualScoresList))

  ELSE (player has no actual score at all yet — most common case: bye in round 1):
      # LAYERED FALLBACK — see explanation below
      IF the player has history from PREVIOUS tournaments/events (cross-event, if the app stores a persistent profile):
          dummyScore = round(average of this player's actual scores from past events)
      ELSE:
          dummyScore = round(N / 2, byeHalfNRounding)   # falls back to the same neutral baseline as the HALF_N option
  ```
- **IMPORTANT**: the average must ONLY be calculated from entries with status `ACTUAL`. Never include a dummy score from a previous bye round in this average — otherwise error compounds (dummy calculated from dummy).

**Why a layered fallback instead of plain N/2:**
A player who happens to be on bye in the first round still has some underlying "level" — the data just doesn't exist yet in THIS tournament. If the app stores a cross-tournament player profile (i.e., history of all matches this player has ever played in the app), their historical average is a far more accurate estimate than a generic neutral number. Only when there's truly no data at all (a first-time app user) does it fall back to the neutral baseline `round(N/2)`.

> ⚠️ **Technical prerequisite**: the first fallback layer (cross-event history) ONLY works if the app has a persistent player-profile system across tournaments (not data that resets every new event). If the current data architecture doesn't yet support this, go straight to the second layer (`round(N/2)`) as the sole fallback, and log this as technical debt for future improvement.

### Alternative — `HALF_N`: half of the match's total points
- Formula: `dummyScore = round(N / 2, byeHalfNRounding)`
- Interpretation: a fixed, non-adaptive neutral score — always exactly half the match total, regardless of the player's actual skill level.
- Example: N=24 (even) → 24/2 = 12 exactly → `byeHalfNRounding` has no effect, result is always 12.
- Example: N=21 (odd) → 21/2 = 10.5 → result depends on `byeHalfNRounding`: `ROUND_UP` → 11, `ROUND_DOWN` → 10, `ROUND_NEAREST` → 11 (round-half-up convention).
- This option intentionally replaces the earlier two-way split ("round up" vs "round down" as separate selectable options) from a previous draft of this brief — those two were found to be mathematically identical whenever N is even, which covers most real-world match formats (16/24/32 points), so keeping them as two separate user-facing choices added complexity without a meaningful practical difference. `byeHalfNRounding` still exists as a config field for the rare odd-N case, but it's a minor rounding-direction setting, not a headline feature choice.

---

## 6. Score State Machine per Round

Every player score entry per round has 2 possible statuses:

```
ScoreEntry {
  playerId: string
  roundNumber: int
  score: int
  status: "ACTUAL" | "PLACEHOLDER"
  createdAt: timestamp
  replacedAt: timestamp | null
}
```

**Flow:**
1. Round is generated → bye players get a `ScoreEntry` with `status = PLACEHOLDER`, `score` calculated per the selected option.
2. That bye player, at the point where they actually get to play (per Section 7b, they are guaranteed priority to play the very next round):
   - The `ScoreEntry` for the bye round is updated: `status = ACTUAL`, `score = <real match score>`, `replacedAt = now()`.

**Recommended replacement rule** (see Section 13 for rationale): use the score from the **first match this player actually plays after the bye round** as the replacement value. This is consistent with the scheduling-priority rule (Section 7b), which already guarantees this player will be prioritized to play in the immediate next round — removing the ambiguity of needing a separate "make-up match" concept.

---

## 7. Impact on Ranking & Next-Round Pairing (FIXED: `byeAffectsNextRoundPairing = true`)

**Decision is final**: the dummy score ALWAYS counts toward the player's cumulative total when the system determines pairing for round N+1 (who partners/opposes whom, based on ranking). Consequence: bye players still "move" on the leaderboard even though they didn't play, so subsequent pairing still makes competitive sense based on cumulative score (which partially includes the dummy).

---

## 7b. Scheduling Priority: Players with a Dummy Score MUST Play Next

**Business rule**: any player whose score still contains a dummy/placeholder (not yet replaced by an actual score) from any round **must be prioritized** to get a court slot in the next round — so they don't fall further behind in matches played compared to other players.

This creates a **direct conflict** with standard Mexicano pairing logic (which forms pairs purely based on ranking order: rank 1&4 vs 2&3, etc.). Therefore, the round-generation operation **MUST** follow 2 separate stages, not be combined into one step:

### Stage 1 — Select who plays this round (priority based on matches behind)
```
1. Compute matchesPlayed[player] for each active player.
2. Players with fewest matches played (min matchesPlayed) or who sat out in the previous round
   are assigned to Tier 0 (Protected / Must Play).
3. Sit-out candidates are selected from Tier 1 (players with more matches played),
   sorted by sit-out recency and count.
```

### Stage 2 — Proximity-Based Court Clustering & Temporal Mexicano Pairing
```
1. Sort all active attendees by cumulative standings rank (0 to M-1).
2. Evaluate valid sit-out combinations that minimize the Proximity Spread Cost across courts:
   ProximityCost = Sum( (max_rank_index_in_court - min_rank_index_in_court)^2 )
   This prevents large rank gaps (e.g., Rank #1 paired on court with Rank #8).
3. Within each proximity-clustered court of 4 players:
   - Order the 4 court players by their relative rank (temporal ranks 1, 2, 3, 4).
   - Matchup: Temporal Rank (1 + 4) vs (2 + 3).
   - If repeat partner avoidance applies, swap to (1 + 3) vs (2 + 4).
```

### ⚠️ Conflict to be aware of
Stage 1 prioritizes players based on **matches behind**, not based on **level/ranking**. This can result in a very low-ranked player being "forced into" a group with high-ranked players, because they have to play next even though ranking-wise they'd normally belong in a different group. This is an **INTENTIONAL CONSEQUENCE** of your business rule (prioritizing match-count equity over competitive matching), but it needs to be clearly documented in code comments so it isn't mistaken for a bug by a future developer.

**Additional edge case**: if the number of players "required to play" (low matchesPlayed) isn't evenly divisible by 4, the system must still fill remaining slots with the next players by matchesPlayed (step 4 above already handles this via ascending sort + taking the top N), but make sure this is tested with odd-count scenarios (e.g. 3 match-behind players when 4 slots per court are needed).

---

## 8. Edge Cases to Handle

### 8.1 Uneven bye rotation
Handled by Section 7b's priority selection — matchesPlayed tracking already ensures no single player gets byes repeatedly while others never do. No separate rotation module needed; Stage 1 selection subsumes this responsibility.

### 8.2 Player on bye in the very first round (Option 3)
No history exists at all → must use the layered fallback (Section 5). Never let the app crash or produce `NaN`/division-by-zero.

### 8.3 Player on bye in consecutive rounds (Option 3)
If a player is on bye 2 rounds in a row and still has no actual score by the 2nd round → still fall back per Section 5's layered logic. NEVER average from a previous round's dummy score (see compounding-error prohibition in Section 5).

### 8.4 Odd vs. even N
Make sure both cases are tested (see examples in Section 5). Odd N produces an exact integer difference between Options 1 & 2 — this is the only scenario where the two options meaningfully diverge.

### 8.5 Tournament ends before replacement occurs
If a player gets a bye in the last round and the tournament ends before Section 7b's guaranteed "play next round" can happen — the dummy score **remains as the final score** for that round on the final leaderboard. The system must visually flag (e.g. a distinct icon or color) that this score was never actually replaced, for transparency to the user/organizer.

### 8.6 Changing configuration mid-tournament
The system must lock `byeScoringMethod` once the tournament starts (round 1 has been generated) — changing the method mid-way would make the leaderboard inconsistent across rounds.

---

## 9. Implementation Pseudocode

```python
def calculate_bye_score(player, round_number, N, config):
    method = config.byeScoringMethod

    if method == "PLAYER_AVERAGE":
        actual_scores = get_actual_scores(player, before_round=round_number)
        if len(actual_scores) > 0:
            return round(sum(actual_scores) / len(actual_scores))

        # Layered fallback (Section 5)
        cross_event_history = get_actual_scores_from_previous_events(player)
        if len(cross_event_history) > 0:
            return round(sum(cross_event_history) / len(cross_event_history))

        return apply_rounding(N / 2, config.byeHalfNRounding)  # neutral baseline, same formula as HALF_N

    elif method == "HALF_N":
        return apply_rounding(N / 2, config.byeHalfNRounding)

    else:
        raise ConfigError("Invalid byeScoringMethod")


def apply_rounding(value, rule):
    if value == int(value):
        return int(value)  # N even — rounding rule irrelevant
    if rule == "ROUND_UP":
        return ceil(value)
    if rule == "ROUND_DOWN":
        return floor(value)
    if rule == "ROUND_NEAREST":
        return round(value)  # round-half-up convention, document this in code comments


def assign_bye_score(player, round_number, N, config):
    score = calculate_bye_score(player, round_number, N, config)
    create_score_entry(
        player_id=player.id,
        round_number=round_number,
        score=score,
        status="PLACEHOLDER"
    )


def replace_bye_score_with_actual(player, round_number, actual_score):
    entry = get_score_entry(player.id, round_number)
    assert entry.status == "PLACEHOLDER", "Can only replace an entry that is still PLACEHOLDER"
    entry.score = actual_score
    entry.status = "ACTUAL"
    entry.replacedAt = now()
    recalculate_leaderboard()  # re-trigger standing & pairing recalculation as needed


def generate_next_round(active_players, courts_available, config):
    # STAGE 1 — select who plays, priority based on matches behind
    sorted_by_priority = sort_players(
        active_players,
        key=lambda p: (p.matchesPlayed, -p.roundsSinceLastActualMatch)
        # ascending matchesPlayed, then descending roundsSinceLastActualMatch as tie-breaker
    )
    slots_available = courts_available * 4
    playing_this_round = sorted_by_priority[:slots_available]
    bye_this_round = sorted_by_priority[slots_available:]

    # Assign dummy score to bye players
    for player in bye_this_round:
        assign_bye_score(player, current_round_number, N, config)

    # STAGE 2 — ranking-based pairing, ONLY among playing_this_round
    ranked = sort_players(
        playing_this_round,
        key=lambda p: -p.cumulativeScore  # includes dummy score, per Section 7
    )
    groups_of_4 = chunk(ranked, size=4)
    matches = [form_mexicano_pairing(group) for group in groups_of_4]

    return matches, bye_this_round
```

---

## 10. Numeric Scenario Examples (for unit tests)

**Setup**: N = 24 (even), `byeHalfNRounding = ROUND_NEAREST`

| Method | Formula | Result |
|---|---|---|
| PLAYER_AVERAGE (history: [18, 14, 20]) | avg = 52/3 = 17.33 | 17 |
| PLAYER_AVERAGE (empty history, no cross-event data → fallback) | round(24/2) | 12 |
| HALF_N | round(24/2) | 12 |

> Note: when N is even, `PLAYER_AVERAGE`'s fallback and `HALF_N` always produce the same result (12) — expected, since the fallback formula IS the HALF_N formula. This should be an explicit test case, not treated as a bug.

**Setup**: N = 21 (odd) — this is where `byeHalfNRounding` actually matters

| Method / Rounding | Formula | Result |
|---|---|---|
| HALF_N, ROUND_UP | ceil(21/2) = ceil(10.5) | 11 |
| HALF_N, ROUND_DOWN | floor(21/2) = floor(10.5) | 10 |
| HALF_N, ROUND_NEAREST | round(21/2) = round(10.5) | 11 (round-half-up) |

---

## 11. Acceptance Criteria / Test Cases

- [ ] Config stores `byeScoringMethod` per tournament and locks it once round 1 starts.
- [ ] `HALF_N` produces valid integers for both even and odd N, respecting `byeHalfNRounding`.
- [ ] An explicit test verifies that `byeHalfNRounding` has no effect when N is even, and produces the expected different results (`ROUND_UP` vs `ROUND_DOWN` vs `ROUND_NEAREST`) when N is odd.
- [ ] `PLAYER_AVERAGE` never crashes on empty history (fallback layer 1 & layer 2 tested separately).
- [ ] `PLAYER_AVERAGE` never averages from an entry with status `PLACEHOLDER`.
- [ ] An explicit test verifies that `PLAYER_AVERAGE`'s final fallback (no history at all, no cross-event data) produces the exact same result as `HALF_N` for the same N and rounding rule — this is expected, not a bug.
- [ ] Bye `ScoreEntry` is stored with `status=PLACEHOLDER` before any actual score exists.
- [ ] Replacement changes `status` to `ACTUAL` and triggers leaderboard recalculation.
- [ ] Leaderboard/UI shows a distinct visual indicator for scores still `PLACEHOLDER` vs. `ACTUAL`.
- [ ] If the tournament ends with an entry still `PLACEHOLDER`, the final leaderboard still displays that value with a "never replaced" indicator.
- [ ] Dummy score always counts toward next-round pairing (`byeAffectsNextRoundPairing` fixed true) — tested via a pairing scenario after a bye.
- [ ] **Stage 1 (priority selection)** is tested separately from **Stage 2 (ranking pairing)** — verify players with the lowest `matchesPlayed` are always selected to play first, regardless of their score ranking.
- [ ] The `roundsSinceLastActualMatch` tie-breaker scenario is tested when 2+ players have the same `matchesPlayed`.
- [ ] The scenario "a low-ranked player is placed in a high-rank group due to match-count priority" is tested and documented as intentional behavior (not a bug).
- [ ] The replacement rule (Section 6) — using the player's first match after the bye round as the actual score — is tested end-to-end.

---

## 12. Critical Notes (Read Before Implementation)

1. **`PLAYER_AVERAGE`'s layered fallback requires a persistent cross-tournament player profile system.** If your app's current architecture scopes all data per-tournament (no "global player history"), the first fallback layer can't function and will always fall through to `round(N/2)` — meaning it effectively becomes identical to `HALF_N` for all new players in round 1. Confirm whether your app already has (or will have) a data model for this, so expectations are set correctly.
2. **The scheduling-priority rule (Section 7b) intentionally sacrifices pairing accuracy for match-count equity.** A weaker player who happens to get frequent byes can be "forced into" a group of strong players because they must play next. This is valid as a business decision, but make sure it's communicated to the organizer/app user (e.g. via a UI label like "prioritized due to fewer matches played") so it doesn't look like a broken or random pairing.
3. **`byeHalfNRounding` is a minor setting, not a headline feature.** It only changes behavior for odd N (a minority of real-world match formats). Don't over-expose this in the primary UI — a sensible fixed default (`ROUND_NEAREST`) is enough for most organizers; consider hiding it behind an "advanced settings" toggle rather than presenting it alongside the main `PLAYER_AVERAGE` vs `HALF_N` choice.

---

## 13. Decision Summary

Per product decision: **`PLAYER_AVERAGE` is the application's default bye-scoring method.** `HALF_N` is offered as the sole alternative, for organizers who prefer a simple, fixed, non-adaptive dummy score over one personalized to each player's performance.

This resolves the earlier open question about how many bye-scoring options to expose: rather than three separate choices, the app now has exactly two — an adaptive default and one fixed alternative — with `HALF_N`'s rounding direction (`byeHalfNRounding`) treated as a minor configuration detail rather than a third user-facing option.
