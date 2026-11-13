import { useQuery } from '@tanstack/react-query'
import {
  Bell,
  CalendarDays,
  CircleAlert,
  Clock,
  MapPin,
  Repeat,
  Tag,
  UserRoundCheck,
  UsersRound,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { CategoryDot } from '#/components/calendar/categories'
import { ResponsiveDialog } from '#/components/responsive-dialogue'
import {
  formatClockRange,
  formatDayRange,
  formatShortDate,
} from '#/lib/calendar'
import { formatLongDate } from '#/lib/day'
import { isSpan } from '#/lib/event-span'
import {
  describeRepeat,
  REMINDERS,
  staffEventQueryOptions,
} from '#/lib/school-calendar'
import type {
  EventCategory,
  Occurrence,
  StaffEvent,
} from '#/lib/school-calendar'

/**
 * One event, read only: a teacher's view of their school calendar. What the
 * calendar sent shows at once; the notes, how it repeats, who's invited and
 * their reminders follow from the event itself.
 */
export function OccurrenceSheet({
  occurrence,
  categories,
  onClose,
}: {
  occurrence: Occurrence | null
  categories: Array<EventCategory>
  onClose: () => void
}) {
  const o = occurrence
  return (
    <ResponsiveDialog
      isOpen={o !== null}
      setIsOpen={(open: boolean) => !open && onClose()}
      title={o?.title ?? ''}
      description={o ? formatLongDate(o.date) : ''}
      className="sm:max-w-md"
    >
      {o && (
        <Details
          key={`${o.event_id}:${o.date}`}
          occurrence={o}
          categories={categories}
        />
      )}
    </ResponsiveDialog>
  )
}

function Details({
  occurrence: o,
  categories,
}: {
  occurrence: Occurrence
  categories: Array<EventCategory>
}) {
  const details = useQuery(staffEventQueryOptions(o.event_id))
  const e = details.data
  const category = o.category_id
    ? categories.find((c) => c.id === o.category_id)
    : undefined
  const who = e && describeWho(e)
  const reminders = e
    ? REMINDERS.filter((r) => e.reminders.includes(r.value)).map((r) => r.label)
    : []

  return (
    <div className="flex flex-col gap-4">
      <dl className="flex flex-col gap-3">
        <Row
          icon={<CalendarDays className="size-5" />}
          label={isSpan(o) ? 'Dates' : 'Date'}
        >
          {isSpan(o)
            ? formatDayRange(o.first_day, o.last_day)
            : formatLongDate(o.date)}
        </Row>
        <Row icon={<Clock className="size-5" />} label="Time">
          {o.all_day
            ? 'All day'
            : `${formatClockRange(o.start, o.end)}${isSpan(o) ? ' each day' : ''}`}
        </Row>
        {e?.repeat ? (
          <Row icon={<Repeat className="size-5" />} label="Repeats">
            {describeRepeat(e.repeat, e.date)}
            {e.until ? `, until ${formatShortDate(e.until)}` : ''}
          </Row>
        ) : (
          o.repeats &&
          !e && (
            <Row icon={<Repeat className="size-5" />} label="Repeats">
              One of a series
            </Row>
          )
        )}
        {e?.series_id && e.original_date && (
          <Row icon={<CalendarDays className="size-5" />} label="Changed">
            Moved or changed from {formatShortDate(e.original_date)} in its
            series
          </Row>
        )}
        {o.location && (
          <Row icon={<MapPin className="size-5" />} label="Where">
            {o.location}
          </Row>
        )}
        {category && (
          <Row icon={<Tag className="size-5" />} label="Category">
            <span className="flex items-center gap-2">
              <CategoryDot color={category.color} />
              {category.name}
            </span>
          </Row>
        )}
        {who && (
          <Row icon={<UsersRound className="size-5" />} label="Who">
            {who}
          </Row>
        )}
        {o.invited && (
          <Row icon={<UserRoundCheck className="size-5" />} label="You">
            You’re invited
          </Row>
        )}
        {reminders.length > 0 && (
          <Row icon={<Bell className="size-5" />} label="Reminders">
            {reminders.length === 1 ? 'Email reminder' : 'Email reminders'}:{' '}
            {reminders.join(', ')}
          </Row>
        )}
      </dl>
      {e?.notes && (
        <p className="rounded-lg bg-muted px-3 py-2 text-sm whitespace-pre-line wrap-break-word">
          {e.notes}
        </p>
      )}
      {!e &&
        (details.isError ? (
          <div
            role="alert"
            className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm"
          >
            <span className="flex items-center gap-2 text-muted-foreground">
              <CircleAlert className="size-4 shrink-0 text-destructive" />
              Couldn’t load the notes and who’s invited.
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void details.refetch()}
              disabled={details.isFetching}
              className="rounded-lg border-2 font-bold"
            >
              Try again
            </Button>
          </div>
        ) : details.fetchStatus === 'paused' ? (
          <p className="text-sm text-muted-foreground">
            The notes and who’s invited show once you’re back online.
          </p>
        ) : (
          <p
            role="status"
            className="flex items-center gap-2 text-sm text-muted-foreground"
          >
            <Spinner aria-hidden className="size-4" />
            Loading the notes…
          </p>
        ))}
    </div>
  )
}

/** "Everyone on staff", or the groups then people, up to 8 named; none: null. */
function describeWho(e: StaffEvent) {
  if (e.everyone) return 'Everyone on staff'
  const names = [...e.groups, ...e.people]
  if (names.length === 0) return null
  return names.length > 8
    ? `${names.slice(0, 8).join(', ')} and ${names.length - 8} more`
    : names.join(', ')
}

function Row({
  icon,
  label,
  children,
}: {
  icon: ReactNode
  label: string
  children: ReactNode
}) {
  return (
    <div className="flex items-start gap-3">
      <span aria-hidden className="mt-0.5 shrink-0 text-muted-foreground">
        {icon}
      </span>
      <dt className="sr-only">{label}</dt>
      <dd className="min-w-0 font-medium wrap-break-word">{children}</dd>
    </div>
  )
}
