import { test, expect } from '@playwright/test';
import { BASE_URL } from '../helpers/auth';
import { attachMetrics, assertP99SLA, SLA } from '../helpers/performance';

/**
 * P99 SLA gate (see specs/performance-sla.md "P99 methodology"): a single-sample gate
 * (assertSLA, used by 001-005) is a real signal, but one lucky or unlucky sample can't show tail
 * behavior. This repeats two cheap, read-only flows several times in one test and gates their
 * 99th-percentile duration - a slow tail request can't hide behind one fast sample.
 *
 * Sample size is deliberately small and only applied to CHEAP flows (home page load, nav click) -
 * this project explicitly avoids generating repeated/concurrent load against its shared staging
 * accounts (see playwright.config.ts's workers: 1 note). The heavier booking-flow tier (T6, see
 * 005) is intentionally left single-sample.
 */
test.describe('Performance - P99 SLA', () => {
  test('home page load and nav-click P99 stay within the formal SLA', async ({ page }, testInfo) => {
    const pageLoadSamples: number[] = [];
    for (let i = 0; i < 8; i++) {
      const start = Date.now();
      await page.goto(`${BASE_URL}/en`, { waitUntil: 'load' });
      pageLoadSamples.push(Date.now() - start);
    }

    const navClickSamples: number[] = [];
    for (let i = 0; i < 6; i++) {
      await page.goto(`${BASE_URL}/en`, { waitUntil: 'load' });
      const start = Date.now();
      await page.getByRole('link', { name: 'Activity Activity' }).click();
      await expect(page).toHaveURL(`${BASE_URL}/en/activity`, { timeout: 10_000 });
      navClickSamples.push(Date.now() - start);
    }

    const summary = [
      assertP99SLA('SLA P99 T1 - Home page load', pageLoadSamples, SLA.PAGE_LOAD),
      assertP99SLA('SLA P99 T2 - Stay -> Activity nav click', navClickSamples, SLA.NAVIGATION),
    ];
    console.log(`\n[PERF] P99 SLA:\n  ${summary.join('\n  ')}`);
    await attachMetrics(testInfo, 'p99-sla-performance-metrics', summary);
  });
});
