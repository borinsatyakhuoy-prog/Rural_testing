import { test, expect } from '@playwright/test';
import { BASE_URL, loginAsCustomer } from '../helpers/auth';

/**
 * Notifications' All/Read/Unread tabs, same "plain button, no URL change" pattern as My Booking's
 * status tabs (see customer-booking/007). Live recon confirmed clicking "Unread" fires a new
 * notifications.getMy request with `"status":"UNREAD"` rather than just restyling the button, so
 * this waits on that request as the real signal.
 */
test.describe('Customer Booking Cycle - Notifications filter', () => {
  test('clicking the Unread tab fires a status-filtered notifications query', async ({ page }) => {
    await loginAsCustomer(page);
    await page.goto(`${BASE_URL}/en/customer/notification`, { waitUntil: 'load' });
    await expect(page.getByRole('button', { name: 'Unread', exact: true })).toBeVisible({ timeout: 10_000 });

    const filteredRequest = page.waitForRequest(
      (r) => r.url().includes('notifications.getMy') && decodeURIComponent(r.url()).includes('"status":"UNREAD"'),
      { timeout: 10_000 }
    );
    await page.getByRole('button', { name: 'Unread', exact: true }).click();
    await filteredRequest;
  });
});
