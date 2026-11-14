import { daysIn, isSpan } from './event-span'
import type { EventCategory, Occurrence } from './school-calendar'

// How a month's events sit in its grid, week by week, so it reads at a
// glance like a school's printed calendar, minus the repetition:
// - a category shown "beside the date" (a daily duty, "SB-Cruz") goes in
//   the day's top row;
// - an event that spans days is one bar across them, split only where the
//   week ends; so is the same event on days in a row ("Kletter out"
//   entered Monday to Friday), instead of five copies;
// - a category shown as "one line a day" ("Employee out") gathers a day's
//   events into one line;
// - everything else is a line of its own, in the order the server sends
//   (all-day first, then by time).
// Every line has a row in its week: bars keep theirs, and a day's own lines
// fill the rows its bars leave free, top down, so a bar on Friday takes no
// room on Tuesday.
// Plain functions, no React.

export type DayItem =
  | { kind: 'event'; o: Occurrence }
  | { kind: 'combined'; category: EventCategory; items: Array<Occurrence> }

/** One event on days in a row within a week. */
export type Span = {
  /** Its occurrence on each day, first to last. */
  items: Array<Occurrence>
  /** Columns (0 = Sunday) it starts and ends in. */
  first: number
  last: number
  /** Which bar row of the week it's in (0 = top). */
  lane: number
  /** How many days the whole event lasts (more than this week's, maybe). */
  days: number
  /** An event that spans days, carrying on from last week or into next. */
  before: boolean
  after: boolean
}

/** A day's own line, in a row of its week (0 = the first under the dates). */
export type DayLine =
  | { kind: 'item'; row: number; item: DayItem }
  /** "+N more": hidden counts events, each in a gathered line too. */
  | { kind: 'more'; row: number; hidden: number }

export type WeekLayout = {
  days: Array<string>
  /** By column: shown beside the day's number. */
  header: Array<Array<Occurrence>>
  /** Bars, each in the row its lane says. */
  spans: Array<Span>
  /** By column: the day's own lines, in the rows its bars leave free. */
  lines: Array<Array<DayLine>>
  /** How many rows of lines the week needs, bars and days' own. */
  rows: number
}

/** Lowercase, single spaces: how titles are compared. */
function same(s: string) {
  return s.trim().replace(/\s+/g, ' ').toLocaleLowerCase()
}

/**
 * The weeks of a month grid (dates: whole weeks, Sunday first). A day shows
 * perDay lines, or as many as the week's bars make it tall, before "+N more".
 */
export function layoutMonth(
  dates: Array<string>,
  occurrences: Array<Occurrence>,
  categories: Array<EventCategory>,
  perDay: number,
): Array<WeekLayout> {
  const byId = new Map(categories.map((c) => [c.id, c]))
  const categoryOf = (o: Occurrence) =>
    o.category_id ? byId.get(o.category_id) : undefined
  const byDate = new Map<string, Array<Occurrence>>()
  for (const o of occurrences)
    byDate.set(o.date, [...(byDate.get(o.date) ?? []), o])

  const weeks: Array<WeekLayout> = []
  for (let w = 0; w < dates.length; w += 7) {
    const days = dates.slice(w, w + 7)
    const header: Array<Array<Occurrence>> = days.map(() => [])
    const rest: Array<Array<Occurrence>> = days.map(() => [])
    days.forEach((date, col) => {
      for (const o of byDate.get(date) ?? []) {
        if (categoryOf(o)?.display === 'header') header[col].push(o)
        else rest[col].push(o)
      }
    })

    const spans: Array<Span> = []
    const inBar = new Set<Occurrence>()
    // Bars: an event that spans days, for its days this week (even one).
    const spanCols = new Map<string, Map<number, Occurrence>>()
    rest.forEach((list, col) => {
      for (const o of list) {
        if (!isSpan(o)) continue
        const k = `${o.event_id}|${o.first_day}`
        const m = spanCols.get(k) ?? new Map<number, Occurrence>()
        if (!m.has(col)) m.set(col, o)
        spanCols.set(k, m)
      }
    })
    for (const m of spanCols.values()) {
      const run = [...m.keys()].sort((a, b) => a - b)
      const items = run.map((c) => m.get(c) as Occurrence)
      items.forEach((o) => inBar.add(o))
      const head = items[0]
      const tail = items[items.length - 1]
      spans.push({
        items,
        first: run[0],
        last: run[run.length - 1],
        lane: 0,
        days: daysIn(head.first_day, head.last_day),
        before: head.date > head.first_day,
        after: tail.date < tail.last_day,
      })
    }

    // And separate events with the same title, category and start on days
    // in a row (entered day by day).
    const keyOf = (o: Occurrence) =>
      `${o.category_id ?? ''}|${o.all_day ? '' : (o.start ?? '')}|${same(o.title)}`
    const cols = new Map<string, Map<number, Occurrence>>()
    rest.forEach((list, col) => {
      for (const o of list) {
        if (inBar.has(o)) continue
        const k = keyOf(o)
        const m = cols.get(k) ?? new Map<number, Occurrence>()
        if (!m.has(col)) m.set(col, o)
        cols.set(k, m)
      }
    })
    for (const m of cols.values()) {
      let run: Array<number> = []
      const flush = () => {
        if (run.length >= 2) {
          const items = run.map((c) => m.get(c) as Occurrence)
          items.forEach((o) => inBar.add(o))
          spans.push({
            items,
            first: run[0],
            last: run[run.length - 1],
            lane: 0,
            days: items.length,
            before: false,
            after: false,
          })
        }
        run = []
      }
      for (let col = 0; col < 7; col++) {
        if (m.has(col)) run.push(col)
        else flush()
      }
      flush()
    }
    // Earliest first, longest first; each takes the first row it fits in.
    spans.sort((a, b) => a.first - b.first || b.last - a.last)
    const laneEnds: Array<number> = []
    for (const s of spans) {
      let lane = laneEnds.findIndex((end) => end < s.first)
      if (lane === -1) lane = laneEnds.length
      laneEnds[lane] = s.last
      s.lane = lane
    }

    const body = rest.map((list) =>
      gatherDay(
        list.filter((o) => !inBar.has(o)),
        byId,
      ),
    )
    // The rows each day's bars are in.
    const taken = days.map(
      (_, col) =>
        new Set(
          spans
            .filter((s) => s.first <= col && col <= s.last)
            .map((s) => s.lane),
        ),
    )
    // A stack of bars makes the whole week taller: every day may use it.
    let capacity = Math.max(perDay, laneEnds.length)
    // A day its bars fill still gets a row, for its "+N more".
    if (
      body.some((items, col) => items.length > 0 && taken[col].size >= capacity)
    )
      capacity += 1
    const lines = body.map((items, col) =>
      placeDay(items, taken[col], capacity),
    )
    const rows = Math.max(
      laneEnds.length,
      ...lines.flat().map((line) => line.row + 1),
    )
    weeks.push({ days, header, spans, lines, rows })
  }
  return weeks
}

/**
 * A day's lines in the rows its bars leave free, top down. When they don't
 * all fit, the last free row says "+N more" instead.
 */
function placeDay(
  items: Array<DayItem>,
  taken: Set<number>,
  capacity: number,
): Array<DayLine> {
  const free: Array<number> = []
  for (let row = 0; row < capacity; row++) if (!taken.has(row)) free.push(row)
  if (items.length <= free.length)
    return items.map((item, i) => ({ kind: 'item', row: free[i], item }))
  const shown = free.length - 1
  const hidden = items
    .slice(shown)
    .reduce((n, i) => n + (i.kind === 'combined' ? i.items.length : 1), 0)
  return [
    ...items
      .slice(0, shown)
      .map((item, i): DayLine => ({ kind: 'item', row: free[i], item })),
    { kind: 'more', row: free[shown], hidden },
  ]
}

/**
 * One day's events as lines: a "one line a day" category's events gather
 * into one line when there are two or more; the rest stay as they are, in
 * order.
 */
export function gatherDay(
  list: Array<Occurrence>,
  byId: Map<string, EventCategory>,
): Array<DayItem> {
  const items: Array<DayItem> = []
  const gathered = new Map<string, Extract<DayItem, { kind: 'combined' }>>()
  for (const o of list) {
    const c = o.category_id ? byId.get(o.category_id) : undefined
    const together =
      c?.display === 'combined' &&
      list.filter((x) => x.category_id === c.id).length > 1
    if (!c || !together) {
      items.push({ kind: 'event', o })
      continue
    }
    const line = gathered.get(c.id)
    if (line) line.items.push(o)
    else {
      const fresh = { kind: 'combined' as const, category: c, items: [o] }
      gathered.set(c.id, fresh)
      items.push(fresh)
    }
  }
  return items
}

const BIRTHDAY = /birthday|b-?\s?day/i

/** A birthday category shows a cake, not its name. */
export function isBirthdays(c: EventCategory | undefined) {
  return !!c && BIRTHDAY.test(c.name)
}

/**
 * An event's words inside a "one line a day" category: "B-DAY M. Garcia" →
 * "M. Garcia", "Rebueno out" → "Rebueno". The category says the rest.
 */
export function shortTitle(title: string) {
  const s = title
    .replace(/^\s*(b-?\s?days?|birthday)\b[\s:–-]*/i, '')
    .replace(/[\s,–-]*\bout\b[.!]?\s*$/i, '')
    .trim()
  return s || title
}

/** "Employee out: Rebueno, Garcia", or "🎂 M. Garcia, K. Nunez". */
export function combinedText(c: EventCategory, items: Array<Occurrence>) {
  const names = items.map((o) => shortTitle(o.title)).join(', ')
  return isBirthdays(c) ? `🎂 ${names}` : `${c.name}: ${names}`
}

/** Can't this name match a title on its own ("Al" would match "Also")? */
function usable(part: string) {
  return part.length >= 3
}

function escape(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Which events are "mine": ones you're invited to, or with your name in the
 * title (a spreadsheet's "SB-Barragan", "1:30 Barragan/RF"). Your last name
 * or full name, as a whole word.
 */
export function mineMatcher(fullName: string | null | undefined) {
  const parts = (fullName ?? '').trim().split(/\s+/).filter(Boolean)
  const names = [
    ...(parts.length > 1 ? [parts.join(' ')] : []),
    ...(parts.length > 0 ? [parts[parts.length - 1]] : []),
  ].filter(usable)
  const re =
    names.length > 0
      ? new RegExp(
          `(^|[^\\p{L}])(${names.map(escape).join('|')})($|[^\\p{L}])`,
          'iu',
        )
      : null
  return (o: Occurrence) => o.invited || (re !== null && re.test(o.title))
}
