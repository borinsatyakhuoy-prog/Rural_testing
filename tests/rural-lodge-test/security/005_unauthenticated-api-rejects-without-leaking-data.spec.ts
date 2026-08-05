import { test, expect } from '@playwright/test';
import { BASE_URL } from '../helpers/auth';

/**
 * DEFECT-1 (specs/defects/DEFECT-1-protected-route-after-logout.md) is a CLIENT-side/UX bug: the
 * dashboard route guard doesn't redirect a logged-out user, and instead renders a shell that looks
 * like an empty-but-valid account. Confirmed on staging (2026-08-05) that the underlying SERVER-
 * side API is not the same bug: calling the booking.getBookings tRPC endpoint directly with no
 * session cookie returns a real 401 UNAUTHORIZED and no booking data, rather than silently
 * succeeding or leaking another account's data. This locks in that this specific API-level
 * authorization check stays correct - it's the presentation layer that's broken, not the data
 * access boundary - as a regression test.
 */
test.describe('Security - Unauthenticated API access', () => {
  test('booking.getBookings rejects a request with no auth cookie and returns no data', async ({ page }) => {
    await page.goto(`${BASE_URL}/en`, { waitUntil: 'load' });
    await page.context().clearCookies();

    const result = await page.evaluate(async (base) => {
      const url = `${base}/api/trpc/booking.getBookings?batch=1&input=%7B%220%22%3A%7B%22json%22%3A%7B%22options%22%3A%7B%22take%22%3A3%7D%7D%7D%7D`;
      const res = await fetch(url, { credentials: 'omit' });
      return { status: res.status, body: await res.text() };
    }, BASE_URL);

    expect(result.status).toBe(401);
    expect(result.body).toContain('UNAUTHORIZED');
    expect(result.body.toLowerCase()).not.toMatch(/"bookings"\s*:\s*\[\s*\{/);
  });
});
