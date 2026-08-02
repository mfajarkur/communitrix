import { test, expect } from '@playwright/test';

// Walks the public Quick Match sandbox (/quick-match) end-to-end: no auth required, so this is
// the one wizard surface that can be fully exercised without real Supabase credentials. Also
// doubles as a regression guard for the POINTS-mode score auto-complement behavior (tapping one
// team's score should immediately fill the other and complete the match) — see
// src/lib/matchmaking/scoring-format.ts.
test('sandbox Quick Match: create, score, and end a match', async ({ page }) => {
  await page.goto('/quick-match');

  // Step 1: pick a format (Americano, default sport/config already selected).
  await page.getByText('Americano', { exact: true }).click();

  // Step 2: defaults (16 Points, 1 court, Americano) are already filled in — just confirm.
  await page.getByRole('button', { name: 'Confirm Configuration' }).click();

  // Step 3: register 4 players (minimum for a non-team format).
  const nameInput = page.getByPlaceholder('Type player name and press Enter...');
  for (const name of ['Alice', 'Bob', 'Carol', 'Dave']) {
    await nameInput.fill(name);
    await nameInput.press('Enter');
  }

  const startButton = page.getByRole('button', { name: 'Generate Matches & Open Session' });
  await expect(startButton).toBeEnabled();
  await startButton.click();

  // Step 4: Round 1 should have exactly one match (4 players, 1 court, doubles).
  await expect(page.getByText('Court 1')).toBeVisible();

  // Tap Team A's score button (shows "-" before a score is picked) and select 10 from the
  // picker. In POINTS mode (16 Points target) Team B should auto-complement to 6 — no second
  // tap needed for the match to be considered complete.
  await page.getByRole('button', { name: '-' }).first().click();
  await expect(page.getByText('Tap to Select Score')).toBeVisible();
  await page.getByRole('button', { name: '10', exact: true }).click();

  // Both score slots should now be filled (10 and the auto-complemented 6) with no more "-"
  // placeholders left in the match card.
  await expect(page.getByRole('button', { name: '10', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '6', exact: true })).toBeVisible();

  // Switch to the Leaderboard tab and end the match.
  await page.getByText('LEADERBOARD').click();
  await page.getByRole('button', { name: /End Match Session/i }).click();
  await page.getByRole('button', { name: 'Yes, End' }).click();

  await expect(page.getByText('Final Match Standings')).toBeVisible();
});
