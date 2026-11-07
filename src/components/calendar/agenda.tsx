import { MapPin, Repeat } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatClock } from '#/lib/calendar'
import { formatLongDate } from '#/lib/day'
import { breakOn } from '#/components/calendar/month-grid'
import type { Occurrence, SchoolBreak } from '#/lib/school-calendar'

/**
 * The calendar as a list: each day with events, and its breaks. Phones show
 * this by default; a day's "+2 more" shows one day of it.
 */
export function Agenda({
  occurrences,
  breaks,
  emptyText,
  onOpen,
}: {
  occurrences: Array<Occurrence>
  breaks: Array<SchoolBreak>
  emptyText: string
  onOpen: (o: Occurrence) => void
}) {
  const days: Array<{ date: string; events: Array<Occurrence> }> = []
  for (const o of occurrences) {
    const last = days.at(-1)
    if (last?.date === o.date) last.events.push(o)
    else days.push({ date: o.date, events: [o] })
  }
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
              {events.map((o) => (
                <li key={`${o.event_id}:${o.date}`}>
                  <button
                    type="button"
                    onClick={() => onOpen(o)}
                    className={cn(
                      'flex w-full items-start gap-3 rounded-xl border-2 border-border bg-card p-3 text-left shadow-sm outline-none hover:bg-muted focus-visible:ring-4 focus-visible:ring-ring',
                      o.past && 'opacity-70',
                    )}
                  >
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
                        <span className="min-w-0 truncate">{o.title}</span>
                        {o.repeats && (
                          <Repeat
                            aria-label="Repeats"
                            className="size-3.5 shrink-0"
                          />
                        )}
                      </span>
                      {o.location && (
                        <span className="flex items-center gap-1 truncate text-sm text-muted-foreground">
                          <MapPin className="size-3.5 shrink-0" />
                          {o.location}
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </li>
        )
      })}
    </ol>
  )
}
