import { useEffect } from 'react'
import { cn } from '@/lib/utils'
import { listDays } from '#/components/calendar/agenda'
import type { CalendarView } from '#/components/calendar/calendar-prefs'
import { MonthGrid, breakOn } from '#/components/calendar/month-grid'
import { WeekGrid } from '#/components/calendar/week-grid'
import { PrintWeekNote } from '#/components/calendar/week-note'
import {
  formatClockRange,
  formatDayRange,
  formatMonth,
  formatWeekRange,
  monthOf,
} from '#/lib/calendar'
import {
  NO_CATEGORY_COLOR,
  categoryStyle,
  printChip,
} from '#/lib/category-colors'
import { formatLongDate } from '#/lib/day'
import { isSpan } from '#/lib/event-span'
import type {
  EventCategory,
  Occurrence,
  SchoolBreak,
} from '#/lib/school-calendar'

/**
 * The calendar on paper, by the view on screen:
 * - Month (landscape): the grid (up to six lines a day, then "+2 more,
 *   see list"), and on the next page every event of the month as a list,
 *   in three columns, titles in full. Printed two-sided, the list is on
 *   the back.
 * - Week (portrait): the week, every event in full, then the week's
 *   message: the weekly notes staff get. A page breaks only between the
 *   two rows of days or before the message.
 * - List (landscape): the month's list alone.
 * On the page all the time but only shown when printing (`print:block`),
 * like the lesson plan's, so a plain Ctrl+P prints it too. While legend
 * chips are picked, the page passes only the events they cover.
 */
export function PrintCalendar({
  school,
  view,
  month,
  week,
  weekNote,
  today,
  occurrences,
  breaks,
  categories,
}: {
  school: string
  view: CalendarView
  month: string
  /** The week's Monday. */
  week: string
  /** The week's message; '' for none ("Have a great week!"). */
  weekNote: string
  today: string
  occurrences: Array<Occurrence>
  breaks: Array<SchoolBreak>
  categories: Array<EventCategory>
}) {
  const weekly = view === 'week'
  const heading = weekly ? formatWeekRange(week) : formatMonth(month)
  // The saved PDF is named after the page title.
  const title = `${school} – ${heading}`
  useEffect(() => {
    let saved: string | null = null
    const before = () => {
      saved ??= document.title
      document.title = title
    }
    const after = () => {
      if (saved !== null) document.title = saved
      saved = null
    }
    window.addEventListener('beforeprint', before)
    window.addEventListener('afterprint', after)
    return () => {
      window.removeEventListener('beforeprint', before)
      window.removeEventListener('afterprint', after)
      after()
    }
  }, [title])

  // The page's size (styles.css): portrait for a week, landscape for the
  // rest, named on the root while the calendar is on the page.
  const page = weekly ? 'calendar-print-week' : 'calendar-print-page'
  useEffect(() => {
    document.documentElement.classList.add(page)
    return () => document.documentElement.classList.remove(page)
  }, [page])

  const used = new Set(occurrences.map((o) => o.category_id))
  const legend = categories.filter((c) => used.has(c.id))
  const inMonth = occurrences.filter((o) => monthOf(o.date) === month)
  const list = (
    <PrintList
      days={listDays(inMonth)}
      breaks={breaks}
      categories={categories}
      emptyText={`Nothing on the calendar in ${formatMonth(month)}.`}
    />
  )
  return (
    <section className="calendar-print hidden bg-white text-black [-webkit-print-color-adjust:exact] [print-color-adjust:exact] print:block">
      <Top
        heading={heading}
        note={view === 'agenda' ? 'every event' : undefined}
        school={school}
        logo={weekly ? 'week' : 'month'}
        legend={legend}
      />
      {view === 'month' && (
        <MonthGrid
          variant="print"
          month={month}
          today={today}
          occurrences={occurrences}
          breaks={breaks}
          categories={categories}
        />
      )}
      {weekly && (
        <WeekGrid
          variant="print"
          week={week}
          today={today}
          occurrences={occurrences}
          breaks={breaks}
          categories={categories}
        />
      )}
      {weekly && <PrintWeekNote text={weekNote} />}
      {view === 'agenda' && list}
      {view === 'month' && inMonth.length > 0 && (
        <div className="break-before-page">
          <Top
            heading={heading}
            note="every event"
            school={school}
            logo="month"
            legend={legend}
          />
          {list}
        </div>
      )}
    </section>
  )
}

/**
 * The school's logo, top right of every printed page (week, month and
 * list), from public/school-logos. For now it's this one for every school;
 * it'll come from the school's profile.
 *
 * Every logo gets the same box (LOGO_BOX): 0.9in tall on the week, 0.75in
 * on the landscape month and list pages, up to 2.5in wide, and is scaled to fit whole against its
 * right edge (object-contain): a round or square logo prints that tall, a
 * wide one up to 2.5in wide and shorter. For a sharp print, a logo should
 * be at least 270 px tall (300 dpi at 0.9in; vcalogo.png is 378 × 355), on
 * a transparent or white background with little empty margin around it.
 */
const SCHOOL_LOGO = '/school-logos/vcalogo.png'
/**
 * The logo's height: a little smaller on the month and its list
 * ("month"), which have more to fit.
 */
const LOGO_BOX = { week: 'h-[0.9in]', month: 'h-[0.75in]' } as const

/**
 * A page's heading, the categories in use and the school's logo (the
 * school's name is its alt text).
 */
function Top({
  heading,
  note,
  school,
  logo,
  legend,
}: {
  heading: string
  note?: string
  school: string
  /** The logo's size: the week's, or the month's and list's. */
  logo: keyof typeof LOGO_BOX
  legend: Array<EventCategory>
}) {
  return (
    // Never alone at the bottom of a page.
    <div className="mb-1.5 flex break-after-avoid items-start justify-between gap-4">
      <div className="min-w-0">
        {/* The biggest text on the page, above the days' numbers. */}
        <h1 className="mb-2 text-3xl leading-tight font-bold">
          {heading}
          {note && (
            <span className="font-medium text-neutral-600"> · {note}</span>
          )}
        </h1>
        <Legend legend={legend} />
      </div>
      <img
        src={SCHOOL_LOGO}
        alt={school}
        className={cn(
          LOGO_BOX[logo],
          'w-auto max-w-[2.5in] shrink-0 object-contain object-right',
        )}
      />
    </div>
  )
}

/** The categories in use, as chips. */
function Legend({ legend }: { legend: Array<EventCategory> }) {
  if (legend.length === 0) return null
  return (
    <ul className="mb-1.5 flex flex-wrap gap-1 text-[0.6875rem] font-semibold">
      {legend.map((c) => (
        <li key={c.id} className={`rounded-sm px-1.5 ${printChip(c.color)}`}>
          {c.name}
        </li>
      ))}
    </ul>
  )
}

/**
 * Every event, day by day, in three columns: a dot in its category's
 * color, its time, its title in full, its dates when it spans days, and
 * its place. A day's events stay together unless there are many.
 */
function PrintList({
  days,
  breaks,
  categories,
  emptyText,
}: {
  days: Array<{ date: string; events: Array<Occurrence> }>
  breaks: Array<SchoolBreak>
  categories: Array<EventCategory>
  emptyText: string
}) {
  const byId = new Map(categories.map((c) => [c.id, c]))
  if (days.length === 0) return <p className="text-sm">{emptyText}</p>
  return (
    <div className="columns-3 gap-x-6 text-[0.6875rem] leading-4">
      {days.map(({ date, events }) => {
        const off = breakOn(date, breaks)
        return (
          <section
            key={date}
            className={cn('mb-2', events.length <= 6 && 'break-inside-avoid')}
          >
            <h2 className="mb-0.5 border-b border-neutral-400 font-bold break-after-avoid">
              {formatLongDate(date)}
              {off && (
                <span className="font-medium text-neutral-600">
                  {' '}
                  · {off.name}
                </span>
              )}
            </h2>
            <ul>
              {events.map((o) => {
                const c = o.category_id ? byId.get(o.category_id) : undefined
                return (
                  <li
                    key={`${o.event_id}:${o.date}`}
                    className="flex gap-1.5 py-px break-inside-avoid"
                  >
                    <span
                      aria-hidden
                      className={cn(
                        'mt-1.5 size-2 shrink-0 rounded-full',
                        categoryStyle(c?.color ?? NO_CATEGORY_COLOR).dot,
                      )}
                    />
                    <span className="w-[5.25rem] shrink-0 font-semibold tabular-nums">
                      {o.all_day || !o.start
                        ? 'All day'
                        : formatClockRange(o.start, o.end)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="font-bold">{o.title}</span>
                      {isSpan(o) && (
                        <span className="text-neutral-700">
                          {' '}
                          · {formatDayRange(o.first_day, o.last_day)}
                        </span>
                      )}
                      {o.location && (
                        <span className="text-neutral-700">
                          {' '}
                          · {o.location}
                        </span>
                      )}
                    </span>
                  </li>
                )
              })}
            </ul>
          </section>
        )
      })}
    </div>
  )
}
