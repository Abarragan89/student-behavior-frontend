import { Lock, MapPin, Repeat } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatClock, formatDayRange } from '#/lib/calendar'
import { NO_CATEGORY_COLOR, categoryStyle } from '#/lib/category-colors'
import { formatLongDate } from '#/lib/day'
import { isSpan } from '#/lib/event-span'
import { breakOn } from '#/components/calendar/month-grid'
import type {
  EventCategory,
  Occurrence,
  SchoolBreak,
} from '#/lib/school-calendar'

/**
 * The calendar as a list: each day with events (a bar in their category's
 * color), and its breaks. Phones show this by default; a day's "+2 more"
 * shows one day of it. An event that spans days is listed once, on its
 * first day in the list, with its dates.
 */
export function Agenda({
  occurrences,
  breaks,
  categories,
  emptyText,
  onOpen,
  highlight = null,
}: {
  occurrences: Array<Occurrence>
  breaks: Array<SchoolBreak>
  categories: Array<EventCategory>
  emptyText: string
  onOpen: (o: Occurrence) => void
  /** Which events stand out (the legend's picks); the rest fade. */
  highlight?: ((o: Occurrence) => boolean) | null
}) {
  const byId = new Map(categories.map((c) => [c.id, c]))
  const days = listDays(occurrences)
  if (days.length === 0) {
    return (
      <p className="rounded-xl border-2 border-dashed border-border px-4 py-8 text-center text-muted-foreground">
        {emptyText}
      </p>
    )
  }
  return (
    <ol className="flex flex-col gap-4">
      {days.map(({ date, events }) => {
        const off = breakOn(date, breaks)
        return (
          <li key={date} className="flex flex-col gap-2">
            <h3 className="flex flex-wrap items-baseline gap-x-2 text-sm font-bold">
              {formatLongDate(date)}
              {off && (
                <span className="font-medium text-muted-foreground">
                  · {off.name}
                </span>
              )}
            </h3>
            <ul className="flex flex-col gap-2">
              {events.map((o) => {
                const category = o.category_id
                  ? byId.get(o.category_id)
                  : undefined
                return (
                  <li key={`${o.event_id}:${o.date}`}>
                    <button
                      type="button"
                      onClick={() => onOpen(o)}
                      className={cn(
                        'flex w-full items-stretch gap-3 rounded-xl border-2 border-border bg-card p-3 text-left shadow-sm outline-none hover:bg-muted focus-visible:ring-4 focus-visible:ring-ring',
                        o.past && 'opacity-70',
                        highlight && !highlight(o) && 'opacity-30',
                      )}
                    >
                      <span
                        aria-hidden
                        className={cn(
                          '-my-1 -ml-1 w-1.5 shrink-0 rounded-full',
                          categoryStyle(category?.color ?? NO_CATEGORY_COLOR)
                            .dot,
                        )}
                      />
                      <span className="flex w-20 shrink-0 flex-col text-sm font-bold whitespace-nowrap tabular-nums">
                        {o.all_day || !o.start ? (
                          'All day'
                        ) : (
                          <>
                            {formatClock(o.start)}
                            {o.end && (
                              <span className="font-medium text-muted-foreground">
                                {formatClock(o.end)}
                              </span>
                            )}
                          </>
                        )}
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="flex items-center gap-1.5 font-bold">
                          <span className="min-w-0 wrap-break-word">
                            {o.title}
                          </span>
                          {o.repeats && (
                            <Repeat
                              aria-label="Repeats"
                              className="size-3.5 shrink-0"
                            />
                          )}
                          {o.private && (
                            <Lock
                              aria-label="Private"
                              className="size-3.5 shrink-0"
                            />
                          )}
                        </span>
                        {isSpan(o) && (
                          <span className="text-sm font-medium">
                            {formatDayRange(o.first_day, o.last_day)}
                            {!o.all_day && ' · each day'}
                          </span>
                        )}
                        {category && (
                          <span className="truncate text-sm text-muted-foreground">
                            {category.name}
                          </span>
                        )}
                        {o.location && (
                          <span className="flex items-center gap-1 truncate text-sm text-muted-foreground">
                            <MapPin className="size-3.5 shrink-0" />
                            {o.location}
                          </span>
                        )}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </li>
        )
      })}
    </ol>
  )
}

/**
 * Events by day, in order, only days with events; an event that spans
 * days once (on its first day here). The printed list uses this too.
 */
export function listDays(
  occurrences: Array<Occurrence>,
): Array<{ date: string; events: Array<Occurrence> }> {
  const byDate = new Map<string, Array<Occurrence>>()
  const listed = new Set<string>()
  for (const o of occurrences) {
    if (isSpan(o)) {
      const key = `${o.event_id}|${o.first_day}`
      if (listed.has(key)) continue
      listed.add(key)
    }
    byDate.set(o.date, [...(byDate.get(o.date) ?? []), o])
  }
  return [...byDate].map(([date, events]) => ({ date, events }))
}
