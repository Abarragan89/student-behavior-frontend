import { useState } from 'react'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import {
  keepPreviousData,
  useQuery,
  useSuspenseQuery,
} from '@tanstack/react-query'
import {
  CalendarOff,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  FileUp,
  Globe,
  Plus,
  RefreshCw,
  UsersRound,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import { Agenda } from '#/components/calendar/agenda'
import { BreaksDialog } from '#/components/calendar/breaks-dialog'
import { EventDialog } from '#/components/calendar/event-form'
import type { EventFormMode } from '#/components/calendar/event-form'
import { EventSheet } from '#/components/calendar/event-sheet'
import { CalendarImportDialog } from '#/components/calendar/import-dialog'
import { MonthGrid } from '#/components/calendar/month-grid'
import { ResponsiveDialog } from '#/components/responsive-dialogue'
import { ApiError } from '#/lib/api'
import { meQueryOptions } from '#/lib/auth'
import type { Me } from '#/lib/auth'
import {
  addMonths,
  formatMonth,
  isMonthString,
  monthGrid,
  monthOf,
} from '#/lib/calendar'
import { formatLongDate, timeZoneLabel } from '#/lib/day'
import { localDate, timeZone } from '#/lib/marks'
import { useEnsureSchoolTimezone } from '#/lib/school'
import { calendarQueryOptions } from '#/lib/school-calendar'
import type { Occurrence } from '#/lib/school-calendar'
import { staffQueryOptions } from '#/lib/staff'
import { isSchoolAdmin } from '#/lib/workspace'

// /calendar: a school administrator's calendar. Events for staff (one-time
// or repeating), school breaks, and email reminders; a month grid, or a list
// on phones. ?month=YYYY-MM picks the month.
export const Route = createFileRoute('/_authed/calendar')({
  staticData: { schoolAdmin: true },
  validateSearch: (search: Record<string, unknown>): { month?: string } => ({
    month: isMonthString(search.month) ? search.month : undefined,
  }),
  loaderDeps: ({ search }) => ({ month: search.month }),
  loader: ({ context: { queryClient }, deps }) => {
    const me = queryClient.getQueryData<Me | null>(meQueryOptions.queryKey)
    if (me !== undefined && !isSchoolAdmin(me)) return
    const days = monthGrid(deps.month ?? monthOf(localDate()))
    void queryClient
      .query(calendarQueryOptions(days[0], days[41]))
      .catch(() => null)
    void queryClient.query(staffQueryOptions).catch(() => null)
  },
  component: CalendarPage,
})

type View = 'month' | 'agenda'
const VIEW_KEY = 'tff:calendar-view'

function readView(): View {
  try {
    const saved = localStorage.getItem(VIEW_KEY)
    if (saved === 'month' || saved === 'agenda') return saved
  } catch {
    // Storage off: decide by screen size.
  }
  return window.matchMedia('(min-width: 768px)').matches ? 'month' : 'agenda'
}

const tabsListClass =
  'gap-0.5 rounded-lg border-2 border-border bg-card p-0.5 group-data-horizontal/tabs:h-10'
const tabClass = cn(
  'rounded-md px-3 text-sm font-bold text-foreground transition-colors not-data-active:hover:bg-muted focus-visible:ring-4 focus-visible:ring-ring focus-visible:outline-none motion-reduce:transition-none sm:text-base dark:text-foreground',
  'data-active:bg-primary data-active:text-primary-foreground dark:data-active:bg-primary dark:data-active:text-primary-foreground',
)

function CalendarPage() {
  const { month: picked } = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const { data: me } = useSuspenseQuery(meQueryOptions)
  useEnsureSchoolTimezone()
  const month = picked ?? monthOf(localDate())
  const days = monthGrid(month)
  const calendar = useQuery({
    ...calendarQueryOptions(days[0], days[41]),
    placeholderData: keepPreviousData,
  })
  const staff = useQuery(staffQueryOptions)
  const [view, setView] = useState<View>(readView)
  const [open, setOpen] = useState<Occurrence | null>(null)
  const [editor, setEditor] = useState<EventFormMode | null>(null)
  const [breaksOpen, setBreaksOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [day, setDay] = useState<string | null>(null)

  if (!me?.school) return null
  const cal = calendar.data
  const today = cal?.today ?? localDate()
  const thisMonth = monthOf(today)
  const goTo = (m: string) =>
    void navigate({
      search: { month: m === thisMonth ? undefined : m },
      replace: true,
    })
  const chooseView = (v: View) => {
    setView(v)
    try {
      localStorage.setItem(VIEW_KEY, v)
    } catch {
      // Remembered for this visit only.
    }
  }
  const newEvent = (date: string) =>
    setEditor({ kind: 'new', date: date < today ? today : date })
  const settingUp =
    calendar.error instanceof ApiError &&
    calendar.error.reason === 'no_timezone'

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 px-4 py-8 sm:py-10">
      <div className="flex flex-wrap items-center justify-between gap-3 max-md:pr-12">
        <h1 className="text-2xl font-bold">Calendar</h1>
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
          <Button
            onClick={() =>
              newEvent(monthOf(today) === month ? today : `${month}-01`)
            }
            disabled={!cal}
            className="h-10 rounded-lg px-3 font-bold"
          >
            <Plus />
            New event
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <h2 className="mr-auto text-xl font-bold" aria-live="polite">
          {formatMonth(month)}
        </h2>
        {month !== thisMonth && (
          <Button
            variant="link"
            onClick={() => goTo(thisMonth)}
            className="px-1 text-base font-bold"
          >
            Today
          </Button>
        )}
        <Button
          variant="outline"
          size="icon"
          aria-label="Previous month"
          onClick={() => goTo(addMonths(month, -1))}
          className="size-10 rounded-lg border-2 border-border bg-card"
        >
          <ChevronLeft className="size-5" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          aria-label="Next month"
          onClick={() => goTo(addMonths(month, 1))}
          className="size-10 rounded-lg border-2 border-border bg-card"
        >
          <ChevronRight className="size-5" />
        </Button>
        <Tabs value={view} onValueChange={(v: View) => chooseView(v)}>
          <TabsList aria-label="View" className={tabsListClass}>
            <TabsTrigger value="month" className={tabClass}>
              Month
            </TabsTrigger>
            <TabsTrigger value="agenda" className={tabClass}>
              List
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {cal && cal.timezone !== timeZone() && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Globe className="size-4 shrink-0" />
          Times are your school’s: {timeZoneLabel(today, cal.timezone)}.
        </p>
      )}
      {staff.data && staff.data.people.length <= 1 && (
        <Link
          to="/staff"
          className="flex items-center gap-3 rounded-lg border-2 border-dashed border-border px-4 py-3 text-sm font-bold hover:bg-muted"
        >
          <UsersRound className="size-5 shrink-0" />
          Add your staff to invite them to events and send them reminders.
        </Link>
      )}

      {!cal ? (
        settingUp || calendar.isPending ? (
          <p
            role="status"
            className="flex items-center gap-2 font-medium text-muted-foreground"
          >
            <Spinner aria-hidden className="size-5" />
            Loading your calendar…
          </p>
        ) : (
          <div role="alert" className="flex flex-col items-start gap-3">
            <p className="flex items-center gap-2 font-medium">
              <CircleAlert className="size-5 shrink-0 text-destructive" />
              Couldn’t load your calendar.
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
          occurrences={cal.occurrences}
          breaks={cal.breaks}
          loading={calendar.isPlaceholderData}
          onAdd={newEvent}
          onOpen={setOpen}
          onDay={setDay}
        />
      ) : (
        <Agenda
          occurrences={cal.occurrences.filter((o) => monthOf(o.date) === month)}
          breaks={cal.breaks}
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
        emailsOn={cal?.emails ?? false}
      />
      {staff.data && (
        <EventDialog
          mode={editor}
          onClose={() => setEditor(null)}
          directory={staff.data}
          today={today}
          emailsOn={cal?.emails ?? true}
        />
      )}
      <BreaksDialog
        open={breaksOpen}
        onOpenChange={setBreaksOpen}
        today={today}
      />
      {cal && staff.data && (
        <CalendarImportDialog
          open={importOpen}
          onOpenChange={setImportOpen}
          directory={staff.data}
          schoolTz={cal.timezone}
          today={cal.today}
          adminEmail={me.teacher.email}
          eventsLeft={cal.events_left}
          emailsOn={cal.emails}
        />
      )}
      <ResponsiveDialog
        isOpen={day !== null}
        setIsOpen={(o: boolean) => !o && setDay(null)}
        title={day ? formatLongDate(day) : ''}
      >
        {day && cal && (
          <Agenda
            occurrences={cal.occurrences.filter((o) => o.date === day)}
            breaks={cal.breaks}
            emptyText="Nothing this day."
            onOpen={(o) => {
              setDay(null)
              setOpen(o)
            }}
          />
        )}
      </ResponsiveDialog>
    </main>
  )
}
