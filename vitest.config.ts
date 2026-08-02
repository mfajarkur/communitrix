import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Playwright owns tests/e2e — without this, vitest's default glob also picks up .spec.ts
    // files there and fails trying to run Playwright's test() outside its own runner.
    include: ['tests/unit/**/*.test.ts'],
  },
});
