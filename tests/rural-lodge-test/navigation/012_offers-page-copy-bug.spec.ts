import { test, expect } from '@playwright/test';
import { BASE_URL } from '../helpers/auth';

test.describe('Offers page content', () => {
  test('Offers page "Coming Soon" placeholder currently shows Activity copy (documented copy bug)', async ({ page }) => {
    await page.goto(`${BASE_URL}/en/offers`);
    await expect(page.getByRole('heading', { name: 'Coming Soon' })).toBeVisible();
    // KNOWN BUG (see specs/exploratory-findings.md, Navigation 1.2): this "Coming Soon" copy was
    // copy-pasted from the Activity page and says "activities", which is contextually wrong for
    // the Offers page. This test intentionally asserts the current (buggy) text so it PASSES today
    // and documents the mismatch — if a fix ever changes this copy, the test will fail and prompt
    // a human to update/retire this assertion rather than let the fix go unnoticed.
    await expect(page.getByText('We are working hard to bring you exciting activities. Stay tuned!')).toBeVisible();
  });
});
