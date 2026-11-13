import { useEffect } from 'react'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import {
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query'
import {
  Building2,
  ChevronLeft,
  CircleAlert,
  RefreshCw,
  WifiOff,
} from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'
import { CalendarEditor } from '#/components/calendar/calendar-editor'
import {
  readView,
  resolveRange,
  useCalendarPrefs,
} from '#/components/calendar/calendar-prefs'
import type { Picked } from '#/components/calendar/calendar-prefs'
import { CalendarViewer } from '#/components/calendar/calendar-viewer'
import { SchoolAdminHub } from '#/components/school/school-admin-hub'
import { SchoolMemberView } from '#/components/school/school-member-view'
import { meQueryOptions } from '#/lib/auth'
import type { Me } from '#/lib/auth'
import { isMonthString } from '#/lib/calendar'
import { isDateString } from '#/lib/day'
import { localDate } from '#/lib/marks'
import { schoolQueryOptions, setMySchool } from '#/lib/school'
import {
  calendarQueryOptions,
  staffCalendarQueryOptions,
} from '#/lib/school-calendar'
import { staffQueryOptions } from '#/lib/staff'
import { canEditCalendar } from '#/lib/workspace'

// /account/school (Account → School, or the school's name in the avatar
// menu): your school. An administrator gets the join link, who's joined and
// the school's name (their calendar is its own tab). A teacher gets the
// school's calendar (to change it, if an administrator let them), then the
// school, what the administrators can see, and Leave. ?month=YYYY-MM picks
// the calendar's month, ?week=YYYY-MM-DD its week. Always the signed-in
// person's own school, even in a classroom they co-teach, so it declares
// no co-teacher feature. The trailing _ keeps it out of account.tsx's
// layout (like lesson-plans.$date_.present.tsx).
export const Route = createFileRoute('/_authed/account_/school')({
  validateSearch: (search: Record<string, unknown>): Picked => ({
    month: isMonthString(search.month) ? search.month : undefined,
    week: isDateString(search.week) ? search.week : undefined,
  }),
  loaderDeps: ({ search }) => ({ month: search.month, week: search.week }),
  loader: ({ context: { queryClient }, deps }) => {
    void queryClient.query(schoolQueryOptions).catch(() => null)
    const me = queryClient.getQueryData<Me | null>(meQueryOptions.queryKey)
    if (me?.school?.role !== 'teacher') return
    const { days } = resolveRange(deps, readView(), localDate())
    if (canEditCalendar(me)) {
      void queryClient
        .query(calendarQueryOptions(days[0], days[41]))
        .catch(() => null)
      void queryClient.query(staffQueryOptions).catch(() => null)
    } else {
      void queryClient
        .query(staffCalendarQueryOptions(days[0], days[41]))
        .catch(() => null)
    }
  },
  component: SchoolPage,
})

function SchoolPage() {
  // Already loaded by the login check in _authed.tsx.
  const { data: me } = useSuspenseQuery(meQueryOptions)
  const school = useQuery(schoolQueryOptions)
  const queryClient = useQueryClient()
  const picked = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const prefs = useCalendarPrefs()
  const detail = school.data

  // Joined or left on another device: bring the menus up to date.
  const meSchool = me?.school?.id ?? null
  const actual = detail === undefined ? undefined : (detail?.school.id ?? null)
  useEffect(() => {
    if (actual !== undefined && actual !== meSchool) {
      setMySchool(
        queryClient,
        detail
          ? {
              id: detail.school.id,
              name: detail.school.name,
              role: detail.role,
            }
          : null,
      )
    }
  }, [actual, meSchool, detail, queryClient])

  if (!me) return null
  // A teacher's page is wide, for the calendar.
  const teacher = me.school?.role === 'teacher'
  const onPick = (next: Picked) =>
    void navigate({ search: next, replace: true })

  return (
    <main
      className={cn(
        'mx-auto flex w-full flex-1 flex-col gap-6 px-4 py-10',
        !teacher
          ? 'max-w-xl'
          : cn(
              'print:max-w-none print:p-0',
              prefs.view === 'agenda' ? 'max-w-5xl' : 'max-w-7xl',
            ),
      )}
    >
      {/* A teacher's title is the calendar's ("School Calendar"), kept as
          close under the link as a heading here would be. */}
      <div
        className={cn(
          'flex flex-col items-start gap-2 print:hidden',
          teacher && '-mb-4',
        )}
      >
        <Link
          to="/account"
          className={cn(
            buttonVariants({ variant: 'link' }),
            'h-auto p-0 font-bold',
          )}
        >
          <ChevronLeft />
          Account
        </Link>
        {!teacher && <h1 className="text-2xl font-bold">School</h1>}
      </div>
      {teacher &&
        (canEditCalendar(me) ? (
          <CalendarEditor
            picked={picked}
            onPick={onPick}
            prefs={prefs}
            title="School Calendar"
          />
        ) : (
          <CalendarViewer picked={picked} onPick={onPick} prefs={prefs} />
        ))}
      <div className="flex w-full max-w-xl flex-col gap-6 print:hidden">
        {detail ? (
          detail.role === 'admin' ? (
            <SchoolAdminHub detail={detail} adminName={me.teacher.name} />
          ) : (
            <SchoolMemberView detail={detail} />
          )
        ) : detail === null ? (
          <NoSchool />
        ) : school.fetchStatus === 'paused' ? (
          <p
            role="status"
            className="flex items-center gap-2 text-sm font-medium text-muted-foreground"
          >
            <WifiOff className="size-4 shrink-0" />
            You’re offline. Connect to the internet to see your school.
          </p>
        ) : school.isError ? (
          <div role="alert" className="flex flex-col items-start gap-3">
            <p className="flex items-center gap-2 font-medium">
              <CircleAlert className="size-5 shrink-0 text-destructive" />
              Couldn’t load your school.
            </p>
            <Button
              variant="outline"
              onClick={() => void school.refetch()}
              disabled={school.isFetching}
              className="h-10 rounded-lg border-2 font-bold"
            >
              <RefreshCw className={cn(school.isFetching && 'animate-spin')} />
              Try again
            </Button>
          </div>
        ) : (
          <p
            role="status"
            className="flex items-center gap-2 font-medium text-muted-foreground"
          >
            <Spinner aria-hidden className="size-5" />
            Loading your school…
          </p>
        )}
      </div>
    </main>
  )
}

function NoSchool() {
  return (
    <Empty className="rounded-xl border-2 border-dashed border-border">
      <EmptyHeader>
        <EmptyMedia
          variant="icon"
          className="size-12 rounded-lg bg-chart-3 text-foreground"
        >
          <Building2 className="size-6" />
        </EmptyMedia>
        <EmptyTitle className="text-lg font-bold">
          You’re not in a school
        </EmptyTitle>
        <EmptyDescription>
          Part of a school? Ask your administrator for the join link.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Link
          to="/school/start"
          className={cn(buttonVariants(), 'h-11 rounded-lg px-5 font-bold')}
        >
          Start a school
        </Link>
      </EmptyContent>
    </Empty>
  )
}
