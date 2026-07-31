<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Mandatory Documentation Synchronization Rule
Whenever major feature changes, architectural refactors, business rule updates, or RBAC/scoring modifications are made to the codebase, ALL relevant `.md` documentation files (`docs/PRD.md`, `docs/SCORING_RULESET.md`, `docs/bye-point-brief.md`, `README.md`) MUST be updated in lockstep so that the project documentation remains 100% synchronized and aligned with the active codebase.

# Footer Version Number
The footer displayed across the app (`src/components/footer.tsx`, and the auth/quick-match layouts) shows a version string sourced from `src/lib/version.json`, formatted as `YYMMDDVA.B` by `src/lib/version.ts` (e.g. `260731V1.0` = bumped 2026-07-31, major 1, minor 0).

- **B (minor)** auto-increments on every commit via the Husky `pre-commit` hook (`scripts/bump-version.mjs`, wired in `.husky/pre-commit`) — do not bump it by hand, and do not bypass the hook (`--no-verify`) when committing changes to this repo.
- **A (major)** is NOT automated. Bump it by hand in `src/lib/version.json` — increment `major` by 1 and reset `minor` to `0` — only for a significant/breaking change (major feature, architectural refactor), not a routine fix. Use judgment consistent with the Documentation Synchronization Rule above: if a change is big enough to require updating `docs/PRD.md` etc., it likely also warrants a major bump.
