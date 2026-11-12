// Events that span days: one event with a first and a last day (up to 60,
// never repeating, the same times each day). The server sends each day it
// covers as its own occurrence, all with the same first_day and last_day.
// No imports, so the file readers (calendar-import.ts, sheet-import.ts)
// can use it too.

/** The longest an event can span, in days (the server's limit too). */
export const MAX_SPAN_DAYS = 60

/** Days from first to last, both counted: Nov 12 to Nov 17 is 6. */
export function daysIn(first: string, last: string) {
  const ms = Date.parse(`${last}T00:00:00Z`) - Date.parse(`${first}T00:00:00Z`)
  return Math.round(ms / 864e5) + 1
}

/** An occurrence of an event that spans days. */
export function isSpan(o: { first_day: string; last_day: string }) {
  return o.last_day > o.first_day
}
