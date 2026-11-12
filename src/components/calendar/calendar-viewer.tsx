import { useMemo, useState } from 'react'
import {
  keepPreviousData,
  useQuery,
  useSuspenseQuery,
} from '@tanstack/react-query'
import { CircleAlert, Globe, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'
import { Agenda } from '#/components/calendar/agenda'
import { CategoryLegend } from '#/components/calendar/categories'
import { resolveRange, useLegend } from '#/components/calendar/calendar-prefs'
import type {
  CalendarPrefs,
  CalendarView,
  Picked,
} from '#/components/calendar/calendar-prefs'
import { CalendarToolbar } from '#/components/calendar/calendar-toolbar'
import { MonthGrid } from '#/components/calendar/month-grid'
import { OccurrenceSheet } from '#/components/calendar/occurrence-sheet'
import { PrintCalendar } from '#/components/calendar/print-calendar'
import { WeekGrid } from '#/components/calendar/week-grid'
import { WeekNote } from '#/components/calendar/week-note'
import { ResponsiveDialog } from '#/components/responsive-dialogue'
import { ApiError } from '#/lib/api'
import { meQueryOptions } from '#/lib/auth'
import { formatMonth, monthOf, weekStart } from '#/lib/calendar'
import { formatLongDate, timeZoneLabel } from '#/lib/day'
import { localDate, timeZone } from '#/lib/marks'
import { mineMatcher } from '#/lib/month-layout'
import { staffCalendarQueryOptions, weekNoteOf } from '#/lib/school-calendar'
import type { Occurrence } from '#/lib/school-calendar'

// A stable empty list while the calendar loads.
const NONE: Array<never> = []

/**
 * A teacher's view of their school's calendar, read only: the events
 * they're invited to, and the categories the administrators share with
 * staff (the color-coded spreadsheet everyone used to look at). On the
 * teacher's School page: a month, a week, or a list.
 *
 * Printing gives only the calendar: the screen part is print:hidden and
 * the paper version sits beside it.
 */
export function CalendarViewer({
  picked,
  onPick,
  prefs,
}: {
  /** ?month= and ?week=; neither for now. */
  picked: Picked
  onPick: (next: Picked) => void
  prefs: CalendarPrefs
}) {
  const { data: me } = useSuspenseQuery(meQueryOptions)
  const { view, focus } = prefs
  const { month, week, days, from, to } = resolveRange(
    picked,
    view,
    localDate(),
  )
  const calendar = useQuery({
    ...staffCalendarQueryOptions(days[0], days[41]),
    placeholderData: keepPreviousData,
    enabled: !!me?.school,
  })
  const name = me?.teacher.name
  const isMine = useMemo(() => mineMatcher(name), [name])
  const categories = calendar.data?.categories ?? NONE
  const occurrences = calendar.data?.occurrences ?? NONE
  const { counts, mineCount, highlight } = useLegend({
    occurrences,
    categories,
    focus,
    from,
    to,
    isMine,
  })
  const [open, setOpen] = useState<Occurrence | null>(null)
  const [day, setDay] = useState<string | null>(null)

  if (!me?.school) return null
  const cal = calendar.data
  const today = cal?.today ?? localDate()
  const weekNote = weekNoteOf(cal?.week_notes ?? [], week)
  const thisMonth = monthOf(today)
  const thisWeek = weekStart(today)
  const goMonth = (m: string) => onPick(m === thisMonth ? {} : { month: m })
  const goWeek = (w: string) => onPick(w === thisWeek ? {} : { week: w })
  // Switching views keeps the place: the week's month, or the month's week.
  const changeView = (v: CalendarView) => {
    prefs.setView(v)
    if (v === 'week') goWeek(week)
    else goMonth(month)
  }
  const notSetUp =
    calendar.error instanceof ApiError &&
    calendar.error.reason === 'no_timezone'

  return (
    <>
      <div className="flex flex-col gap-4 print:hidden">
        <h2 className="text-xl font-bold">Calendar</h2>

        <CalendarToolbar
          month={month}
          thisMonth={thisMonth}
          onMonth={goMonth}
          week={week}
          thisWeek={thisWeek}
          onWeek={goWeek}
          view={view}
          onView={changeView}
        />

        {cal && cal.timezone !== timeZone() && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Globe className="size-4 shrink-0" />
            Times are your school’s: {timeZoneLabel(today, cal.timezone)}.
          </p>
        )}
        {cal && (
          <CategoryLegend
            categories={categories}
            counts={counts}
            mineCount={mineCount}
            focus={focus}
            onFocusChange={prefs.setFocus}
          />
        )}
        {cal && cal.categories.length === 0 && (
          <p className="text-sm text-muted-foreground">
            You see the events you’re invited to. Your school can share more
            with staff, like breaks, testing days and field trips.
          </p>
        )}

        {!cal ? (
          notSetUp ? (
            <p className="rounded-xl border-2 border-dashed border-border px-4 py-8 text-center text-muted-foreground">
              Your school’s calendar isn’t set up yet.
            </p>
          ) : calendar.isPending ? (
            <p
              role="status"
              className="flex items-center gap-2 font-medium text-muted-foreground"
            >
              <Spinner aria-hidden className="size-5" />
              Loading the calendar…
            </p>
          ) : (
            <div role="alert" className="flex flex-col items-start gap-3">
              <p className="flex items-center gap-2 font-medium">
                <CircleAlert className="size-5 shrink-0 text-destructive" />
                Couldn’t load the calendar.
              </p>
              <Button
                variant="outline"
                onClick={() => void calendar.refetch()}
                disabled={calendar.isFetching}
                className="h-10 rounded-lg border-2 font-bold"
              >
                <RefreshCw
                  className={cn(calendar.isFetching && 'animate-spin')}
                />
                Try again
              </Button>
            </div>
          )
        ) : view === 'month' ? (
          <MonthGrid
            month={month}
            today={today}
            occurrences={occurrences}
            breaks={cal.breaks}
            categories={categories}
            highlight={highlight}
            loading={calendar.isPlaceholderData}
            onOpen={setOpen}
            onDay={setDay}
          />
        ) : view === 'week' ? (
          <>
            <WeekGrid
              week={week}
              today={today}
              occurrences={occurrences}
              breaks={cal.breaks}
              categories={categories}
              highlight={highlight}
              loading={calendar.isPlaceholderData}
              onOpen={setOpen}
              onDay={setDay}
            />
            <WeekNote
              key={week}
              week={week}
              text={weekNote}
              today={today}
              loading={calendar.isPlaceholderData}
            />
          </>
        ) : (
          <Agenda
            occurrences={occurrences.filter((o) => monthOf(o.date) === month)}
            highlight={highlight}
            breaks={cal.breaks}
            categories={categories}
            emptyText={`Nothing on the calendar in ${formatMonth(month)}.`}
            onOpen={setOpen}
          />
        )}

        <OccurrenceSheet
          occurrence={open}
          categories={categories}
          onClose={() => setOpen(null)}
        />
        <ResponsiveDialog
          isOpen={day !== null}
          setIsOpen={(o: boolean) => !o && setDay(null)}
          title={day ? formatLongDate(day) : ''}
        >
          {day && cal && (
            <Agenda
              occurrences={occurrences.filter((o) => o.date === day)}
              highlight={highlight}
              breaks={cal.breaks}
              categories={categories}
              emptyText="Nothing this day."
              onOpen={(o) => {
                setDay(null)
                setOpen(o)
              }}
            />
          )}
        </ResponsiveDialog>
      </div>
      {cal && (
        <PrintCalendar
          school={me.school.name}
          view={view}
          month={month}
          week={week}
          weekNote={weekNote}
          today={today}
          // While legend chips are picked, only what they cover goes on paper.
          occurrences={occurrences.filter(
            (o) => days.includes(o.date) && (!highlight || highlight(o)),
          )}
          breaks={cal.breaks}
          categories={categories}
        />
      )}
    </>
  )
}
