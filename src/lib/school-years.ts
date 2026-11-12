import type { SchoolBreak } from './school-calendar'

// School years, worked out from dates: July 1 to June 30, named "2026–27".
// Nothing is stored; they only group the school's breaks, so the breaks
// list shows one year at a time instead of every break ever entered.

/** The year (its July 1's year) a "YYYY-MM-DD" falls in. */
export function schoolYearOf(date: string) {
  const y = Number(date.slice(0, 4))
  const m = Number(date.slice(5, 7))
  return m >= 7 ? y : y - 1
}

/** "2026–27". */
export function yearLabel(start: number) {
  return `${start}–${String(start + 1).slice(-2)}`
}

/**
 * The breaks of a school year, by date: the ones that start in it. A
 * summer break (June to August) is the end of the year it starts in.
 */
export function breaksIn(start: number, breaks: Array<SchoolBreak>) {
  return breaks
    .filter((b) => schoolYearOf(b.first_day) === start)
    .sort((a, b) =>
      a.first_day < b.first_day ? -1 : a.first_day > b.first_day ? 1 : 0,
    )
}
