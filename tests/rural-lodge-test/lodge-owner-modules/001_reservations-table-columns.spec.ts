import { test, expect } from '@playwright/test';
import { loginAsOwner } from '../helpers/auth';

/**
 * Covers the Lodge Owner Reservations module, against the dedicated OWNER_TEST_EMAIL account.
 * That account is intentionally "clean" (0 reservations at time of writing) per
 * specs/exploratory-findings.md, so this assertion accepts either the empty state or real data,
 * rather than asserting one specific outcome.
 */
test.describe('Lodge Owner - other modules', () => {
  test('Reservations page shows expected table columns', async ({ page }) => {
    await loginAsOwner(page);
    await page.getByRole('button', { name: 'Reservations', exact: true }).click();
    await page.waitForURL(/\/reservations/, { timeout: 15000 });
    await expect(page).toHaveTitle(/Reservations/);

    // Note: "Created At" is only the default sort-combobox option on this page, not an actual
    // table column - the live table header row does not include it.
    for (const name of ['No.', 'Code', 'Lodge', 'Check-in', 'Status', 'Guest', 'Payment', 'Actions']) {
      await expect(page.getByRole('columnheader', { name, exact: true })).toBeVisible();
    }

    // This dedicated QA Owner account may genuinely have 0 reservations - accept either the
    // documented empty state or real data rows rather than asserting one specific outcome.
    // With 0 reservations the page shows a "0 Reservations" counter and an empty table body,
    // NOT a "No results found" message (that copy may apply elsewhere but not here) - check for
    // either empty-state signal, not just one.
    const noResults = page.getByText(/no results found/i);
    const zeroCounter = page.getByText(/^0 Reservations$/);
    const dataRowCount = await page.getByRole('row').count(); // includes the header row
    const hasEmptyState = (await noResults.isVisible().catch(() => false))
      || (await zeroCounter.isVisible().catch(() => false));
    expect(hasEmptyState || dataRowCount > 1).toBeTruthy();
  });
});
