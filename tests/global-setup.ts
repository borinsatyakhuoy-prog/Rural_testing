import * as fs from 'fs';
import * as path from 'path';

/**
 * Writes allure-results/environment.properties before any test runs, so the Allure report's
 * Environment widget has something to show. Allure reads this specific filename/format (simple
 * KEY=VALUE lines); it isn't produced automatically by allure-playwright.
 */
export default async function globalSetup() {
  const resultsDir = path.resolve(__dirname, '..', 'allure-results');
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
