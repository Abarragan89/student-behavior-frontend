import { cn } from '@/lib/utils'
import { formatLongDate, formatShortDay, parseDate } from '#/lib/day'
import { perDay, sumDays } from '#/lib/mark-stats'
import type { DayCount } from '#/lib/mark-stats'

// The tallest bar, up or down, in px. Each side also has room for its count.
const ARM = 48

/**
 * A student's recent days side by side, for the screen (the printed report
 * has its own, in report-charts.tsx). Positive bars rise from the center
 * line, negative bars hang below it, both on one scale. Up or down tells
 * them apart as well as the color does, and every bar has its count.
 *
 * Each day is a button that opens it; the day being looked at is shaded.
 */
export function RecentDaysChart({
  days,
  selected,
  onSelect,
  faded = false,
}: {
  /** Oldest first, already trimmed to the days worth showing. */
  days: Array<DayCount>
  /** The day open below the chart. */
  selected: string
  onSelect: (date: string) => void
  /** Other days are loading: these stay on screen, dimmed. */
  faded?: boolean
}) {
  const max = Math.max(1, ...days.flatMap((d) => [d.positive, d.negative]))
  // A count of 1 next to a count of 30 still shows.
  const length = (count: number) => Math.max(4, (count / max) * ARM)

  return (
    <figure
      className={cn(
        'flex flex-col gap-2 transition-opacity motion-reduce:transition-none',
        faded && 'opacity-50',
      )}
    >
      <div className="flex gap-4 text-sm font-bold">
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="size-2.5 rounded-xs bg-chart-5" />
          Positive (up)
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="size-2.5 rounded-xs bg-destructive" />
          Negative (down)
        </span>
      </div>

      <div
        className="grid"
        style={{
          gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))`,
        }}
      >
        {days.map((day) => {
          const isSelected = day.date === selected
          const label = formatShortDay(day.date)
          const empty = day.positive + day.negative === 0
          return (
            <button
              key={day.date}
              type="button"
              aria-label={`${formatLongDate(day.date)}: ${
                empty
                  ? 'no marks'
                  : `${day.positive} positive, ${day.negative} negative`
              }`}
              aria-current={isSelected || undefined}
              onClick={() => onSelect(day.date)}
              className="group relative flex min-w-0 flex-col items-center py-1.5 outline-none"
            >
              {/* The column's shading, inset so neighbors stay apart. */}
              <span
                aria-hidden
                className={cn(
                  'absolute inset-x-0.5 inset-y-0 rounded-lg transition-colors group-focus-visible:ring-3 group-focus-visible:ring-ring/50 motion-reduce:transition-none',
                  isSelected ? 'bg-muted' : 'group-hover:bg-muted/60',
                )}
              />

              {/* Positive: the count, then the bar down to the line. */}
              <span
                aria-hidden
                className="relative flex w-full flex-col items-center justify-end"
                style={{ height: ARM + 18 }}
              >
                {day.positive > 0 && (
                  <>
                    <span className="mb-0.5 text-xs font-bold tabular-nums">
                      {day.positive}
                    </span>
                    <span
                      className="w-3 rounded-t-[4px] bg-chart-5 sm:w-4"
                      style={{ height: length(day.positive) }}
                    />
                  </>
                )}
                {empty && (
                  <span className="mb-1 text-xs text-muted-foreground">–</span>
                )}
              </span>

              <span
                aria-hidden
                className="relative h-px w-full bg-foreground/30"
              />

              {/* Negative: the bar down from the line, then the count. */}
              <span
                aria-hidden
                className="relative flex w-full flex-col items-center justify-start"
                style={{ height: ARM + 18 }}
              >
                {day.negative > 0 && (
                  <>
                    <span
                      className="w-3 rounded-b-[4px] bg-destructive sm:w-4"
                      style={{ height: length(day.negative) }}
                    />
                    <span className="mt-0.5 text-xs font-bold tabular-nums">
                      {day.negative}
                    </span>
                  </>
                )}
              </span>

              <span
                aria-hidden
                className={cn(
                  'relative mt-1 flex flex-col items-center text-xs leading-tight whitespace-nowrap',
                  isSelected
                    ? 'font-bold text-foreground'
                    : 'text-muted-foreground',
                )}
              >
                <span>{label.weekday}</span>
                {/* Phones only have room for the day of the month. */}
                <span className="tabular-nums sm:hidden">
                  {parseDate(day.date).getDate()}
                </span>
                <span className="hidden tabular-nums sm:inline">
                  {label.monthDay}
                </span>
              </span>
            </button>
          )
        })}
      </div>
    </figure>
  )
}

/** The days in a sentence: totals, and a typical day with marks. */
export function recentDaysSummary(days: Array<DayCount>) {
  const { positive, negative, marked } = sumDays(days)
  if (marked === 0) return 'No marks on any of these days.'
  const total = `In all: ${positive} positive, ${negative} negative.`
  // Averaged over days with marks only: a day without any may be a day the
  // student was away, which would make every day look quieter.
  if (marked < 2) return total
  return `${total} A typical day with marks: ${perDay(positive / marked)} positive, ${perDay(negative / marked)} negative.`
}
