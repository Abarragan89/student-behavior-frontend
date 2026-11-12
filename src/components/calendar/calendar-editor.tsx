import { useEffect, useMemo, useState } from 'react'
import { Link } from '@tanstack/react-router'
import {
  keepPreviousData,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query'
import {
  CalendarOff,
  CircleAlert,
  FileUp,
  Globe,
  Plus,
  RefreshCw,
  UserCog,
  UsersRound,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'
import { Agenda } from '#/components/calendar/agenda'
import { BreaksDialog } from '#/components/calendar/breaks-dialog'
import {
  CategoriesDialog,
  CategoryLegend,
} from '#/components/calendar/categories'
import { resolveRange, useLegend } from '#/components/calendar/calendar-prefs'
import type {
  CalendarPrefs,
  CalendarView,
  Picked,
} from '#/components/calendar/calendar-prefs'
import { CalendarToolbar } from '#/components/calendar/calendar-toolbar'
import { EditorsDialog } from '#/components/calendar/editors-dialog'
import { EventDialog } from '#/components/calendar/event-form'
import type { EventFormMode } from '#/components/calendar/event-form'
import { EventSheet } from '#/components/calendar/event-sheet'
import { CalendarImportDialog } from '#/components/calendar/import-dialog'
import { MonthGrid } from '#/components/calendar/month-grid'
import { PrintCalendar } from '#/components/calendar/print-calendar'
import { WeekGrid } from '#/components/calendar/week-grid'
import { WeekNote } from '#/components/calendar/week-note'
import { ResponsiveDialog } from '#/components/responsive-dialogue'
import { ApiError } from '#/lib/api'
import { meQueryOptions } from '#/lib/auth'
import { formatMonth, monthOf, weekStart } from '#/lib/calendar'
import { addDays, formatLongDate, timeZoneLabel } from '#/lib/day'
import { localDate, timeZone } from '#/lib/marks'
import { mineMatcher } from '#/lib/month-layout'
import { useEnsureSchoolTimezone } from '#/lib/school'
import { calendarQueryOptions, weekNoteOf } from '#/lib/school-calendar'
import type { Occurrence } from '#/lib/school-calendar'
import { staffQueryOptions } from '#/lib/staff'

// A stable empty list while the calendar loads.
const NONE: Array<never> = []

/**
 * The school calendar you can change: events for staff (one-time or
 * repeating), school breaks, categories, imports and email reminders; a
 * month grid, a week, or a list (the default on phones). For a school's
 * administrators (their Calendar tab) and teachers an administrator let
 * edit it (their School page). Only administrators get "Who can edit" and
 * the Staff link.
 *
 * Printing gives only the calendar: the screen part is print:hidden and
 * the paper version sits beside it, so the page must not hide this whole
 * component when printing.
 */
export function CalendarEditor({
  picked,
  onPick,
  prefs,
  heading,
}: {
  /** ?month= and ?week=; neither for now. */
  picked: Picked
  onPick: (next: Picked) => void
  prefs: CalendarPrefs
  /** h1 on the administrator's Calendar page, h2 on a School page. */
  heading: 'h1' | 'h2'
}) {
  const { data: me } = useSuspenseQuery(meQueryOptions)
  const queryClient = useQueryClient()
  useEnsureSchoolTimezone()
  const { view, focus } = prefs
  const { month, week, days, from, to } = resolveRange(
    picked,
    view,
    localDate(),
  )
  const calendar = useQuery({
    ...calendarQueryOptions(days[0], days[41]),
    placeholderData: keepPreviousData,
  })
  const staff = useQuery(staffQueryOptions)
  const [open, setOpen] = useState<Occurrence | null>(null)
  const [editor, setEditor] = useState<EventFormMode | null>(null)
  const [breaksOpen, setBreaksOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [categoriesOpen, setCategoriesOpen] = useState(false)
  const [editorsOpen, setEditorsOpen] = useState(false)
  const [day, setDay] = useState<string | null>(null)
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

  // An administrator turned your editing off: `me` comes back without it,
  // and the School page shows the calendar read only.
  const refused =
    calendar.error instanceof ApiError && calendar.error.status === 403
  useEffect(() => {
    if (refused)
      void queryClient.invalidateQueries({ queryKey: meQueryOptions.queryKey })
  }, [refused, queryClient])

  if (!me?.school) return null
  const isAdmin = me.school.role === 'admin'
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
  const newEvent = (date: string) =>
    setEditor({ kind: 'new', date: date < today ? today : date })
  // "New event" starts on today when it's in view, else the first day shown.
  const startAt =
    view === 'week'
      ? today >= week && today <= addDays(week, 6)
        ? today
        : week
      : monthOf(today) === month
        ? today
        : `${month}-01`
  // An administrator's page sets the time zone itself (useEnsureSchoolTimezone).
  const notSetUp =
    calendar.error instanceof ApiError &&
    calendar.error.reason === 'no_timezone'
  const Heading = heading

  return (
    <>
      <div className="flex flex-col gap-4 print:hidden">
        <div
          className={cn(
            'flex flex-wrap items-center justify-between gap-3',
            // Clear of the floating avatar on phones, at the top of a page.
            heading === 'h1' && 'max-md:pr-12',
          )}
        >
          <div className="flex items-center gap-2">
            <Heading
              className={cn(
                'font-bold',
                heading === 'h1' ? 'text-2xl' : 'text-xl',
              )}
            >
              Calendar
            </Heading>
            {!isAdmin && <Badge variant="secondary">You can edit</Badge>}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setImportOpen(true)}
              disabled={!cal || !staff.data}
              className="h-10 rounded-lg border-2 px-3 font-bold"
            >
              <FileUp />
              <span className="max-sm:sr-only">Import</span>
            </Button>
            <Button
              variant="outline"
              onClick={() => setBreaksOpen(true)}
              className="h-10 rounded-lg border-2 px-3 font-bold"
            >
              <CalendarOff />
              <span className="max-sm:sr-only">School breaks</span>
            </Button>
            {isAdmin && (
              <Button
                variant="outline"
                onClick={() => setEditorsOpen(true)}
                className="h-10 rounded-lg border-2 px-3 font-bold"
              >
                <UserCog />
                <span className="max-sm:sr-only">Who can edit</span>
              </Button>
            )}
            <Button
              onClick={() => newEvent(startAt)}
              disabled={!cal}
              className="h-10 rounded-lg px-3 font-bold"
            >
              <Plus />
              New event
            </Button>
          </div>
        </div>

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
        {isAdmin && staff.data && staff.data.people.length <= 1 && (
          <Link
            to="/staff"
            className="flex items-center gap-3 rounded-lg border-2 border-dashed border-border px-4 py-3 text-sm font-bold hover:bg-muted"
          >
            <UsersRound className="size-5 shrink-0" />
            Add your staff to invite them to events and send them reminders.
          </Link>
        )}
        {cal && (
          <CategoryLegend
            categories={categories}
            counts={counts}
            mineCount={mineCount}
            focus={focus}
            onFocusChange={prefs.setFocus}
            onEdit={() => setCategoriesOpen(true)}
          />
        )}

        {!cal ? (
          notSetUp && !isAdmin ? (
            <p className="rounded-xl border-2 border-dashed border-border px-4 py-8 text-center text-muted-foreground">
              Your school’s calendar isn’t set up yet. It’s ready once an
              administrator opens it.
            </p>
          ) : notSetUp || calendar.isPending ? (
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
            onAdd={newEvent}
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
              onAdd={newEvent}
              onOpen={setOpen}
              onDay={setDay}
            />
            <WeekNote
              key={week}
              week={week}
              text={weekNote}
              today={today}
              canEdit
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

        <EventSheet
          occurrence={open}
          onClose={() => setOpen(null)}
          onEdit={(event, date) => {
            setOpen(null)
            setEditor({ kind: 'edit', event, date })
          }}
          directory={staff.data}
          categories={categories}
          emailsOn={cal?.emails ?? false}
        />
        {staff.data && (
          <EventDialog
            mode={editor}
            onClose={() => setEditor(null)}
            directory={staff.data}
            categories={categories}
            today={today}
            emailsOn={cal?.emails ?? true}
          />
        )}
        <CategoriesDialog
          open={categoriesOpen}
          onOpenChange={setCategoriesOpen}
          categories={categories}
        />
        <BreaksDialog
          open={breaksOpen}
          onOpenChange={setBreaksOpen}
          today={today}
        />
        {isAdmin && (
          <EditorsDialog open={editorsOpen} onOpenChange={setEditorsOpen} />
        )}
        {cal && staff.data && (
          <CalendarImportDialog
            open={importOpen}
            onOpenChange={setImportOpen}
            directory={staff.data}
            schoolTz={cal.timezone}
            today={cal.today}
            yourEmail={me.teacher.email}
            eventsLeft={cal.events_left}
            emailsOn={cal.emails}
            categories={categories}
          />
        )}
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
