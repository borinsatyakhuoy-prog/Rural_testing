import { test, expect } from '@playwright/test';
import { BASE_URL, login } from '../helpers/auth';

/**
 * The Payout Overview's "Payout Filters" sheet (Payment Status/Payment Method/Date Range) is
 * kept at a view-only level of coverage, consistent with 002_payout-overview-and-settings.spec.ts
 * and specs/exploratory-findings.md's own scope boundary for this module (no real bank/payment
 * data entered or submitted anywhere in Payout). Payment Status/Payment Method render as
 * dropdown-style controls whose option lists mount in a portal outside the sheet's own DOM
 * subtree, so this confirms the filter panel and its sections are real and reachable rather than
 * exercising specific option selection.
 */
test.describe('Lodge Owner - other modules', () => {
  test('Payout Filters sheet opens with the expected sections', async ({ page }) => {
    await login(page);
    await page.waitForTimeout(1500);
    await page.goto(`${BASE_URL}/en/payout`, { waitUntil: 'load' });

    await page.getByRole('button', { name: /Payout Filters/i }).click();
    const dialog = page.getByRole('dialog').filter({ hasText: 'Payout Filters' });
    await expect(dialog).toBeVisible({ timeout: 10_000 });

    for (const section of ['Payment Status', 'Payment Method', 'Date Range']) {
      await expect(dialog.locator('[data-slot="accordion-trigger"]').filter({ hasText: section })).toBeVisible();
    }
    await expect(dialog.getByText(/active filters/)).toBeVisible();
  });
});
