-- Removes the skill_level attribute (BEGINNER/INTERMEDIATE/ADVANCED badge + its self-request/
-- admin-approve workflow, added in 0036) entirely, per explicit product decision: no skill
-- attribute on players at all. Confirmed via investigation that skill_level never factored into
-- matchmaking/round-generation/Elo — round generation runs entirely on elo_rating and current
-- standings — so this is a pure removal with no gameplay-logic impact.
--
-- The derived "Skill Rating" (1.00-7.00, computed client-side from elo_rating) that used to show
-- on the leaderboard has no DB footprint — nothing to drop here, it's removed UI-side only.
--
-- 0018_elo_adjustments_and_cp.sql's player_rankings.skill_rating_official/skill_rating_set_by_
-- admin_id/skill_rating_assessed_at/elo_at_last_assessment/review_flagged were never actually
-- applied to this database (per 0028's own header comment and docs/SCORING_RULESET.md) — the
-- `if exists` guards below make these drops safe regardless of whether that's still true.

drop function if exists public.resolve_skill_level_request(uuid, text);
drop function if exists public.request_skill_level(uuid, text);

drop table if exists public.skill_level_requests;

alter table public.community_members
  drop column if exists skill_level;

alter table public.player_rankings
  drop column if exists skill_rating_official,
  drop column if exists skill_rating_set_by_admin_id,
  drop column if exists skill_rating_assessed_at,
  drop column if exists elo_at_last_assessment,
  drop column if exists review_flagged;
