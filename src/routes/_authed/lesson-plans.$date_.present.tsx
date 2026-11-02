import { Link, createFileRoute } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { CircleAlert, RefreshCw, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'
import { formatShortDate } from '#/lib/calendar'
import { isDateString, useToday } from '#/lib/day'
import { lessonPlanDayQueryOptions } from '#/lib/lesson-plans'
import type { PlanDay, PlanItem } from '#/lib/lesson-plans'
import { flushDrafts, runOp } from '#/lib/lesson-plan-queue'
import { markTypesQueryOptions } from '#/lib/marks'
import { useOnline } from '#/lib/online'
import { PresenterClass } from '#/components/lesson-plans/presenter-class'
import { PresenterView } from '#/components/lesson-plans/presenter-view'

// /lesson-plans/2026-11-05/present: the day's checklist on the whole screen,
// to teach from. Not nested in the day page ("$date_"), so it replaces it.
export const Route = createFileRoute('/_authed/lesson-plans/$date_/present')({
  staticData: { fullScreen: true },
  loader: ({ context: { queryClient }, params }) => {
    // The mark types too, so the buttons are ready when a student is tapped
    // in the class view (like the Classes page).
    void queryClient.query(markTypesQueryOptions).catch(() => null)
    if (!isDateString(params.date)) return
    void queryClient
      .query(lessonPlanDayQueryOptions(params.date))
      .catch(() => null)
  },
  component: PresentPage,
})

function PresentPage() {
  const { date } = Route.useParams()
  const today = useToday()
  const online = useOnline()
  const day = useQuery({
    ...lessonPlanDayQueryOptions(date),
    enabled: isDateString(date),
  })

  if (day.data) {
    return (
      <TeacherPresenter key={date} day={day.data} isToday={date === today} />
    )
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 pt-[env(safe-area-inset-top)] text-center">
      {!isDateString(date) ? (
        <p className="text-lg font-bold">That isn’t a date we can open.</p>
      ) : day.isError ? (
        <>
          <p className="flex items-center gap-2 font-medium">
            <CircleAlert className="size-5 shrink-0 text-destructive" />
            {online
              ? 'Couldn’t load this day’s plan.'
              : 'This day’s plan isn’t saved on this device. Connect to the internet to see it.'}
          </p>
          <Button
            variant="outline"
            onClick={() => void day.refetch()}
            disabled={day.isFetching}
            className="h-11 rounded-lg border-2 border-border font-bold"
          >
            <RefreshCw className={cn(day.isFetching && 'animate-spin')} />
            Try again
          </Button>
        </>
      ) : (
        <p
          role="status"
          className="flex items-center gap-2 font-medium text-muted-foreground"
        >
          <Spinner aria-hidden className="size-5" />
          {online ? 'Loading plan…' : 'Waiting for a connection…'}
        </p>
      )}
      <Link
        to="/lesson-plans"
        className="flex items-center gap-1 font-bold text-primary underline-offset-4 hover:underline"
      >
        <X className="size-4" />
        Close
      </Link>
    </main>
  )
}

/**
 * The teacher's presenter: checkmarks go through the lesson plan queue (they
 * work offline in the installed app), ✕ goes back to planning the day, and
 * the round button brings up the open class.
 */
function TeacherPresenter({
  day,
  isToday,
}: {
  day: PlanDay
  isToday: boolean
}) {
  const queryClient = useQueryClient()

  function check(item: PlanItem) {
    runOp(queryClient, {
      kind: 'done',
      date: day.date,
      id: item.id,
      done: !item.done,
    })
  }

  return (
    <PresenterView
      day={day}
      isToday={isToday}
      heading={isToday ? 'Today' : formatShortDate(day.date)}
      onCheck={check}
      exit={
        <Link
          to="/lesson-plans/$date"
          params={{ date: day.date }}
          onClick={flushDrafts}
          aria-label="Close presenter view"
          className="flex size-11 shrink-0 items-center justify-center rounded-lg outline-none hover:bg-muted focus-visible:ring-4 focus-visible:ring-ring"
        >
          <X className="size-6" />
        </Link>
      }
      emptyAction={
        <Link
          to="/lesson-plans/$date"
          params={{ date: day.date }}
          className="text-lg font-bold text-primary underline-offset-4 hover:underline"
        >
          Plan it
        </Link>
      }
      classView={(state) => <PresenterClass {...state} isToday={isToday} />}
    />
  )
}
