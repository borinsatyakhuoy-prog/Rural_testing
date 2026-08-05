import { test, expect, type Locator } from '@playwright/test';
import { loginAsOwner } from '../helpers/auth';

test.describe('Lodge Owner - other modules', () => {
  test('Profile: display name edit is reversible and reverted after the test', async ({ page }) => {
    // This test does substantially more real work than its siblings - a login (with its own
    // internal retry/settle waits) followed by TWO full edit+"Save Changes"+reload round-trips
    // (change name, then revert it) - each a real server round-trip. Under this staging backend's
    // observed slowness (see specs/exploratory-findings.md), the default 30s test timeout leaves
    // too little margin.
    // Step 5 healing: test.slow()'s 3x multiplier (135s) still wasn't enough headroom for BOTH
    // round-trips when the "Joined" text's post-reload re-render is itself slow on one of them -
    // the test was observed to time out even though the rename had genuinely already succeeded.
    // Set an explicit, larger timeout instead, matching the pattern already used for the heaviest
    // test in lodge-owner-crud.
    test.setTimeout(240000);
    await loginAsOwner(page);
    await page.getByRole('button', { name: 'Profile', exact: true }).click();
    await page.waitForURL(/\/profile-management/, { timeout: 15000 });
    await expect(page).toHaveTitle(/Profile/);

    // The display-name button has no fixed accessible name (it IS the owner's current name), so
    // it's located structurally, near the "Joined <date>" text, rather than by name. NOTE: the
    // accessibility-tree snapshot makes the button and the "Joined" text LOOK like direct siblings,
    // but the real DOM has several extra wrapping <div>s in between (an icon-wrapper div around
    // the "Joined" text, plus layout divs) - a single `locator('xpath=..')` step only reaches the
    // icon-wrapper div (which has no button in it), causing the original single-level-up locator to
    // hang forever. Walk up ancestor levels until one actually contains a button, rather than
    // hardcoding a specific (fragile) depth.
    async function getNameButton(): Promise<Locator> {
      const joined = page.getByRole('main').getByText(/^Joined /);
      // This is called again after each reload (post-edit and post-revert), so the "Joined" text
      // itself may not have re-rendered yet - wait for it before walking ancestors, rather than
      // taking an immediate zero-count as "structure changed". Observed during Step 5 healing to
      // occasionally still not be visible even after 20s under slower staging load; one extra
      // reload-and-retry recovers it rather than failing the whole test on a single slow load.
      const visible = await joined.isVisible({ timeout: 20000 }).catch(() => false);
      if (!visible) {
        await page.reload();
        await expect(joined).toBeVisible({ timeout: 30000 });
      }
      for (let levels = 1; levels <= 8; levels++) {
        const candidate = joined.locator('xpath=' + Array(levels).fill('..').join('/')).getByRole('button');
        if ((await candidate.count()) > 0) return candidate.first();
      }
      throw new Error('Could not locate the owner display-name button near the "Joined" text');
    }

    const originalName = ((await (await getNameButton()).textContent()) ?? '').trim();
    expect(originalName.length).toBeGreaterThan(0);
    // ROOT CAUSE found during Step 5 healing (via live MCP browser diagnosis): a hardcoded
    // testName here caused a self-perpetuating hang. If any earlier run of this test crashed
    // before its `finally` revert ran, the account's real display name stays "QA Owner Test" -
    // so on the NEXT run, originalName reads back as "QA Owner Test" too, making the "rename to
    // testName" a genuine no-op. The app correctly does not surface a Save Changes bar for a
    // no-op edit, so the test hung forever waiting for a Save button that would never appear -
    // and every such failure left the fixture corrupted for the run after it. Guarantee testName
    // can never collide with whatever originalName happens to be, so this test is self-healing
    // regardless of what a previous crashed run left behind.
    const testName = originalName === 'QA Owner Test' ? 'QA Owner' : 'QA Owner Test';

    async function changeNameTo(target: string) {
      await (await getNameButton()).click();
      const input = page.getByRole('textbox', { name: 'Enter your name' });
      await input.fill(target);
      await input.press('Enter');
      // Fallback: if the inline textbox is still open (Enter didn't commit it), click its
      // unlabeled inline confirm (check) icon, which sits alongside the textbox.
      if (await input.isVisible().catch(() => false)) {
        await input.locator('xpath=..').getByRole('button').first().click().catch(() => {});
      }
      await page.getByRole('button', { name: 'Save Changes' }).click();
      await page.reload();
    }

    try {
      await changeNameTo(testName);
      await expect(await getNameButton()).toHaveText(testName);
    } finally {
      // Revert unconditionally (even if the assertion above failed) so this shared QA Owner
      // account's display name is never left altered by this test run.
      await changeNameTo(originalName);
    }
    await expect(await getNameButton()).toHaveText(originalName);
  });
});
