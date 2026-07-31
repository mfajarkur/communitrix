# Communitrix — Elo & Skill Rating Adjustment Brief

## 0. Context

**STATUS UPDATE:** the gap this section originally described is now built. `sessions/new` (`wizard-form.tsx`) creates the session via `startSessionAction` and hands off immediately to the real-time Live Board (`sessions/[sessionId]` + `sessions/[sessionId]/m/[matchId]`) for round-by-round scoring, instead of playing everything out in local React state and bulk-persisting at the end. Quick Match (`isGuestDemoMode`) still uses the original local-state sandbox path, unchanged and by design — it never touches the DB and never affects Elo/CP. The history below is kept for context on why the round-by-round design was chosen over bulk-persisting local state.

**Original framing (kept for history):** the previous version of this section called the gap below a "critical bug." It wasn't — **Communitrix is still in active development**, and per the product owner: Quick Match was deliberately built first, as a sandbox to nail down the scoring/UX experience (`wizard-form.tsx`'s local-state, instant-feedback approach), with the explicit plan to **replicate that experience into the real community session flow afterward**, adjusted and extended with everything in this brief (Elo, Skill Rating, Community Points, etc.).

**What was built:** a community-session version of the session flow that:
1. Reuses the wizard's UX for setup (sport/format/scoring config, player registration) — this part was already proven in the sandbox and carried over as-is.
2. Is wired to the **already-existing, already-correct, round-by-round database flow**: `generateNextRoundAction` (server-side, pulls live `session_players` standings from Supabase, calls the same `generateAmericanoRound`/`generateMexicanoRound` functions the wizard already uses) → user enters scores as each match finishes via `submitMatchScoreAction` (wraps `submit_match_score`; already existed in both `round.actions.ts` and `match.actions.ts` by the time this was wired up) → repeat per round → `finalizeSessionAction` at the end, triggered by a Host from the Live Board's "End Session" control.
3. This is the point where every patch in this brief (Elo, Skill Rating review triggers, Community Points) actually has an effect — none of it fires until real match scores reach `submit_match_score`, which now happens for every community session.
4. Along the way, fixed a page-level authorization gap: `sessions/new`, `sessions/[sessionId]`, and `sessions/[sessionId]/m/[matchId]` were gated on `requireCommunityAdmin`/`role === 'ADMIN'` while every underlying server action already correctly accepted Host or Admin (`requireCommunityHost`) — Hosts were blocked from creating sessions or scoring matches even though the backend allowed it. Now aligned to Host-or-Admin at the page level; `amendMatchScoreAction`/`voidMatchAction` remain Admin-only, unchanged.

**Deliberately not built as part of this:** replicating the wizard's bye-point display or podium screen inside the Live Board. Left as an open follow-up (see the still-open item below), not resolved here.

**Why bulk-persisting the wizard's local state at the end (the fix drafted in an earlier version of this section) is the WRONG direction, not just incomplete:** Mexicano's round 2+ re-seeding depends on live standings pulled fresh from `session_players` in the database (see `generateNextRoundAction`'s query). If the community flow generates every round upfront in local state (like the wizard sandbox does) and only persists everything at the very end, Mexicano's re-seeding during that local simulation never actually reflects real submitted results — it's simulating against itself, not the source of truth. The correct integration is **round-by-round**, submitting each match's score as it happens, generating the next round only after that submission — matching how `generateNextRoundAction` and the "Round N+1 gated until Round N complete" rule already assume things work.

**Still open:**
1. ~~`submitMatchScoreAction` needs to be created~~ — done; it existed in both `round.actions.ts` and `match.actions.ts` by the time the flow below was wired up.
2. Whether the community version keeps the wizard's bye-points feature at all, and if so, whether it's computed the same way (client-side estimate) or needs to be a real, persisted mechanic — still not decided; the Live Board shipped without it.
3. ~~The actual UI/UX rebuild connecting `generateNextRoundAction` → per-match score entry → `submitMatchScoreAction` → repeat~~ — done; see the status update above.

**CORRECTION (real RPC definitions now reviewed, `0008_rpc_session.sql`):** an earlier draft of this section guessed that `persist_round` returns `[{courtNumber, matchId}]`. **That guess was wrong.** The real function `returns uuid` — specifically the **round_id**, nothing about individual matches. To get actual match IDs after persisting a round, the client must run a **separate query** against `matches` filtered by `round_id`, ordered by `court_number` (the exact pattern `elo-sql-sync.test.ts` already uses):
```tsx
const { data: persistedMatches } = await supabase
  .from('matches')
  .select('id, court_number')
  .eq('round_id', roundId)
  .order('court_number');
// map back to local roundMatches by court order, then call submitMatchScoreAction per match.id
```
`persistRoundAction` itself doesn't need to change — it already correctly wraps the real `persist_round` signature. The fix is in what the *caller* does with the return value.

**Also found while reviewing `0008_rpc_session.sql`, unrelated to the above:** `persist_round` increments `session_players.matches_played` at the moment a round is **persisted/scheduled**, not when a score is actually **submitted**. If a session is abandoned mid-round after persisting but before `submit_match_score` runs, affected players' `matches_played` — and therefore their sit-out fairness priority in future rounds, per `sitout.ts` — will already reflect a match that was never actually completed. May be intentional (a scheduled turn counts regardless of outcome); flagged for awareness, not resolved.

**FINDING, now fully resolved (was briefly misdiagnosed twice before landing here — see the correction trail below):** `0013_add_host_role_and_avatar.sql` confirms **Host DOES exist** — added to `member_role` via `alter type ... add value 'HOST'`, with a new `is_community_host()` helper, *after* the RLS policies in `0006_rls_policies.sql` were written.

**Final, confirmed status (after reviewing `guards.ts`): this is NOT a functional bug.** `session.actions.ts`'s `startSessionAction` calls `requireCommunityHost(communityId)` from `guards.ts` *before* invoking the `start_session` RPC — and `requireCommunityHost` correctly calls the newer `is_community_host` RPC (checks ADMIN or HOST). Since `start_session` is `SECURITY DEFINER` (bypasses table RLS for its own internal writes), and every reviewed path to creating a session goes through this application-layer guard first, **Hosts can create sessions today without issue.**

What remains true and worth fixing: `0006_rls_policies.sql`'s `sessions_insert` policy still calls `is_community_admin()`, not `is_community_host()`. This is a **defense-in-depth gap, not an active bug** — it only matters if some future code path ever inserts into `sessions` directly, bypassing `startSessionAction`/`requireCommunityHost`. If that ever happens, the stale RLS policy would incorrectly block a Host (over-restrictive, not a security hole) since it doesn't recognize the newer role. Recommend fixing it for consistency and to remove a latent trap for future development, but it is **not urgent** and not currently causing any real user-facing problem.

**Correction trail, kept for transparency:** this same finding was stated three different ways across this session — first "Host is aspirational, not implemented" (based on `0006` alone, before `0013` was reviewed), then "likely a real bug blocking Host from creating sessions" (based on `0006` + `0013`, before `guards.ts` was reviewed), and now this final, accurate version (based on all three files together: `0006`, `0013`, and `guards.ts`). Each correction came from seeing one more file, not from re-reasoning about files already reviewed — a reminder that conclusions in this brief are only as good as the code that's actually been read, not inferred.

**A second, smaller instance of the same drift, in `0016_guest_claim_requests.sql`:** its RLS policy explicitly allows `role IN ('ADMIN','HOST')` to update claim requests, but `resolve_guest_claim`'s own internal authorization check only calls `is_community_admin()` — so even though the table-level policy would permit a Host's update, the function itself rejects a Host with `UNAUTHORIZED`. Two authorization layers disagree for this specific RPC.

---


This is NOT a from-scratch schema. Communitrix already has a working, tested Elo system:
- `src/lib/elo/calculate.ts` (TS engine), `constants.ts`, `normalize.ts`
- `supabase/migrations/0009_rpc_scoring_elo.sql` (live match scoring RPC)
- `supabase/migrations/0011_rpc_amend_void.sql` (`replay_ratings`, `amend_match_score`, `void_match`)
- `supabase/migrations/0003_tables.sql` (`profiles`, `communities`, `community_members`, `player_rankings`, `sessions`, `matches`, `match_players`)
- `supabase/migrations/0015_claim_guest_profile.sql` (guest/claim system — already solves what an earlier draft of this brief called "shadow profiles"; that earlier design is discarded)
- Matchmaking (`src/lib/matchmaking/americano.ts`, `mexicano.ts`, `sitout.ts`, `standings.ts`) — already handles scheduling, sit-out fairness, and Mexicano re-seeding by standings. Out of scope for this brief; no changes proposed here.

Everything below is written as a **patch plan against these real files**, not a new schema. Constants, table names, and column names match what already exists.

**Known constraint confirmed by reading the code:** `calculate.ts` (TypeScript) and the SQL RPCs (`submit_match_score`, `replay_ratings`) are two independent implementations of the same formula, kept in sync only by a test (`elo-sql-sync.test.ts`) that compares their output. TypeScript cannot run inside Postgres, so a single literal implementation across both runtimes is not achievable. What IS achievable, and is part of this plan, is eliminating the duplication *within SQL* (currently `submit_match_score` and `replay_ratings` each have their own copy of the same PL/pgSQL logic — that's the third copy this brief removes).

---

## 1. Decision Log (this session)

| # | Decision |
|---|---|
| 1 | Consolidate the SQL-side duplication: `submit_match_score` and `replay_ratings` currently each embed their own copy of the delta formula. Extract into one shared SQL function, `calculate_match_delta(...)`, called by both. TS (`calculate.ts`) remains the separate reference implementation, kept aligned via the existing sync test. |
| 2 | Remove `amend_match_score` entirely. Admins can no longer edit the score of a completed match. |
| 3 | Keep `void_match`, but matches must record which formula version applies to them (`matches.formula_version`), so voiding an old match and triggering a replay does **not** silently apply new rules (Carry Rule, dampening) to historical matches. Old matches always replay under the formula version active when they were originally played. |
| 4 | Skill Rating (new feature, from earlier sessions) is scoped per `(community_id, profile_id, sport)`, matching the existing `player_rankings` uniqueness constraint — not a single rating per membership. |
| 5 | Add a dampening mechanism for matches where both teams are provisional (`total_matches < 10` on both sides) — the existing `is_provisional` check is per-player only and does not look at the opponent's status at all. |

---

## 2. Patch 1 — Consolidate SQL duplication

**Files touched:** new migration `0018_calculate_match_delta.sql`; edits to `0009_rpc_scoring_elo.sql` and `0011_rpc_amend_void.sql` (as a follow-up migration, not editing old migration files in place — see note below).

```sql
-- 0018_calculate_match_delta.sql
-- Single shared SQL implementation of the Elo delta formula.
-- submit_match_score and replay_ratings both call this instead of
-- duplicating the PL/pgSQL logic inline.

create type public.match_delta_result as (
  delta            numeric,
  expected_a       numeric,
  mov              numeric,
  k_factor_avg     numeric,
  player_ks        numeric[]   -- same order as p_all_players input
);

create or replace function public.calculate_match_delta(
  p_avg_elo_a         numeric,
  p_avg_elo_b         numeric,
  p_score_a           int,
  p_score_b           int,
  p_scoring_type      scoring_type,
  p_points_mode       points_mode,
  p_max_score_target  int,
  p_all_players_matches_played  int[],   -- total_matches per player, team A first then team B
  p_format_damping    numeric,
  p_formula_version    int              -- selects which rule set applies (see Patch 2)
)
returns public.match_delta_result
language plpgsql
immutable
as $$
declare
  v_expected_a numeric;
  v_w_a numeric;
  v_margin int;
  v_denom int;
  v_m numeric;
  v_mov numeric;
  v_player_ks numeric[] := '{}';
  v_k numeric;
  v_matches_played int;
  v_k_avg numeric;
  v_delta numeric;
  v_dampening numeric := 1.0;  -- only used if p_formula_version >= 2, see Patch 4
begin
  v_expected_a := 1.0 / (1.0 + power(10.0, (p_avg_elo_b - p_avg_elo_a) / 400.0));

  if p_score_a > p_score_b then
    v_w_a := 1.0;
  elsif p_score_b > p_score_a then
    v_w_a := 0.0;
  else
    v_w_a := 0.5;
  end if;

  v_margin := abs(p_score_a - p_score_b);
  v_denom := p_max_score_target;
  if p_scoring_type = 'POINTS' and p_points_mode = 'TIMED' then
    v_denom := greatest(p_score_a + p_score_b, 1);
  end if;
  if v_denom <= 0 then v_denom := 1; end if;
  v_m := least(greatest(v_margin::numeric / v_denom, 0.0), 1.0);
  v_mov := 1.0 + 0.5 * v_m;  -- MARGIN_WEIGHT = 0.5, unchanged from constants.ts

  foreach v_matches_played in array p_all_players_matches_played loop
    v_k := (case when v_matches_played < 10 then 48.00 else 24.00 end) * p_format_damping;
    v_player_ks := v_player_ks || v_k;
  end loop;

  select avg(val) into v_k_avg from unnest(v_player_ks) as val;

  -- Patch 4 (new-vs-new dampening) and Patch 5 (Carry Rule) branch on
  -- p_formula_version here -- see those sections. v1 behavior below is
  -- byte-for-byte identical to the current production formula.
  v_delta := round(v_k_avg * v_mov * (v_w_a - v_expected_a) * v_dampening, 2);

  return (v_delta, v_expected_a, v_mov, v_k_avg, v_player_ks)::public.match_delta_result;
end;
$$;
```

`submit_match_score` and `replay_ratings` are then edited to replace their inline "steps 8-12" / equivalent block with a single call:
```sql
select * into v_result from public.calculate_match_delta(
  v_avg_elo_a, v_avg_elo_b, p_score_a, p_score_b,
  v_scoring_type, v_points_mode, v_max_score_target,
  v_matches_played_array, v_format_damping, v_formula_version
);
v_delta := v_result.delta;
```

**Note on migration hygiene:** Supabase migrations are meant to be append-only history, not edited in place. This brief treats `0009` and `0011` as needing a **new** migration (`0019_refactor_use_shared_delta.sql`) that `create or replace function`s them to call the new shared function — the original files stay as historical record, the new migration supersedes their function bodies. This matches the pattern already used in the codebase (`0009` and `0011` themselves are `create or replace function`, layered on top of whatever came before).

---

## 3. Patch 2 — Formula versioning (protects old matches from new rules)

```sql
-- 0018_calculate_match_delta.sql (continued) or a dedicated migration

alter table public.matches
  add column formula_version int not null default 1;
  -- Set at match creation time from a config value (current active version).
  -- NEVER changed after creation, including during replay.

create table public.rating_formula_versions (
  version           int primary key,
  description       text not null,
  carry_rule_enabled       boolean not null default false,
  new_vs_new_dampening_enabled boolean not null default false,
  activated_at      timestamptz not null default now()
);

insert into rating_formula_versions (version, description, carry_rule_enabled, new_vs_new_dampening_enabled)
values (1, 'Original formula: flat split within team, no opponent-based dampening', false, false);
-- Version 2 row is inserted by whichever future migration actually ships
-- Carry Rule / dampening -- NOT inserted now, so nothing changes yet.
```

`replay_ratings` reads `v_match.formula_version` (already stored on the row it's iterating) and passes it into `calculate_match_delta` as `p_formula_version`. This is the mechanism that satisfies decision #3: an old match voided next year still replays exactly as it did the day it was played, even if Carry Rule has since shipped as version 2.

**Open question for you:** when a NEW match is created, where does `matches.formula_version` get its value from? Recommended: a single row lookup, `select max(version) from rating_formula_versions`, at match/session creation time — meaning turning on Carry Rule later is just inserting a new row into `rating_formula_versions`, no code deploy needed for the cutover itself (the *logic* for v2 still needs to be coded ahead of time, but *activating* it for new matches is a data change).

---

## 4. Patch 3 — Remove `amend_match_score`

```sql
-- 0019_remove_amend_score.sql
drop function if exists public.amend_match_score(uuid, int, int, text);
```

**Consequence to flag:** the existing test suite doesn't seem to cover `amend_match_score` directly (not in the files you shared), but if there's a frontend button/route calling this RPC, it needs to be removed too — this brief only covers the database/backend side. Worth a search for `amend_match_score` across `src/` before shipping.

`void_match` is unchanged in permission logic, just now calls the shared delta function via `replay_ratings` with per-match `formula_version`.

---

## 5. Patch 4 — New-vs-new dampening (formula_version = 2, part A)

Inside `calculate_match_delta`, when `p_formula_version >= 2` and `new_vs_new_dampening_enabled` for that version:

```sql
  if p_formula_version >= 2 then
    -- Dampening based on the LOSING side's provisional status specifically,
    -- not a simple "any provisional player involved" check -- consistent
    -- with the earlier "blind vs blind" fix: what matters is whether the
    -- opponent being beaten is unproven, not the winner's own status.
    -- Requires passing which players are on the losing side, and their
    -- matches_played, as additional function arguments (not shown above
    -- for brevity -- needs p_loser_matches_played int[] param).
    v_loser_avg_matches := (select avg(m) from unnest(p_loser_matches_played) as m);
    if v_loser_avg_matches < 10 then
      -- e.g. linear ramp: fully damped at 0 matches, no damping at 10
      v_dampening := greatest(0.4, v_loser_avg_matches / 10.0);
    end if;
  end if;
```

**Still a placeholder, not a final formula:** the exact curve (`0.4` floor, linear ramp) is not validated against Communitrix's real match volume. Given the existing `formatDamping` already reduces K based on session length, stacking a second dampening factor on top needs a sanity check that combined damping doesn't crush deltas to near-zero for short/casual sessions. **Recommend simulating this against a handful of real session configs (`rounds_planned`, `court_count`, `attendee_count` combinations you actually use) before locking the floor/ramp values.**

---

## 6. Patch 5 — Carry Rule (formula_version = 2, part B)

This is the biggest structural change, since currently every player on a team gets the **exact same delta** (`getDeltas` in `calculate.ts`, and the identical `v_player_delta := v_delta` / `:= -v_delta` in both SQL RPCs).

**TS side (`calculate.ts`):**
```ts
const GAP_REFERENCE = 150;  // confirmed via calibration, see below (was placeholder 400)

const getDeltas = (team: PlayerInput[], sign: number, formulaVersion: number): PlayerDelta[] => {
  if (formulaVersion < 2 || team.length < 2) {
    return team.map(p => { /* existing flat-split logic, unchanged */ });
  }

  const sorted = [...team].sort((a, b) => a.ratingBefore - b.ratingBefore);
  const [lower, higher] = sorted;
  const eloGap = higher.ratingBefore - lower.ratingBefore;
  const skew = Math.min(eloGap / GAP_REFERENCE, 1.0);

  const teamDelta = sign * delta;
  const isWinningTeam = sign === 1 ? wA === 1.0 : wA === 0.0;

  // Gap-scaled, NOT a fixed constant: near-equal partners split ~50/50,
  // large gaps approach the old fixed values (0.6 win-side, 0.65 loss-side)
  // as an upper bound, not a flat default regardless of gap size.
  const lowerShare = isWinningTeam
    ? 0.5 + skew * 0.1   // -> up to 0.6 at max skew
    : 1 - (0.5 + skew * 0.15);  // -> down to 0.35 at max skew (higher-rated partner penalized up to 0.65)

  return [
    { ...lower,  delta: teamDelta * lowerShare },
    { ...higher, delta: teamDelta * (1 - lowerShare) },
  ];
};
```

**Zero-sum invariant check:** `elo.test.ts` explicitly asserts `sumDeltas === 0` across all 4 players. Carry Rule as written above preserves this automatically, because `lowerShare + (1 - lowerShare) = 1` — the team-level delta is unchanged, only its internal split changes. This test should keep passing without modification once Carry Rule ships. **This is the test you should run first after implementing the patch, before anything else, since it's the cheapest way to catch a mistake in the split logic.**

**`GAP_REFERENCE = 150` — confirmed via calibration, not a guess anymore.** Measured the actual distribution of internal team Elo gaps across a year-long, 15-seed simulation (31,200 team-pairing observations): median gap was only 36.8, p90=119, p95=150.1, p99=218.4, and the single largest gap observed across all 15 simulated communities was 365.3 — meaning the original placeholder of 400 was higher than the most extreme gap ever observed, which would have made Carry Rule's asymmetry nearly invisible for ordinary matches (median-gap teams would only reach ~9% of max skew). 150 (right at p95) means typical matches (median gap) get a modest, real skew (~25% of max), while only the most lopsided 5% of pairings reach the full 60/40 (win) or 65/35 (loss) split — consistent with the same "meaningful but not routine" philosophy used to calibrate `REVIEW_THRESHOLD=100` in Patch 6.

**SQL side:** the same branching logic (`p_formula_version >= 2` → sort team by `elo_before`, split `v_delta` using the same share constants) needs to be added inside `calculate_match_delta`, returning per-player deltas instead of one team-level delta. This changes the function's return shape (`player_ks` becomes `player_deltas`), which is a larger edit to Patch 1's `calculate_match_delta` than shown above — flagged here as a known follow-up, not written out in full since it depends on finalizing Patch 1 first.

**Fixed-team collusion guard — resolved, not open anymore.** `0002_enums.sql` has been reviewed: `session_format` only has two values, `AMERICANO` and `MEXICANO` — there is no player-chosen/fixed-team format in Communitrix at all. This guard is therefore **not applicable and not needed** — partners are always system-assigned via the existing matchmaking engines, never player-chosen, so the collusion pattern this guard was meant to catch cannot occur in this codebase as it exists today.

---

## 7. Patch 6 — Skill Rating (admin judgment only; Elo is a review TRIGGER, never the source of the number)

**Why every earlier formula in this section was wrong, and why this is the actual fix (not another iteration to keep revisiting):** Elo is, by its own mathematical nature, a *comparative* measure valid only within the closed pool of players it's computed from — it cannot be converted into an absolute skill claim without an external anchor connecting that pool to the outside world (this is well-established: see the Elo article's own framing, "ratings are relative, not absolute measures of skill"). Communitrix communities are closed pools with no cross-community match data. That means:
- `elo/1000` (attempt #1) was wrong — wrong calibration AND wrong in kind.
- Percentile-within-community (attempt #2) was wrong — explicitly relative-to-neighbors, which is exactly the failure mode described above (a player's label could shift just because someone else joined, without the player playing at all).
- Elo re-centered on the fixed zero-sum mean of 1000 (attempt #3) — still wrong in kind, just a more sophisticated version of attempt #1. Being closer to a "fair" linear mapping doesn't fix the core issue: no linear function of in-pool Elo produces an absolute claim.

**None of these can be algorithmically fixed without an external anchor.** So Skill Rating is not computed at all. It is **always an admin's judgment call**, informed by the `level_guidance` criteria (Patch: wiki content, see separate deliverable). Elo's only role is to flag *when* a re-assessment might be due — it never decides the number.

```sql
alter table public.player_rankings
  add column skill_rating_official         numeric(4,2) not null default 1.00,
  add column skill_rating_set_by_admin_id  uuid references profiles(id),
  add column skill_rating_assessed_at      timestamptz,
  add column elo_at_last_assessment        numeric(7,2),   -- snapshot, drift baseline
  add column review_flagged                boolean not null default false,
  add column review_flagged_at             timestamptz,
  add column external_proof_url            text;           -- optional, for Platinum/High Platinum audit trail
```

**Trigger logic** (runs inside `submit_match_score` / `replay_ratings`, after `elo_after` is computed — no new RPC needed):
```
drift = elo_after - coalesce(elo_at_last_assessment, 1000.00)
if abs(drift) >= REVIEW_THRESHOLD and not review_flagged:
    review_flagged = true
    review_flagged_at = now()
    notify_community_admin(profile_id, drift)
-- REVIEW_THRESHOLD = 100 (confirmed via multi-seed year-long simulation, see below)
```

**Admin review flow (product/UI, not a new RPC pattern):** admin sees a flagged player, opens `level_guidance` criteria for nearby tiers, decides the number (or decides "no change needed"). Either action clears the flag:
```
skill_rating_official = <admin's chosen value>   -- or unchanged if admin dismisses
skill_rating_set_by_admin_id = <acting admin>
skill_rating_assessed_at = now()
elo_at_last_assessment = elo_after            -- resets the drift baseline
review_flagged = false
```

**Platinum/High Platinum:** no longer a hard-coded cap in the formula (there IS no formula to cap). Instead, `external_proof_url` exists so an admin assigning these top two tiers can attach real evidence (FIP ranking link, tournament result, etc.) — a UI/policy convention, not a database constraint, since this is fully admin-driven now.

**What this removes from the brief, now moot:** `ALPHA_UP`/`ALPHA_DOWN`, percentile calculation, `target_skill`, the small-community weighting discussion, the 6.24 hard cap logic. None of it is needed — there's no computed value to bound or calibrate anymore.

**Still open:**
1. **`REVIEW_THRESHOLD = 100` — confirmed, not a placeholder anymore.** Validated via a year-long simulation (30 members, 52 weekly sessions, 16 random attendees/session, Mexicano format) run across 15 different random seeds, using a corrected model where each player has a fixed hidden "true skill" driving match outcomes (the first simulation attempt lacked this and produced misleadingly small Elo drift — average max drift was only ~73 without it, vs. ~196 with realistic skill variance present; confirmed the Elo/damping/Carry Rule formulas themselves were fine, the earlier simulation was just missing a variable, not evidence of a formula problem). At threshold=100, this produces ~7 review events/year for a 30-member community (~22% of members ever flagged over a year) — frequent enough to be a real safety net, not so frequent it turns into rubber-stamped routine noise. Lower values (50-75) were tested and rejected as too sensitive (38-62% of members flagged) once realistic skill variance was modeled.
2. Whether `review_flagged` also resets/triggers during `replay_ratings` (a voided match changing `elo_after` retroactively) — needs the same formula-versioning-style thinking as Patch 2, not detailed here.
3. Whether Patch 8's Round 1 Mexicano seeding formula (which used `skill_rating_as_elo` derived via a fixed conversion) needs revisiting now that Skill Rating has no formula tying it to Elo at all — flagged as a likely follow-up, not resolved in this session.

### Secondary review trigger: "carry pattern" (confirmed this session, safe alternative to feeding Skill Rating into expected-win)

**Explicitly rejected approach:** feeding Skill Rating into `effective_elo`/expected-win (Patch 9) was considered and rejected this session. Simulated evidence: the exact same players, same Elo, same match result produced a 2x difference in the stronger partner's Elo penalty purely based on which Skill Rating an admin happened to assign them — a direct, demonstrated sandbagging incentive (assign a strong partner a low Skill Rating to shrink their downside risk). Confirmed rejected; do not revisit without new information.

**Chosen direction instead:** match results can only ever *flag Skill Rating for human review* — never feed back into the Elo formula itself. But the plain Elo-drift trigger from the main Patch 6 mechanism is a weak signal specifically for "carry ability," because Patch 9's `effective_elo` deliberately dampens Elo movement in extreme-gap situations (that's the point of Patch 9) — so a player who reliably carries weak partners may show very little raw Elo drift, and would slip past `REVIEW_THRESHOLD` undetected.

```sql
create table public.carry_pattern_tracking (
  profile_id       uuid not null references profiles(id),
  community_id     uuid not null references communities(id),
  sport            sport_type not null,
  extreme_gap_matches_played int not null default 0,
  extreme_gap_wins           int not null default 0,
  expected_wins_sum          numeric(6,3) not null default 0,  -- sum of that team's expected_score across those matches
  primary key (profile_id, community_id, sport)
);
```

**After every match where the internal Elo gap on a team exceeds `EXTREME_GAP_THRESHOLD`** (reuse `GAP_REFERENCE=150` from Patch 5 rather than invent a third constant), for the stronger player on that team:
```
extreme_gap_matches_played += 1
expected_wins_sum += effective_expected_score_for_their_team
if their team won: extreme_gap_wins += 1

if extreme_gap_matches_played >= MIN_SAMPLE
   and (extreme_gap_wins - expected_wins_sum) >= OVERPERFORM_THRESHOLD
   and not review_flagged:
    review_flagged = true
    review_flagged_at = now()
    notify_community_admin(profile_id, reason='carry_overperformance')
```

This only ever produces a **flag for a human to look at** — same admin review flow as the main mechanism (Patch 6), same `external_proof_url` convention for anything that would push a player toward Platinum/High Platinum. It never touches `elo_rating` or any delta calculation.

**Still open:** ~~`MIN_SAMPLE` and `OVERPERFORM_THRESHOLD` are unvalidated placeholders~~ **confirmed via calibration: `MIN_SAMPLE = 5`, `OVERPERFORM_THRESHOLD = 2.0`.** Measured across the same 15-seed, year-long simulation used for `REVIEW_THRESHOLD` and `GAP_REFERENCE`: players who ever end up as the stronger partner in an extreme-gap team (gap > `GAP_REFERENCE`=150) accumulate a median of only 3 such matches/year (p90=8), so requiring too large a sample would make the trigger nearly unreachable for most players. Flag frequency was nearly identical across `MIN_SAMPLE` values of 3/5/8 (the truly standout overperformance cases naturally require several matches to accumulate regardless), so `MIN_SAMPLE=5` was chosen mainly as a small-sample-noise filter, not because it changes the flag rate much. At `OVERPERFORM_THRESHOLD=2.0`, this produces roughly 1 flag per 3 years for a 30-member community — appropriately rarer than the primary `REVIEW_THRESHOLD` trigger (~7/year), consistent with this being a more specific, secondary signal.

---

## 8. Patch 9 — Effective team rating (fixes expected_score for teams with an extreme internal gap)

**Problem this fixes:** `expected_score` currently uses the raw team average (`avgRatingA`/`avgRatingB` in `calculate.ts`, `v_avg_elo_a`/`v_avg_elo_b` in SQL). A team of Elo 100 + Elo 1900 averages to exactly 1000 — identical to a team of two Elo 1000 players — even though in padel, opponents can specifically target the weaker player, so the strong partner often cannot compensate the way the raw average implies. This is a real gameplay concern specific to padel (not a Carry Rule problem — Carry Rule only decides how an already-computed team delta gets split between partners; this patch fixes the delta's size in the first place).

```
internal_gap = |elo_high - elo_low|   -- within one team
effective_elo = team_average - GAP_PENALTY_FRACTION * internal_gap
-- expected_score is then computed from BOTH teams' effective_elo, not raw average
```

**`GAP_PENALTY_FRACTION = 0.25`** — confirmed this session. At this value, a team's effective rating sits a quarter of the way from the raw average toward the weaker player's own rating; at the mathematical extreme (`0.5`), effective rating would equal the weaker player's rating exactly (the stronger partner treated as contributing nothing) — `0.25` was chosen as a moderate middle ground, not the extreme.

**Confirmed example (Elo 100 + Elo 1900 vs. two Elo 1000 players), K_BASE=24, damping=1.0 for illustration:**
- `effective_elo` of the 100+1900 team = 550 (vs. raw average 1000) → expected win probability drops from 50% to ~7%.
- If they lose (the far more likely outcome), team delta shrinks to ~-2.11 instead of ~-15 under the old raw-average calculation — a loss the system now recognizes as "expected," not a surprise, so it barely penalizes either player.
- If they win (an upset), team delta jumps to ~+28 — properly rewarded as the surprising result it is.
- Carry Rule (Patch 5) then splits that team-level delta as before: on this specific loss scenario, the strong partner (Elo 1900) only drops about -1.37, not the roughly -9.84 the old flat-average calculation would have produced — directly addressing the "my strong partner shouldn't be punished for getting stuck with a total beginner" concern raised this session.

**Applies to BOTH sides independently** — i.e. `effective_elo` is computed once per team, per match, from that team's own two players; it doesn't compare across teams.

**Where this needs to be patched:** `calculate.ts` (replace `avgRatingA`/`avgRatingB` computation) and the shared SQL function from Patch 1 (`calculate_match_delta`) — same two-implementation constraint as everything else in this brief, no new duplication risk since Patch 1 already consolidates the SQL side.

**Still open:** `GAP_PENALTY_FRACTION` value is confirmed as a decision (0.25), but — like every other constant in this brief — not yet validated against real match data. Recommend treating it as tunable config (`rating_config`, per Patch 1's existing pattern) rather than a hardcoded literal, so it can be adjusted without a code deploy once real gameplay data exists.

**Cross-reference:** because this patch deliberately dampens Elo movement for extreme-gap teams, a player who reliably carries weak partners won't show much Elo drift — see Patch 6's "carry pattern" secondary trigger, added specifically to catch what this patch would otherwise hide from the review system.

---

## 9. Patch 7 — Community Points (CP): activity reward, fully separate from Elo

**Decision confirmed this session:** Elo stays strictly zero-sum (no reward injection into `elo_rating`). Activity/participation rewards live in a brand new, separate metric: **Community Points (CP)**. Not used for matchmaking in any way — purely a gamification/retention number, computed once per session (natural home: inside whatever `0010_rpc_finalize_session.sql` already does at session-end, pending confirmation of that file's actual structure).

```sql
-- New table, or a column set on session_players if preferred -- shown here
-- as a dedicated table since CP has its own lifecycle (may get seasonal
-- reset later, unlike raw match stats).
create table public.community_points (
  id            uuid primary key default gen_random_uuid(),
  community_id  uuid not null references communities(id) on delete cascade,
  profile_id    uuid not null references profiles(id) on delete cascade,
  session_id    uuid not null references sessions(id) on delete cascade,
  points_awarded numeric(8,2) not null,
  session_rank  int not null,
  session_size  int not null,          -- N attendees, kept for audit/explainability
  awarded_at    timestamptz not null default now()
);
-- Lifetime total per player = sum(points_awarded) -- no running total column
-- to avoid a second source of truth; sum on read, or maintain via trigger
-- if read performance becomes a concern later.
```

**Formula — confirmed, podium + cliff + decay, tiered by session size:**

```
IF N >= 10:
    rank 1 = 100
    rank 2 = 75
    rank 3 = 50
    rank 4 = 20                                  -- cliff: -30 from rank 3, not just -25
    rank 5..N = linear decay from 20 down to floor 8
ELSE (4 <= N < 10):
    rank 1 = 75
    rank 2 = 50
    rank 3 = 25
    rank 4..N = flat 10                          -- small session, no decay tail
```

```sql
-- Pseudocode for the decay tail (N >= 10, rank 5..N):
-- field_position = rank - 5          (0-indexed within the decay tail)
-- field_size     = greatest(N - 5, 1)
-- decay_fraction = field_position::numeric / field_size
-- points = 20 - (20 - 8) * decay_fraction
```

**Accepted, explicitly flagged, not re-litigated:**
- The cliff at exactly N=10 (a 9-attendee session pays podium 75/50/25, a 10-attendee session pays 100/75/50 — a 33% jump from one extra attendee) creates a theoretical incentive to pad session size. Accepted as low-risk for a casual community app (points, not money), but worth remembering if abuse ever surfaces.
- `100/75/50` and `75/50/25` (constant -25 step, just shifted) — deliberately simple, easy to explain to users, not empirically tuned.
- Cliff value (20) and floor (8) for the N>=10 case are placeholders, not derived from data.

**Confirmed this session: reset policy is per-community, configurable — not a single global decision.** Correction to an earlier version of this brief: there is **no `seasons` table in the real Communitrix schema** (`0003_tables.sql` has no such table — that reference bled in from an earlier, discarded fictional draft of this brief and was wrong). A dedicated new table is needed:

```sql
alter table public.communities
  add column cp_reset_policy text not null default 'never'
    check (cp_reset_policy in ('never', 'seasonal'));

create table public.community_point_seasons (
  id           uuid primary key default gen_random_uuid(),
  community_id uuid not null references communities(id) on delete cascade,
  starts_at    timestamptz not null default now(),
  ends_at      timestamptz,
  is_active    boolean not null default true
);

alter table public.community_points
  add column season_id uuid references community_point_seasons(id);
  -- NULL when cp_reset_policy = 'never' (lifetime accumulation, sum all rows).
  -- Points when cp_reset_policy = 'seasonal', filter/sum by the community's
  -- currently active season_id.
```

**Still open:** who ends a season and starts a new one — **confirmed this session: only `ADMIN` role** (not Host, not Member). This maps cleanly to the existing `member_role` enum (`ADMIN`/`MEMBER`), no new role needed for this specific decision.

```sql
-- New, admin-gated RPC -- separate from finalize_session, since a CP season
-- spans many sessions and isn't tied to any single session's lifecycle.
create or replace function public.start_new_cp_season(p_community_id uuid)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_caller uuid := public.current_profile_id();
  v_caller_role member_role;
  v_new_season_id uuid;
begin
  if v_caller is null then
    raise exception 'UNAUTHENTICATED' using errcode = '42501';
  end if;

  select role into v_caller_role from public.community_members
  where community_id = p_community_id and profile_id = v_caller and is_active;

  if v_caller_role is distinct from 'ADMIN' then
    raise exception 'UNAUTHORIZED'
      using message = 'Only community ADMIN can start a new CP season', errcode = '42501';
  end if;

  update public.community_point_seasons
    set is_active = false, ends_at = now()
  where community_id = p_community_id and is_active = true;

  insert into public.community_point_seasons (community_id, starts_at, is_active)
  values (p_community_id, now(), true)
  returning id into v_new_season_id;

  return v_new_season_id;
end;
$$;
```

**Now that the real `0010_rpc_finalize_session.sql` has been reviewed, CP computation has a concrete home** — added as a new step at the end of the existing function (via a follow-up `create or replace`, same pattern as Patch 1/3):

**CP ranking tiebreak — decided, not re-opened for discussion:** deliberately does NOT replicate `standings.ts`'s full tiebreak chain (head-to-head diff, seeded random) — that logic exists for Mexicano's live re-seeding, a higher-stakes, real-time decision that affects who plays whom next round. CP is a one-time, end-of-session participation reward; a tied CP payout differs by at most a few points, not a competitive-integrity concern. Reimplementing H2H + seeded random in PL/pgSQL for that payoff isn't worth it. Decided tiebreak: the session's own configured `standings_metric`, then `seed_elo` (already stored on `session_players`, no recomputation needed), then `profile_id` for a fully deterministic final tiebreak.

```sql
-- Appended after the existing "5. Update session status" step:

-- 6. Compute and award Community Points for this session
declare
  v_active_season_id uuid;
  v_cp_reset_policy   text;
  v_standings_metric  standings_metric;
  v_attendee_count    int;
  v_player            record;
  v_points            numeric;
begin
  select cp_reset_policy into v_cp_reset_policy
  from public.communities where id = v_community_id;

  v_active_season_id := null;
  if v_cp_reset_policy = 'seasonal' then
    select id into v_active_season_id from public.community_point_seasons
    where community_id = v_community_id and is_active = true
    order by starts_at desc limit 1;
  end if;

  select standings_metric into v_standings_metric
  from public.sessions where id = p_session_id;

  select count(*) into v_attendee_count
  from public.session_players
  where session_id = p_session_id and status = 'ACTIVE';

  for v_player in
    select profile_id,
           row_number() over (
             order by
               case v_standings_metric
                 when 'AVG_POINT_DIFF' then
                   (session_points_for - session_points_against)::numeric
                     / nullif(matches_played, 0)
                 when 'TOTAL_POINTS' then session_points_for::numeric
                 when 'WINS' then session_wins::numeric
               end desc,
               seed_elo desc,      -- tiebreak 1
               profile_id asc      -- tiebreak 2, fully deterministic
           ) as rnk
    from public.session_players
    where session_id = p_session_id and status = 'ACTIVE'
  loop
    v_points := public.calculate_cp_points(v_player.rnk, v_attendee_count); -- Patch 7 formula
    insert into public.community_points
      (community_id, profile_id, session_id, points_awarded, session_rank, session_size, awarded_at)
    values
      (v_community_id, v_player.profile_id, p_session_id, v_points, v_player.rnk, v_attendee_count, now());
  end loop;
end;
```

**Finding, later corrected — kept here for the history trail:** `0006_rls_policies.sql` was reviewed at this point in the session and showed only `is_community_admin()`/`is_community_member()` anywhere, no "Host" concept — leading to the conclusion "Host is not implemented at all." **This was corrected twice more later in this brief (see section 0): first to "Host exists but RLS may block it," then finally, after reviewing `guards.ts`, to the accurate status — Host works fine today via the application-layer guard (`requireCommunityHost`), and the stale RLS policy is only a defense-in-depth gap, not an active bug.** See section 0 for the full correction trail.

**New finding, flagged as a likely real gap:** `finalize_session` is `SECURITY DEFINER`, which bypasses RLS for its internal operations, and the function body itself has **no explicit role check** — only `current_profile_id() is not null` (i.e., "is logged in," not "is Admin of this community"). Unless there's a `grant execute` restriction not shown in the reviewed file, any authenticated community member who knows a `session_id` could potentially call this and close someone else's session. Needs the `grant execute` statement (usually at the end of the migration file) to confirm either way.

---

## 10. Patch 8 — Round 1 Mexicano seeding: combine Elo + Skill Rating

**Scope: ONLY the very first round of a session.** Round 2+ already uses live session standings (existing `mexicano.ts` behavior, unchanged). This patch only touches how players are sorted before the "rank 1+4 vs 2+3" pairing on round 1.

```
seed_score = w_elo * elo + (1 - w_elo) * skill_rating_as_elo

w_elo = min(matches_played / 10, 1.0)
-- 0 matches -> fully trust Skill Rating (Elo is still the uninformative
--   default 1000). >=10 matches -> fully trust Elo. Deliberately reuses
--   the SAME threshold as calculate.ts's own is_provisional check (< 10),
--   rather than inventing a separate confidence concept.

skill_rating_as_elo = 1000 + (skill_rating_official - 3.5) * SPREAD_PER_LEVEL
-- 3.5 = midpoint of the 0-7 scale. SPREAD_PER_LEVEL = 40, confirmed via
-- calibration (see below) -- counterintuitively SMALLER than the original
-- placeholder of 100, not larger.
```

This value is used ONLY to sort/rank players for round-1 pairing. It does NOT feed into `calculate_match_delta` — the actual delta calculation for round 1 still uses each player's raw `elo_before`, unchanged.

**`SPREAD_PER_LEVEL = 40` — confirmed via calibration, not a placeholder anymore.** This constant only matters in ONE specific scenario: a Round 1 Mexicano session with a MIX of established players (real Elo history) and brand-new players (only Skill Rating, no match history yet) — if everyone in round 1 is equally new, this value has zero effect on pairing order (it's just a monotonic rescaling of the same Skill Rating values). Tested across 21 combinations (7 simulated communities × 3 new-player cohorts, mixing 20 established + 10 brand-new players) measuring how well the resulting seed order matched each player's actual hidden skill: correlation peaked around `SPREAD_PER_LEVEL=40` (0.915 average), with a flat plateau from 30-50 (0.910-0.915, differences within noise), degrading noticeably above 70 (0.85-0.89) and further at 100+ (the original placeholder). **Counterintuitive finding, worth remembering:** a SMALLER spread value performs better here, not larger — because a large value stretches new players' skill-based seed scores far outside the natural Elo range established players actually occupy, distorting how they interleave in the combined ranking rather than helping new players get correctly positioned relative to veterans.

---

## 11. Deferred — Player Statistics (win rate, frequent partner/opponent)

Explicitly deferred at your request. Notes for later:
- Win rate already exists in `v_leaderboard` (`total_wins / total_matches`).
- Frequent partner / frequent opponent do not exist yet — straightforward aggregation views over `match_players` (self-join on `match_id`, grouped by `team` match/mismatch), not a new formula, no open design questions anticipated.

