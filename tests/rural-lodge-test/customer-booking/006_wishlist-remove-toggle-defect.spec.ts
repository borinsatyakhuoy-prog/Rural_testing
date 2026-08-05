import { test, expect, type Page } from '@playwright/test';
import { BASE_URL, loginAsCustomer } from '../helpers/auth';

const LODGE_SLUG = 'lotus-lake-floating-villa';
const LODGE_NAME = 'Lotus Lake Floating Villa';

/**
 * Reliably removes a lodge from the wishlist via the dedicated Wishlist-page icon button + confirm
 * dialog. Per specs/exploratory-findings.md this is the ONLY path that actually persists a removal
 * server-side (the lodge-detail page's own toggle does not - see the defect test below). Used here
 * purely to reset state so the defect test always starts from a known-clean wishlist.
 */
async function removeFromWishlistIfPresent(page: Page, lodgeName: string) {
  await page.goto(`${BASE_URL}/en/customer/wishlist`);
  // The wishlist page can render a blank content area for several seconds after navigation (no
  // item, no empty-state copy) before real data arrives - poll rather than asserting immediately.
  const card = page.getByText(lodgeName, { exact: false });
  const present = await card.first().isVisible({ timeout: 15000 }).catch(() => false);
  if (!present) return;

  await page.getByRole('button', { name: 'Remove from wishlist' }).first().click();
  const confirmDialog = page.getByRole('dialog').filter({ hasText: 'Remove from Wishlist' });
  await expect(confirmDialog).toBeVisible();
  await confirmDialog.getByRole('button', { name: 'Remove', exact: true }).click();
  await expect(page.getByText(lodgeName, { exact: false })).toHaveCount(0, { timeout: 15000 });
}

test.describe('Customer Booking Cycle', () => {
  test('Wishlist: the lodge-detail Save/Remove toggle should persist removal (KNOWN DEFECT, fails until fixed)', async ({ page }) => {
    // specs/exploratory-findings.md documents a confirmed, reproducible defect: on the lodge-detail
    // page, clicking the Save/Remove toggle a SECOND time (while it reads "Remove") flips its own
    // label back to "Save" - looking like a successful removal - but never actually persists the
    // removal server-side. Reloading /customer/wishlist afterwards still shows the item.
    //
    // This test asserts the CORRECT expected behavior (the item is genuinely gone from the
    // Wishlist page afterwards) rather than encoding the bug into the assertion. It is therefore
    // expected to FAIL right now and should start passing once the toggle's remove path is fixed
    // to actually await/persist the mutation - the chosen convention in this suite for known
    // defects: a failing test documenting the gap, not a green test that quietly bakes in the bug.
    await loginAsCustomer(page);

    // Start from a known-clean wishlist in case a previous run left the item saved.
    await removeFromWishlistIfPresent(page, LODGE_NAME);

    await page.goto(`${BASE_URL}/en/lodges/${LODGE_SLUG}`);
    const toggle = page.getByRole('button', { name: /^(Save|Remove)$/ });
    await expect(toggle).toHaveText('Save');

    // The initial "add" click is the one path exploratory testing confirmed to reliably persist
    // (only the SECOND/"remove" click below is the documented defect under test) - but on this
    // page a click landing right after navigation has occasionally been observed to no-op (the
    // toggle's mutation is briefly guarded while the page's own wishlist-status check is still in
    // flight). Retry the click itself, bounded, rather than the assertion, so a swallowed first
    // click doesn't make this test fail for a reason unrelated to the actual defect being asserted.
    for (let i = 0; i < 5 && (await toggle.textContent()) !== 'Remove'; i++) {
      await toggle.click();
      await page.waitForTimeout(500);
    }
    await expect(toggle).toHaveText('Remove');

    await toggle.click(); // the buggy "remove" click
    await expect(toggle).toHaveText('Save'); // local/optimistic UI flips back regardless of the bug

    await page.goto(`${BASE_URL}/en/customer/wishlist`);
    // The wishlist page renders a completely blank content area (no item, no empty-state copy)
    // for several seconds right after navigation before real data arrives (see
    // specs/exploratory-findings.md, 1.6). Asserting `toHaveCount(0)` directly is unsafe here: it
    // would be trivially (and WRONGLY) satisfied during that blank window, before the real item
    // data has even loaded - a false pass that would mask this exact defect. Wait for a definitive
    // signal first (either the item itself, or the genuine empty-state copy), then assert on
    // which one actually showed up.
    const itemLocator = page.getByText(LODGE_NAME, { exact: false });
    const emptyStateLocator = page.getByText(/your wishlist is empty/i);
    await expect(itemLocator.or(emptyStateLocator)).toBeVisible({ timeout: 15000 });

    // Expected (correct) behavior: the lodge should no longer be listed here (empty state shows).
    // Actual (buggy) behavior, per exploratory findings: it is still present, because the
    // detail-page toggle's remove path never persisted server-side.
    await expect(emptyStateLocator).toBeVisible();
  });
});
