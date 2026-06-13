/**
 * Date helpers for collaborator cycle milestones (plan 009).
 *
 * Dates are handled as plain `YYYY-MM-DD` strings (Postgres `date`). All math is
 * done in UTC to avoid timezone drift when parsing/formatting day-only values.
 *
 * v1 minimal scope (D3): business days exclude Saturday/Sunday only — NO holiday
 * calendar. German public holidays vary by Bundesland and are out of scope.
 */

const DAY_MS = 24 * 60 * 60 * 1000

/** Parse a `YYYY-MM-DD` string into a UTC Date at midnight. */
function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1))
}

/** Format a UTC Date back to a `YYYY-MM-DD` string. */
function formatISODate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

/** True for Saturday (6) or Sunday (0) in UTC. */
function isWeekend(date: Date): boolean {
  const day = date.getUTCDay()
  return day === 0 || day === 6
}

/**
 * Add `n` business days to `start` (a `YYYY-MM-DD` string), skipping weekends.
 *
 * `addBusinessDays('2026-06-12', 3)` (Fri) → '2026-06-17' (Wed): skips Sat/Sun.
 * `n = 0` returns the start unchanged. Negative `n` is not supported and is
 * treated as 0.
 */
export function addBusinessDays(start: string, n: number): string {
  const date = parseISODate(start)
  let remaining = Math.max(0, Math.floor(n))
  while (remaining > 0) {
    date.setTime(date.getTime() + DAY_MS)
    if (!isWeekend(date)) remaining--
  }
  return formatISODate(date)
}

/**
 * Review window end date (D3): start + 3 business days.
 * Returns null when no start date is set.
 */
export function reviewEndDate(reviewStartDate: string | null): string | null {
  if (!reviewStartDate) return null
  return addBusinessDays(reviewStartDate, 3)
}

/**
 * Default payment date (D4): final certification date + 20 calendar days.
 * Returns null when no certification date is set.
 */
export function defaultPaymentDate(finalCertDate: string | null): string | null {
  if (!finalCertDate) return null
  const date = parseISODate(finalCertDate)
  date.setTime(date.getTime() + 20 * DAY_MS)
  return formatISODate(date)
}
