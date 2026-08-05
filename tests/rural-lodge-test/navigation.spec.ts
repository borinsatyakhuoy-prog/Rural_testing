import { test, expect, type Page } from '@playwright/test';

// APP_URL in .env is https://staging-ruralloge.allweb.cloud/km (includes a default locale suffix),
// so the origin is derived here to freely compose locale-prefixed paths (/en, /fr, /km, /en/auth, ...).
const BASE_URL = new URL(process.env.APP_URL!).origin;

async function login(page: Page) {
  await page.goto(`${BASE_URL}/en/auth`);
  await page.getByRole('textbox', { name: 'Email' }).fill(process.env.TEST_USER_EMAIL!);
  await page.getByRole('textbox', { name: 'Password' }).fill(process.env.TEST_USER_PASSWORD!);
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.waitForURL((url) => !url.pathname.includes('/auth'));
}

// ROOT CAUSE of the Step-4 "EN"/"FR"/"KH" button timeouts (see specs/step5-group-b-results.md):
// playwright.config.ts's per-project `use: { ...devices['Desktop Chrome'] }` (etc.) silently
// overrode the intended global 2000x1200 viewport with the device descriptor's own bundled
// 1280x720 viewport, because Playwright merges project-level `use` on top of top-level `use`.
// At 1280px, the header language-toggle's text label span (class `min-[1292px]:block hidden`)
// is deterministically CSS-hidden (1280 < 1292), so the button has NO accessible name at all -
// not a hydration-timing race. That has now been fixed at the source in playwright.config.ts
// (each project re-asserts viewport: 2000x1200 after the device spread). A small explicit
// timeout is kept below purely as defense-in-depth for ordinary network variance on this
// staging backend, matching the 15000ms pattern already used elsewhere in this suite.
const LANG_TOGGLE_TIMEOUT = 15000;

async function expectHeaderConsistent(page: Page) {
  const banner = page.getByRole('banner');
  await expect(banner.getByRole('link').first()).toBeVisible(); // logo
  await expect(page.getByRole('link', { name: 'Stay Stay' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Offers Offers' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Activity Activity' })).toBeVisible();
  await expect(banner.getByRole('button', { name: 'Manage Your Lodge' })).toBeVisible();
  await expect(banner.getByRole('button', { name: 'EN', exact: true })).toBeVisible({ timeout: LANG_TOGGLE_TIMEOUT });
  await expect(banner.getByRole('button', { name: '$ USD' })).toBeVisible();
  await expect(banner.getByRole('button').last()).toBeVisible(); // account/login icon
}

test.describe('Top navigation bar', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE_URL}/en`);
  });

  test('Top nav reaches the Stay (home/search) section', async ({ page }) => {
    await expect(page.getByRole('link', { name: 'Stay Stay' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Offers Offers' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Activity Activity' })).toBeVisible();

    // navigate away first so clicking "Stay" proves it returns to the home listing view
    await page.getByRole('link', { name: 'Activity Activity' }).click();
    await expect(page).toHaveURL(`${BASE_URL}/en/activity`);
    // Observed during Step 5 healing (rare, one-off): clicking "Stay" immediately after this nav
    // can race the client router's hydration on the new page, falling back to a hard navigation
    // to the raw "/" href - which then hits the server's default-locale redirect to "/km" instead
    // of preserving "/en". Wait for the page to finish loading before the next click.
    await page.waitForLoadState('load');

    // "Stay" links raw href is "/", but client-side navigation preserves the "/en" locale segment
    await page.getByRole('link', { name: 'Stay Stay' }).click();
    await expect(page).toHaveURL(`${BASE_URL}/en`);
    await expect(page.getByRole('heading', { name: 'Where do you want to go next?' })).toBeVisible();
  });

  test('Top nav reaches the Offers section', async ({ page }) => {
    await page.getByRole('link', { name: 'Offers Offers' }).click();
    await expect(page).toHaveURL(`${BASE_URL}/en/offers`);
    await expect(page).toHaveTitle('Offers');
  });

  test('Top nav reaches the Activity section', async ({ page }) => {
    await page.getByRole('link', { name: 'Activity Activity' }).click();
    await expect(page).toHaveURL(`${BASE_URL}/en/activity`);
    await expect(page).toHaveTitle('Activities');
  });
});

test.describe('Language toggle', () => {
  test('Language toggle switches the site to English', async ({ page }) => {
    await page.goto(`${BASE_URL}/km`);
    await page.getByRole('button', { name: 'KH', exact: true }).click({ timeout: LANG_TOGGLE_TIMEOUT });
    await expect(page.getByRole('button', { name: 'English English' })).toBeVisible();

    await page.getByRole('button', { name: 'English English' }).click();
    await expect(page).toHaveURL(`${BASE_URL}/en`);
    await expect(page.getByRole('link', { name: 'Stay Stay' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Offers Offers' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Activity Activity' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Where do you want to go next?' })).toBeVisible();
  });

  test('Language toggle switches the site to French', async ({ page }) => {
    await page.goto(`${BASE_URL}/en`);
    await page.getByRole('button', { name: 'EN', exact: true }).click({ timeout: LANG_TOGGLE_TIMEOUT });
    await page.getByRole('button', { name: 'French Français' }).click();

    await expect(page).toHaveURL(`${BASE_URL}/fr`);
    await expect(page.getByRole('link', { name: 'Séjour Séjour' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Offres Offres' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Activité Activité' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Où voulez-vous aller ensuite ?' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Gérer votre Lodge' })).toBeVisible();
  });

  test('Language toggle switches the site to Khmer', async ({ page }) => {
    await page.goto(`${BASE_URL}/fr`);
    await page.getByRole('button', { name: 'FR', exact: true }).click({ timeout: LANG_TOGGLE_TIMEOUT });
    await page.getByRole('button', { name: 'Khmer ខ្មែរ' }).click();

    await expect(page).toHaveURL(`${BASE_URL}/km`);
    await expect(page.getByRole('link', { name: 'ស្នាក់នៅ ស្នាក់នៅ' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'សេវាកម្ម សេវាកម្ម' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'សកម្មភាព សកម្មភាព' })).toBeVisible();
  });

  test('Language toggle is present and functional on the login page', async ({ page }) => {
    await page.goto(`${BASE_URL}/en/auth`);
    await expect(page.getByRole('button', { name: 'EN', exact: true })).toBeVisible({ timeout: LANG_TOGGLE_TIMEOUT });

    await page.getByRole('button', { name: 'EN', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Select Language' })).toBeVisible();
    await page.getByRole('button', { name: 'Khmer ខ្មែរ' }).click();

    await expect(page).toHaveURL(`${BASE_URL}/km/auth`);
    await expect(page.getByText('ចូលប្រើគណនីរបស់អ្នក')).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'អ៊ីមែល' })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'ពាក្យសម្ងាត់' })).toBeVisible();

    // reopening the panel should show Khmer as the already-checked radio option
    await page.getByRole('button', { name: 'KH', exact: true }).click({ timeout: LANG_TOGGLE_TIMEOUT });
    await expect(page.getByRole('button', { name: 'Khmer ខ្មែរ' }).getByRole('radio')).toBeChecked();
  });
});

test.describe('Root URL locale default', () => {
  test('Direct root URL defaults to the Khmer locale', async ({ page, context }) => {
    // A NEXT_LOCALE cookie set by a prior language-toggle selection overrides the /km default on
    // later bare "/" visits (see specs/exploratory-findings.md, Navigation 1.8) — clear cookies so
    // this test observes the true default rather than a locale choice left over from another test.
    await context.clearCookies();
    await page.goto(`${BASE_URL}/`);
    await expect(page).toHaveURL(`${BASE_URL}/km`);
  });
});

test.describe('Header consistency', () => {
  test('Header utility icons render consistently across every top-nav section', async ({ page }) => {
    for (const path of ['/en', '/en/offers', '/en/activity']) {
      await page.goto(`${BASE_URL}${path}`);
      await expectHeaderConsistent(page);
    }
  });

  test('Language toggle is present in the header on the login page (logged out)', async ({ page }) => {
    await page.goto(`${BASE_URL}/en/auth`);
    await expect(page.getByRole('button', { name: 'EN', exact: true })).toBeVisible({ timeout: LANG_TOGGLE_TIMEOUT });
  });

  test('Language toggle remains present in the header once logged in', async ({ page }) => {
    await login(page);
    await expect(page).toHaveURL(`${BASE_URL}/en`);
    await expect(page.getByRole('banner').getByRole('button', { name: 'EN', exact: true })).toBeVisible({ timeout: LANG_TOGGLE_TIMEOUT });
  });
});

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
