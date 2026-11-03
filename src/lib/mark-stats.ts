import { addDays, isWeekend, minutesIntoDay } from './day'
import { markTime } from './marks'
import type { Mark } from './marks'

// Small summaries of a student's marks, for their page and the printed report.

/**
 * The hour (on the wall clock) with the most marks, earliest on a tie. Null
 * when no hour has more than one: one mark isn't a pattern.
 */
export function busiestHour(marks: Array<Mark>, zone: string) {
  const perHour = new Map<number, number>()
  for (const mark of marks) {
    const hour = Math.floor(minutesIntoDay(markTime(mark), zone) / 60)
    perHour.set(hour, (perHour.get(hour) ?? 0) + 1)
  }
  let best: { hour: number; count: number } | null = null
  for (const [hour, count] of perHour) {
    if (
      count > 1 &&
      (!best ||
        count > best.count ||
        (count === best.count && hour < best.hour))
    ) {
      best = { hour, count }
    }
  }
  return best
}

export type TypeCount = {
  id: string // the mark type's id
  name: string
  isPositive: boolean
  count: number
}

/** How many of each mark type: most first, then by name. */
export function countByType(marks: Array<Mark>): Array<TypeCount> {
  const counts = new Map<string, TypeCount>()
  for (const mark of marks) {
    const entry = counts.get(mark.mark_type_id)
    if (entry) entry.count++
    else {
      counts.set(mark.mark_type_id, {
        id: mark.mark_type_id,
        name: mark.name,
        isPositive: mark.is_positive,
        count: 1,
      })
    }
  }
  return [...counts.values()].sort(
    (a, b) => b.count - a.count || a.name.localeCompare(b.name),
  )
}

/**
 * The last `count` weekdays up to and including `date`, oldest first. A
 * weekend `date` is kept too, as the last day.
 */
export function schoolDaysEnding(date: string, count: number) {
  const days = isWeekend(date) ? [date] : []
  for (let d = date; days.length < count; d = addDays(d, -1)) {
    if (!isWeekend(d)) days.push(d)
  }
  return days.reverse()
}

/** One day's counts, as the daily endpoint sends them. */
export type DayCount = { date: string; positive: number; negative: number }

/**
 * The days a recent-days chart shows: the school days, plus `keep` (the day
 * being looked at) and any weekend day with marks.
 */
export function schoolDaysToShow<T extends DayCount>(
  days: Array<T>,
  keep: string,
) {
  return days.filter(
    (d) => !isWeekend(d.date) || d.date === keep || d.positive + d.negative > 0,
  )
}

/** Totals over some days, and how many of them had any marks. */
export function sumDays(days: Array<DayCount>) {
  let positive = 0
  let negative = 0
  let marked = 0
  for (const d of days) {
    positive += d.positive
    negative += d.negative
    if (d.positive + d.negative > 0) marked++
  }
  return { positive, negative, marked }
}

/** An average per day in words: "about 4", "less than 1", "0". */
export function perDay(average: number) {
  if (average === 0) return '0'
  if (average < 1) return 'less than 1'
  return `about ${Math.round(average)}`
}
