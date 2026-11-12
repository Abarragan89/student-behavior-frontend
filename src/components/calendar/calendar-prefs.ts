import { useMemo, useState } from 'react'
import { MINE, NO_CATEGORY } from '#/components/calendar/categories'
import {
  firstWeekOf,
  monthGrid,
  monthOf,
  weekMonth,
  weekStart,
} from '#/lib/calendar'
import { addDays } from '#/lib/day'
import { isSpan } from '#/lib/event-span'
import type { EventCategory, Occurrence } from '#/lib/school-calendar'

// How someone likes the calendar to look, kept on this device only (the
// administrator's and teachers' calendars alike): month, week or list, and
// the legend chips picked to highlight ("Mine", categories). Not event
// data, so it's fine in localStorage.

export type CalendarView = 'month' | 'week' | 'agenda'

/** ?month= and ?week= (a date in the week): what the calendar shows. */
export type Picked = { month?: string; week?: string }

const VIEW_KEY = 'tff:calendar-view'
const FOCUS_KEY = 'tff:calendar-focus'

function read(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function remember(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    // Remembered for this visit only.
  }
}

/** The view last used on this device; a route's loader reads it too. */
export function readView(): CalendarView {
  const saved = read(VIEW_KEY)
  if (saved === 'month' || saved === 'week' || saved === 'agenda') return saved
  // Nothing saved: decide by screen size.
  return window.matchMedia('(min-width: 768px)').matches ? 'month' : 'agenda'
}

function readFocus(): Set<string> {
  try {
    const saved: unknown = JSON.parse(read(FOCUS_KEY) ?? '[]')
    if (Array.isArray(saved))
      return new Set(saved.filter((k): k is string => typeof k === 'string'))
  } catch {
    // Unreadable: nothing picked.
  }
  return new Set()
}

export type CalendarPrefs = ReturnType<typeof useCalendarPrefs>

/**
 * The month and week the calendar shows (neither picked: now; one picked:
 * the other follows it), and the 42 days to fetch, which hold what the
 * view shows. The week's days are counted for the legend in the week
 * view, the month's otherwise.
 */
export function resolveRange(
  picked: Picked,
  view: CalendarView,
  today: string,
) {
  const month =
    picked.month ??
    (picked.week ? weekMonth(weekStart(picked.week)) : monthOf(today))
  const week = picked.week
    ? weekStart(picked.week)
    : monthOf(today) === month
      ? weekStart(today)
      : firstWeekOf(month)
  const days = monthGrid(view === 'week' ? weekMonth(week) : month)
  const counted =
    view === 'week'
      ? { from: week, to: addDays(week, 6) }
      : { from: `${month}-01`, to: `${month}-31` }
  return { month, week, days, ...counted }
}

export function useCalendarPrefs() {
  const [view, setView] = useState<CalendarView>(readView)
  const [focus, setFocus] = useState(readFocus)
  return {
    view,
    setView: (v: CalendarView) => {
      setView(v)
      remember(VIEW_KEY, v)
    },
    focus,
    setFocus: (next: Set<string>) => {
      setFocus(next)
      remember(FOCUS_KEY, JSON.stringify([...next]))
    },
  }
}

/**
 * The legend's counts for the days from..to (events by category,
 * NO_CATEGORY for none, and yours), and which events stand out: null while
 * no chip is picked (everything as is), else a test. An event stands out
 * if any picked chip covers it. A deleted category's chip covers nothing.
 */
export function useLegend({
  occurrences,
  categories,
  focus,
  from,
  to,
  isMine,
}: {
  occurrences: Array<Occurrence>
  categories: Array<EventCategory>
  focus: Set<string>
  from: string
  to: string
  isMine: (o: Occurrence) => boolean
}) {
  return useMemo(() => {
    const known = new Set(categories.map((c) => c.id))
    const keyOf = (o: Occurrence) =>
      o.category_id && known.has(o.category_id) ? o.category_id : NO_CATEGORY
    const counts = new Map<string, number>()
    let mineCount = 0
    // An event that spans days counts once.
    const counted = new Set<string>()
    for (const o of occurrences) {
      if (o.date < from || o.date > to) continue
      if (isSpan(o)) {
        const key = `${o.event_id}|${o.first_day}`
        if (counted.has(key)) continue
        counted.add(key)
      }
      counts.set(keyOf(o), (counts.get(keyOf(o)) ?? 0) + 1)
      if (isMine(o)) mineCount++
    }
    const picked = new Set(
      [...focus].filter((k) => k === MINE || k === NO_CATEGORY || known.has(k)),
    )
    const highlight =
      picked.size === 0
        ? null
        : (o: Occurrence) =>
            picked.has(keyOf(o)) || (picked.has(MINE) && isMine(o))
    return { counts, mineCount, highlight }
  }, [occurrences, categories, focus, from, to, isMine])
}
