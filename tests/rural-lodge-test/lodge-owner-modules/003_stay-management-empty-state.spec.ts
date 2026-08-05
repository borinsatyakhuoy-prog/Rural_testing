import { test, expect } from '@playwright/test';
import { loginAsOwner } from '../helpers/auth';

test.describe('Lodge Owner - other modules', () => {
  test('Stay Management shows empty state or calendar depending on lodge data', async ({ page }) => {
    await loginAsOwner(page);
    await page.getByRole('button', { name: 'Stay Management', exact: true }).click();
    await page.waitForURL(/\/lodges\/calendar/, { timeout: 15000 });
    await expect(page).toHaveTitle(/Calendar Lodge/);

    const noLodgesHeading = page.getByRole('heading', { name: 'No lodges yet' });
    if (await noLodgesHeading.isVisible().catch(() => false)) {
      await expect(noLodgesHeading).toBeVisible();
      await expect(
        page.getByText('Create your first lodge to set availability, pricing, and stay rules from this calendar.')
      ).toBeVisible();
      await expect(page.getByRole('link', { name: 'Create lodge' })).toBeVisible();
    } else {
      // This account has at least one lodge - the real per-lodge calendar UI renders instead.
      await expect(noLodgesHeading).toHaveCount(0);
    }
  });
});
