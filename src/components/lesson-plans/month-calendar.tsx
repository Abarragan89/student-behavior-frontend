import { Link } from '@tanstack/react-router'
import { Check, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  addMonths,
  formatMonth,
  monthGrid,
  monthOf,
  weekdayLabels,
} from '#/lib/calendar'
import { formatLongDate, isWeekend, parseDate } from '#/lib/day'
import type { DaySummary } from '#/lib/lesson-plans'

/**
 * A month of dates, six weeks from Sunday. Each date shows a dot when it has
 * a plan and a check when every line is done. Dates are links to that day's
 * plan, or, with onPick, buttons that choose a date (the copy dialogs).
 */
export function MonthCalendar({
  month,
  onMonthChange,
  today,
  summaries,
  onPick,
  selected,
  size = 'large',
}: {
  month: string
  onMonthChange: (month: string) => void
  today: string
  /** What's planned on the dates shown; undefined while loading. */
  summaries: Array<DaySummary> | undefined
  onPick?: (date: string) => void
  selected?: string
  size?: 'large' | 'small'
}) {
  const byDate = new Map(summaries?.map((s) => [s.date, s]))
  const dates = monthGrid(month)
  const large = size === 'large'
  const thisMonth = monthOf(today)

  return (
    <section aria-label={formatMonth(month)} className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <h2
          className={cn('mr-auto font-bold', large ? 'text-xl' : 'text-base')}
          aria-live="polite"
        >
          {formatMonth(month)}
        </h2>
        {month !== thisMonth && (
          <Button
            variant="link"
            onClick={() => onMonthChange(thisMonth)}
            className="px-1 text-base font-bold"
          >
            Today
          </Button>
        )}
        <Button
          variant="outline"
          size="icon"
          aria-label="Previous month"
          onClick={() => onMonthChange(addMonths(month, -1))}
          className="size-10 rounded-lg border-2 border-border bg-card"
        >
          <ChevronLeft className="size-5" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          aria-label="Next month"
          onClick={() => onMonthChange(addMonths(month, 1))}
          className="size-10 rounded-lg border-2 border-border bg-card"
        >
          <ChevronRight className="size-5" />
        </Button>
      </div>

      <div
        className={cn(
          'grid grid-cols-7 overflow-hidden rounded-lg border-2 border-border bg-card',
          large && 'shadow-md',
        )}
      >
        {weekdayLabels(large ? 'short' : 'narrow').map((label, day) => (
          <div
            // Narrow labels repeat ("S", "T"), so the key is the weekday.
            key={day}
            aria-hidden
            className="border-b-2 border-border py-1.5 text-center text-xs font-bold text-muted-foreground uppercase"
          >
            {label}
          </div>
        ))}
        {dates.map((date) => (
          <DateCell
            key={date}
            date={date}
            inMonth={monthOf(date) === month}
            isToday={date === today}
            summary={byDate.get(date)}
            loading={summaries === undefined}
            large={large}
            onPick={onPick}
            selected={selected === date}
          />
        ))}
      </div>
    </section>
  )
}

function DateCell({
  date,
  inMonth,
  isToday,
  summary,
  loading,
  large,
  onPick,
  selected,
}: {
  date: string
  inMonth: boolean
  isToday: boolean
  summary: DaySummary | undefined
  loading: boolean
  large: boolean
  onPick?: (date: string) => void
  selected: boolean
}) {
  const complete =
    !!summary && summary.items > 0 && summary.done === summary.items
  const label = `${formatLongDate(date)}${isToday ? ', today' : ''}: ${
    loading
      ? 'loading'
      : !summary
        ? 'nothing planned'
        : summary.items === 0
          ? `${summary.sections} ${summary.sections === 1 ? 'section' : 'sections'}`
          : `${summary.done} of ${summary.items} done`
  }`

  const className = cn(
    'relative flex flex-col items-center gap-1 border-border outline-none focus-visible:z-10 focus-visible:ring-4 focus-visible:ring-ring focus-visible:ring-inset',
    large ? 'min-h-14 py-1.5 sm:min-h-20' : 'min-h-11 py-1',
    // Lines between cells, but not on the outer edge (the grid has a border).
    'not-nth-[7n]:border-r [&:nth-last-child(-n+7)]:border-b-0 border-b',
    isWeekend(date) && 'bg-muted/50',
    !inMonth && 'text-muted-foreground/60',
    selected && 'bg-primary text-primary-foreground',
    'hover:bg-muted',
    selected && 'hover:bg-primary/90',
  )

  const content = (
    <>
      <span
        className={cn(
          'flex size-7 items-center justify-center rounded-full text-sm',
          inMonth ? 'font-bold' : 'font-medium',
          isToday && 'ring-2 ring-primary',
          isToday && selected && 'ring-primary-foreground',
        )}
      >
        {parseDate(date).getDate()}
      </span>
      {summary &&
        (complete ? (
          <span
            aria-hidden
            className="flex size-4 items-center justify-center rounded-full border-2 border-border bg-chart-5 text-foreground"
          >
            <Check className="size-2.5" strokeWidth={4} />
          </span>
        ) : (
          <span
            aria-hidden
            className="size-2.5 rounded-full border-2 border-border bg-chart-3"
          />
        ))}
      {large && summary && summary.items > 0 && (
        <span aria-hidden className="hidden text-xs font-medium sm:block">
          {summary.done}/{summary.items}
        </span>
      )}
    </>
  )

  if (onPick) {
    return (
      <button
        type="button"
        aria-label={label}
        aria-pressed={selected}
        onClick={() => onPick(date)}
        className={className}
      >
        {content}
      </button>
    )
  }
  return (
    <Link
      to="/lesson-plans/$date"
      params={{ date }}
      aria-label={label}
      className={className}
    >
      {content}
    </Link>
  )
}
