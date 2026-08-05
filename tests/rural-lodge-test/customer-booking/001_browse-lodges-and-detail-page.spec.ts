import { test, expect } from '@playwright/test';
import { BASE_URL, loginAsCustomer } from '../helpers/auth';

const LODGE_SLUG = 'lotus-lake-floating-villa';
const LODGE_NAME = 'Lotus Lake Floating Villa';

test.describe('Customer Booking Cycle', () => {
  test('Browse lodges from the home page and open a lodge detail page', async ({ page }) => {
    await loginAsCustomer(page);
    await page.goto(`${BASE_URL}/en`);

    await expect(page.getByText('Where do you want to go next?')).toBeVisible();

    const lodgeLink = page.getByRole('link', { name: new RegExp(LODGE_NAME) }).first();
    await expect(lodgeLink).toBeVisible();
    await lodgeLink.click();
    await page.waitForURL(new RegExp(`/lodges/${LODGE_SLUG}`), { timeout: 15000 });

    // Key detail-page info: gallery, heading, tabs, description, amenities, price, guest capacity.
    await expect(page.getByRole('button', { name: 'Open image gallery' })).toBeVisible();
    await expect(page.getByRole('heading', { name: LODGE_NAME }).first()).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Overview' })).toBeVisible();
    await expect(page.getByText('About this place')).toBeVisible();
    await expect(page.getByText('Amenities You Can Enjoy')).toBeVisible();
    await expect(page.getByText('Guest Capacity')).toBeVisible();
    await expect(page.getByText(/\$\d+/).first()).toBeVisible();
  });
});
