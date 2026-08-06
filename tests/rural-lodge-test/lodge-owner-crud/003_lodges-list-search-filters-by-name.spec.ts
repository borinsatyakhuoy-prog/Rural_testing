import { test, expect } from '@playwright/test';
import { BASE_URL, login } from '../helpers/auth';

/**
 * The Owner Lodges search box was previously only covered by a timing test (performance/003),
 * which never asserted the results were actually filtered by name - just that *a* row rendered
 * within budget. Live exploration via Playwright MCP found a real gotcha worth documenting: right
 * after typing, the row count can render a transient "0 loges" loading flash (same pattern already
 * known from 002's Status filter) before the real filtered count settles a couple seconds later -
 * confirmed by searching "QA" and seeing 0 immediately, then 34 once polled. This test derives its
 * search term from a real row's own name (rather than a hardcoded fixture name that could be
 * deleted/renamed later) and polls past that flash, so it stays valid regardless of which lodges
 * currently exist in the account.
 */
test.describe('Lodge Owner CRUD - Lodges list search', () => {
  test('search box narrows the table to rows whose name actually contains the query', async ({ page }) => {
    await login(page);
    await page.waitForTimeout(1500);
    await page.goto(`${BASE_URL}/en/lodges?sort=updatedAt&sortOrder=desc`, { waitUntil: 'load' });

    const countText = page.getByText(/\d+ loges/i);
    await expect(countText).toBeVisible({ timeout: 10_000 });
    const unfilteredCount = parseInt((await countText.innerText()).match(/\d+/)![0], 10);
    expect(unfilteredCount).toBeGreaterThan(0);

    // Derive a real, currently-existing search term from the first row's own lodge name, rather
    // than assuming a specific fixture (e.g. "QA_CRUD_...") still exists.
    const firstRowName = (await page.getByRole('row').nth(1).getByRole('heading').first().innerText()).trim();
    const searchTerm = firstRowName.slice(0, Math.min(6, firstRowName.length));
    expect(searchTerm.length).toBeGreaterThan(0);

    await page.getByPlaceholder('Search for loges...').fill(searchTerm);
    await expect(page).toHaveURL(new RegExp(`prop_search=${encodeURIComponent(searchTerm)}`), { timeout: 10_000 });

    // The filtered count needs a moment to settle past the transient "0 loges" loading flash
    // (same race documented in 002_lodges-list-status-filter.spec.ts).
    await expect
      .poll(async () => {
        const text = await countText.innerText().catch(() => '');
        const match = text.match(/\d+/);
        return match ? parseInt(match[0], 10) : -1;
      }, { timeout: 10_000, intervals: [500, 1000, 1500] })
      .toBeGreaterThan(0);

    const filteredCount = parseInt((await countText.innerText()).match(/\d+/)![0], 10);
    expect(filteredCount).toBeLessThanOrEqual(unfilteredCount);

    // Every visible row's name should actually contain the search term (case-insensitive) -
    // confirming the search is a real server-side name filter, not a no-op that just re-renders
    // the same unfiltered page.
    const rowNames = await page.getByRole('row').getByRole('heading').allInnerTexts();
    expect(rowNames.length).toBeGreaterThan(0);
    for (const name of rowNames) {
      expect(name.toLowerCase()).toContain(searchTerm.toLowerCase());
    }
  });
});
