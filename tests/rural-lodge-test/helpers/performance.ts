import { type Page, type TestInfo, expect } from '@playwright/test';

export interface NavigationMetrics {
  ttfb: number;
  domContentLoaded: number;
  loadComplete: number;
  firstPaint: number | null;
  firstContentfulPaint: number | null;
}

/**
 * Reads the browser's own Navigation Timing Level 2 + Paint Timing entries for the current
 * document - real numbers from the actual page load, not an external synthetic probe. Call right
 * after the navigation that should be measured (before further clicks), since these entries are
 * per-document and get reset on the next navigation.
 */
export async function getNavigationMetrics(page: Page): Promise<NavigationMetrics> {
  return page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    const paint = performance.getEntriesByType('paint');
    const fp = paint.find((p) => p.name === 'first-paint')?.startTime ?? null;
    const fcp = paint.find((p) => p.name === 'first-contentful-paint')?.startTime ?? null;
    if (!nav) {
      return { ttfb: -1, domContentLoaded: -1, loadComplete: -1, firstPaint: fp, firstContentfulPaint: fcp };
    }
    return {
      ttfb: Math.round(nav.responseStart - nav.startTime),
      domContentLoaded: Math.round(nav.domContentLoadedEventEnd - nav.startTime),
      loadComplete: Math.round(nav.loadEventEnd - nav.startTime),
      firstPaint: fp !== null ? Math.round(fp) : null,
      firstContentfulPaint: fcp !== null ? Math.round(fcp) : null,
    };
  });
}

/**
 * Reads Resource Timing entries for requests whose URL contains `urlSubstr` (e.g. an API path
 * like "trpc" or "/api/trpc/booking.getBookings") made since the last navigation. Returns each
 * match's duration in ms, most recent first.
 */
export async function getResourceDurations(page: Page, urlSubstr: string): Promise<number[]> {
  return page.evaluate((substr) => {
    return performance
      .getEntriesByType('resource')
      .filter((r) => r.name.includes(substr))
      .map((r) => Math.round(r.duration))
      .reverse();
  }, urlSubstr);
}

/**
 * Nearest-rank percentile over a set of samples (e.g. `percentile(durations, 99)` for P99). Used
 * to gate a *distribution* of repeated measurements rather than a single sample - see
 * `assertP99SLA` below. With a small sample count (kept modest here to avoid hammering the shared
 * staging accounts), P99 converges toward the observed max - that's expected and reported honestly
 * rather than presented as statistically rigorous.
 */
export function percentile(samples: number[], p: number): number {
  if (samples.length === 0) return -1;
  const sorted = [...samples].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx];
}

export interface SampleRange {
  count: number;
  min: number;
  max: number;
  p50: number;
  p99: number;
}

/** Summarizes a set of repeated/parameterized samples into min/max/P50/P99. */
export function summarizeSamples(samples: number[]): SampleRange {
  if (samples.length === 0) return { count: 0, min: -1, max: -1, p50: -1, p99: -1 };
  return {
    count: samples.length,
    min: Math.min(...samples),
    max: Math.max(...samples),
    p50: percentile(samples, 50),
    p99: percentile(samples, 99),
  };
}

/**
 * P99 SLA gate: computes the 99th percentile of `samples` and asserts it against `tier.max` (the
 * same hard-fail ceiling `assertSLA` uses for a single sample) - the point is that a slow tail
 * request can't hide behind one lucky fast sample. Returns a formatted line reporting the full
 * min/P50/P99/max range regardless of outcome.
 */
export function assertP99SLA(label: string, samples: number[], tier: SlaTier): string {
  const r = summarizeSamples(samples);
  if (r.count === 0) {
    return `${label}: n/a (no samples captured)`;
  }
  const verdict = rateSla(r.p99, tier);
  const line = `${label}: n=${r.count}, min=${r.min} ms, P50=${r.p50} ms, P99=${r.p99} ms, max=${r.max} ms  [SLA ${verdict} on P99 - target ${tier.target} ms / max ${tier.max} ms]`;
  expect(
    r.p99,
    `${label} P99 (${r.p99} ms, n=${r.count}) exceeded the formal SLA max of ${tier.max} ms`
  ).toBeLessThanOrEqual(tier.max);
  return line;
}

/** Attaches a human-readable metrics summary to the HTML/Allure report. */
export async function attachMetrics(testInfo: TestInfo, label: string, lines: string[]) {
  await testInfo.attach(label, { body: lines.join('\n'), contentType: 'text/plain' });
}

export type Rating = 'GOOD' | 'SLOW' | 'POOR';

/**
 * Rates a duration in ms against two thresholds: at or under `goodMax` is GOOD, at or under
 * `slowMax` is SLOW, anything above is POOR. Thresholds are UX-heuristic, not a formal SLA - the
 * point is a readable signal per flow, not a hard gate.
 */
export function rate(ms: number, goodMax: number, slowMax: number): Rating {
  if (ms <= goodMax) return 'GOOD';
  if (ms <= slowMax) return 'SLOW';
  return 'POOR';
}

/** Formats one metric line with its rating, e.g. "Login round trip: 812 ms  [GOOD]". */
export function ratedLine(label: string, ms: number, goodMax: number, slowMax: number): string {
  return `${label}: ${ms} ms  [${rate(ms, goodMax, slowMax)}]`;
}

/**
 * Formal performance SLA, per operation class. Unlike `rate()` above (a readable heuristic signal
 * only), every tier here has a hard `max` that a test MUST fail against via `assertSLA()` - this
 * is a real gate, not just a label. `target` is the expected/healthy figure; a result between
 * `target` and `max` is a WARN (within SLA but degraded, worth watching), not a failure. See
 * specs/performance-sla.md for the full rationale per tier.
 */
export const SLA = {
  /** T1: full page load (goto -> load event) for an initial/unauthenticated page (home, login). */
  PAGE_LOAD: { target: 2_000, max: 8_000 },
  /** T2: in-app navigation - click a nav/language-toggle control to its content visible. */
  NAVIGATION: { target: 2_000, max: 6_000 },
  /** T3: a batched tRPC read call captured via Resource Timing. */
  API_READ: { target: 800, max: 3_000 },
  /** T4: search/filter - typing into a search box to the filtered table re-rendering. */
  SEARCH_FILTER: { target: 1_500, max: 5_000 },
  /** T5: opening a dialog (date picker, guest count, language selector). */
  DIALOG_OPEN: { target: 1_000, max: 4_000 },
  /**
   * T6: Booking flow - "Book for N nights" click through to the Personal Details step actually
   * rendering. Per specs/exploratory-findings.md this flow has an observed transient "Loading
   * Your Booking... Fetching cart data" state - this is this app's heaviest, most user-visible
   * real operation (its equivalent of the reference project's Report Consult/PDF Generation).
   */
  BOOKING_TO_PERSONAL_DETAILS: { target: 8_000, max: 20_000 },
} as const;

export type SlaTier = (typeof SLA)[keyof typeof SLA];

export type SlaVerdict = 'PASS' | 'WARN' | 'FAIL';

/** Rates a duration against a formal SLA tier: PASS (<= target), WARN (<= max), FAIL (> max). */
export function rateSla(ms: number, tier: SlaTier): SlaVerdict {
  if (ms <= tier.target) return 'PASS';
  if (ms <= tier.max) return 'WARN';
  return 'FAIL';
}

/**
 * Hard SLA gate: fails the test if `ms` exceeds `tier.max`. Returns a formatted line (for
 * attaching/logging) reporting PASS/WARN/FAIL against both the target and the max, regardless of
 * outcome.
 */
export function assertSLA(label: string, ms: number, tier: SlaTier): string {
  const verdict = rateSla(ms, tier);
  const line = `${label}: ${ms} ms  [SLA ${verdict} - target ${tier.target} ms / max ${tier.max} ms]`;
  expect(ms, `${label} exceeded the formal SLA max of ${tier.max} ms (measured ${ms} ms)`).toBeLessThanOrEqual(
    tier.max
  );
  return line;
}
