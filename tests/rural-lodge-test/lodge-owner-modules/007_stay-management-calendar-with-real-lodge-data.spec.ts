import { test, expect } from '@playwright/test';
import { BASE_URL, login } from '../helpers/auth';

/**
 * The other Stay Management test (003_stay-management-empty-state.spec.ts) only ever exercises
 * the OWNER_TEST_EMAIL account, which is intentionally "clean" (0 lodges) - so the real calendar
 * UI itself had never been explored/covered, only its empty state. This test uses the main
 * TEST_USER_EMAIL account (40+ real lodges, per specs/exploratory-findings.md) to reach the
 * actual calendar branch, confirmed live via Playwright MCP exploration: a "Choose a lodge"
 * selector (one button per lodge, each showing its name and nightly price), a calendar legend
 * (Custom price / Custom stay rules / Custom price & stay rules / Blocked), a 12-month rolling
 * calendar grid with per-day price buttons, and Default Stay Rules / Custom Rules / Price Rules
 * sections below it.
 */
test.describe('Lodge Owner - other modules', () => {
  test('Stay Management shows the real calendar (lodge selector, legend, month grid) for an account with lodges', async ({ page }) => {
    await login(page);
    // The AUTH_TOKEN cookie settles asynchronously just after login (see helpers/auth.ts's
    // loginAsOwner for the identically-documented race) - a short buffer avoids racing the
    // dashboard navigation below.
    await page.waitForTimeout(1500);

    for (let attempt = 0; attempt < 2; attempt++) {
      await page.getByRole('button', { name: 'Manage Your Lodge' }).click();
      try {
        await page.waitForURL(/\/dashboard/, { timeout: 8000 });
        break;
      } catch {
        if (attempt === 1) throw new Error('Could not reach the owner dashboard after logging in');
        await page.goto(`${BASE_URL}/en`);
        await page.waitForTimeout(2000);
      }
    }

    await page.getByRole('button', { name: 'Stay Management', exact: true }).click();
    await page.waitForURL(/\/lodges\/calendar/, { timeout: 15000 });
    await expect(page).toHaveTitle(/Calendar Lodge/);

    // Ground truth this is the real calendar branch, not the empty state.
    await expect(page.getByRole('heading', { name: 'No lodges yet' })).toHaveCount(0);
    await expect(page.getByText('Choose a lodge')).toBeVisible({ timeout: 15000 });

    // At least one lodge-selector button, showing a name and a "$X/night" price.
    const lodgeButtons = page.getByRole('button', { name: /\$[\d.]+\/night/ });
    expect(await lodgeButtons.count()).toBeGreaterThan(0);

    // Calendar legend confirms the 4 documented day states.
    await expect(page.getByText('Calendar legend')).toBeVisible();
    for (const label of ['Custom price', 'Custom stay rules', 'Custom price & stay rules', 'Blocked']) {
      await expect(page.getByText(label, { exact: true })).toBeVisible();
    }

    // A real month grid is rendered (heading format "<Month> <Year>", e.g. "August 2026").
    await expect(page.getByRole('heading', { name: /^[A-Z][a-z]+ \d{4}$/ }).first()).toBeVisible();

    // Stay-rules sections below the calendar.
    await expect(page.getByRole('heading', { name: 'Default Stay Rules' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Custom Rules' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Price Rules' })).toBeVisible();
  });
});
