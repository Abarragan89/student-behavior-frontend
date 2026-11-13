import { queryOptions } from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'
import { apiDelete, apiGet, apiPost, apiPut } from './api'
import type { CategoryColor } from './category-colors'
import { parseDate } from './day'

// The school calendar (Calendar tab): events the administrator makes for
// people and groups on the staff list, one-time or repeating, and the
// school's breaks. Dates are "YYYY-MM-DD" and times "HH:MM" in the school's
// time zone; the server works out a series' dates. Every call is the
// administrator's own ({ space: null }). Never saved on the device: event
// text can name students.

export type Freq = 'daily' | 'weekly' | 'monthly' | 'yearly'
export type MonthlyBy = '' | 'day' | 'nth' | 'last'
export type Weekday = 'SU' | 'MO' | 'TU' | 'WE' | 'TH' | 'FR' | 'SA'
export type Reminder = 'day' | 'morning' | 'hour' | 'ten_min'

export type Repeat = {
  freq: Freq
  interval: number
  /** Weekly only; empty means the event's own weekday. */
  weekdays: Array<Weekday>
  /** Monthly only. */
  monthly_by: MonthlyBy
}

export type SchoolEvent = {
  id: string
  title: string
  location: string
  notes: string
  all_day: boolean
  /** Its date; for an event that spans days, the first. */
  date: string
  /**
   * The last day of an event that spans days (up to 60, never repeating);
   * null for one day. Times, if any, are the same each day.
   */
  end_date: string | null
  start: string | null
  end: string | null
  repeat: Repeat | null
  until: string | null
  skip_breaks: boolean
  everyone: boolean
  staff_ids: Array<string>
  group_ids: Array<string>
  reminders: Array<Reminder>
  /** Its category (the color it shows in), or none. */
  category_id: string | null
  /** A one-date change of a series: which series, and the date it replaced. */
  series_id: string | null
  original_date: string | null
  /**
   * Only the people it's for, administrators and calendar editors see it.
   * Otherwise everyone on staff does; staff_ids, group_ids and everyone are
   * who gets its emails.
   */
  private: boolean
}

export type EventInput = Omit<SchoolEvent, 'id' | 'series_id' | 'original_date'>

/**
 * One event as a teacher opens it from their calendar: the details and
 * notes, and who's invited by name (not the staff list's ids).
 */
export type StaffEvent = Pick<
  SchoolEvent,
  | 'id'
  | 'title'
  | 'location'
  | 'notes'
  | 'all_day'
  | 'date'
  | 'end_date'
  | 'start'
  | 'end'
  | 'repeat'
  | 'until'
  | 'everyone'
  | 'category_id'
  | 'series_id'
  | 'original_date'
  | 'private'
> & {
  /** Who's invited by name, sorted; both empty for an everyone event. */
  groups: Array<string>
  people: Array<string>
  /** They're in its audience. */
  invited: boolean
  /** The emails they'll get: only when invited and emails go out. */
  reminders: Array<Reminder>
}

export type Occurrence = {
  event_id: string
  date: string
  all_day: boolean
  start: string | null
  end: string | null
  title: string
  location: string
  repeats: boolean
  edited: boolean
  past: boolean
  category_id: string | null
  /**
   * The viewer gets its emails (it's for everyone, them, or a group of
   * theirs): one of "their" events.
   */
  invited: boolean
  /** Only the people it's for and the calendar's editors see it. */
  private: boolean
  /**
   * The whole event's first and last day: an event that spans days comes
   * once per day it covers, each with the same two. Both are `date` for a
   * one-day event or a date of a series. For a span, `past` means it has
   * ended.
   */
  first_day: string
  last_day: string
}

/**
 * How a category's events show in a month: each its own chip; one line a
 * day ("Employee out: Garcia, Ruiz"); or in the date row, beside the day's
 * number (a daily duty, "SB-Cruz").
 */
export type CategoryDisplay = 'chip' | 'combined' | 'header'

/** A kind of event and its color ("IEP/504", orange). */
export type EventCategory = {
  id: string
  name: string
  color: CategoryColor
  display: CategoryDisplay
}

export type SchoolBreak = {
  id: string
  name: string
  first_day: string
  last_day: string
}

/**
 * A week's message: reminders, a theme or goals that aren't events. `week`
 * is its Monday (weeks run Monday to Sunday).
 */
export type WeekNote = { week: string; text: string }

/** How many events still to come a school can have (the server's cap). */
export const MAX_UPCOMING_EVENTS = 2000

export type CalendarWindow = {
  timezone: string
  today: string
  occurrences: Array<Occurrence>
  breaks: Array<SchoolBreak>
  /** The messages of the weeks the window touches. */
  week_notes: Array<WeekNote>
  /** The school's categories, oldest first. */
  categories: Array<EventCategory>
  /** Reminder emails go out (the server has email set up). */
  emails: boolean
  /**
   * How many more events the school can add (it holds up to 2000 that are
   * still to come; past ones don't count).
   */
  events_left: number
}

/**
 * A teacher's read-only school calendar: every event but private ones that
 * aren't for them (a calendar editor sees those too).
 */
export type StaffCalendarWindow = {
  timezone: string
  today: string
  occurrences: Array<Occurrence>
  breaks: Array<SchoolBreak>
  week_notes: Array<WeekNote>
  categories: Array<EventCategory>
}

export type Scope = 'one' | 'week' | 'future'

export function calendarQueryOptions(from: string, to: string) {
  return queryOptions({
    queryKey: ['school-calendar', from, to],
    queryFn: () =>
      apiGet<CalendarWindow>(
        `/schools/mine/calendar?${new URLSearchParams({ from, to })}`,
        { space: null },
      ),
    staleTime: 30_000,
  })
}

export function staffCalendarQueryOptions(from: string, to: string) {
  return queryOptions({
    queryKey: ['school-staff-calendar', from, to],
    queryFn: () =>
      apiGet<StaffCalendarWindow>(
        `/schools/mine/staff-calendar?${new URLSearchParams({ from, to })}`,
        { space: null },
      ),
    staleTime: 60_000,
  })
}

export function eventQueryOptions(id: string) {
  return queryOptions({
    queryKey: ['school-event', id],
    queryFn: () =>
      apiGet<SchoolEvent>(`/schools/mine/events/${encodeURIComponent(id)}`, {
        space: null,
      }),
    staleTime: 0,
  })
}

/** One event on the teacher's calendar, opened (404 if it's not on it). */
export function staffEventQueryOptions(id: string) {
  return queryOptions({
    queryKey: ['school-staff-event', id],
    queryFn: () =>
      apiGet<StaffEvent>(
        `/schools/mine/staff-calendar/events/${encodeURIComponent(id)}`,
        { space: null },
      ),
    staleTime: 30_000,
  })
}

export const breaksQueryOptions = queryOptions({
  queryKey: ['school-breaks'],
  queryFn: () =>
    apiGet<Array<SchoolBreak>>('/schools/mine/breaks', { space: null }),
  staleTime: 30_000,
})

/**
 * After any change to the calendar: refetch every calendar view, the
 * editor's and the read-only one (the School page, and the events on a
 * teacher's lesson plans), with the open event and the breaks.
 */
export function invalidateCalendar(queryClient: QueryClient) {
  for (const key of [
    'school-calendar',
    'school-staff-calendar',
    'school-event',
    'school-staff-event',
    'school-breaks',
  ])
    void queryClient.invalidateQueries({ queryKey: [key] })
}

export type Preview = { next: Array<string>; count: number | null }

export function previewQueryOptions(body: {
  date: string
  repeat: Repeat | null
  until: string | null
  skip_breaks: boolean
}) {
  return queryOptions({
    queryKey: ['school-event-preview', body],
    queryFn: () =>
      apiPost<Preview>('/schools/mine/events/preview', body, { space: null }),
    staleTime: 60_000,
  })
}

export function createEvent(input: EventInput) {
  return apiPost<SchoolEvent>('/schools/mine/events', input, { space: null })
}

/** Changes an event; for a series, `date` is the date opened. */
export function editEvent(
  id: string,
  date: string,
  scope: Scope,
  input: EventInput,
) {
  return apiPut<SchoolEvent>(
    `/schools/mine/events/${encodeURIComponent(id)}?${new URLSearchParams({ date, scope })}`,
    input,
    { space: null },
  )
}

export function deleteEvent(id: string, date: string, scope: Scope) {
  return apiDelete(
    `/schools/mine/events/${encodeURIComponent(id)}?${new URLSearchParams({ date, scope })}`,
    { space: null },
  )
}

export function createBreak(b: Omit<SchoolBreak, 'id'>) {
  return apiPost<SchoolBreak>('/schools/mine/breaks', b, { space: null })
}

export function deleteBreak(id: string) {
  return apiDelete(`/schools/mine/breaks/${encodeURIComponent(id)}`, {
    space: null,
  })
}

// ---------- Week messages ----------

/** How long a week's message can be (the server's limit). */
export const MAX_WEEK_NOTE = 1000
/** What a week without a message says. */
export const DEFAULT_WEEK_NOTE = 'Have a great week!'

/** The message of the week starting `monday`, or '' for none. */
export function weekNoteOf(notes: Array<WeekNote>, monday: string) {
  return notes.find((n) => n.week === monday)?.text ?? ''
}

/** Saves the message of the week starting `monday`; '' removes it. */
export function saveWeekNote(monday: string, text: string) {
  return apiPut<WeekNote>(
    `/schools/mine/week-notes/${encodeURIComponent(monday)}`,
    { text },
    { space: null },
  )
}

/**
 * Puts a saved message into every calendar window already loaded, the
 * editor's and the staff one, so the week shows it without a refetch.
 */
export function cacheWeekNote(queryClient: QueryClient, note: WeekNote) {
  const put = <T extends { week_notes: Array<WeekNote> }>(w: T | undefined) =>
    w && {
      ...w,
      week_notes: [
        ...w.week_notes.filter((n) => n.week !== note.week),
        ...(note.text ? [note] : []),
      ],
    }
  queryClient.setQueriesData<CalendarWindow>(
    { queryKey: ['school-calendar'] },
    put,
  )
  queryClient.setQueriesData<StaffCalendarWindow>(
    { queryKey: ['school-staff-calendar'] },
    put,
  )
}

// ---------- Categories ----------

/** Up to this many per school (the server's limit). */
export const MAX_CATEGORIES = 30
export const MAX_CATEGORY_NAME = 40

export type CategoryInput = Omit<EventCategory, 'id'>

export function createCategory(c: CategoryInput) {
  return apiPost<EventCategory>('/schools/mine/event-categories', c, {
    space: null,
  })
}

export function editCategory(id: string, c: CategoryInput) {
  return apiPut<EventCategory>(
    `/schools/mine/event-categories/${encodeURIComponent(id)}`,
    c,
    { space: null },
  )
}

/** Its events stay, with no category. */
export function deleteCategory(id: string) {
  return apiDelete(`/schools/mine/event-categories/${encodeURIComponent(id)}`, {
    space: null,
  })
}

/** The category with this name, ignoring case and spaces at the ends. */
export function categoryNamed(
  categories: Array<EventCategory>,
  name: string,
): EventCategory | undefined {
  const key = name.trim().toLocaleLowerCase()
  return categories.find((c) => c.name.trim().toLocaleLowerCase() === key)
}

// ---------- Importing a calendar file (see calendar-import.ts) ----------

/** An event from a calendar file, as sent: the form's fields and more. */
export type ImportWireEvent = EventInput & {
  /** The file's id for it: importing it again skips it. */
  uid: string
  /** Dates of a series cancelled in the calendar app. */
  cancelled: Array<string>
  /** Dates of a series changed there: each its own one-date edit. */
  overrides: Array<
    // One date each: never repeating, never spanning days.
    Omit<EventInput, 'repeat' | 'until' | 'end_date'> & {
      original_date: string
    }
  >
}

export type ImportResult = {
  added: number
  /** Imported before, so skipped. */
  already: number
  breaks: number
  skipped: Array<{ uid: string; reason: string }>
}

const BATCH_EVENTS = 100
// The server takes up to 1 MB a request.
const BATCH_BYTES = 700_000
const BATCH_BREAKS = 100

/**
 * Imports events and breaks in batches; done counts the events sent so
 * far. A failed batch can be sent again: events already saved are skipped.
 * Every batch carries the same importId, so undoImport takes it all back.
 */
export async function importEvents(
  events: Array<ImportWireEvent>,
  breaks: Array<Omit<SchoolBreak, 'id'>>,
  importId: string,
  onProgress?: (done: number) => void,
): Promise<ImportResult> {
  const total: ImportResult = { added: 0, already: 0, breaks: 0, skipped: [] }
  const encoder = new TextEncoder()
  const waitingBreaks = [...breaks]
  let batch: Array<ImportWireEvent> = []
  let bytes = 0
  let done = 0
  const send = async () => {
    const res = await apiPost<ImportResult>(
      '/schools/mine/events/import',
      {
        events: batch,
        breaks: waitingBreaks.splice(0, BATCH_BREAKS),
        import_id: importId,
      },
      { space: null, timeoutMs: 60_000 },
    )
    total.added += res.added
    total.already += res.already
    total.breaks += res.breaks
    total.skipped.push(...res.skipped)
    done += batch.length
    batch = []
    bytes = 0
    onProgress?.(done)
  }
  for (const e of events) {
    const size = encoder.encode(JSON.stringify(e)).length
    if (
      batch.length > 0 &&
      (batch.length >= BATCH_EVENTS || bytes + size > BATCH_BYTES)
    ) {
      await send()
    }
    batch.push(e)
    bytes += size
  }
  while (batch.length > 0 || waitingBreaks.length > 0) await send()
  return total
}

/**
 * Takes back an import: the events and breaks it saved (and one-date
 * changes made to them since). Nobody is emailed.
 */
export function undoImport(importId: string) {
  return apiDelete(
    `/schools/mine/events/imports/${encodeURIComponent(importId)}`,
    { space: null, timeoutMs: 60_000 },
  )
}

// ---------- Repeats, in words ----------

export const WEEKDAYS: Array<Weekday> = [
  'SU',
  'MO',
  'TU',
  'WE',
  'TH',
  'FR',
  'SA',
]
const SCHOOL_WEEK: Array<Weekday> = ['MO', 'TU', 'WE', 'TH', 'FR']
const NTH = ['first', 'second', 'third', 'fourth', 'fifth']

/** "Tuesday" for "TU". */
export function weekdayName(d: Weekday, format: 'long' | 'short' = 'long') {
  // 2026-11-01 is a Sunday.
  return new Date(2026, 10, 1 + WEEKDAYS.indexOf(d)).toLocaleDateString(
    undefined,
    { weekday: format },
  )
}

export function weekdayOf(date: string): Weekday {
  return WEEKDAYS[parseDate(date).getDay()]
}

/** 1 → "1st", 22 → "22nd". */
export function ordinal(n: number) {
  const tens = n % 100
  const ones = n % 10
  if (tens >= 11 && tens <= 13) return `${n}th`
  return `${n}${ones === 1 ? 'st' : ones === 2 ? 'nd' : ones === 3 ? 'rd' : 'th'}`
}

function nthOf(date: string) {
  return Math.floor((parseDate(date).getDate() - 1) / 7) + 1
}

/** Whether date is its weekday's last in the month (the last Tuesday). */
function isLastOfMonth(date: string) {
  const d = parseDate(date)
  return (
    new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7).getMonth() !==
    d.getMonth()
  )
}

function list(names: Array<string>) {
  if (names.length <= 1) return names.join('')
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

/** "Every second Tuesday", "Every 2 weeks on Monday and Wednesday". */
export function describeRepeat(r: Repeat, date: string) {
  const every = (unit: string, units: string) =>
    r.interval === 1 ? `Every ${unit}` : `Every ${r.interval} ${units}`
  const d = parseDate(date)
  switch (r.freq) {
    case 'daily':
      return every('day', 'days')
    case 'weekly': {
      const days = r.weekdays.length > 0 ? r.weekdays : [weekdayOf(date)]
      const weekdaysOnly =
        days.length === 5 && SCHOOL_WEEK.every((x) => days.includes(x))
      if (weekdaysOnly && r.interval === 1)
        return 'Every weekday (Monday to Friday)'
      const ordered = WEEKDAYS.filter((x) => days.includes(x))
      return `${every('week', 'weeks')} on ${list(ordered.map((x) => weekdayName(x)))}`
    }
    case 'monthly': {
      const on =
        r.monthly_by === 'day'
          ? `the ${ordinal(d.getDate())}`
          : r.monthly_by === 'last'
            ? `the last ${weekdayName(weekdayOf(date))}`
            : `the ${NTH[nthOf(date) - 1]} ${weekdayName(weekdayOf(date))}`
      return `${every('month', 'months')} on ${on}`
    }
    case 'yearly':
      return `${every('year', 'years')} on ${d.toLocaleDateString(undefined, { month: 'long', day: 'numeric' })}`
  }
}

export type RepeatPreset = { key: string; label: string; repeat: Repeat | null }

/**
 * The repeat choices for an event on date, worded for that date: "Every
 * week on Tuesday", "Every month on the second Tuesday"… Custom is last.
 */
export function repeatPresets(date: string): Array<RepeatPreset> {
  const wd = weekdayOf(date)
  const nth = nthOf(date)
  const make = (key: string, repeat: Repeat | null): RepeatPreset => ({
    key,
    repeat,
    label: repeat ? describeRepeat(repeat, date) : 'Doesn’t repeat',
  })
  const presets = [
    make('none', null),
    make('daily', { freq: 'daily', interval: 1, weekdays: [], monthly_by: '' }),
    make('weekdays', {
      freq: 'weekly',
      interval: 1,
      weekdays: [...SCHOOL_WEEK],
      monthly_by: '',
    }),
    make('weekly', {
      freq: 'weekly',
      interval: 1,
      weekdays: [wd],
      monthly_by: '',
    }),
    make('biweekly', {
      freq: 'weekly',
      interval: 2,
      weekdays: [wd],
      monthly_by: '',
    }),
    make('monthly-day', {
      freq: 'monthly',
      interval: 1,
      weekdays: [],
      monthly_by: 'day',
    }),
  ]
  if (nth <= 4) {
    presets.push(
      make('monthly-nth', {
        freq: 'monthly',
        interval: 1,
        weekdays: [],
        monthly_by: 'nth',
      }),
    )
  }
  if (isLastOfMonth(date)) {
    presets.push(
      make('monthly-last', {
        freq: 'monthly',
        interval: 1,
        weekdays: [],
        monthly_by: 'last',
      }),
    )
  }
  presets.push(
    make('yearly', {
      freq: 'yearly',
      interval: 1,
      weekdays: [],
      monthly_by: '',
    }),
  )
  return presets
}

/** Whether two repeats are the same (an empty weekly list is date's weekday). */
export function sameRepeat(a: Repeat | null, b: Repeat | null, date: string) {
  if (!a || !b) return a === b
  const days = (r: Repeat) =>
    r.freq === 'weekly'
      ? WEEKDAYS.filter((x) =>
          (r.weekdays.length > 0 ? r.weekdays : [weekdayOf(date)]).includes(x),
        ).join()
      : ''
  return (
    a.freq === b.freq &&
    a.interval === b.interval &&
    days(a) === days(b) &&
    (a.freq !== 'monthly' || a.monthly_by === b.monthly_by)
  )
}

/** Whether a series has more than one date a week (so "this week" means something). */
export function repeatsWithinAWeek(r: Repeat | null) {
  return (
    !!r &&
    ((r.freq === 'daily' && r.interval < 7) ||
      (r.freq === 'weekly' && r.interval === 1 && r.weekdays.length > 1))
  )
}

/** The reminder emails an event can have. `timed`: not for all-day events. */
export const REMINDERS: Array<{
  value: Reminder
  label: string
  timed: boolean
}> = [
  { value: 'day', label: '1 day before', timed: false },
  { value: 'morning', label: 'Morning of (7 AM)', timed: false },
  { value: 'hour', label: '1 hour before', timed: true },
  { value: 'ten_min', label: '10 min before', timed: true },
]

/** Whether an all-day event can't have this reminder (no start time). */
export function timedOnly(r: Reminder) {
  return REMINDERS.some((x) => x.value === r && x.timed)
}
