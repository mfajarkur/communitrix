import versionData from './version.json';

// versionData.date is the date (YYMMDD) this version number was last bumped, not "today".
// versionData.minor auto-increments on every commit via the pre-commit hook in
// scripts/bump-version.mjs (see .husky/pre-commit). versionData.major is bumped by
// hand only for a significant/breaking change, which also resets minor back to 0 —
// see the convention documented in AGENTS.md.
export const APP_VERSION = `${versionData.date}V${versionData.major}.${versionData.minor}`;
