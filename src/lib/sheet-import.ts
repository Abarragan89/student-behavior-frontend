import { looksLikeBreak } from './calendar-import'
import type { ImportEvent, ImportItem, SkipReason } from './calendar-import'
import { CATEGORY_STYLES, hueGap, hueOf, nearestColor } from './category-colors'
import { MAX_SPAN_DAYS, daysIn } from './event-span'
import type { CategoryColor } from './category-colors'
import type { CategoryDisplay, EventCategory } from './school-calendar'
import { cellKey, serialToDate } from './xlsx'
import type { Sheet, Workbook } from './xlsx'

// Reading a school's calendar spreadsheet (a month per sheet, a box per
// day, color-coded by a legend: "orange = IEP/504") into events for the
// school calendar. It happens on this device; only what the administrator
// keeps is sent (importEvents in school-calendar.ts). Plain functions, no
// React or app state, so a script can run them on a test file (bundled:
// the imports have no extensions).
//
// The sheet's colors are its categories. Colors its legend names map
// straight across (including "any shade of orange"); colors it doesn't
// name are left for the administrator to place, since a guess by nearest
// color is often wrong (a light-pink SST sits closest to CAASPP's pink).

const MAX_TITLE = 200
const MAX_BREAK_NAME = 80
const YEARS_AHEAD = 5

/** A sheet without day boxes: not a month calendar. */
export class SheetFileError extends Error {
  kind: 'no-days'
  constructor(kind: 'no-days') {
    super(kind)
    this.kind = kind
  }
}

/** One thing written on a day. */
export type SheetEntry = {
  date: string
  /** Cleaned up, one line. */
  text: string
  /** Its color, "RRGGBB"; null for none (or the day's own background). */
  fill: string | null
  /** Which ColorGroup it's in. */
  group: string
  /** Written in the date row, beside the day's number (a daily duty). */
  dateRow: boolean
}

/** Entries sharing a color (or the legend entry the color belongs to). */
export type ColorGroup = {
  key: string
  kind: 'legend' | 'birthdays' | 'plain' | 'unlisted'
  /** The legend's words for it ("IEP/504"), "Birthdays", or null. */
  label: string | null
  /** The sheet's colors in it, most used first. */
  swatches: Array<string>
  /** The legend's color, to pick ours from. */
  color: string | null
  /** In by shade ("any shade of orange") or as a lighter/darker legend color. */
  shades: boolean
  count: number
  /** A few of its entries, to recognize it by. */
  samples: Array<string>
  /** Mostly written beside the day numbers ("SB-Cruz"): a daily duty. */
  dateRow: boolean
  /** An unlisted color: the legend entry it's closest to, to offer. */
  suggestion: { key: string; label: string; color: string } | null
}

export type ParsedSheet = {
  /** From today on, by date. */
  entries: Array<SheetEntry>
  groups: Array<ColorGroup>
  skipped: Array<{ title: string; reason: SkipReason }>
}

/** What a color group becomes. */
export type ColorChoice =
  | { kind: 'category'; id: string }
  | {
      kind: 'new'
      name: string
      color: CategoryColor
      display: CategoryDisplay
    }
  | { kind: 'none' }
  | { kind: 'break' }
  | { kind: 'skip' }

/** An import item that knows its color group. */
export type SheetItem = ImportItem & { group: string }

// ---------- Reading ----------

type LegendEntry = {
  color: string
  label: string
  /** "Any shade of orange": the hues that count. */
  family: [number, number] | null
}

const JUNK =
  /vertex42|^©|^\(c\)\s*\d|^https?:\/\/|^school calendars$|^edit the year|^year$|^start day$|^\d\s*:\s*sun|^important reminders$|^please note\b|^(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{4}$/i
// "SB-" with no name: the template's empty duty slot.
const EMPTY_SLOT = /^[a-z]{1,4}\s*-\s*$/i
const BIRTHDAY = /^\s*(b-?\s?day|birthday)\b/i
const BIRTHDAY_PINK = 'F472B6'
const SHADE = /\bany\s+shade\s+of\s+([a-z]+)/i
const HUE_FAMILIES: Partial<Record<string, [number, number]>> = {
  red: [345, 15],
  orange: [15, 52],
  yellow: [52, 70],
  green: [70, 170],
  blue: [190, 250],
  purple: [250, 290],
  pink: [290, 345],
}

/**
 * Reads every month sheet: the day boxes (a row of day numbers, then the
 * rows below it until the next), what's written in each, and the legend
 * of colors beside them. Only dates from today on are kept.
 */
export function readSheetCalendar(wb: Workbook, today: string): ParsedSheet {
  const raw: Array<{
    date: string
    text: string
    fill: string | null
    dateRow: boolean
  }> = []
  const skipped: ParsedSheet['skipped'] = []
  const legendVotes = new Map<string, Map<string, number>>()
  const families = new Map<string, [number, number]>()
  let anyDays = false

  for (const sheet of wb.sheets) {
    const grid = dayBoxes(sheet, wb.date1904)
    if (!grid) continue
    anyDays = true
    const background = backgrounds(sheet, grid)
    for (const cell of sheet.cells.values()) {
      if (typeof cell.value !== 'string') continue
      const box = grid.boxAt(cell.row, cell.col)
      // The day number's own cell.
      if (box && box.row === cell.row && box.col === cell.col) continue
      const own = cell.fill && cell.fill !== 'FFFFFF' ? cell.fill : null
      const fill = own && own !== background.get(cell.col) ? own : null
      for (const text of pieces(cell.value)) {
        if (
          JUNK.test(text) ||
          EMPTY_SLOT.test(text) ||
          /^\d+(\.\d+)?$/.test(text)
        )
          continue
        if (box?.date) {
          raw.push({
            date: box.date,
            text,
            fill,
            dateRow: box.row === cell.row,
          })
        } else if (!box && fill) {
          // Beside the days, with a color: the legend.
          const label = tidyLabel(text)
          if (!label) continue
          const votes = legendVotes.get(fill) ?? new Map<string, number>()
          votes.set(label, (votes.get(label) ?? 0) + 1)
          legendVotes.set(fill, votes)
          const shade = SHADE.exec(text)?.at(1)?.toLowerCase()
          const family = shade ? HUE_FAMILIES[shade] : undefined
          if (family) families.set(fill, family)
        } else {
          skipped.push({ title: text, reason: 'undated' })
        }
      }
    }
  }
  if (!anyDays) throw new SheetFileError('no-days')

  const legend: Array<LegendEntry> = [...legendVotes.entries()].map(
    ([color, votes]) => ({
      color,
      label: [...votes.entries()].sort((a, b) => b[1] - a[1])[0][0],
      family: families.get(color) ?? null,
    }),
  )

  // Once each (a month can be in a file twice), past dates out.
  const seen = new Set<string>()
  const far = addYears(today, YEARS_AHEAD)
  const entries: Array<SheetEntry> = []
  const groups = new Map<string, ColorGroup>()
  const swatchCount = new Map<string, Map<string, number>>()
  const dateRowCount = new Map<string, number>()
  raw.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
  for (const r of raw) {
    const dup = `${r.date}|${r.text.toLocaleLowerCase()}`
    if (seen.has(dup)) continue
    seen.add(dup)
    if (r.date < today) {
      skipped.push({ title: r.text, reason: 'past' })
      continue
    }
    if (r.date > far) {
      skipped.push({ title: r.text, reason: 'far' })
      continue
    }
    const g = groupOf(r.text, r.fill, legend)
    entries.push({ ...r, group: g.key })
    let group = groups.get(g.key)
    if (!group) {
      group = { ...g, swatches: [], count: 0, samples: [], dateRow: false }
      groups.set(g.key, group)
    }
    group.count++
    if (r.dateRow) dateRowCount.set(g.key, (dateRowCount.get(g.key) ?? 0) + 1)
    if (group.samples.length < 3 && !group.samples.includes(r.text))
      group.samples.push(r.text)
    if (r.fill) {
      const s = swatchCount.get(g.key) ?? new Map<string, number>()
      s.set(r.fill, (s.get(r.fill) ?? 0) + 1)
      swatchCount.set(g.key, s)
    }
  }
  for (const group of groups.values())
    group.dateRow = (dateRowCount.get(group.key) ?? 0) >= group.count * 0.6
  for (const [key, s] of swatchCount) {
    const group = groups.get(key)
    if (group)
      group.swatches = [...s.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([c]) => c)
  }
  const order = { legend: 0, birthdays: 1, unlisted: 2, plain: 3 }
  return {
    entries,
    groups: [...groups.values()].sort(
      (a, b) => order[a.kind] - order[b.kind] || b.count - a.count,
    ),
    skipped,
  }
}

type Box = { row: number; col: number; date: string | null }

/**
 * Where a sheet's days are: rows holding several day-of-month cells ("d"),
 * each starting a week. A day's box runs from its day number across to
 * the next day's column and down to the next week's row. Weekday names
 * stored as dates ("dddd") and full dates don't count.
 */
function dayBoxes(sheet: Sheet, date1904: boolean) {
  const byRow = new Map<number, Array<{ col: number; date: string | null }>>()
  for (const cell of sheet.cells.values()) {
    if (!isDayFormat(cell.format)) continue
    const date =
      typeof cell.value === 'number' && cell.value > 0
        ? serialToDate(cell.value, date1904)
        : null
    const list = byRow.get(cell.row) ?? []
    list.push({ col: cell.col, date })
    byRow.set(cell.row, list)
  }
  const weeks = [...byRow.entries()]
    .filter(([, days]) => days.length >= 2)
    .sort((a, b) => a[0] - b[0])
  if (!weeks.some(([, days]) => days.some((d) => d.date))) return null
  const spans: Array<{
    top: number
    bottom: number
    days: Array<{
      left: number
      right: number
      date: string | null
      col: number
    }>
  }> = []
  weeks.forEach(([row, days], i) => {
    days.sort((a, b) => a.col - b.col)
    const width = days.length > 1 ? days[1].col - days[0].col : 1
    const next = weeks[i + 1]?.[0]
    const height = next ? next - row : i > 0 ? row - weeks[i - 1][0] : 6
    spans.push({
      top: row,
      bottom: row + height - 1,
      days: days.map((d, j) => ({
        col: d.col,
        date: d.date,
        left: d.col,
        right: (days[j + 1]?.col ?? d.col + width) - 1,
      })),
    })
  })
  // Each day's column (Sunday's, Monday's…): its day numbers, all weeks.
  const columns = new Map<
    number,
    { left: number; right: number; cells: Array<{ row: number; col: number }> }
  >()
  for (const s of spans) {
    for (const d of s.days) {
      const c = columns.get(d.col) ?? {
        left: d.left,
        right: d.right,
        cells: [],
      }
      c.cells.push({ row: s.top, col: d.col })
      columns.set(d.col, c)
    }
  }
  return {
    weekRows: new Set(weeks.map(([r]) => r)),
    weeks: spans.map(({ top, bottom }) => ({ top, bottom })),
    columns: [...columns.values()],
    boxAt(row: number, col: number): Box | null {
      for (const s of spans) {
        if (row < s.top || row > s.bottom) continue
        for (const d of s.days) {
          if (col >= d.left && col <= d.right)
            return { row: s.top, col: d.col, date: d.date }
        }
      }
      return null
    },
  }
}

function isDayFormat(format: string) {
  const code = format
    .toLowerCase()
    .replace(/"[^"]*"|\[[^\]]*\]|\\.|;@$/g, '')
    .trim()
  return code === 'd' || code === 'dd'
}

/**
 * Each column's shading inside the day boxes (a weekend's light blue),
 * which isn't a category: the fill most of the column's day numbers have,
 * or most of its empty cells (a cell the file leaves out has none). "Most"
 * is a clear majority, so a week colored for a break doesn't count.
 */
function backgrounds(
  sheet: Sheet,
  grid: NonNullable<ReturnType<typeof dayBoxes>>,
) {
  const majority = (t: Map<string, number>) => {
    const total = [...t.values()].reduce((a, b) => a + b, 0)
    const [top, n] = [...t.entries()].sort((a, b) => b[1] - a[1])[0] ?? ['', 0]
    return top !== '' && n >= total * 0.6 ? top : null
  }
  const out = new Map<number, string>()
  for (const days of grid.columns) {
    const numbers = new Map<string, number>()
    for (const d of days.cells) {
      const key = sheet.cells.get(cellKey(d.row, d.col))?.fill ?? ''
      numbers.set(key, (numbers.get(key) ?? 0) + 1)
    }
    const shade = majority(numbers)
    for (let col = days.left; col <= days.right; col++) {
      const empty = new Map<string, number>()
      for (const { top, bottom } of grid.weeks) {
        for (let row = top + 1; row <= bottom; row++) {
          const cell = sheet.cells.get(cellKey(row, col))
          if (cell && cell.value !== null) continue
          const key = cell?.fill ?? ''
          empty.set(key, (empty.get(key) ?? 0) + 1)
        }
      }
      const bg = shade ?? majority(empty)
      if (bg) out.set(col, bg)
    }
  }
  return out
}

/** A cell's text as items: lines, or ".    " between two things. */
function pieces(value: string) {
  return value
    .split(/\r?\n|\.\s{4,}/)
    .map(oneLine)
    .filter((s) => s !== '')
}

function oneLine(s: string) {
  return s
    .replace(/\p{Cc}/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\.+$/, '')
    .trim()
}

/** "IEP/504= ANY SHADE OF ORANGE" → "IEP/504"; "PUPIL FREE DAYS" → "Pupil free days". */
export function tidyLabel(text: string) {
  let s = text.replace(/\s*=?\s*any\s+shade\s+of\s+[a-z]+.*$/i, '')
  s = s.replace(/\s*\/\s*/g, '/').replace(/(\w)-\s+/g, '$1 ')
  s = s.replace(/\s+/g, ' ').trim()
  // ALL CAPS words ("PUPIL FREE DAYS") read as a sentence; a short
  // acronym ("SB", "IEP/504") stays.
  const letters = s.replace(/[^\p{L}]/gu, '')
  if (letters.length > 5 && letters === letters.toUpperCase())
    s = s.charAt(0) + s.slice(1).toLowerCase()
  return s.slice(0, 40).trim()
}

function rgbGap(a: string, b: string) {
  const x = Number.parseInt(a, 16)
  const y = Number.parseInt(b, 16)
  const dr = ((x >> 16) & 255) - ((y >> 16) & 255)
  const dg = ((x >> 8) & 255) - ((y >> 8) & 255)
  const db = (x & 255) - (y & 255)
  return Math.sqrt(dr * dr + dg * dg + db * db)
}

function inFamily(hue: number, [lo, hi]: [number, number]) {
  return lo <= hi ? hue >= lo && hue <= hi : hue >= lo || hue <= hi
}

function groupOf(
  text: string,
  fill: string | null,
  legend: Array<LegendEntry>,
): Omit<ColorGroup, 'swatches' | 'count' | 'samples' | 'dateRow'> {
  const base = { shades: false, suggestion: null }
  if (BIRTHDAY.test(text)) {
    return {
      ...base,
      key: 'birthdays',
      kind: 'birthdays',
      label: 'Birthdays',
      color: null,
    }
  }
  if (!fill)
    return { ...base, key: 'plain', kind: 'plain', label: null, color: null }
  const asLegend = (l: LegendEntry, shades: boolean) => ({
    ...base,
    key: `legend:${l.label.toLocaleLowerCase()}`,
    kind: 'legend' as const,
    label: l.label,
    color: l.color,
    shades,
  })
  const exact = legend.find((l) => l.color === fill)
  if (exact) return asLegend(exact, false)
  const { hue, chroma } = hueOf(fill)
  if (chroma >= 0.2) {
    const family = legend.find((l) => l.family && inFamily(hue, l.family))
    if (family) return asLegend(family, true)
  }
  // A lighter or darker legend color: same hue, close by.
  const near = legend.find((l) => {
    const h = hueOf(l.color)
    return (
      chroma >= 0.2 &&
      h.chroma >= 0.2 &&
      hueGap(h.hue, hue) <= 12 &&
      rgbGap(l.color, fill) <= 50
    )
  })
  if (near) return asLegend(near, true)
  const closest = legend
    .map((l) => ({ l, gap: rgbGap(l.color, fill) }))
    .sort((a, b) => a.gap - b.gap)
    .at(0)
  return {
    shades: false,
    key: `color:${fill}`,
    kind: 'unlisted',
    label: null,
    color: fill,
    suggestion:
      closest && closest.gap <= 90
        ? {
            key: `legend:${closest.l.label.toLocaleLowerCase()}`,
            label: closest.l.label,
            color: closest.l.color,
          }
        : null,
  }
}

// ---------- Choosing ----------

/**
 * Where each group goes to start: a legend entry to the category of that
 * name (made if the school doesn't have it), or a school break if it sounds
 * like one ("No school/holiday"); birthdays to Birthdays; the rest to no
 * category.
 */
export function defaultChoices(
  groups: Array<ColorGroup>,
  categories: Array<EventCategory>,
): Map<string, ColorChoice> {
  const out = new Map<string, ColorChoice>()
  const taken = new Set<CategoryColor>(categories.map((c) => c.color))
  // Colors from the legend pick first, biggest group first; birthdays,
  // which have no color of their own, take what's left.
  const rank = (g: ColorGroup) => (g.kind === 'birthdays' ? 1 : 0)
  for (const g of [...groups].sort(
    (a, b) => rank(a) - rank(b) || b.count - a.count,
  )) {
    if (g.kind === 'plain' || g.kind === 'unlisted' || !g.label) {
      out.set(g.key, { kind: 'none' })
      continue
    }
    if (g.kind === 'legend' && looksLikeBreak(g.label)) {
      out.set(g.key, { kind: 'break' })
      continue
    }
    const label = sameText(g.label)
    const have = categories.find((c) => sameText(c.name) === label)
    if (have) {
      out.set(g.key, { kind: 'category', id: have.id })
      continue
    }
    const color = nearestColor(g.color ?? BIRTHDAY_PINK, taken)
    taken.add(color)
    out.set(g.key, {
      kind: 'new',
      name: g.label,
      color,
      display: displayFor(g),
    })
  }
  return out
}

/**
 * How a new category from the sheet shows: what's written beside the day
 * numbers stays there (a duty rota); absences and birthdays become one line
 * a day; the rest, an event each.
 */
export function displayFor(g: ColorGroup): CategoryDisplay {
  if (g.dateRow) return 'header'
  if (g.kind === 'birthdays') return 'combined'
  if (g.label && /\b(out|absent|absences?)\b/i.test(g.label)) return 'combined'
  return 'chip'
}

/** A new category's color for a legend entry, avoiding ones in use. */
export function colorFor(rgb: string, inUse: Iterable<CategoryColor>) {
  return nearestColor(rgb, new Set(inUse))
}

// ---------- Times ----------

// Times: "3:30", "3:30pm", "3pm", "11 a.m.", and ranges like "10:00-12:00"
// or "730-11". Digits next to a slash are a date ("9/14-18"), not a time.
const AMPM = String.raw`[ap]\.?\s?m\b\.?`
const RANGE = new RegExp(
  String.raw`(?<![\d/:])(\d{3,4}|\d{1,2}(?::[0-5]\d)?)(?![\d:])\s*(${AMPM})?\s*(?:-|–|—|\bto\b)\s*(\d{1,2}(?::[0-5]\d)?)(?![\d/:])\s*(${AMPM})?`,
  'gi',
)
const ONE = new RegExp(
  String.raw`(?<![\d/:])(\d{1,2})(?::([0-5]\d))?(?![\d/:])\s*(${AMPM})?`,
  'gi',
)
const BEFORE_TIME = /\b(until|till|til|by|before|after|through|thru)\s*$/i
const EDGES = /^[\s\-–—@,.:;*/]+|[\s\-–—@,.:;*/]+$/g

export type ReadTime = { title: string; start: string; end: string }

/**
 * A time written at the start or end of an entry: "Board Meeting 5:00 PM",
 * "8:30 Dr.G/JB", "Sped PD 10:00-12:00", "Uniforms 730-11". Left alone (all
 * day): a time in the middle ("SST 10:30am Vargas"), two of them, a bare
 * number ("Leadership 9") and "until 4:30". Without am/pm, 7–11 is morning
 * and 12–6 afternoon, school hours. With no end, it lasts 30 minutes.
 */
export function readTime(text: string): ReadTime | null {
  const ranges = [...text.matchAll(RANGE)].filter(
    (m) =>
      m[1].includes(':') ||
      m[1].length >= 3 ||
      !!m[2] ||
      !!m[4] ||
      m[3].includes(':'),
  )
  const singles = [...text.matchAll(ONE)].filter(
    (m) =>
      (m[2] || m[3]) &&
      !ranges.some(
        (r) => m.index >= r.index && m.index < r.index + r[0].length,
      ),
  )
  if (ranges.length + singles.length !== 1) return null
  const m = ranges[0] ?? singles[0]
  const before = text.slice(0, m.index)
  const after = text.slice(m.index + m[0].length)
  const atStart = before.replace(EDGES, '') === ''
  const atEnd = after.replace(EDGES, '') === ''
  if (!atStart && !atEnd) return null
  if (BEFORE_TIME.test(before)) return null
  // "1 & 2pm", "12:30, 1:45": several times (two shows), not one start.
  if (/\d\s*(?:&|\band\b|,|\/|\bor\b)\s*$/i.test(before)) return null
  if (/^\s*(?:&|\band\b|,|\/|\bor\b)\s*\d/i.test(after)) return null

  let start: number | null
  let end: number | null
  if (ranges[0]) {
    const a = m[1]
    const ap1 = m.at(2) ?? null
    const b = m[3]
    const ap2 = m.at(4) ?? null
    const bMin = toMinutes(b, ap2)
    // "3-5pm": the end's pm is the start's too, if that keeps it first.
    let aMin = toMinutes(a, ap1)
    if (!ap1 && ap2 && aMin !== null && bMin !== null) {
      const same = toMinutes(a, ap2)
      if (same !== null && same < bMin) aMin = same
    }
    start = aMin
    end = bMin
    if (start !== null && end !== null && end <= start && end < 720) end += 720
    if (start === null || end === null || end <= start || end > 1440)
      return null
  } else {
    const minutes = m.at(2)
    start = toMinutes(m[1] + (minutes ? `:${minutes}` : ''), m.at(3) ?? null)
    if (start === null) return null
    end = Math.min(start + 30, 1440)
  }
  const title = oneLine(
    (atStart ? after : before).replace(EDGES, '').replace(/\s+(at|@)$/i, ''),
  ).replace(EDGES, '')
  if (!title) return null
  return { title, start: clock(start), end: clock(end) }
}

/** "730", "7:30", "11" with am/pm or a school-hours guess, to minutes. */
function toMinutes(t: string, ampm: string | null): number | null {
  let h: number
  let min: number
  if (t.includes(':')) {
    const [hh, mm] = t.split(':')
    h = Number(hh)
    min = Number(mm)
  } else if (t.length >= 3) {
    h = Number(t.slice(0, -2))
    min = Number(t.slice(-2))
  } else {
    h = Number(t)
    min = 0
  }
  if (!Number.isFinite(h) || h < 0 || h > 23 || min > 59) return null
  if (ampm) {
    if (h < 1 || h > 12) return null
    const pm = ampm.toLowerCase().startsWith('p')
    h = (h % 12) + (pm ? 12 : 0)
  } else if (h >= 1 && h <= 6) {
    h += 12
  } else if (h === 0) {
    return null
  }
  return h * 60 + min
}

function clock(min: number) {
  return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`
}

// ---------- Items ----------

/**
 * The entries as import items, by what each group became. A group that's a
 * school break joins its dates into breaks: dates next to each other, or
 * with only a weekend between. Each item's uid is a hash of the file and
 * the entry, so the same file imported again (a retry) skips what's saved,
 * and the uid gives nothing away (the server keeps it unencrypted).
 */
export async function sheetItems(
  parsed: ParsedSheet,
  choices: Map<string, ColorChoice>,
  opts: { readTimes: boolean; fileDigest: string },
): Promise<Array<SheetItem>> {
  const items: Array<SheetItem> = []
  const breakDays = new Map<string, Array<SheetEntry>>()
  // The same text in the same color on days in a row is one event that
  // spans them ("Kletter out" Monday to Friday). A second copy on one day
  // stays its own event.
  const runs = new Map<string, Array<string>>()
  const extras: Array<{ e: SheetEntry; n: number }> = []
  const seen = new Map<string, number>()
  const firstOf = new Map<string, SheetEntry>()
  for (const e of parsed.entries) {
    const choice = choices.get(e.group) ?? { kind: 'none' }
    if (choice.kind === 'skip') continue
    if (choice.kind === 'break') {
      breakDays.set(e.group, [...(breakDays.get(e.group) ?? []), e])
      continue
    }
    const n = seen.get(`${e.date}|${e.text}`) ?? 0
    seen.set(`${e.date}|${e.text}`, n + 1)
    const key = `${e.group}\0${e.text}`
    if (n > 0) {
      extras.push({ e, n })
      continue
    }
    if (!firstOf.has(key)) firstOf.set(key, e)
    runs.set(key, [...(runs.get(key) ?? []), e.date])
  }
  const eventOf = async (
    e: SheetEntry,
    first: string,
    last: string,
    n: number,
  ): Promise<ImportEvent> => {
    const time = opts.readTimes ? readTime(e.text) : null
    return {
      title: cut(time?.title ?? e.text, MAX_TITLE),
      location: '',
      notes: '',
      all_day: !time,
      date: first,
      end_date: first === last ? null : last,
      start: time?.start ?? null,
      end: time?.end ?? null,
      // Invite nobody: changing or deleting an event emails who's invited.
      everyone: false,
      staff_ids: [],
      // One day keeps the id it always had, so the same file imported
      // again is still known; a span's id includes its last day.
      uid:
        first === last
          ? await uidOf(opts.fileDigest, 'event', first, e.text, n)
          : await uidOf(
              opts.fileDigest,
              'event',
              first,
              `${last}|${e.text}`,
              0,
            ),
      repeat: null,
      until: null,
      cancelled: [],
      overrides: [],
    }
  }
  for (const [key, dates] of runs) {
    const e = firstOf.get(key)
    if (!e) continue
    for (const [first, last] of consecutive(dates.sort())) {
      items.push(plainItem(await eventOf(e, first, last, 0), e.group))
    }
  }
  for (const { e, n } of extras) {
    items.push(plainItem(await eventOf(e, e.date, e.date, n), e.group))
  }
  for (const [group, days] of breakDays) {
    for (const run of runsOf(days)) {
      const first = run[0].date
      const last = run[run.length - 1].date
      const name = cut(mostCommon(run.map((d) => d.text)), MAX_BREAK_NAME)
      const longSpan = daysIn(first, last) > MAX_SPAN_DAYS
      const event: ImportEvent = {
        title: cut(name, MAX_TITLE),
        location: '',
        notes: '',
        all_day: true,
        date: first,
        // As an event: one that spans the days, or a date a day when it's
        // longer than an event can span.
        end_date: first !== last && !longSpan ? last : null,
        start: null,
        end: null,
        everyone: false,
        staff_ids: [],
        uid: await uidOf(opts.fileDigest, 'break', first, `${last}|${name}`, 0),
        repeat: longSpan
          ? { freq: 'daily', interval: 1, weekdays: [], monthly_by: '' }
          : null,
        until: longSpan ? last : null,
        cancelled: [],
        overrides: [],
      }
      items.push({
        ...plainItem(event, group),
        asBreak: { name, first_day: first, last_day: last },
        breakFirst: true,
      })
    }
  }
  return items.sort((a, b) =>
    a.event.date < b.event.date ? -1 : a.event.date > b.event.date ? 1 : 0,
  )
}

function plainItem(event: ImportEvent, group: string): SheetItem {
  return {
    event,
    asBreak: null,
    breakFirst: false,
    guests: { staff: 0, outside: 0 },
    caution: null,
    group,
  }
}

/** Dates in a row, a weekend between allowed. */
function runsOf(days: Array<SheetEntry>) {
  const dates = [...new Set(days.map((d) => d.date))].sort()
  const byDate = new Map<string, Array<SheetEntry>>()
  for (const d of days) byDate.set(d.date, [...(byDate.get(d.date) ?? []), d])
  const runs: Array<Array<SheetEntry>> = []
  let run: Array<SheetEntry> = []
  let prev: string | null = null
  for (const date of dates) {
    if (prev && !joins(prev, date)) {
      runs.push(run)
      run = []
    }
    run.push(...(byDate.get(date) ?? []))
    prev = date
  }
  if (run.length > 0) runs.push(run)
  return runs
}

/**
 * Sorted dates as [first, last] runs of days in a row (no gap, not even a
 * weekend), each at most MAX_SPAN_DAYS long.
 */
function consecutive(dates: Array<string>): Array<[string, string]> {
  const out: Array<[string, string]> = []
  for (const date of dates) {
    const run = out.at(-1)
    if (
      run &&
      addDays(run[1], 1) === date &&
      daysIn(run[0], date) <= MAX_SPAN_DAYS
    )
      run[1] = date
    else out.push([date, date])
  }
  return out
}

/** The next date carries on the run: the next day, or only Sat/Sun between. */
function joins(prev: string, next: string) {
  let d = addDays(prev, 1)
  while (d < next) {
    const day = new Date(`${d}T00:00:00Z`).getUTCDay()
    if (day !== 0 && day !== 6) return false
    d = addDays(d, 1)
  }
  return d === next
}

function mostCommon(texts: Array<string>) {
  const n = new Map<string, number>()
  for (const t of texts) n.set(t, (n.get(t) ?? 0) + 1)
  return [...n.entries()].sort((a, b) => b[1] - a[1])[0][0]
}

/** The same entry of the same file always gets the same uid. */
async function uidOf(
  fileDigest: string,
  kind: string,
  date: string,
  text: string,
  n: number,
) {
  const data = new TextEncoder().encode(
    [fileDigest, kind, date, text, n].join('\u0000'),
  )
  return `sheet:${hex(await crypto.subtle.digest('SHA-256', data)).slice(0, 40)}`
}

/** The file's SHA-256, hex. */
export async function digestOf(bytes: Uint8Array<ArrayBuffer>) {
  return hex(await crypto.subtle.digest('SHA-256', bytes))
}

function hex(buf: ArrayBuffer) {
  return [...new Uint8Array(buf)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function cut(s: string, max: number) {
  const chars = [...s]
  return chars.length <= max ? s : chars.slice(0, max).join('').trim()
}

function addDays(date: string, n: number) {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

function addYears(date: string, n: number) {
  return `${Number(date.slice(0, 4)) + n}${date.slice(4)}`
}

// ---------- Already on the calendar ----------

/** Lowercase, single spaces: how titles are compared. */
export function sameText(s: string) {
  return s.trim().replace(/\s+/g, ' ').toLocaleLowerCase()
}

/**
 * Marks items the calendar already has: an event with the same title on
 * the same date, or a break with the same days. So an updated spreadsheet
 * only adds what's new.
 */
export function alreadyThere(
  items: Array<SheetItem>,
  existing: {
    occurrences: Array<{ date: string; title: string }>
    breaks: Array<{ first_day: string; last_day: string }>
  },
): Set<string> {
  const have = new Set(
    existing.occurrences.map((o) => `${o.date}|${sameText(o.title)}`),
  )
  const out = new Set<string>()
  for (const i of items) {
    if (i.asBreak) {
      const b = i.asBreak
      if (
        existing.breaks.some(
          (x) => x.first_day <= b.first_day && x.last_day >= b.last_day,
        )
      )
        out.add(i.event.uid)
    } else if (have.has(`${i.event.date}|${sameText(i.event.title)}`)) {
      out.add(i.event.uid)
    }
  }
  return out
}

/** The days the import covers, split into windows the calendar can list. */
export function windowsOf(from: string, to: string, days = 60) {
  const out: Array<{ from: string; to: string }> = []
  let start = from
  while (start <= to) {
    const end = addDays(start, days - 1)
    out.push({ from: start, to: end < to ? end : to })
    start = addDays(end, 1)
  }
  return out
}

/** Our name for a color key ("Orange"). */
export function colorLabel(c: CategoryColor) {
  return CATEGORY_STYLES[c].label
}
