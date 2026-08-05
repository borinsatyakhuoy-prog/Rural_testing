import { test, expect } from '@playwright/test';
import { BASE_URL, loginAsCustomer } from '../helpers/auth';

test.describe('Customer Booking Cycle', () => {
  test('Customer dashboard/profile loads and shows Bookings/Wishlist/Notifications sections', async ({ page }) => {
    await loginAsCustomer(page);
    await page.goto(`${BASE_URL}/en/customer/dashboard`);

    await expect(page.getByText(/Hello,/)).toBeVisible();
    for (const name of ['Dashboard', 'Booking', 'Notifications', 'Wishlist', 'Explore Lodge']) {
      // Sidebar items were observed as links, but verify structurally rather than assume the role
      // never changes (exploratory-findings.md flags this as worth double-checking).
      const asLink = page.getByRole('link', { name, exact: true });
      const asButton = page.getByRole('button', { name, exact: true });
      const visible = (await asLink.first().isVisible().catch(() => false))
        || (await asButton.first().isVisible().catch(() => false));
      expect(visible, `sidebar item "${name}" should be visible as a link or button`).toBeTruthy();
    }

    await page.goto(`${BASE_URL}/en/customer/booking`);
    await expect(page.getByText(/Total Bookings/i)).toBeVisible();
    // These filter chips render as plain buttons, not ARIA tabs - the same app-wide pattern
    // already documented in lodge-owner-modules (Payout/Notifications tab bars).
    for (const tab of ['All', 'Pending', 'Confirmed', 'Cancelled']) {
      await expect(page.getByRole('button', { name: tab, exact: true })).toBeVisible();
    }

    await page.goto(`${BASE_URL}/en/customer/notification`);
    await expect(page.getByText(/notifications/i).first()).toBeVisible();

    await page.goto(`${BASE_URL}/en/customer/wishlist`);
    await expect(page.getByText(/Wishlist/i).first()).toBeVisible();

    // "Profile" per this scenario's title refers to Account Settings - a light read-only check.
    // These render as plain buttons, not ARIA tabs (same pattern as the Booking filters above).
    await page.goto(`${BASE_URL}/en/customer/accounts`);
    await expect(page.getByRole('button', { name: 'Account Settings', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Security Settings', exact: true })).toBeVisible();
  });
});
