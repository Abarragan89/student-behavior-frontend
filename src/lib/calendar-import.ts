import type ICAL from 'ical.js'
import { MAX_SPAN_DAYS } from './event-span'
import type {
  EventInput,
  ImportWireEvent,
  Reminder,
  Repeat,
  SchoolBreak,
  Weekday,
} from './school-calendar'

// Reading a calendar file into events for the school calendar: Google
// Calendar's export (an .ics, or a .zip of them), or another calendar app's
// .ics. It all happens on this device: only the events the administrator
// ticks are sent (importEvents in school-calendar.ts). Plain functions, no
// React or app imports, so Node can run them against a test file.
//
// Dates come out in the school's time zone, and repeats only as the event
// form could make them: a repeat is mapped, then checked by listing both
// its dates and ours for two years. Anything that doesn't fit is skipped
// with a reason, never quietly changed.

type ICALModule = typeof ICAL
type Component = InstanceType<ICALModule['Component']>
type ICalTime = InstanceType<ICALModule['Time']>
type ICalEvent = InstanceType<ICALModule['Event']>
type Recur = InstanceType<ICALModule['Recur']>

// The server's limits (internal/schoolevent).
const MAX_TITLE = 200
const MAX_LOCATION = 200
const MAX_NOTES = 2000
const MAX_BREAK_NAME = 80
const MAX_OVERRIDES = 50
const MAX_CANCELLED = 2000
const YEARS_AHEAD = 5
// How far ahead a repeat's dates are compared with ours.
const CHECK_YEARS = 2
// A series that started long ago is walked from its start: this many dates
// at most.
const MAX_STEPS = 50_000
// One calendar in a ZIP (a zip bomb guard).
const MAX_ENTRY_BYTES = 30 * 1024 * 1024

export type SkipReason =
  | 'past'
  | 'far'
  | 'overnight'
  | 'multi-day-repeat'
  | 'rule'
  | 'changes'
  | 'timezone'
  | 'no-length'
  | 'cancelled'
  | 'unreadable'
  | 'undated'

/** Why events were skipped, in words. */
export const SKIP_REASONS: Record<SkipReason, string> = {
  past: 'Already happened',
  far: 'More than 5 years ahead',
  overnight: 'Runs past midnight',
  'multi-day-repeat': 'Lasts several days and repeats',
  rule: 'Repeats in a way this calendar can’t',
  changes: 'Too many changed dates',
  timezone: 'In a time zone that doesn’t line up with your school’s',
  'no-length': 'Has no length',
  cancelled: 'Cancelled',
  unreadable: 'Couldn’t be read',
  undated: 'Not on a date (notes like “Core Virtue”)',
}

/** An event's details as the form has them (no reminders yet). */
export type ImportFields = Pick<
  EventInput,
  | 'title'
  | 'location'
  | 'notes'
  | 'all_day'
  | 'date'
  | 'start'
  | 'end'
  | 'everyone'
  | 'staff_ids'
>

/** One date of a series changed in the calendar app. */
export type ImportOverride = ImportFields & { original_date: string }

/** An event ready to send, but for the reminders chosen in the preview. */
export type ImportEvent = ImportFields & {
  uid: string
  /** The last day of an event that spans days; null for one day. */
  end_date: string | null
  repeat: Repeat | null
  until: string | null
  cancelled: Array<string>
  overrides: Array<ImportOverride>
}

export type BreakFields = Omit<SchoolBreak, 'id'>

export type ImportItem = {
  event: ImportEvent
  /** A one-off all-day event can be a school break instead. */
  asBreak: BreakFields | null
  /** It starts as a break: its title sounds like one ("Winter break"). */
  breakFirst: boolean
  /** Guests on the staff list, and guests who aren't. */
  guests: { staff: number; outside: number }
  /** Why it starts unticked, if it does. */
  caution: 'private' | 'declined' | 'outside' | null
}

export type ImportCalendar = {
  name: string
  /** Named after the administrator's own email: Google's personal calendar. */
  personal: boolean
  items: Array<ImportItem>
  skipped: Array<{ title: string; reason: SkipReason }>
}

export type ImportContext = {
  /** The school's IANA time zone. */
  schoolTz: string
  /** Today there, YYYY-MM-DD. */
  today: string
  /** Staff list: lowercased email → staff id. */
  staffByEmail: Map<string, string>
  /** Your email (whoever imports), lowercased. */
  yourEmail: string
}

/** A file that isn't a calendar, or a ZIP with none in it. */
export class CalendarFileError extends Error {
  kind: 'not-calendar' | 'empty-zip'
  constructor(kind: 'not-calendar' | 'empty-zip') {
    super(kind)
    this.kind = kind
  }
}

let icalModule: Promise<ICALModule> | undefined
// Loaded only when a file is read (it's not small).
function loadIcal() {
  return (icalModule ??= import('ical.js').then((m) => m.default))
}

/** Reads an .ics, or a .zip of them (Google's Export), into its calendars. */
export async function readCalendarFile(
  bytes: Uint8Array,
  fileName: string,
  ctx: ImportContext,
): Promise<Array<ImportCalendar>> {
  const ICAL = await loadIcal()
  const files: Array<{ name: string; text: string }> = []
  // A ZIP starts "PK" (Google's single-calendar export can be one too).
  if (bytes[0] === 0x50 && bytes[1] === 0x4b) {
    const { unzipSync } = await import('fflate')
    let entries: Record<string, Uint8Array>
    try {
      entries = unzipSync(bytes, {
        filter: (f) =>
          /\.ics$/i.test(f.name) &&
          !f.name.startsWith('__MACOSX/') &&
          f.originalSize <= MAX_ENTRY_BYTES,
      })
    } catch {
      throw new CalendarFileError('not-calendar')
    }
    for (const [name, data] of Object.entries(entries)) {
      files.push({ name, text: decode(data) })
    }
    if (files.length === 0) throw new CalendarFileError('empty-zip')
  } else {
    files.push({ name: fileName, text: decode(bytes) })
  }
  return files.flatMap((f) =>
    parseCalendars(ICAL, f.text, baseName(f.name), ctx),
  )
}

function decode(bytes: Uint8Array) {
  const s = new TextDecoder('utf-8').decode(bytes)
  // A byte-order mark in front would hide BEGIN:VCALENDAR.
  return s.charCodeAt(0) === 0xfeff ? s.slice(1) : s
}

/** A calendar's name when the file has none: its file name. */
function baseName(path: string) {
  const file = path.split('/').pop() ?? path
  return file.replace(/\.ics$/i, '') || 'Calendar'
}

function parseCalendars(
  ICAL: ICALModule,
  source: string,
  fallbackName: string,
  ctx: ImportContext,
): Array<ImportCalendar> {
  if (!/BEGIN:VCALENDAR/i.test(source))
    throw new CalendarFileError('not-calendar')
  let jcal: unknown
  try {
    jcal = ICAL.parse(source)
  } catch {
    throw new CalendarFileError('not-calendar')
  }
  const roots = (
    Array.isArray(jcal) && Array.isArray(jcal[0]) ? jcal : [jcal]
  ) as Array<Array<unknown>>
  return roots.map((root) => {
    const vcal = new ICAL.Component(root)
    if (vcal.name !== 'vcalendar') throw new CalendarFileError('not-calendar')
    return parseCalendar(ICAL, vcal, fallbackName, ctx)
  })
}

function parseCalendar(
  ICAL: ICALModule,
  vcal: Component,
  fallbackName: string,
  ctx: ImportContext,
): ImportCalendar {
  const name =
    oneLine(text(vcal.getFirstPropertyValue('x-wr-calname')), 200) ||
    fallbackName
  const cal: ImportCalendar = {
    name,
    personal: name.toLowerCase() === ctx.yourEmail,
    items: [],
    skipped: [],
  }
  // An event and its changed dates share a UID; grouped here, so ical.js
  // doesn't search the whole file for each event.
  const masters = new Map<string, Component>()
  const changes = new Map<string, Array<Component>>()
  for (const ve of vcal.getAllSubcomponents('vevent')) {
    const uid = eventUid(ve)
    if (ve.hasProperty('recurrence-id')) {
      changes.set(uid, [...(changes.get(uid) ?? []), ve])
    } else if (!masters.has(uid)) {
      masters.set(uid, ve)
    }
  }
  const add = (ve: Component, uid: string, exceptions: Array<Component>) => {
    let result: ImportItem | SkipReason
    try {
      result = mapEvent(ICAL, ve, uid, exceptions, ctx)
    } catch {
      result = 'unreadable'
    }
    if (typeof result === 'string') {
      cal.skipped.push({ title: titleOf(ve), reason: result })
    } else {
      cal.items.push(result)
    }
  }
  for (const [uid, ve] of masters) add(ve, uid, changes.get(uid) ?? [])
  // Changed dates whose series isn't in the file: one-time events.
  for (const [uid, list] of changes) {
    if (masters.has(uid)) continue
    for (const ve of list) {
      const rid = ve.getFirstPropertyValue('recurrence-id') as ICalTime | null
      add(ve, `${uid}#${rid ? ymd(rid) : 'changed'}`, [])
    }
  }
  cal.items.sort(
    (a, b) =>
      a.event.date.localeCompare(b.event.date) ||
      (a.event.start ?? '').localeCompare(b.event.start ?? ''),
  )
  return cal
}

/** The event's UID; one without (rare) gets one made from its details. */
function eventUid(ve: Component) {
  const uid = text(ve.getFirstPropertyValue('uid')).trim()
  if (uid) return Array.from(uid).slice(0, 255).join('')
  const start = text(ve.getFirstProperty('dtstart')?.toICALString())
  return Array.from(`generated:${start}:${titleOf(ve)}`)
    .slice(0, 255)
    .join('')
}

function titleOf(ve: Component) {
  return (
    oneLine(text(ve.getFirstPropertyValue('summary')), MAX_TITLE) ||
    'Untitled event'
  )
}

// ---------- One event ----------

type Local = { date: string; min: number | null }

function mapEvent(
  ICAL: ICALModule,
  ve: Component,
  uid: string,
  exceptions: Array<Component>,
  ctx: ImportContext,
): ImportItem | SkipReason {
  if (text(ve.getFirstPropertyValue('status')).toUpperCase() === 'CANCELLED') {
    return 'cancelled'
  }
  const ev = new ICAL.Event(ve, { strictExceptions: true, exceptions })
  const start = ev.startDate as ICalTime | null
  if (!start) return 'unreadable'
  // A time zone named but not defined in the file (and not the school's)
  // can't be placed.
  const tzid = text(ve.getFirstProperty('dtstart')?.getParameter('tzid'))
  if (
    !start.isDate &&
    tzid &&
    zoneOf(start) === 'floating' &&
    tzid !== ctx.schoolTz
  ) {
    return 'timezone'
  }
  const fiveYears = addYears(ctx.today, YEARS_AHEAD)
  const allDay = start.isDate
  const who = audienceOf(ve, ctx)
  const fields = (
    src: ICalEvent,
    local: Local,
    endMin: number | null,
  ): ImportFields => ({
    // A changed date without a title keeps the series'.
    title:
      oneLine(text(src.summary), MAX_TITLE) ||
      oneLine(text(ev.summary), MAX_TITLE) ||
      'Untitled event',
    location: oneLine(text(src.location), MAX_LOCATION),
    notes: cleanNotes(text(src.description)),
    all_day: local.min === null,
    date: local.date,
    start: local.min === null ? null : clock(local.min),
    end: endMin === null ? null : clock(endMin),
    everyone: who.staffIds.length === 0,
    staff_ids: who.staffIds,
  })
  const item = (
    event: ImportEvent,
    asBreak: BreakFields | null,
  ): ImportItem => ({
    event,
    asBreak,
    breakFirst: !!asBreak && looksLikeBreak(event.title),
    guests: { staff: who.staffIds.length, outside: who.outside },
    caution: who.private
      ? 'private'
      : who.declined
        ? 'declined'
        : who.staffIds.length === 0 && who.outside > 0
          ? 'outside'
          : null,
  })

  // How long it lasts: days (all day, the end being the day after) or
  // minutes.
  const end = ev.endDate as ICalTime | null
  const days =
    allDay && end ? Math.max(1, daysBetween(ymd(start), ymd(end))) : 1
  const minutes =
    allDay || !end
      ? 0
      : Math.round((end.toUnixTime() - start.toUnixTime()) / 60)
  if (!allDay && minutes <= 0) return 'no-length'

  if (!ev.isRecurring()) {
    if (allDay) {
      const first = ymd(start)
      const last = addDays(first, days - 1)
      if (last < ctx.today) return 'past'
      if (first > fiveYears) return 'far'
      // As an event: from today at the earliest, to the last day. Up to
      // 60 days, one event that spans them; longer, a date a day.
      const from = first < ctx.today ? ctx.today : first
      const until =
        last > addYears(from, YEARS_AHEAD) ? addYears(from, YEARS_AHEAD) : last
      const span = from !== until && daysBetween(from, until) < MAX_SPAN_DAYS
      const event: ImportEvent = {
        ...fields(ev, { date: from, min: null }, null),
        uid,
        end_date: span ? until : null,
        repeat: from === until || span ? null : daily(),
        until: from === until || span ? null : until,
        cancelled: [],
        overrides: [],
      }
      const asBreak =
        daysBetween(first, last) <= 366
          ? {
              name: oneLine(event.title, MAX_BREAK_NAME),
              first_day: first,
              last_day: last,
            }
          : null
      return item(event, asBreak)
    }
    const s = localOf(start, ctx)
    if (!s || s.min === null) return 'timezone'
    if (s.date < ctx.today) return 'past'
    if (s.date > fiveYears) return 'far'
    if (s.min + minutes > 1440) return 'overnight'
    return item(
      {
        ...fields(ev, s, s.min + minutes),
        uid,
        end_date: null,
        repeat: null,
        until: null,
        cancelled: [],
        overrides: [],
      },
      null,
    )
  }

  // ----- A series -----
  const rules = ve.getAllProperties('rrule')
  if (
    rules.length !== 1 ||
    ve.hasProperty('rdate') ||
    ve.hasProperty('exrule')
  ) {
    return 'rule'
  }
  if (allDay && days > 1) return 'multi-day-repeat'
  const recur = rules[0].getFirstValue() as Recur
  const bounded = recur.until !== null || recur.count !== null
  const checkTo = addYears(ctx.today, CHECK_YEARS)

  let first: Local | null = null
  let last: string | null = null
  let offset: number | null = null
  const theirs: Array<string> = [] // their dates, today to checkTo
  const cancelled = new Set<string>()
  const overrides: Array<ImportOverride> = []
  const it = ev.iterator()
  let steps = 0
  for (
    let t = it.next() as ICalTime | undefined;
    t;
    t = it.next() as ICalTime | undefined
  ) {
    if (++steps > MAX_STEPS) return 'rule'
    const o = localOf(t, ctx)
    if (!o) return 'timezone'
    if (o.date < ctx.today) continue
    if (first === null) {
      if (o.date > fiveYears) return 'far'
      if (o.min !== null && o.min + minutes > 1440) return 'overnight'
      first = o
    }
    // Each date has to land at the same clock time and day as the first in
    // the school's zone (two zones changing clocks on different dates
    // don't).
    if (o.min !== first.min) return 'timezone'
    const shift = daysBetween(ymd(t), o.date)
    if (offset !== null && shift !== offset) return 'timezone'
    offset = shift
    if (o.date > addYears(first.date, YEARS_AHEAD)) break // the most a series runs
    if (!bounded && o.date > checkTo) break
    last = o.date
    if (o.date <= checkTo) theirs.push(o.date)

    const details = ev.getOccurrenceDetails(t)
    if (details.item === ev) continue
    // A changed date: moved or edited, or cancelled.
    const changed = details.item
    const cs = localOf(details.startDate, ctx)
    const cm = changed.startDate.isDate
      ? 0
      : Math.round(
          (details.endDate.toUnixTime() - details.startDate.toUnixTime()) / 60,
        )
    const usable =
      text(changed.component.getFirstPropertyValue('status')).toUpperCase() !==
        'CANCELLED' &&
      cs !== null &&
      cs.date >= ctx.today &&
      cs.date <= fiveYears &&
      (cs.min === null || (cm > 0 && cs.min + cm <= 1440))
    if (!usable) {
      cancelled.add(o.date)
      continue
    }
    overrides.push({
      ...fields(changed, cs, cs.min === null ? null : cs.min + cm),
      original_date: o.date,
    })
  }
  if (first === null || last === null) return 'past'
  if (overrides.length > MAX_OVERRIDES) return 'changes'

  const repeat = toRepeat(recur, first.date)
  if (!repeat) return 'rule'
  const until = bounded ? last : null
  // Dates the calendar app left out (EXDATE): cancelled here.
  for (const p of ve.getAllProperties('exdate')) {
    for (const v of p.getValues() as Array<ICalTime>) {
      const x = localOf(v, ctx)
      if (x && x.date > first.date && (!until || x.date <= until))
        cancelled.add(x.date)
    }
  }
  // Our rule has to give the same dates as theirs (theirs leave out the
  // EXDATEs, which ours cancel).
  const theirSet = new Set(theirs)
  const ours = ourDates(ICAL, repeat, first.date, until, checkTo).filter(
    (d) => theirSet.has(d) || !cancelled.has(d),
  )
  if (ours.join() !== theirs.join()) return 'rule'
  if (cancelled.size > MAX_CANCELLED) return 'changes'

  return item(
    {
      ...fields(ev, first, first.min === null ? null : first.min + minutes),
      uid,
      end_date: null,
      repeat,
      until,
      cancelled: [...cancelled].sort(),
      overrides,
    },
    null,
  )
}

/** Who's invited: guests on the staff list (none: everyone). */
function audienceOf(ve: Component, ctx: ImportContext) {
  const staff = new Set<string>()
  let outside = 0
  let declined = false
  for (const a of ve.getAllProperties('attendee')) {
    const cutype = text(a.getParameter('cutype')).toUpperCase()
    if (cutype === 'RESOURCE' || cutype === 'ROOM') continue
    const email = text(a.getFirstValue())
      .replace(/^mailto:/i, '')
      .trim()
      .toLowerCase()
    // Rooms and Google's own calendar addresses (a shared calendar can be
    // listed as a guest) aren't people.
    if (!email || /calendar\.google\.com$/.test(email)) continue
    if (email === ctx.yourEmail) {
      declined = text(a.getParameter('partstat')).toUpperCase() === 'DECLINED'
    }
    const id = ctx.staffByEmail.get(email)
    if (id) staff.add(id)
    else if (email !== ctx.yourEmail) outside++
  }
  const cls = text(ve.getFirstPropertyValue('class')).toUpperCase()
  return {
    staffIds: [...staff],
    outside,
    declined,
    private: cls === 'PRIVATE' || cls === 'CONFIDENTIAL',
  }
}

// ---------- Repeats ----------

const WEEKDAY_CODES: Array<Weekday> = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA']
const ALLOWED_PARTS = new Set(['BYDAY', 'BYMONTHDAY', 'BYMONTH', 'BYSETPOS'])

function daily(): Repeat {
  return { freq: 'daily', interval: 1, weekdays: [], monthly_by: '' }
}

/**
 * The form's repeat for a calendar app's rule starting on first (a real
 * date of it), or null when there's none. ourDates then checks it.
 */
export function toRepeat(recur: Recur, first: string): Repeat | null {
  const interval = recur.interval || 1
  if (interval < 1 || interval > 99) return null
  const parts = recur.parts as Record<string, Array<unknown> | undefined>
  if (
    Object.entries(parts).some(
      ([k, v]) => v && v.length > 0 && !ALLOWED_PARTS.has(k),
    )
  ) {
    return null
  }
  const byday = (recur.getComponent('BYDAY') as Array<string>).map((d) =>
    d.toUpperCase(),
  )
  const bymonthday = recur.getComponent('BYMONTHDAY') as Array<number>
  const bymonth = recur.getComponent('BYMONTH') as Array<number>
  const bysetpos = recur.getComponent('BYSETPOS') as Array<number>
  const plainDays = byday.every((d) =>
    (WEEKDAY_CODES as Array<string>).includes(d),
  )
  const days = WEEKDAY_CODES.filter((d) => byday.includes(d))
  const [y, m, d] = first.split('-').map(Number)
  const wd = WEEKDAY_CODES[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]
  const weekly = (n: number): Repeat => ({
    freq: 'weekly',
    interval: n,
    weekdays: days.length > 0 ? days : [wd],
    monthly_by: '',
  })
  switch (recur.freq) {
    case 'DAILY':
      if (bymonthday.length || bymonth.length || bysetpos.length) return null
      if (byday.length === 0) return { ...daily(), interval }
      // "Every weekday" as some apps write it.
      return interval === 1 && plainDays ? weekly(1) : null
    case 'WEEKLY':
      if (
        bymonthday.length ||
        bymonth.length ||
        bysetpos.length ||
        !plainDays
      ) {
        return null
      }
      return weekly(interval)
    case 'MONTHLY': {
      if (bymonth.length) return null
      const monthly = (by: Repeat['monthly_by']): Repeat => ({
        freq: 'monthly',
        interval,
        weekdays: [],
        monthly_by: by,
      })
      if (byday.length === 0 && bysetpos.length === 0) {
        if (bymonthday.length === 0) return monthly('day')
        return bymonthday.length === 1 && bymonthday[0] === d
          ? monthly('day')
          : null
      }
      if (byday.length !== 1 || bymonthday.length) return null
      let code = byday[0]
      if (bysetpos.length === 1 && plainDays) code = `${bysetpos[0]}${code}`
      else if (bysetpos.length) return null
      const match = /^([+-]?\d)(SU|MO|TU|WE|TH|FR|SA)$/.exec(code)
      if (!match || match[2] !== wd) return null
      const n = Number(match[1])
      if (n === -1) return d + 7 > daysInMonth(y, m) ? monthly('last') : null
      return n === Math.floor((d - 1) / 7) + 1 ? monthly('nth') : null
    }
    case 'YEARLY':
      if (
        byday.length ||
        bysetpos.length ||
        bymonth.length > 1 ||
        bymonthday.length > 1
      ) {
        return null
      }
      if (bymonth.length === 1 && bymonth[0] !== m) return null
      if (bymonthday.length === 1 && bymonthday[0] !== d) return null
      return { freq: 'yearly', interval, weekdays: [], monthly_by: '' }
  }
  return null
}

/**
 * The rule the server will store for repeat from first (a copy of Go's
 * Repeat.Rule: no WKST, so weeks start on Monday, as on the server).
 */
export function ruleOf(repeat: Repeat, first: string) {
  const [y, m, d] = first.split('-').map(Number)
  const wd = WEEKDAY_CODES[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]
  const parts = [
    `FREQ=${repeat.freq.toUpperCase()}`,
    `INTERVAL=${repeat.interval}`,
  ]
  switch (repeat.freq) {
    case 'weekly': {
      const days = repeat.weekdays.length > 0 ? repeat.weekdays : [wd]
      parts.push(
        `BYDAY=${WEEKDAY_CODES.filter((x) => days.includes(x)).join(',')}`,
      )
      break
    }
    case 'monthly':
      if (repeat.monthly_by === 'day') parts.push(`BYMONTHDAY=${d}`)
      if (repeat.monthly_by === 'nth')
        parts.push(`BYDAY=${Math.floor((d - 1) / 7) + 1}${wd}`)
      if (repeat.monthly_by === 'last') parts.push(`BYDAY=-1${wd}`)
      break
    case 'yearly':
      parts.push(`BYMONTH=${m}`, `BYMONTHDAY=${d}`)
      break
  }
  return parts.join(';')
}

/** Our rule's dates from first to the earlier of until and to. */
function ourDates(
  ICAL: ICALModule,
  repeat: Repeat,
  first: string,
  until: string | null,
  to: string,
) {
  const recur = ICAL.Recur.fromString(ruleOf(repeat, first))
  const end = until && until < to ? until : to
  const it = recur.iterator(ICAL.Time.fromDateString(first))
  const out: Array<string> = []
  for (
    let t = it.next() as ICalTime | undefined, n = 0;
    t && n < MAX_STEPS;
    t = it.next() as ICalTime | undefined, n++
  ) {
    const day = ymd(t)
    if (day > end) break
    out.push(day)
  }
  return out
}

// ---------- Sending ----------

/**
 * The event as sent: the reminders chosen in the preview (all-day events
 * can't have the ones before a start time), repeats skipping breaks, and
 * its category (a spreadsheet's color), if any.
 */
export function toWire(
  e: ImportEvent,
  reminders: Array<Reminder>,
  timed: (r: Reminder) => boolean,
  categoryId: string | null = null,
): ImportWireEvent {
  const forEvent = (allDay: boolean) =>
    reminders.filter((r) => !(allDay && timed(r)))
  return {
    ...e,
    skip_breaks: true,
    group_ids: [],
    reminders: forEvent(e.all_day),
    category_id: categoryId,
    overrides: e.overrides.map((o) => ({
      ...o,
      skip_breaks: true,
      group_ids: [],
      reminders: forEvent(o.all_day),
      category_id: categoryId,
    })),
  }
}

/** How many rows an event takes of the school's 1000 (a series' changed dates count). */
export function rowsOf(e: ImportEvent) {
  return 1 + e.overrides.length
}

// ---------- Text ----------

const BREAK_WORDS =
  /\b(break|vacation|no school|recess|closed|day off|holidays?)\b/i
const NOT_A_BREAK =
  /\b(party|parties|concert|camp|program|fair|parade|show|lunch|luncheon|dinner|breakfast|celebration|assembly|meeting)\b/i

export function looksLikeBreak(title: string) {
  return BREAK_WORDS.test(title) && !NOT_A_BREAK.test(title)
}

function text(v: unknown): string {
  if (v === null || v === undefined) return ''
  if (Array.isArray(v)) return v.map(text).join(' ')
  return String(v)
}

/** One line, at most max characters (as the server counts them). */
function oneLine(s: string, max: number) {
  return cut(
    s
      .replace(/\p{Cc}/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim(),
    max,
  )
}

function cut(s: string, max: number) {
  const chars = Array.from(s)
  return chars.length > max
    ? `${chars
        .slice(0, max - 1)
        .join('')
        .trimEnd()}…`
    : s
}

/**
 * Notes from a description: Google's HTML made plain text, its Google
 * Meet block left out, and cut to the server's limit.
 */
export function cleanNotes(raw: string) {
  let s = raw.replace(/\r\n?/g, '\n')
  s = s
    .replace(/-::~[~:]*::-[\s\S]*?-::~[~:]*::-/g, '')
    .replace(/-::~[~:]*::-[\s\S]*$/, '')
  if (/<\/?[a-z][^>]*>/i.test(s)) s = htmlToText(s)
  s = s
    .split('\n')
    // Control characters out (the lines' own breaks are already split).
    .map((line) =>
      line.replace(/\p{Cc}/gu, (c) => (c === '\t' ? ' ' : '')).trimEnd(),
    )
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  return cut(s, MAX_NOTES)
}

function htmlToText(html: string) {
  const marked = html
    .replace(/\n/g, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
  // DOMParser reads it without running anything in it.
  if (typeof DOMParser !== 'undefined') {
    return new DOMParser().parseFromString(marked, 'text/html').body.textContent
  }
  return marked
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, '&')
}

// ---------- Dates ----------

function pad(n: number) {
  return String(n).padStart(2, '0')
}

function ymd(t: { year: number; month: number; day: number }) {
  return `${t.year}-${pad(t.month)}-${pad(t.day)}`
}

function clock(min: number) {
  return `${pad(Math.floor(min / 60))}:${pad(min % 60)}`
}

function utc(date: string) {
  const [y, m, d] = date.split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}

function addDays(date: string, n: number) {
  return new Date(utc(date) + n * 86_400_000).toISOString().slice(0, 10)
}

function addYears(date: string, n: number) {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y + n, m - 1, d)).toISOString().slice(0, 10)
}

function daysBetween(a: string, b: string) {
  return Math.round((utc(b) - utc(a)) / 86_400_000)
}

function daysInMonth(y: number, m: number) {
  return new Date(Date.UTC(y, m, 0)).getUTCDate()
}

const formats = new Map<string, Intl.DateTimeFormat>()

/** A moment's date and clock minutes in a time zone. */
function inZone(ms: number, tz: string): Local {
  let f = formats.get(tz)
  if (!f) {
    f = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
    formats.set(tz, f)
  }
  const p = Object.fromEntries(
    f.formatToParts(new Date(ms)).map((x) => [x.type, x.value]),
  )
  return {
    date: `${p.year}-${p.month}-${p.day}`,
    min: Number(p.hour) * 60 + Number(p.minute),
  }
}

/** A time's zone: "UTC", "floating" (none), or the file's name for it. */
function zoneOf(t: ICalTime) {
  // ical.js leaves it unset on some times, whatever its types say.
  const zone = t.zone as { tzid?: string } | null | undefined
  return zone?.tzid ?? 'floating'
}

/**
 * A time from the file as a date and clock minutes in the school's zone
 * (minutes null all day). A time with no zone is taken as the school's.
 */
function localOf(t: ICalTime, ctx: ImportContext): Local | null {
  if (t.isDate) return { date: ymd(t), min: null }
  const zone = zoneOf(t)
  if (zone === 'floating' || zone === ctx.schoolTz) {
    return { date: ymd(t), min: t.hour * 60 + t.minute }
  }
  const ms = t.toUnixTime() * 1000
  return Number.isFinite(ms) ? inZone(ms, ctx.schoolTz) : null
}
