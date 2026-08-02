import { test, expect } from '@playwright/test';

// Personal Quick Match and community session creation both require a logged-in profile
// (requireProfile() / requireCommunityHost() in src/server/guards.ts). A real authenticated
// click-through isn't possible here without a live test account's credentials, but every
// protected wizard surface should at least fail closed — redirecting to /login rather than
// erroring or rendering a blank/broken page for an anonymous visitor.
test.describe('protected wizard surfaces redirect anonymous visitors to /login', () => {
  test('Personal Quick Match', async ({ page }) => {
    await page.goto('/communities/quick-match');
    await expect(page).toHaveURL(/\/login/);
  });

  test('community session creation', async ({ page }) => {
    await page.goto('/c/some-community/sessions/new');
    await expect(page).toHaveURL(/\/login/);
  });
});
