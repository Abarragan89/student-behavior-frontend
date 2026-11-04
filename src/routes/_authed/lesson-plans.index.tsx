import { Link, createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { LayoutTemplate } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { isMonthString, monthOf } from '#/lib/calendar'
import { useToday } from '#/lib/day'
import {
  lessonPlanCalendarQueryOptions,
  lessonPlanDayQueryOptions,
} from '#/lib/lesson-plans'
import { localDate } from '#/lib/marks'
import { mayLoad, usePermission } from '#/lib/workspace'
import { MonthCalendar } from '#/components/lesson-plans/month-calendar'
import { TodayCard } from '#/components/lesson-plans/today-card'

export const Route = createFileRoute('/_authed/lesson-plans/')({
  // A co-teacher needs at least View on Lesson plans (_authed.tsx checks).
  staticData: { feature: { key: 'lesson_plans', level: 'view' } },
  // ?month=YYYY-MM picks the month; left out, it's this month.
  validateSearch: (search: Record<string, unknown>): { month?: string } => ({
    month: isMonthString(search.month) ? search.month : undefined,
  }),
  loaderDeps: ({ search }) => ({ month: search.month }),
  // Started early, not waited for: the page shows what it has meanwhile.
  loader: ({ context: { queryClient }, deps }) => {
    if (!mayLoad(queryClient, 'lesson_plans')) return
    const today = localDate()
    void queryClient
      .query(lessonPlanCalendarQueryOptions(deps.month ?? monthOf(today)))
      .catch(() => null)
    void queryClient.query(lessonPlanDayQueryOptions(today)).catch(() => null)
  },
  component: LessonPlansPage,
})

function LessonPlansPage() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const today = useToday()
  const month = search.month ?? monthOf(today)
  const calendar = useQuery(lessonPlanCalendarQueryOptions(month))
  // Templates are for planning, so a co-teacher with View doesn't see them.
  const editable = usePermission('lesson_plans') === 'edit'

  return (
    <main className="mx-auto flex w-full max-w-3xl min-w-0 flex-1 flex-col gap-6 px-4 py-6 sm:py-8">
      <header className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Lesson Plans</h1>
      </header>
        {editable && (
          <Link
            to="/lesson-plans/templates"
            className={cn(
              buttonVariants({ variant: 'outline' }),
              'h-10 rounded-lg border-2 border-border bg-card text-base font-bold',
            )}
          >
            <LayoutTemplate className="size-5" />
            My Templates
          </Link>
        )}
      <TodayCard today={today} />
      <MonthCalendar
        month={month}
        today={today}
        onMonthChange={(next) =>
          void navigate({
            search: { month: next === monthOf(today) ? undefined : next },
            replace: true,
          })
        }
        summaries={calendar.data}
      />
      <p className="text-sm text-muted-foreground">
        Tap a day to plan it or check it off.
      </p>
    </main>
  )
}
