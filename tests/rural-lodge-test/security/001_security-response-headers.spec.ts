import { test, expect } from '@playwright/test';
import { BASE_URL } from '../helpers/auth';

/**
 * Regression coverage for the security response headers confirmed present on staging during
 * security-focused exploratory testing (2026-08-05). These are already correctly configured today
 * - the point of this test is to catch a future regression (e.g. a CSP directive accidentally
 * loosened, or a header dropped during a reverse-proxy/CDN change), not to report a new finding.
 */
test.describe('Security - Response headers', () => {
  test('home page sets the expected hardening headers', async ({ page }) => {
    const response = await page.goto(`${BASE_URL}/en`, { waitUntil: 'load' });
    const headers = response!.headers();

    expect(headers['x-frame-options']).toBe('DENY');
    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
    expect(headers['strict-transport-security']).toContain('max-age=');
    expect(headers['content-security-policy']).toContain("default-src 'self'");
    expect(headers['content-security-policy']).toContain("frame-ancestors 'self'");
  });

  test('auth page sets the expected hardening headers', async ({ page }) => {
    const response = await page.goto(`${BASE_URL}/en/auth`, { waitUntil: 'load' });
    const headers = response!.headers();

    expect(headers['x-frame-options']).toBe('DENY');
    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['strict-transport-security']).toContain('max-age=');
    expect(headers['content-security-policy']).toContain("default-src 'self'");
  });
});
