import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { cn } from '@/lib/utils'
import { CalendarEditor } from '#/components/calendar/calendar-editor'
import {
  readView,
  resolveRange,
  useCalendarPrefs,
} from '#/components/calendar/calendar-prefs'
import type { Picked } from '#/components/calendar/calendar-prefs'
import { meQueryOptions } from '#/lib/auth'
import type { Me } from '#/lib/auth'
import { isMonthString } from '#/lib/calendar'
import { isDateString } from '#/lib/day'
import { localDate } from '#/lib/marks'
import { calendarQueryOptions } from '#/lib/school-calendar'
import { staffQueryOptions } from '#/lib/staff'
import { isSchoolAdmin } from '#/lib/workspace'

// /calendar: a school administrator's calendar (CalendarEditor). Teachers
// see theirs on their School page (Account → School). ?month=YYYY-MM picks
// the month, ?week=YYYY-MM-DD the week.
export const Route = createFileRoute('/_authed/calendar')({
  staticData: { schoolAdmin: true },
  validateSearch: (search: Record<string, unknown>): Picked => ({
    month: isMonthString(search.month) ? search.month : undefined,
    week: isDateString(search.week) ? search.week : undefined,
  }),
  loaderDeps: ({ search }) => ({ month: search.month, week: search.week }),
  loader: ({ context: { queryClient }, deps }) => {
    const me = queryClient.getQueryData<Me | null>(meQueryOptions.queryKey)
    if (me !== undefined && !isSchoolAdmin(me)) return
    const { days } = resolveRange(deps, readView(), localDate())
    void queryClient
      .query(calendarQueryOptions(days[0], days[41]))
      .catch(() => null)
    void queryClient.query(staffQueryOptions).catch(() => null)
  },
  component: CalendarPage,
})

function CalendarPage() {
  const picked = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const prefs = useCalendarPrefs()
  return (
    <main
      className={cn(
        'mx-auto flex w-full flex-1 flex-col gap-4 px-4 py-8 sm:py-10 print:max-w-none print:p-0',
        prefs.view === 'agenda' ? 'max-w-5xl' : 'max-w-7xl',
      )}
    >
      <CalendarEditor
        picked={picked}
        onPick={(next) => void navigate({ search: next, replace: true })}
        prefs={prefs}
        heading="h1"
      />
    </main>
  )
}
