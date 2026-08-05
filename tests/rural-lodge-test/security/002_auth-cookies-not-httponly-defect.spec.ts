import { test, expect } from '@playwright/test';
import { login } from '../helpers/auth';

/**
 * DEFECT-2 (specs/defects/DEFECT-2-auth-cookies-not-httponly.md): after login, the AUTH_TOKEN and
 * user cookies are Secure + SameSite=Lax but NOT HttpOnly, leaving the live session token readable
 * from page JavaScript (a defense-in-depth gap against a future XSS bug). This test asserts the
 * CORRECT expected behavior (HttpOnly=true) so it fails - by design - until the cookies are fixed
 * server-side, rather than encoding the current gap into the assertion.
 */
test.describe('Security - Session cookie hardening', () => {
  test('KNOWN DEFECT: AUTH_TOKEN and user cookies should be HttpOnly', async ({ page, context }) => {
    await login(page);

    const cookies = await context.cookies();
    const authToken = cookies.find((c) => c.name === 'AUTH_TOKEN');
    const userCookie = cookies.find((c) => c.name === 'user');

    expect(authToken, 'AUTH_TOKEN cookie should exist after login').toBeTruthy();
    expect(userCookie, 'user cookie should exist after login').toBeTruthy();

    // Secure + SameSite are already correct today - only HttpOnly is the confirmed gap.
    expect(authToken!.secure).toBe(true);
    expect(userCookie!.secure).toBe(true);

    expect(authToken!.httpOnly, 'AUTH_TOKEN should be HttpOnly so page JS cannot read the live session token').toBe(true);
    expect(userCookie!.httpOnly, 'user cookie should be HttpOnly for the same reason').toBe(true);
  });
});
