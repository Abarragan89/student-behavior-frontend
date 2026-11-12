import { ChevronLeft, ChevronRight, Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import type { CalendarView } from '#/components/calendar/calendar-prefs'
import { addMonths, formatMonth, formatWeekRange } from '#/lib/calendar'
import { addDays } from '#/lib/day'

const tabsListClass =
  'gap-0.5 rounded-lg border-2 border-border bg-card p-0.5 group-data-horizontal/tabs:h-10'
const tabClass = cn(
  'rounded-md px-3 text-sm font-bold text-foreground transition-colors not-data-active:hover:bg-muted focus-visible:ring-4 focus-visible:ring-ring focus-visible:outline-none motion-reduce:transition-none sm:text-base dark:text-foreground',
  'data-active:bg-primary data-active:text-primary-foreground dark:data-active:bg-primary dark:data-active:text-primary-foreground',
)

const PRINT_HINT: Record<CalendarView, string> = {
  month: 'The month on paper: the grid, then every event as a list',
  week: 'This week on paper, with its message',
  agenda: 'Every event this month on paper, as a list',
}

/**
 * The month's name (or the week's dates), Today, the arrows, Print (wide
 * screens), and Month | Week | List: the administrator's calendar and
 * teachers'. The arrows step a week at a time in the week view.
 */
export function CalendarToolbar({
  month,
  thisMonth,
  onMonth,
  week,
  thisWeek,
  onWeek,
  view,
  onView,
}: {
  month: string
  thisMonth: string
  onMonth: (month: string) => void
  /** The week's Monday. */
  week: string
  thisWeek: string
  onWeek: (monday: string) => void
  view: CalendarView
  onView: (v: CalendarView) => void
}) {
  const weekly = view === 'week'
  const unit = weekly ? 'week' : 'month'
  const step = (n: number) =>
    weekly ? onWeek(addDays(week, 7 * n)) : onMonth(addMonths(month, n))
  const now = weekly ? week === thisWeek : month === thisMonth
  return (
    <div className="flex flex-wrap items-center gap-2">
      <h2 className="mr-auto text-xl font-bold" aria-live="polite">
        {weekly ? formatWeekRange(week) : formatMonth(month)}
      </h2>
      {!now && (
        <Button
          variant="link"
          onClick={() => (weekly ? onWeek(thisWeek) : onMonth(thisMonth))}
          className="px-1 text-base font-bold"
        >
          Today
        </Button>
      )}
      <Button
        variant="outline"
        size="icon"
        aria-label={`Previous ${unit}`}
        onClick={() => step(-1)}
        className="size-10 rounded-lg border-2 border-border bg-card"
      >
        <ChevronLeft className="size-5" />
      </Button>
      <Button
        variant="outline"
        size="icon"
        aria-label={`Next ${unit}`}
        onClick={() => step(1)}
        className="size-10 rounded-lg border-2 border-border bg-card"
      >
        <ChevronRight className="size-5" />
      </Button>
      <Button
        variant="outline"
        onClick={() => window.print()}
        title={PRINT_HINT[view]}
        className="h-10 rounded-lg border-2 border-border bg-card px-3 font-bold max-md:hidden"
      >
        <Printer />
        <span className="max-lg:sr-only">Print</span>
      </Button>
      <Tabs value={view} onValueChange={(v: CalendarView) => onView(v)}>
        <TabsList aria-label="View" className={tabsListClass}>
          <TabsTrigger value="month" className={tabClass}>
            Month
          </TabsTrigger>
          <TabsTrigger value="week" className={tabClass}>
            Week
          </TabsTrigger>
          <TabsTrigger value="agenda" className={tabClass}>
            List
          </TabsTrigger>
        </TabsList>
      </Tabs>
    </div>
  )
}
