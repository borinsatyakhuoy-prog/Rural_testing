import { test, expect } from '@playwright/test';
import { BASE_URL, loginAsCustomer } from '../helpers/auth';
import { attachMetrics, ratedLine, assertSLA, SLA } from '../helpers/performance';

const LODGE_SLUG = 'lotus-lake-floating-villa';

/** Real dialog-open timing for the booking widget's date picker and guest-count stepper. */
test.describe('Performance - Booking dialogs', () => {
  test('date picker and guests dialogs open within a generous budget', async ({ page }, testInfo) => {
    await loginAsCustomer(page);
    await page.goto(`${BASE_URL}/en/lodges/${LODGE_SLUG}`, { waitUntil: 'load' });

    const dateStart = Date.now();
    await page.getByRole('button', { name: 'Check-in — Check-out Select' }).click();
    const dateDialog = page.getByRole('dialog').filter({ hasText: 'Select your dates' });
    await expect(dateDialog).toBeVisible({ timeout: 10_000 });
    const dateOpenMs = Date.now() - dateStart;
    await page.keyboard.press('Escape').catch(() => {});

    const guestsStart = Date.now();
    await page.getByRole('button', { name: /Guests/ }).first().click();
    const guestsDialog = page.getByRole('dialog').filter({ hasText: 'Guest details' });
    await expect(guestsDialog).toBeVisible({ timeout: 10_000 });
    const guestsOpenMs = Date.now() - guestsStart;

    const summary = [
      ratedLine('Date picker dialog open', dateOpenMs, 1000, 3000),
      assertSLA('SLA T5 - Date picker dialog open', dateOpenMs, SLA.DIALOG_OPEN),
      ratedLine('Guests dialog open', guestsOpenMs, 1000, 3000),
      assertSLA('SLA T5 - Guests dialog open', guestsOpenMs, SLA.DIALOG_OPEN),
    ];
    console.log(`\n[PERF] Booking dialogs:\n  ${summary.join('\n  ')}`);
    await attachMetrics(testInfo, 'booking-dialogs-performance-metrics', summary);
  });
});
