import { test, expect } from '@playwright/test';
import { BASE_URL, login, loginAsCustomer } from '../helpers/auth';
import { getResourceDurations, waitForResourceEntry, attachMetrics, ratedLine, assertSLA, SLA } from '../helpers/performance';

/**
 * Extends T3 (API Read) coverage beyond 001's single post-login batch call to the other
 * data-fetching pages/endpoints named in specs/exploratory-findings.md and the DEFECT-1 writeup
 * (notifications.getMy, notifications.getUnreadCount, booking.getBookings) plus the Owner-side
 * Reservations/Payout/Notifications reads. Same broad `trpc` substring match as 001 - per
 * specs/performance-sla.md's T3 methodology note, this app batches reads under
 * `/api/trpc/...?batch=1` and individual procedure names aren't always resolvable from the client
 * side, so each test's SLA gate is against whichever batch call fires for that page.
 *
 * Each page fires more than one batched call (e.g. the dashboard's greeting is sourced from an
 * earlier auth.getActiveCustomer batch than the notifications/booking one). `waitForResourceEntry`
 * polls the real Resource Timing buffer directly rather than a UI marker (which can render off an
 * unrelated batch) or Playwright's `waitForResponse` (a CDP event that can resolve a tick before
 * the browser actually buffers the matching Resource Timing entry) - both were observed to
 * intermittently read an empty result before this fix.
 */
test.describe('Performance - API Read (T3)', () => {
  test('Customer Dashboard API read stays within budget', async ({ page }, testInfo) => {
    await loginAsCustomer(page);
    await page.goto(`${BASE_URL}/en/customer/dashboard`, { waitUntil: 'load' });
    await expect(page.getByText(/Hello,/)).toBeVisible({ timeout: 15_000 });
    await waitForResourceEntry(page, 'trpc');
    const trpcDurations = await getResourceDurations(page, 'trpc');

    const summary = [
      ratedLine('Customer Dashboard tRPC batch (notifications/getBookings)', trpcDurations[0], 500, 1500),
      assertSLA('SLA T3 - Customer Dashboard API read', trpcDurations[0], SLA.API_READ),
    ];
    console.log(`\n[PERF] Customer Dashboard API read:\n  ${summary.join('\n  ')}`);
    await attachMetrics(testInfo, 'customer-dashboard-api-performance-metrics', summary);
  });

  test('Customer Wishlist API read stays within budget', async ({ page }, testInfo) => {
    await loginAsCustomer(page);
    await page.goto(`${BASE_URL}/en/customer/wishlist`, { waitUntil: 'load' });
    // specs/exploratory-findings.md documents this page rendering a blank content area for
    // several seconds with no loading skeleton before the real list/empty-state appears.
    await expect(page.getByText(/Wishlist/i).first()).toBeVisible({ timeout: 20_000 });
    await waitForResourceEntry(page, 'trpc', 20_000);
    const trpcDurations = await getResourceDurations(page, 'trpc');

    const summary = [
      ratedLine('Customer Wishlist tRPC batch', trpcDurations[0], 500, 1500),
      assertSLA('SLA T3 - Customer Wishlist API read', trpcDurations[0], SLA.API_READ),
    ];
    console.log(`\n[PERF] Customer Wishlist API read:\n  ${summary.join('\n  ')}`);
    await attachMetrics(testInfo, 'customer-wishlist-api-performance-metrics', summary);
  });

  test('Owner Reservations list API read stays within budget', async ({ page }, testInfo) => {
    await login(page);
    // AUTH_TOKEN cookie settles asynchronously just after login (see helpers/auth.ts's
    // loginAsOwner and 003's own note) - a short buffer avoids racing this direct URL navigation
    // into a protected owner route.
    await page.waitForTimeout(1500);
    await page.goto(`${BASE_URL}/en/reservations?page=1&res_status=pending,confirmed,checkedIn`, {
      waitUntil: 'load',
    });
    await expect(page.getByRole('columnheader', { name: 'Status' })).toBeVisible({ timeout: 15_000 });
    await waitForResourceEntry(page, 'trpc');
    const trpcDurations = await getResourceDurations(page, 'trpc');

    const summary = [
      ratedLine('Owner Reservations tRPC batch', trpcDurations[0], 500, 1500),
      assertSLA('SLA T3 - Owner Reservations API read', trpcDurations[0], SLA.API_READ),
    ];
    console.log(`\n[PERF] Owner Reservations API read:\n  ${summary.join('\n  ')}`);
    await attachMetrics(testInfo, 'owner-reservations-api-performance-metrics', summary);
  });

  test('Owner Payout Overview API read stays within budget', async ({ page }, testInfo) => {
    await login(page);
    await page.waitForTimeout(1500);
    await page.goto(`${BASE_URL}/en/payout`, { waitUntil: 'load' });
    await expect(page.getByText('Total Earnings').first()).toBeVisible({ timeout: 15_000 });
    await waitForResourceEntry(page, 'trpc');
    const trpcDurations = await getResourceDurations(page, 'trpc');

    const summary = [
      ratedLine('Owner Payout Overview tRPC batch', trpcDurations[0], 500, 1500),
      assertSLA('SLA T3 - Owner Payout Overview API read', trpcDurations[0], SLA.API_READ),
    ];
    console.log(`\n[PERF] Owner Payout Overview API read:\n  ${summary.join('\n  ')}`);
    await attachMetrics(testInfo, 'owner-payout-api-performance-metrics', summary);
  });

  test('Owner Notifications API read stays within budget', async ({ page }, testInfo) => {
    await login(page);
    await page.waitForTimeout(1500);
    await page.goto(`${BASE_URL}/en/notifications`, { waitUntil: 'load' });
    await expect(page.getByText(/new notifications/)).toBeVisible({ timeout: 15_000 });
    await waitForResourceEntry(page, 'trpc');
    const trpcDurations = await getResourceDurations(page, 'trpc');

    const summary = [
      ratedLine('Owner Notifications tRPC batch', trpcDurations[0], 500, 1500),
      assertSLA('SLA T3 - Owner Notifications API read', trpcDurations[0], SLA.API_READ),
    ];
    console.log(`\n[PERF] Owner Notifications API read:\n  ${summary.join('\n  ')}`);
    await attachMetrics(testInfo, 'owner-notifications-api-performance-metrics', summary);
  });
});
