import { test, expect } from '@playwright/test';
import { BASE_URL, loginAsCustomer } from '../helpers/auth';
import { attachMetrics, ratedLine, assertSLA, SLA } from '../helpers/performance';

const LODGE_SLUG = 'lotus-lake-floating-villa';

/**
 * Measures this app's heaviest real, safe-to-repeat user flow: clicking "Book for N nights"
 * through to the Personal Details step actually rendering. specs/exploratory-findings.md and this
 * suite's own Step 5 healing both documented a transient "Loading Your Booking... Fetching cart
 * data" state here - this is the flow's real, user-facing completion, not just the click
 * acknowledgment.
 *
 * IMPORTANT (scope constraint, same as customer-booking/002): never proceeds past Personal
 * Details, never submits a real payment.
 */
test.describe('Performance - Booking flow', () => {
  test('Book CTA click through to Personal Details renders within a generous budget', async ({ page }, testInfo) => {
    await loginAsCustomer(page);
    await page.goto(`${BASE_URL}/en/lodges/${LODGE_SLUG}`, { waitUntil: 'load' });

    const today = new Date();
    const checkIn = new Date(today);
    checkIn.setDate(today.getDate() + 2);
    const checkOut = new Date(today);
    checkOut.setDate(today.getDate() + 4);
    const checkInLabel = checkIn.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
    const checkOutLabel = checkOut.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });

    await page.getByRole('button', { name: 'Check-in — Check-out Select' }).click();
    const dateDialog = page.getByRole('dialog').filter({ hasText: 'Select your dates' });
    await expect(dateDialog).toBeVisible();
    await dateDialog.getByRole('button', { name: new RegExp(`${checkInLabel},`) }).first().click();
    await dateDialog.getByRole('button', { name: new RegExp(`${checkOutLabel},`) }).first().click();
    await expect(dateDialog).toBeHidden();

    const bookCta = page.getByRole('button', { name: /Book for \d+ nights?/ });
    await expect(bookCta).toBeEnabled();

    const bookingStart = Date.now();
    await bookCta.click();
    await page.waitForURL(/\/booking\?scheduleID=/, { timeout: 20_000 });
    await expect(page.getByText('Personal Details').first()).toBeVisible({ timeout: 20_000 });
    const bookingToPersonalDetailsMs = Date.now() - bookingStart;

    const summary = [
      ratedLine('Book CTA click -> Personal Details rendered', bookingToPersonalDetailsMs, 8000, 15000),
      assertSLA('SLA T6 - Booking flow to Personal Details', bookingToPersonalDetailsMs, SLA.BOOKING_TO_PERSONAL_DETAILS),
    ];
    console.log(`\n[PERF] Booking flow:\n  ${summary.join('\n  ')}`);
    await attachMetrics(testInfo, 'booking-flow-performance-metrics', summary);
  });
});
