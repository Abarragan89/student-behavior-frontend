import { Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowRight,
  Eye,
  NotebookPen,
  Pencil,
  Presentation,
} from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'
import { formatClockRange } from '#/lib/calendar'
import { formatLongDate } from '#/lib/day'
import { lessonPlanDayQueryOptions, progress } from '#/lib/lesson-plans'
import { ProgressBar } from '#/components/lesson-plans/progress-bar'
import { usePermission } from '#/lib/workspace'

/**
 * Today's plan at a glance, above the calendar: how much is done, what's
 * next, and a big button to open it. Most visits are for today.
 */
export function TodayCard({ today }: { today: string }) {
  const day = useQuery(lessonPlanDayQueryOptions(today))
  // A co-teacher with View only opens the plan to read it.
  const editable = usePermission('lesson_plans') === 'edit'
  const sections = day.data?.sections ?? []
  const { done, total } = progress(sections)
  const upNext = sections.filter(
    (s) => s.items.length === 0 || s.items.some((i) => !i.done),
  )

  return (
    <section
      aria-labelledby="today-heading"
      className="flex flex-col gap-4 rounded-xl border-2 border-border bg-card p-4 shadow-md sm:p-6"
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="flex size-11 shrink-0 items-center justify-center rounded-lg border-2 border-border bg-chart-3"
        >
          <NotebookPen className="size-5" />
        </span>
        <div className="flex min-w-0 flex-col">
          <h2 id="today-heading" className="text-lg font-bold">
            Today
          </h2>
          <p className="text-sm text-muted-foreground">
            {formatLongDate(today)}
          </p>
        </div>
      </div>

      {day.isPending ? (
        <p
          role="status"
          className="flex items-center gap-2 text-sm font-medium text-muted-foreground"
        >
          <Spinner aria-hidden className="size-4" />
          Loading today’s plan…
        </p>
      ) : sections.length === 0 ? (
        <p className="text-base">
          {day.isError ? 'Couldn’t load today’s plan.' : 'Nothing planned yet.'}
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {total > 0 && (
            <ProgressBar
              done={done}
              total={total}
              label={`${done} of ${total} done`}
            />
          )}
          {upNext.length > 0 ? (
            <ul className="flex flex-col gap-1">
              {upNext.slice(0, 3).map((s) => (
                <li key={s.id} className="flex items-baseline gap-2">
                  <span className="truncate font-bold">
                    {s.title || 'Untitled section'}
                  </span>
                  {(s.start_time || s.end_time) && (
                    <span className="shrink-0 text-sm text-muted-foreground">
                      {formatClockRange(s.start_time, s.end_time)}
                    </span>
                  )}
                </li>
              ))}
              {upNext.length > 3 && (
                <li className="text-sm text-muted-foreground">
                  and {upNext.length - 3} more
                </li>
              )}
            </ul>
          ) : (
            <p className="font-bold">Everything’s checked off. Nice work!</p>
          )}
        </div>
      )}

      {sections.length > 0 ? (
        <div className="flex gap-2">
          {/* The in-class button: the plan on the whole screen. */}
          <Link
            to="/lesson-plans/$date/present"
            params={{ date: today }}
            className={cn(
              buttonVariants(),
              'h-12 flex-1 rounded-lg border-2 border-border text-base font-bold shadow-sm',
            )}
          >
            <Presentation className="size-5" />
            Presenter view
          </Link>
          <Link
            to="/lesson-plans/$date"
            params={{ date: today }}
            className={cn(
              buttonVariants({ variant: 'outline' }),
              'h-12 rounded-lg border-2 border-border bg-card px-4 text-base font-bold',
            )}
          >
            {editable ? (
              <Pencil className="size-4" />
            ) : (
              <Eye className="size-4" />
            )}
            {editable ? 'Edit' : 'Open'}
          </Link>
        </div>
      ) : (
        <Link
          to="/lesson-plans/$date"
          params={{ date: today }}
          className={cn(
            buttonVariants(),
            'h-12 rounded-lg border-2 border-border text-base font-bold shadow-sm',
          )}
        >
          {day.isPending || !editable ? 'Open today' : 'Plan today'}
          <ArrowRight className="size-5" />
        </Link>
      )}
    </section>
  )
}
