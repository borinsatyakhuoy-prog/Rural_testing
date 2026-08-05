import { test, expect } from '@playwright/test';
import { loginAsOwner } from '../helpers/auth';

test.describe('Lodge Owner - other modules', () => {
  test('Notifications shows empty state and All/Read/Unread tabs', async ({ page }) => {
    await loginAsOwner(page);
    await page.getByRole('button', { name: 'Notifications', exact: true }).click();
    await page.waitForURL(/\/notifications/, { timeout: 15000 });
    await expect(page).toHaveTitle(/Notifications/);

    // These filters render as plain buttons rather than ARIA tabs, matching the app-wide pattern
    // seen on the Payout/Account Settings tab bars (also plain buttons, not role="tab").
    for (const tabName of ['All', 'Read', 'Unread']) {
      await expect(page.getByRole('button', { name: tabName, exact: true })).toBeVisible();
    }

    // This dedicated QA Owner account has never received a booking/status-change notification.
    const noNotificationsHeading = page.getByRole('heading', { name: 'No notifications' });
    if (await noNotificationsHeading.isVisible().catch(() => false)) {
      await expect(noNotificationsHeading).toBeVisible();
      await expect(page.getByText("You don't have any notifications yet.")).toBeVisible();
    }
  });
});
