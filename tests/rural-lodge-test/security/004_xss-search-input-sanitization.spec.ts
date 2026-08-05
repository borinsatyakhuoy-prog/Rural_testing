import { test, expect } from '@playwright/test';
import { BASE_URL, login } from '../helpers/auth';

const XSS_PAYLOAD = '<img src=x onerror=alert(1)>';

/**
 * Confirmed on staging (2026-08-05) that typing an HTML/script payload into the Owner Lodges
 * search box (tests/rural-lodge-test/performance/003's same search field, 40+ real rows) is not
 * reflected unescaped into the DOM - React's default escaping holds up here. Locks in that safe
 * behavior as a regression test rather than a one-off manual finding.
 */
test.describe('Security - XSS input sanitization', () => {
  test('HTML/script payload in the Owner Lodges search box is not reflected unescaped', async ({ page }) => {
    await login(page);
    await page.waitForTimeout(1500);
    await page.goto(`${BASE_URL}/en/lodges?sort=updatedAt&sortOrder=desc`, { waitUntil: 'load' });

    const searchBox = page.getByPlaceholder('Search for loges...');
    await expect(searchBox).toBeVisible({ timeout: 10_000 });

    let dialogFired = false;
    page.on('dialog', async (dialog) => {
      dialogFired = true;
      await dialog.dismiss();
    });

    await searchBox.fill(XSS_PAYLOAD);
    await page.waitForTimeout(1500);

    const rawPayloadInDom = await page.evaluate(
      (payload) => document.body.innerHTML.includes(payload),
      XSS_PAYLOAD
    );

    expect(dialogFired, 'the injected onerror handler should never execute').toBe(false);
    expect(rawPayloadInDom, 'the raw payload should be escaped, not present verbatim in the DOM').toBe(false);
  });
});
