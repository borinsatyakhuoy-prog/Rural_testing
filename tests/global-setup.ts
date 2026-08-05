import * as fs from 'fs';
import * as path from 'path';

/**
 * Writes allure-results/environment.properties before any test runs, so the Allure report's
 * Environment widget has something to show. Allure reads this specific filename/format (simple
 * KEY=VALUE lines); it isn't produced automatically by allure-playwright.
 *
 * Also clears any stale results left from a previous run first: unlike Playwright's own
 * outputDir (wiped automatically every run) and monocart-reporter (cleans its own output),
 * allure-results/ is never cleared by allure-playwright itself - every run just adds more
 * uuid-named files on top of whatever's already there. Left alone, `allure generate` ends up
 * aggregating results across multiple unrelated runs into one misleading report (confirmed:
 * a regenerate after a fresh run kept reporting an earlier run's pass/fail counts until this
 * directory was cleared by hand).
 */
export default async function globalSetup() {
  const resultsDir = path.resolve(__dirname, '..', 'allure-results');
  fs.rmSync(resultsDir, { recursive: true, force: true });
  fs.mkdirSync(resultsDir, { recursive: true });

  const { version: playwrightVersion } = require('@playwright/test/package.json');

  const environment: Record<string, string> = {
    Base_URL: process.env.APP_URL ?? '(not set)',
    Playwright_Version: playwrightVersion,
    Node_Version: process.version,
    OS: `${process.platform} ${process.arch}`,
  };

  const contents = Object.entries(environment)
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  fs.writeFileSync(path.join(resultsDir, 'environment.properties'), contents);
}
