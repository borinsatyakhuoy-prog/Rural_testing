# Rural Lodge — Performance SLA

## Purpose

This document defines the formal performance SLA enforced by `tests/rural-lodge-test/performance/`.
Every tier below has a hard `max` that `assertSLA()` / `assertP99SLA()`
(`tests/rural-lodge-test/helpers/performance.ts`) enforces as a real pass/fail gate, not just a
descriptive label. A `target` is also defined per tier — the expected/healthy figure. A result
between `target` and `max` is a **WARN** (within SLA, but degraded and worth investigating); above
`max` is a **FAIL**.

## Methodology

- Measurements use the browser's own Navigation Timing Level 2 / Paint Timing / Resource Timing
  APIs, plus wall-clock timing of user-facing actions (click-to-visible, click-to-state-change) —
  real numbers from real page loads/actions against staging, not a synthetic external probe or a
  load-testing tool. Generating concurrent/artificial load against this shared staging environment
  is explicitly out of scope (see `playwright.config.ts`'s `workers: 1` note).
- Every tier's `max` was set with a deliberate margin above this project's own observed baselines
  from `specs/exploratory-findings.md` and this suite's own Step 5 healing history (e.g. the
  documented "Loading Your Booking... Fetching cart data" transient state, and the general note
  that this staging backend is "genuinely slow under concurrent automation load").
- All performance tests are read-only (page loads, navigation, search, dialog-open) except the
  booking-flow tier, which reuses the existing, already-safe `customer-booking` flow's scope
  constraint — it never proceeds past the Personal Details step and never submits a real payment.

## SLA Tiers

| Tier | Applies to | Target | Max (hard fail) | Rationale |
|---|---|---|---|---|
| **T1 — Page Load** | Full page load (`goto` → `load` event) for the home page or login page | ≤ 2,000 ms | ≤ 8,000 ms | Generous margin for a live, non-CDN-fronted staging app; matches the reference project's T1 methodology |
| **T2 — Navigation** | Click a nav/language-toggle control to its target content visible | ≤ 2,000 ms | ≤ 6,000 ms | Covers Stay/Offers/Activity nav and the FR/EN/KH language toggle |
| **T3 — API Read** | A batched tRPC read call, captured via Resource Timing (URL contains `trpc`) | ≤ 800 ms | ≤ 3,000 ms | This app batches reads under `/api/trpc/...?batch=1`; individual procedure names aren't always resolvable from the client side, so the substring match covers whichever batch fires. Exercised against the post-login batch (`001`) plus the Customer Dashboard, Customer Wishlist, Owner Reservations, Owner Payout Overview, and Owner Notifications reads (`007`) — the same `notifications.getMy` / `notifications.getUnreadCount` / `booking.getBookings` endpoints named in `specs/exploratory-findings.md` and DEFECT-1, plus the owner-side list/overview reads |
| **T4 — Search/Filter** | Typing into the Owner Lodges list search box to the filtered table re-rendering | ≤ 1,500 ms | ≤ 5,000 ms | The lodges table has 40+ rows for the main test account; search includes the app's own ~1.2s debounce |
| **T5 — Dialog Open** | Opening a dialog (booking date picker, guest-count stepper) | ≤ 1,000 ms | ≤ 4,000 ms | Dialogs are local UI state, not typically network-bound |
| **T6 — Booking flow to Personal Details** | "Book for N nights" click through to the Personal Details step actually rendering | ≤ 8,000 ms | ≤ 20,000 ms | This flow has a documented transient "Loading Your Booking... Fetching cart data" state (`specs/exploratory-findings.md`) — this suite's own Step 5 healing already needed to bump this exact wait to 20s once under staging load, so the SLA max matches that already-observed ceiling rather than guessing a tighter one |

## Verdicts

- **PASS** — measured value ≤ `target`. Healthy.
- **WARN** — `target` < measured value ≤ `max`. Within SLA but degraded; logged and attached to the
  test report for trend-watching, does not fail the test.
- **FAIL** — measured value > `max`. Hard test failure via `assertSLA()`/`assertP99SLA()`.

## P99 methodology

A single-sample gate (`assertSLA`) is a real signal, but one lucky or unlucky sample can't show
tail behavior — the industry-standard way to define a latency SLA is against a **percentile of a
distribution of repeated samples** (a "P99 SLA": the 99th-percentile duration must stay under the
threshold), not one click.

`tests/rural-lodge-test/performance/006_p99-sla-performance.spec.ts` adds this on top of the
existing single-sample tests (which stay in place as a fast, per-flow smoke check) via
`percentile()`, `summarizeSamples()` (min/P50/P99/max), and `assertP99SLA()` in
`helpers/performance.ts` — same hard-fail semantics as `assertSLA()`, applied to an array of
repeated samples instead of one.

**Sample size is deliberately small** (5-8 repeats), because this project explicitly avoids
generating repeated/concurrent load against its shared staging accounts (see Methodology above and
`playwright.config.ts`'s `workers: 1`). Only cheap, read-only flows (home page load, nav click) are
repeated — the heavier booking-flow tier (T6) is intentionally left single-sample, matching how the
reference project limits its own most expensive tiers to fewer repeats.
