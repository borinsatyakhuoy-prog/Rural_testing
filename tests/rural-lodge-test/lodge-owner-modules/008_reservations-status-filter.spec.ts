import { test, expect } from '@playwright/test';
import { BASE_URL, login } from '../helpers/auth';

/**
 * The Reservations page's "Filter" sheet (Reservation Status/Payment Status/Date Range
 * accordions) was previously only covered by 001_reservations-table-columns.spec.ts, which checks
 * the static table columns but never opens the filter itself. This confirms toggling a status
 * checkbox and applying is a real, URL-driven filter (`res_status` query param), not just local
 * UI state - confirmed via live recon that checking "Rejected" appends `rejected` to the existing
 * `res_status=pending,confirmed,checkedIn` default.
 */
test.describe('Lodge Owner - other modules', () => {
  test('Reservations Filter sheet adds a status to the res_status query param', async ({ page }) => {
    await login(page);
    await page.waitForTimeout(1500);
    await page.goto(`${BASE_URL}/en/reservations?page=1&res_status=pending,confirmed,checkedIn`, {
      waitUntil: 'load',
    });

    await page.getByRole('button', { name: 'Filter' }).first().click();
    const dialog = page.getByRole('dialog').filter({ hasText: 'Filter Reservations' });
    await expect(dialog).toBeVisible({ timeout: 10_000 });

    // The 6 status checkboxes carry no accessible name; they render in the documented display
    // order Cancelled/Checked In/Checked Out/Confirmed/Pending/Rejected, so "Rejected" is index 5.
    const checkboxes = dialog.getByRole('checkbox');
    await expect(checkboxes).toHaveCount(6);
    const rejectedCheckbox = checkboxes.nth(5);
    await rejectedCheckbox.click();
    await expect(rejectedCheckbox).toHaveAttribute('aria-checked', 'true');

    await dialog.getByRole('button', { name: 'Filters', exact: true }).click();
    await expect(page).toHaveURL(/res_status=pending,confirmed,checkedIn,rejected/, { timeout: 10_000 });
  });
});
