import {
  CalendarDays,
  Clock,
  MapPin,
  Repeat,
  Tag,
  UserRoundCheck,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { CategoryDot } from '#/components/calendar/categories'
import { ResponsiveDialog } from '#/components/responsive-dialogue'
import { formatClockRange, formatDayRange } from '#/lib/calendar'
import { formatLongDate } from '#/lib/day'
import { isSpan } from '#/lib/event-span'
import type { EventCategory, Occurrence } from '#/lib/school-calendar'

/**
 * One event, read only: a teacher's view of their school calendar. What the
 * calendar sent is all there is (no notes, no guest list).
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
  const category = o?.category_id
    ? categories.find((c) => c.id === o.category_id)
    : undefined
  return (
    <ResponsiveDialog
      isOpen={o !== null}
      setIsOpen={(open: boolean) => !open && onClose()}
      title={o?.title ?? ''}
      description={o ? formatLongDate(o.date) : ''}
      className="sm:max-w-md"
    >
      {o && (
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
          {o.repeats && (
            <Row icon={<Repeat className="size-5" />} label="Repeats">
              One of a series
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
          {o.invited && (
            <Row icon={<UserRoundCheck className="size-5" />} label="You">
              You’re invited
            </Row>
          )}
        </dl>
      )}
    </ResponsiveDialog>
  )
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
      <dd className="min-w-0 font-medium">{children}</dd>
    </div>
  )
}
