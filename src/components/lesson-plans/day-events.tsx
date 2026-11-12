import { useMemo, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowRight,
  CalendarDays,
  CalendarOff,
  ChevronRight,
  MapPin,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { breakOn } from '#/components/calendar/month-grid'
import { ResponsiveDialog } from '#/components/responsive-dialogue'
import { meQueryOptions } from '#/lib/auth'
import {
  formatClock,
  formatDayRange,
  formatShortDate,
  monthGrid,
  monthOf,
} from '#/lib/calendar'
import { categoryStyle } from '#/lib/category-colors'
import type { CategoryColor } from '#/lib/category-colors'
import { addDays, formatLongDate } from '#/lib/day'
import { isSpan } from '#/lib/event-span'
import { mineMatcher } from '#/lib/month-layout'
import { staffCalendarQueryOptions } from '#/lib/school-calendar'

/**
 * "You have 3 events today": what's on your school's calendar the day
 * you're planning (the events you're invited to and the categories shared
 * with staff, as on your School page). Tapping it lists each event's time,
 * name and place. For a teacher in a school, in their own space: never on a
 * co-teacher's plans, a template, the presenter view, a sub's page or paper.
 * Nothing shows while loading, offline, or on a day with no events.
 */
export function DayEvents({ date, today }: { date: string; today: string }) {
  const { data: me } = useQuery(meQueryOptions)
  const forYou = me?.school?.role === 'teacher' && !me.acting_for
  // The month's whole grid: the same request as the School page's calendar,
  // so moving between days in a month doesn't fetch again.
  const days = monthGrid(monthOf(date))
  const calendar = useQuery({
    ...staffCalendarQueryOptions(days[0], days[41]),
    enabled: forYou,
  })
  const [open, setOpen] = useState(false)
  const name = me?.teacher.name
  const isMine = useMemo(() => mineMatcher(name), [name])

  const cal = calendar.data
  if (!forYou || !cal) return null
  const events = cal.occurrences.filter((o) => o.date === date)
  if (events.length === 0) return null

  const byId = new Map(cal.categories.map((c) => [c.id, c]))
  const colors: Array<CategoryColor> = []
  for (const o of events) {
    const color = o.category_id ? byId.get(o.category_id)?.color : undefined
    if (color && !colors.includes(color) && colors.length < 3)
      colors.push(color)
  }
  const off = breakOn(date, cal.breaks)
  const count = events.length === 1 ? '1 event' : `${events.length} events`
  const when =
    date === today
      ? 'today'
      : date === addDays(today, 1)
        ? 'tomorrow'
        : `on ${formatShortDate(date)}`
  const thisMonth = monthOf(date) === monthOf(today)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex min-h-11 w-full items-center gap-3 rounded-lg border-2 border-border bg-card px-3 py-2 text-left font-bold shadow-sm outline-none hover:bg-muted focus-visible:ring-4 focus-visible:ring-ring"
      >
        <CalendarDays className="size-5 shrink-0" />
        <span className="min-w-0 flex-1">
          You {date < today ? 'had' : 'have'} {count} {when}
        </span>
        {colors.length > 0 && (
          <span aria-hidden className="flex shrink-0 -space-x-1">
            {colors.map((c) => (
              <span
                key={c}
                className={cn(
                  'size-3.5 rounded-full border-2 border-card',
                  categoryStyle(c).dot,
                )}
              />
            ))}
          </span>
        )}
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
      </button>

      <ResponsiveDialog
        isOpen={open}
        setIsOpen={setOpen}
        title={
          date === today
            ? 'Today’s events'
            : `Events on ${formatLongDate(date)}`
        }
        description={me.school?.name}
        showDescription
        className="sm:max-w-md"
      >
        <div className="flex flex-col gap-4">
          {off && (
            <p className="flex items-center gap-2 text-sm font-bold">
              <CalendarOff className="size-4 shrink-0" />
              {off.name}
            </p>
          )}
          <ul className="flex flex-col gap-2">
            {events.map((o) => {
              const category = o.category_id
                ? byId.get(o.category_id)
                : undefined
              return (
                <li
                  key={`${o.event_id}:${o.date}`}
                  className="flex items-stretch gap-3 rounded-xl border-2 border-border bg-card p-3"
                >
                  <span
                    aria-hidden
                    className={cn(
                      '-my-1 -ml-1 w-1.5 shrink-0 rounded-full',
                      category
                        ? categoryStyle(category.color).dot
                        : 'bg-border',
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
                      <span className="min-w-0 wrap-break-word">{o.title}</span>
                      {isMine(o) && (
                        <Badge variant="secondary" className="shrink-0">
                          You
                        </Badge>
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
                      <span className="flex items-center gap-1 text-sm text-muted-foreground">
                        <MapPin className="size-3.5 shrink-0" />
                        <span className="min-w-0 wrap-break-word">
                          {o.location}
                        </span>
                      </span>
                    )}
                  </span>
                </li>
              )
            })}
          </ul>
          <Link
            to="/account/school"
            search={{ month: thisMonth ? undefined : monthOf(date) }}
            onClick={() => setOpen(false)}
            className={cn(
              buttonVariants({ variant: 'outline' }),
              'h-11 rounded-lg border-2 border-border bg-card font-bold',
            )}
          >
            Open the calendar
            <ArrowRight className="size-4" />
          </Link>
        </div>
      </ResponsiveDialog>
    </>
  )
}
