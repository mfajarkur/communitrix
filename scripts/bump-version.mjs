import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Runs as a pre-commit hook (see .husky/pre-commit). Bumps the minor (B) version
// number and stamps today's date on every commit, so the footer's version string
// (src/lib/version.ts) always reflects the latest pushed change. The major (A)
// number is not touched here — bump it by hand in src/lib/version.json (and reset
// minor to 0) for a significant/breaking change, per the convention in AGENTS.md.

const versionPath = fileURLToPath(new URL('../src/lib/version.json', import.meta.url));
const version = JSON.parse(readFileSync(versionPath, 'utf-8'));

const now = new Date();
const yy = String(now.getFullYear()).slice(2);
const mm = String(now.getMonth() + 1).padStart(2, '0');
const dd = String(now.getDate()).padStart(2, '0');

version.minor += 1;
version.date = `${yy}${mm}${dd}`;

writeFileSync(versionPath, JSON.stringify(version, null, 2) + '\n');
execSync('git add src/lib/version.json', { stdio: 'inherit' });

console.log(`Bumped version to ${version.date}V${version.major}.${version.minor}`);
