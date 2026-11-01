import { localDate } from './marks'

// Working with one local calendar day ("YYYY-MM-DD") and times within it.
// Marks are stored in UTC; everything here shows them on the wall clock of a
// given time zone, so a mark given at 2:30 PM in Los Angeles shows at 2:30 PM.

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

/** "2026-10-31" → that day at local midnight. */
export function parseDate(date: string) {
  const [year, month, day] = date.split('-').map(Number)
  return new Date(year, month - 1, day)
}

/** A real calendar date like "2026-10-31" (not "2026-02-31"). */
export function isDateString(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    DATE_PATTERN.test(value) &&
    localDate(parseDate(value)) === value
  )
}

/** "2026-10-31", 1 → "2026-11-01". Safe across month ends and DST. */
export function addDays(date: string, days: number) {
  const d = parseDate(date)
  d.setDate(d.getDate() + days)
  return localDate(d)
}

/** "Friday, October 31", with the year only when it isn't this year. */
export function formatLongDate(date: string) {
  const d = parseDate(date)
  return d.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: d.getFullYear() === new Date().getFullYear() ? undefined : 'numeric',
  })
}

/** How far into its day a moment falls on the wall clock, in minutes. */
export function minutesIntoDay(when: string | Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
  }).formatToParts(new Date(when))
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value ?? 0)
  return part('hour') * 60 + part('minute') + part('second') / 60
}

/** "2:30 PM" on the wall clock of the time zone. */
export function formatTime(when: string | Date, timeZone: string) {
  return new Date(when).toLocaleTimeString(undefined, {
    timeZone,
    hour: 'numeric',
    minute: '2-digit',
  })
}

/** 6 → "6 AM", 13 → "1 PM", 0 → "12 AM". */
export function formatHour(hour: number) {
  return new Date(2000, 0, 1, hour).toLocaleTimeString(undefined, {
    hour: 'numeric',
  })
}

/** "Pacific Daylight Time", as it was on that date. */
export function timeZoneLabel(date: string, timeZone: string) {
  const noon = parseDate(date)
  noon.setHours(12)
  return (
    new Intl.DateTimeFormat(undefined, { timeZone, timeZoneName: 'long' })
      .formatToParts(noon)
      .find((p) => p.type === 'timeZoneName')?.value ?? timeZone
  )
}

/** The hour starting at `hour`: 10 → "10–11 AM", 11 → "11 AM–12 PM". */
export function formatHourSpan(hour: number) {
  const start = formatHour(hour)
  const end = formatHour(hour + 1)
  // Split at the space before AM/PM (often a narrow no-break space).
  const [startNumber, startHalf] = start.split(/\s/)
  const [, endHalf] = end.split(/\s/)
  return startHalf && startHalf === endHalf
    ? `${startNumber}–${end}`
    : `${start}–${end}`
}
