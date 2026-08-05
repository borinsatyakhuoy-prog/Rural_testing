import { defineConfig, devices } from '@playwright/test';
import path from 'path';

/**
 * Read environment variables from .env using Node's built-in loader (Node 20.6+).
 */
process.loadEnvFile(path.resolve(__dirname, '.env'));

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './tests',
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* TEST_USER_EMAIL is shared across authentication.spec.ts, navigation.spec.ts, and
   * lodge-owner-crud.spec.ts (unlike the dedicated OWNER_TEST_EMAIL/CUSTOMER_TEST_EMAIL accounts,
   * which are already forced test.describe.serial within their own files for the same reason).
   * Step 5 healing confirmed a real cross-file collision: running with multiple workers let two
   * of those files log in as TEST_USER_EMAIL on the same staging backend at once, invalidating
   * each other's session and causing a genuine (reproduced) failure in lodge-owner-crud's Delete
   * test that did not occur in a single-worker run. Force workers: 1 everywhere, not just CI,
   * until/unless a dedicated fourth test account removes the need to share TEST_USER_EMAIL.
   */
  workers: 1,
  /* This staging backend has repeatedly been observed to be genuinely slow under concurrent
   * automation load (see specs/exploratory-findings.md: 502s, multi-second dashboard/table loads,
   * "generous wait/poll time... several seconds observed") - real, successful page loads on
   * Reservations/Payout/booking flows have taken 15-25s+ when several spec files run concurrently.
   * Playwright's 30000ms default leaves too little margin for that genuine (not test-bug-induced)
   * latency, so it's raised suite-wide rather than patched test-by-test.
   */
  timeout: 45000,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: 'html',
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('')`. */
    // baseURL: 'http://localhost:3000',

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
    viewport: { width: 2000, height: 1200 },
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      // NOTE: devices['Desktop Chrome'] (like the other device descriptors below) bundles its own
      // viewport (1280x720). Because Playwright merges project-level `use` on top of the top-level
      // global `use` above, spreading the device descriptor here silently overrode the intended
      // 2000x1200 viewport with 1280x720 for every test in this suite - a real, previously-hidden
      // config bug (see specs/step5-group-b-results.md). At 1280px, content gated behind the app's
      // `min-width: 1292px` breakpoint (e.g. the header language-toggle's "EN"/"FR"/"KH" text label)
      // is deterministically CSS-hidden and therefore has no accessible name, which is what caused
      // navigation.spec.ts's language-toggle tests to fail. Re-asserting the viewport per-project
      // (after the device spread) restores the intended 2000x1200 viewport this suite was authored
      // against (matching the 2000x1200 viewport used during exploratory testing).
      use: { ...devices['Desktop Chrome'], viewport: { width: 2000, height: 1200 } },
    },

    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'], viewport: { width: 2000, height: 1200 } },
    },

    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'], viewport: { width: 2000, height: 1200 } },
    },

    /* Test against mobile viewports. */
    // {
    //   name: 'Mobile Chrome',
    //   use: { ...devices['Pixel 5'] },
    // },
    // {
    //   name: 'Mobile Safari',
    //   use: { ...devices['iPhone 12'] },
    // },

    /* Test against branded browsers. */
    // {
    //   name: 'Microsoft Edge',
    //   use: { ...devices['Desktop Edge'], channel: 'msedge' },
    // },
    // {
    //   name: 'Google Chrome',
    //   use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    // },
  ],

  /* Run your local dev server before starting the tests */
  // webServer: {
  //   command: 'npm run start',
  //   url: 'http://localhost:3000',
  //   reuseExistingServer: !process.env.CI,
  // },
});
