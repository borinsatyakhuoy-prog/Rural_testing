import { test, expect } from '@playwright/test';
import { BASE_URL, loginAsCustomer } from '../helpers/auth';

const LODGE_SLUG = 'lotus-lake-floating-villa';

// IMPORTANT (scope constraint): this test never submits a real payment. It stops after asserting
// the Payment step's two payment-method options are present - "Scan QR" and "Payment" are never
// clicked, and no card details are ever entered.
test.describe('Customer Booking Cycle', () => {
  test('Booking happy path: reach the Payment step without submitting payment', async ({ page }) => {
    await loginAsCustomer(page);
    await page.goto(`${BASE_URL}/en/lodges/${LODGE_SLUG}`);

    // Pick check-in/check-out a few days out from "today" so the dates are always in the future
    // and within the currently-displayed calendar month, regardless of which day this test runs.
    const today = new Date();
    const checkIn = new Date(today);
    checkIn.setDate(today.getDate() + 2);
    const checkOut = new Date(today);
    checkOut.setDate(today.getDate() + 4);
    const checkInLabel = checkIn.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
    const checkOutLabel = checkOut.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });

    await page.getByRole('button', { name: 'Check-in — Check-out Select' }).click();
    const dateDialog = page.getByRole('dialog').filter({ hasText: 'Select your dates' });
    await expect(dateDialog).toBeVisible();

    // Day buttons' accessible names embed weekday/month/day/availability/price, e.g.
    // "Thursday, August 6, $12" - match on "<Month> <Day>," to avoid depending on the weekday.
    await dateDialog.getByRole('button', { name: new RegExp(`${checkInLabel},`) }).first().click();
    await dateDialog.getByRole('button', { name: new RegExp(`${checkOutLabel},`) }).first().click();
    await expect(dateDialog).toBeHidden();

    const bookCta = page.getByRole('button', { name: /Book for \d+ nights?/ });
    await expect(bookCta).toBeEnabled();
    await bookCta.click();

    await page.waitForURL(/\/booking\?scheduleID=/, { timeout: 20000 });
    // The booking page shows a transient "Loading Your Booking... Fetching cart data" state
    // before the real form resolves (see specs/exploratory-findings.md) - observed during Step 5
    // healing to occasionally exceed the default 5s assertion timeout under staging load, so an
    // explicit, longer timeout is given here rather than relying on the framework default.
    await expect(page.getByText('Personal Details').first()).toBeVisible({ timeout: 20000 });
    await expect(page.getByText(/Booking is on Hold/i)).toBeVisible();

    await page.getByPlaceholder('Enter your phone number').fill('012345678');
    const nextStep = page.getByRole('button', { name: 'Next Step' });
    await expect(nextStep).toBeEnabled();
    await nextStep.click();
    await page.waitForURL(/step=2/, { timeout: 15000 });

    // --- STOP HERE. Do not go any further. ---
    // The Payment step is the one and only place in the entire customer flow where a real charge
    // could be triggered. Per task scope, this test only asserts that the step is reached and that
    // its two payment-method options are present - it deliberately never clicks "Scan QR" or the
    // final "Payment" button, and never enters any card/payment details.
    await expect(page.getByText('Payment').first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Scan QR' })).toBeVisible();
    // "Credit/Debit Card" is NOT selectable (it's the "Coming Soon" placeholder per
    // specs/planner/05-customer-booking.md / specs/exploratory-findings.md), so - unlike
    // "Scan QR", which IS a real clickable button - it renders as a plain, non-interactive
    // heading rather than a button. Assert on its actual role/text rather than a button role it
    // doesn't have.
    await expect(page.getByRole('heading', { name: 'Credit/Debit Card' })).toBeVisible();
    await expect(page.getByText('Coming Soon')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Payment', exact: true })).toBeVisible();
  });
});
