import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarClock, CircleAlert, Link2Off, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'
import { ApiError } from '#/lib/api'
import { LIVE_REFRESH_MS } from '#/lib/freshness'
import { formatLongDate } from '#/lib/day'
import { useOnline } from '#/lib/online'
import {
  checkSubItem,
  checkSubSection,
  subCountsQueryOptions,
  subDayQueryOptions,
  subRosterQueryOptions,
  subSessionQueryOptions,
} from '#/lib/sub'
import type { SubClassroom, SubSession } from '#/lib/sub'
import { Wordmark } from '#/components/Wordmark'
import { PresenterView } from '#/components/lesson-plans/presenter-view'
import { useUnsentChanges } from '#/hooks/useUnsentChanges'
import { SubClass } from './sub-class'

/**
 * What a substitute sees from a shared link (/sub): on the day, the
 * teacher's plan in presenter view, with the round button for their classes.
 * Before or after the day, or once the teacher turns the link off, a short
 * note saying so.
 */
export function SubPage({ hasKey }: { hasKey: boolean }) {
  if (!hasKey) {
    return (
      <SubNote
        icon={Link2Off}
        title="This link is missing its key"
        body="Open the link from the teacher’s message again."
      />
    )
  }
  return <SubSessionPage />
}

function SubSessionPage() {
  const online = useOnline()
  const session = useQuery(subSessionQueryOptions)
  useStatusChecks(session.data)

  if (session.error instanceof ApiError && session.error.status === 404) {
    return (
      <SubNote
        icon={Link2Off}
        title="This link doesn’t work"
        body="It may have been turned off. Ask the teacher for a new one."
      />
    )
  }
  if (session.data) {
    const { status, plan_date: date, teacher_name } = session.data
    if (status === 'upcoming') {
      return (
        <SubNote
          icon={CalendarClock}
          title={`This link opens on ${formatLongDate(date)}`}
          body={`It’s ${possessive(teacher_name)} plan for that day. Open it again then.`}
        />
      )
    }
    if (status === 'ended') {
      return (
        <SubNote
          icon={CalendarClock}
          title="This link has ended"
          body={`It was for ${formatLongDate(date)}. Thanks for subbing!`}
        />
      )
    }
    return <SubPresenter session={session.data} />
  }
  if (session.isError) {
    return (
      <SubNote
        icon={CircleAlert}
        title="Couldn’t open the plan"
        body={
          online
            ? 'Something went wrong. Try again in a moment.'
            : 'You’re offline. Connect to the internet and try again.'
        }
        action={
          <TryAgain
            onClick={() => void session.refetch()}
            busy={session.isFetching}
          />
        }
      />
    )
  }
  return <Opening />
}

/** The day: the plan, checkmarks through the link, and the classes. */
function SubPresenter({ session }: { session: SubSession }) {
  const queryClient = useQueryClient()
  // Checkmarks made meanwhile by the teacher (or on another device).
  const day = useQuery({
    ...subDayQueryOptions,
    refetchInterval: LIVE_REFRESH_MS,
  })
  const classrooms = session.classrooms ?? []
  usePrefetchClasses(classrooms)
  useLeaveWarning()

  if (day.data) {
    return (
      <PresenterView
        day={day.data}
        // Only open on its day.
        isToday
        heading={`${possessive(session.teacher_name)} plan`}
        onCheck={(item) => checkSubItem(queryClient, session.plan_date, item)}
        onCheckSection={(section) =>
          checkSubSection(queryClient, session.plan_date, section)
        }
        classView={
          classrooms.length > 0
            ? (state) => (
                <SubClass
                  {...state}
                  classrooms={classrooms}
                  planDate={session.plan_date}
                />
              )
            : undefined
        }
      />
    )
  }
  if (day.isError) {
    return (
      <SubNote
        icon={CircleAlert}
        title="Couldn’t load the plan"
        body="Check the connection and try again."
        action={
          <TryAgain onClick={() => void day.refetch()} busy={day.isFetching} />
        }
      />
    )
  }
  return <Opening />
}

/**
 * Every shared class's students and counts, loaded with the plan, so the
 * class opens at once and switching works through a dropped connection.
 */
function usePrefetchClasses(classrooms: Array<SubClassroom>) {
  const queryClient = useQueryClient()
  const ids = classrooms.map((c) => c.id).join(',')
  useEffect(() => {
    for (const id of ids ? ids.split(',') : []) {
      void queryClient.prefetchQuery(subRosterQueryOptions(id))
      void queryClient.prefetchQuery(subCountsQueryOptions(id))
    }
  }, [ids, queryClient])
}

/**
 * Nothing is saved on a sub's device, so closing the tab with marks still
 * waiting (offline) would lose them: the browser asks first.
 */
function useLeaveWarning() {
  const waiting = useUnsentChanges().total > 0
  useEffect(() => {
    if (!waiting) return
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [waiting])
}

/** Asks again when the day starts or ends, so the page follows along. */
function useStatusChecks(session: SubSession | undefined) {
  const queryClient = useQueryClient()
  const next =
    session?.status === 'upcoming'
      ? session.starts_at
      : session?.status === 'open'
        ? session.ends_at
        : null
  useEffect(() => {
    if (!next) return
    const ms = Date.parse(next) - Date.now()
    // A device clock that's off can't make it ask over and over.
    const delay = ms > 0 ? Math.min(ms + 1000, 2 ** 31 - 1) : 60_000
    const timer = setTimeout(() => {
      void queryClient.invalidateQueries({
        queryKey: subSessionQueryOptions.queryKey,
      })
    }, delay)
    return () => clearTimeout(timer)
  }, [next, queryClient])
}

/** "Ms. Lee’s", or "The teacher’s" without a name. */
function possessive(name: string) {
  const trimmed = name.trim()
  return trimmed ? `${trimmed}’s` : 'The teacher’s'
}

function Opening() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-6">
      <p
        role="status"
        className="flex items-center gap-2 font-medium text-muted-foreground"
      >
        <Spinner aria-hidden className="size-5" />
        Opening the plan…
      </p>
    </main>
  )
}

function SubNote({
  icon: Icon,
  title,
  body,
  action,
}: {
  icon: typeof CircleAlert
  title: string
  body: string
  action?: ReactNode
}) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] text-center">
      <Wordmark className="h-24" />
      <div className="flex max-w-sm flex-col items-center gap-3">
        <span className="flex size-14 items-center justify-center rounded-lg border-2 border-border bg-chart-3 text-foreground">
          <Icon className="size-7" />
        </span>
        <h1 className="text-xl font-bold text-balance">{title}</h1>
        <p className="text-muted-foreground">{body}</p>
        {action}
      </div>
    </main>
  )
}

function TryAgain({ onClick, busy }: { onClick: () => void; busy: boolean }) {
  return (
    <Button
      variant="outline"
      onClick={onClick}
      disabled={busy}
      className="h-11 rounded-lg border-2 border-border font-bold"
    >
      <RefreshCw className={cn(busy && 'animate-spin')} />
      Try again
    </Button>
  )
}
