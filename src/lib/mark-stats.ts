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
