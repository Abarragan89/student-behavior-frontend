import { Plus, Repeat } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatClock, monthGrid, monthOf, weekdayLabels } from '#/lib/calendar'
import { formatLongDate, isWeekend, parseDate } from '#/lib/day'
import type { Occurrence, SchoolBreak } from '#/lib/school-calendar'

/** How many events a day cell lists before "+N more". */
const PER_DAY = 3

export function breakOn(date: string, breaks: Array<SchoolBreak>) {
  return breaks.find((b) => date >= b.first_day && date <= b.last_day)
}

/** "3:15 PM", or "All day". */
export function startLabel(o: Pick<Occurrence, 'all_day' | 'start'>) {
  return o.all_day || !o.start ? 'All day' : formatClock(o.start)
}

/**
 * A month of the school calendar: six weeks, Sunday first. Each day lists
 * its events ("3:15 PM Staff meeting"); break days are shaded with their
 * name. Tapping a day's number adds an event on it; tapping an event opens
 * it; "+2 more" opens the day.
 */
export function MonthGrid({
  month,
  today,
  occurrences,
  breaks,
  loading,
  onAdd,
  onOpen,
  onDay,
}: {
  month: string
  today: string
  occurrences: Array<Occurrence>
  breaks: Array<SchoolBreak>
  loading: boolean
  onAdd: (date: string) => void
  onOpen: (o: Occurrence) => void
  onDay: (date: string) => void
}) {
  const byDate = new Map<string, Array<Occurrence>>()
  for (const o of occurrences)
    byDate.set(o.date, [...(byDate.get(o.date) ?? []), o])

  return (
    <div
      className={cn(
        'grid grid-cols-7 overflow-hidden rounded-lg border-2 border-border bg-card shadow-md transition-opacity motion-reduce:transition-none',
        loading && 'opacity-60',
      )}
      aria-busy={loading || undefined}
    >
      {weekdayLabels('short').map((label, day) => (
        <div
          key={day}
          aria-hidden
          className="border-b-2 border-border py-1.5 text-center text-xs font-bold text-muted-foreground uppercase"
        >
          {label}
        </div>
      ))}
      {monthGrid(month).map((date) => {
        const events = byDate.get(date) ?? []
        const inMonth = monthOf(date) === month
        const isToday = date === today
        const past = date < today
        const off = breakOn(date, breaks)
        return (
          <div
            key={date}
            className={cn(
              'flex min-h-28 min-w-0 flex-col gap-1 border-border p-1',
              'not-nth-[7n]:border-r [&:nth-last-child(-n+7)]:border-b-0 border-b',
              isWeekend(date) && 'bg-muted/50',
              off && 'bg-chart-3/15',
              !inMonth && 'text-muted-foreground/60',
            )}
          >
            <div className="flex items-center gap-1">
              <span
                className={cn(
                  'flex size-7 shrink-0 items-center justify-center rounded-full text-sm',
                  inMonth ? 'font-bold' : 'font-medium',
                  isToday && 'bg-primary text-primary-foreground',
                  past && !isToday && 'text-muted-foreground',
                )}
              >
                {parseDate(date).getDate()}
              </span>
              {off && (
                <span
                  className="min-w-0 truncate text-[0.6875rem] font-bold text-muted-foreground"
                  title={off.name}
                >
                  {off.name}
                </span>
              )}
              {!past && (
                <button
                  type="button"
                  onClick={() => onAdd(date)}
                  aria-label={`Add an event on ${formatLongDate(date)}`}
                  className="ml-auto flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground opacity-60 outline-none hover:bg-muted hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-4 focus-visible:ring-ring"
                >
                  <Plus className="size-4" />
                </button>
              )}
            </div>
            {events.slice(0, PER_DAY).map((o) => (
              <button
                key={`${o.event_id}:${o.date}`}
                type="button"
                onClick={() => onOpen(o)}
                title={o.title}
                className={cn(
                  'flex w-full min-w-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-left text-xs font-bold outline-none focus-visible:ring-4 focus-visible:ring-ring',
                  o.past
                    ? 'bg-muted text-muted-foreground hover:bg-muted/80'
                    : 'bg-primary/15 text-foreground hover:bg-primary/25',
                )}
              >
                <span className="shrink-0 font-medium tabular-nums">
                  {o.all_day
                    ? ''
                    : startLabel(o)
                        .replace(/:00|\s/g, '')
                        .toLowerCase()}
                </span>
                <span className="min-w-0 truncate">{o.title}</span>
                {o.repeats && (
                  <Repeat
                    aria-label="Repeats"
                    className="ml-auto size-3 shrink-0"
                  />
                )}
              </button>
            ))}
            {events.length > PER_DAY && (
              <button
                type="button"
                onClick={() => onDay(date)}
                className="rounded-md px-1.5 text-left text-xs font-bold text-muted-foreground outline-none hover:text-foreground focus-visible:ring-4 focus-visible:ring-ring"
              >
                +{events.length - PER_DAY} more
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}
