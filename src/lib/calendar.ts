import { addDays, isWeekend, parseDate } from './day'
import { localDate } from './marks'

// Months ("2026-11") and clock times ("08:15") for the lesson plan calendar.
// Dates are "YYYY-MM-DD" strings in the teacher's own calendar, as in day.ts.

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/

/** A month like "2026-11". */
export function isMonthString(value: unknown): value is string {
  return typeof value === 'string' && MONTH_PATTERN.test(value)
}

/** "2026-11-05" → "2026-11". */
export function monthOf(date: string) {
  return date.slice(0, 7)
}

/** "2026-11", 1 → "2026-12". */
export function addMonths(month: string, months: number) {
  const [year, m] = month.split('-').map(Number)
  return localDate(new Date(year, m - 1 + months, 1)).slice(0, 7)
}

/** "November 2026". */
export function formatMonth(month: string) {
  return parseDate(`${month}-01`).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  })
}

/**
 * The 42 dates a month calendar shows: six weeks, Sunday to Saturday, starting
 * on or before the 1st. Six rows always, so the grid doesn't jump in height.
 */
export function monthGrid(month: string) {
  const first = `${month}-01`
  const start = addDays(first, -parseDate(first).getDay())
  return Array.from({ length: 42 }, (_, i) => addDays(start, i))
}

/** "Sun", "Mon"…, in the teacher's language, for the calendar's header. */
export function weekdayLabels(format: 'short' | 'narrow' = 'short') {
  // 2026-11-01 is a Sunday.
  return Array.from({ length: 7 }, (_, i) =>
    new Date(2026, 10, 1 + i).toLocaleDateString(undefined, {
      weekday: format,
    }),
  )
}

/**
 * The next school day (Monday to Friday) after date, or before it when
 * direction is -1. From Friday, next is Monday.
 */
export function stepSchoolDay(date: string, direction: 1 | -1) {
  let next = addDays(date, direction)
  while (isWeekend(next)) next = addDays(next, direction)
  return next
}

/** "Thu, Nov 5". */
export function formatShortDate(date: string) {
  return parseDate(date).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

/** "Thursday". */
export function formatWeekday(date: string) {
  return parseDate(date).toLocaleDateString(undefined, { weekday: 'long' })
}

/** "08:15" → minutes since midnight. */
export function clockMinutes(time: string) {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

/** "08:15" → "8:15 AM" (or "08:15" where clocks are 24-hour). */
export function formatClock(time: string) {
  const [h, m] = time.split(':').map(Number)
  return new Date(2000, 0, 1, h, m).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  })
}

/** "8:15–9:00 AM", "8:15 AM", or "" when there are no times. */
export function formatClockRange(start: string | null, end: string | null) {
  if (start && end) {
    const a = formatClock(start)
    const b = formatClock(end)
    // Drop a repeated AM/PM: "8:15–9:00 AM", not "8:15 AM–9:00 AM".
    const [aTime, aHalf] = a.split(/\s/)
    const [, bHalf] = b.split(/\s/)
    return aHalf && aHalf === bHalf ? `${aTime}–${b}` : `${a}–${b}`
  }
  if (start) return formatClock(start)
  if (end) return `Until ${formatClock(end)}`
  return ''
}
