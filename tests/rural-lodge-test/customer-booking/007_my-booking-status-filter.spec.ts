import { test, expect } from '@playwright/test';
import { BASE_URL, loginAsCustomer } from '../helpers/auth';

/**
 * My Booking's status tabs (All/Pending/Confirmed/Checked In/Checked Out/Cancelled/Rejected)
 * render as plain buttons with no URL change and no ARIA tab role, so a CSS-class or URL
 * assertion alone would be weak evidence the filter does anything real. Live recon confirmed
 * clicking a tab fires a genuinely new, differently-filtered booking.getBookings request
 * (`filter: {status: {eq: "pending"}}`) - that's the strongest available signal that this is a
 * real server-side filter, not just a decorative active-tab style change, so this test waits on
 * that request rather than on the button's own class.
 */
test.describe('Customer Booking Cycle - My Booking filter', () => {
  test('clicking the Pending tab fires a status-filtered booking query', async ({ page }) => {
    await loginAsCustomer(page);
    await page.goto(`${BASE_URL}/en/customer/booking`, { waitUntil: 'load' });
    await expect(page.getByRole('button', { name: 'Pending', exact: true })).toBeVisible({ timeout: 10_000 });

    const filteredRequest = page.waitForRequest(
      (r) => r.url().includes('booking.getBookings') && decodeURIComponent(r.url()).includes('"status":{"eq":"pending"}'),
      { timeout: 10_000 }
    );
    await page.getByRole('button', { name: 'Pending', exact: true }).click();
    await filteredRequest;

    // Secondary, visible signal: the clicked tab becomes the active one.
    const pendingClasses = await page.getByRole('button', { name: 'Pending', exact: true }).getAttribute('class');
    expect(pendingClasses).toContain('text-primary');
  });
});
