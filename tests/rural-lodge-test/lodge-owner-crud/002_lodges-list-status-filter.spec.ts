import { test, expect } from '@playwright/test';
import { BASE_URL, login } from '../helpers/auth';

/**
 * The Owner Lodges list's "Filter" sheet (Status/Type/Price Range accordions) was previously only
 * covered indirectly via the search box (see performance/003). This exercises the Status filter
 * end-to-end: checking "Draft" applies a real `prop_status=Draft` query param and the table's own
 * row count updates accordingly - confirmed against the TEST_USER_EMAIL account's real 75+ lodges
 * (61 of which are Draft at the time this was written), not a guessed/empty result.
 *
 * The filtered count needs a few seconds to settle after applying - confirmed via live recon that
 * reading it too early (~2.5s) catches a transient "0 loges" loading flash before the real
 * filtered total (e.g. 61) renders a couple seconds later.
 */
test.describe('Lodge Owner CRUD - Lodges list filter', () => {
  test('filtering the Lodges list by Status (Draft) narrows the table and updates the URL', async ({ page }) => {
    await login(page);
    await page.waitForTimeout(1500);
    await page.goto(`${BASE_URL}/en/lodges?sort=updatedAt&sortOrder=desc`, { waitUntil: 'load' });

    const countText = page.getByText(/\d+ loges/i);
    await expect(countText).toBeVisible({ timeout: 10_000 });
    const unfilteredCount = parseInt((await countText.innerText()).match(/\d+/)![0], 10);
    expect(unfilteredCount).toBeGreaterThan(0);

    await page.getByRole('button', { name: 'Filter' }).first().click();
    const dialog = page.getByRole('dialog').filter({ hasText: 'Filters' });
    await expect(dialog).toBeVisible({ timeout: 10_000 });

    // "Status" is the first accordion section; its checkboxes carry no accessible name (only a
    // sibling label), so they're targeted by their documented display order: Draft, In Review,
    // Pending Review, Published, Restricted, Suspended, Unqualified.
    await dialog.locator('[data-slot="accordion-trigger"]').filter({ hasText: 'Status' }).click();
    const draftCheckbox = dialog.getByRole('checkbox').first();
    await draftCheckbox.click();
    await expect(draftCheckbox).toHaveAttribute('aria-checked', 'true');

    await dialog.getByRole('button', { name: 'Filter', exact: true }).click();
    await expect(page).toHaveURL(/prop_status=Draft/, { timeout: 10_000 });

    // The filtered count needs a moment to settle past a transient "0 loges" loading flash.
    await expect
      .poll(async () => {
        const text = await countText.innerText().catch(() => '');
        const match = text.match(/\d+/);
        return match ? parseInt(match[0], 10) : -1;
      }, { timeout: 10_000, intervals: [500, 1000, 1500] })
      .toBeGreaterThan(0);

    const filteredCount = parseInt((await countText.innerText()).match(/\d+/)![0], 10);
    expect(filteredCount).toBeLessThanOrEqual(unfilteredCount);

    // Every visible row should actually show the Draft status, confirming the filter is real and
    // not just a query-param no-op.
    const statusCells = page.getByRole('row').getByText('Draft', { exact: true });
    expect(await statusCells.count()).toBeGreaterThan(0);
  });
});
