import { test, expect } from '@playwright/test';
import { BASE_URL, loginAsCustomer } from '../helpers/auth';

/**
 * NEW FINDING (live exploration via Playwright MCP, not in the original plan): every "Explore
 * Lodge" CTA inside the customer dashboard shell - the sidebar link, the greeting-header button,
 * and the "No bookings found" empty-state button - opens the public home page in a brand-new
 * browser tab, unlike every other in-shell link (Booking/Notifications/Wishlist), which navigates
 * in the same tab. Confirmed reproducible across all 3 instances in the same session. This is
 * documented as CURRENT behavior (a UX inconsistency worth a human decision, not asserted as a
 * hard failure) so a future change is caught by this test breaking, the same pattern already used
 * for the Offers page copy bug (navigation/012).
 */
test.describe('Customer Booking Cycle - Explore Lodge CTA', () => {
  test('"Explore Lodge" in the empty-bookings state opens the home page in a new tab (documented UX inconsistency)', async ({ page, context }) => {
    await loginAsCustomer(page);
    await page.goto(`${BASE_URL}/en/customer/dashboard`);

    await expect(page.getByText('No bookings found')).toBeVisible({ timeout: 20_000 });
    const emptyStatePanel = page.getByText('No bookings found').locator('..');

    const [popup] = await Promise.all([
      context.waitForEvent('page'),
      emptyStatePanel.getByRole('button', { name: 'Explore Lodge' }).click(),
    ]);
    await popup.waitForLoadState();

    // Documents current behavior: a new tab, not an in-place navigation.
    await expect(popup).toHaveURL(/\/en$/);
    expect(page.url()).toContain('/customer/dashboard');
    await popup.close();
  });
});
