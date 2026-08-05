import { test, expect } from '@playwright/test';
import { BASE_URL } from '../helpers/auth';

test.describe('Root URL locale default', () => {
  test('Direct root URL defaults to the Khmer locale', async ({ page, context }) => {
    // A NEXT_LOCALE cookie set by a prior language-toggle selection overrides the /km default on
    // later bare "/" visits (see specs/exploratory-findings.md, Navigation 1.8) — clear cookies so
    // this test observes the true default rather than a locale choice left over from another test.
    await context.clearCookies();
    await page.goto(`${BASE_URL}/`);
    await expect(page).toHaveURL(`${BASE_URL}/km`);
  });
});
