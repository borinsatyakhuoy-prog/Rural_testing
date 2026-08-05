import { test, expect } from '@playwright/test';
import { loginAsOwner } from '../helpers/auth';

test.describe('Lodge Owner - other modules', () => {
  test('Payout page: Overview stats/history and Settings KHQR section (view only)', async ({ page }) => {
    await loginAsOwner(page);
    await page.getByRole('button', { name: 'Payout', exact: true }).click();
    await page.waitForURL(/\/payout/, { timeout: 15000 });
    await expect(page).toHaveTitle(/Payout/);

    // Overview tab (default) - 4 stat tiles.
    for (const label of ['Total Earnings', 'Amount Paid', 'Pending Payouts', 'Awaiting Confirmation']) {
      await expect(page.getByText(label, { exact: false }).first()).toBeVisible();
    }

    // Note: "Created At" is only the default sort-combobox option here too, not an actual column.
    for (const name of [
      'No.',
      'Transaction ID',
      'Reservation Code',
      'Status',
      'Amount',
      'Platform Fee',
      'Payout Tax',
      'Net Payout',
      'Payment Method',
      'Payment Date',
    ]) {
      await expect(page.getByRole('columnheader', { name, exact: true })).toBeVisible();
    }

    // Settings tab - view only, do not fill or submit any payment/bank details.
    await page.getByRole('main').getByRole('button', { name: 'Settings', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Payout Settings' })).toBeVisible();
    await expect(page.getByText('KHQR').first()).toBeVisible();
    await expect(page.getByText(/upload.*qr code/i).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save Settings' })).toBeDisabled();
  });
});
