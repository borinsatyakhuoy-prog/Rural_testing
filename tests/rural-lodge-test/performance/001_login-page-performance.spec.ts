import { test, expect } from '@playwright/test';
import { BASE_URL } from '../helpers/auth';
import { getNavigationMetrics, getResourceDurations, waitForResourceEntry, attachMetrics, ratedLine, assertSLA, SLA } from '../helpers/performance';

/**
 * Real, unmocked navigation/paint timing for the login page, plus the actual duration of the
 * batched tRPC call(s) that fire around login. Gated against the formal SLA
 * (specs/performance-sla.md) - T1 for page load, T3 for the login-related API traffic - not just
 * the readable GOOD/SLOW/POOR heuristic below.
 */
test.describe('Performance - Login', () => {
  test('login page loads and authenticates within a generous budget', async ({ page }, testInfo) => {
    const navStart = Date.now();
    await page.goto(`${BASE_URL}/en/auth`, { waitUntil: 'load' });
    const pageLoadMs = Date.now() - navStart;
    const nav = await getNavigationMetrics(page);

    // pressSequentially, not fill: see the Cycle 4 note in
    // authentication/001_valid-login-redirects-home.spec.ts.
    await page.getByRole('textbox', { name: 'Email' }).pressSequentially(process.env.TEST_USER_EMAIL!);
    await page.getByRole('textbox', { name: 'Password' }).pressSequentially(process.env.TEST_USER_PASSWORD!);

    const loginStart = Date.now();
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    // Use a timeout comfortably above SLA.NAVIGATION.max so a slow-but-real login is measured and
    // judged by assertSLA() below, rather than false-failing on a shorter default timeout while
    // still genuinely in-flight.
    await expect(page).toHaveURL(`${BASE_URL}/en`, { timeout: 15_000 });
    const loginRoundTripMs = Date.now() - loginStart;
    // The post-login redirect's first paint can beat the browser actually buffering the matching
    // Resource Timing entry - poll the real buffer (see helpers/performance.ts) rather than assume
    // it's already there, which was observed to intermittently read an empty result otherwise.
    await waitForResourceEntry(page, 'trpc').catch(() => {});
    const trpcDurations = await getResourceDurations(page, 'trpc');

    const summary = [
      ratedLine('Login page load (goto to load event)', pageLoadMs, 2000, 5000),
      assertSLA('SLA T1 - Login page load', pageLoadMs, SLA.PAGE_LOAD),
      `Navigation Timing - TTFB: ${nav.ttfb} ms, DOMContentLoaded: ${nav.domContentLoaded} ms, full load: ${nav.loadComplete} ms`,
      `Paint Timing - First Paint: ${nav.firstPaint ?? 'n/a'} ms, First Contentful Paint: ${nav.firstContentfulPaint ?? 'n/a'} ms`,
      ratedLine('Login click-to-home round trip', loginRoundTripMs, 2000, 5000),
      assertSLA('SLA T2 - Login click-to-home round trip', loginRoundTripMs, SLA.NAVIGATION),
      trpcDurations[0] !== undefined
        ? ratedLine('First tRPC batch call after login', trpcDurations[0], 500, 1500)
        : 'First tRPC batch call after login: n/a',
      trpcDurations[0] !== undefined
        ? assertSLA('SLA T3 - tRPC batch call after login', trpcDurations[0], SLA.API_READ)
        : 'SLA T3 - tRPC batch call after login: n/a',
    ];
    console.log(`\n[PERF] Login:\n  ${summary.join('\n  ')}`);
    await attachMetrics(testInfo, 'login-performance-metrics', summary);
  });
});
