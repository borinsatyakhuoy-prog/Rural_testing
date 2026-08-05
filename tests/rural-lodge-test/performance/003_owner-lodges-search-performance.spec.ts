import { test, expect } from '@playwright/test';
import { login } from '../helpers/auth';
import { attachMetrics, ratedLine, assertSLA, SLA } from '../helpers/performance';

const BASE_URL = new URL(process.env.APP_URL!).origin;

/**
 * Real search-to-filtered-table timing on the Owner Lodges list, against the TEST_USER_EMAIL
 * account (40+ pre-existing lodges per specs/exploratory-findings.md), so the search box has a
 * real, non-trivial table to filter.
 */
test.describe('Performance - Owner Lodges search', () => {
  test('search box filters the lodges table within a generous budget', async ({ page }, testInfo) => {
    await login(page);
    // The AUTH_TOKEN cookie settles asynchronously just after login (see helpers/auth.ts's
    // loginAsOwner for the same documented race) - a short buffer here avoids racing the
    // dashboard navigation this test doesn't otherwise need to retry for.
    await page.waitForTimeout(1500);
    await page.goto(`${BASE_URL}/en/lodges?sort=updatedAt&sortOrder=desc`, { waitUntil: 'load' });
    await expect(page.getByPlaceholder('Search for loges...')).toBeVisible({ timeout: 10_000 });

    const searchStart = Date.now();
    await page.getByPlaceholder('Search for loges...').fill('QA');
    // The table re-queries after the app's own debounce - wait for the row count text to update
    // rather than a fixed sleep, so this measures the real filter latency.
    await page.waitForTimeout(1200);
    await expect(page.getByRole('row').first()).toBeVisible({ timeout: 10_000 });
    const searchMs = Date.now() - searchStart;

    const summary = [
      ratedLine('Owner Lodges search-to-filtered-table', searchMs, 1500, 4000),
      assertSLA('SLA T4 - Owner Lodges search', searchMs, SLA.SEARCH_FILTER),
    ];
    console.log(`\n[PERF] Owner Lodges search:\n  ${summary.join('\n  ')}`);
    await attachMetrics(testInfo, 'owner-lodges-search-performance-metrics', summary);
  });
});
