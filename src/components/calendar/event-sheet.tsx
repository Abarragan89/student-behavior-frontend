import { useId, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Bell,
  CalendarDays,
  CircleAlert,
  Clock,
  Mail,
  MapPin,
  Pencil,
  Repeat,
  Trash2,
  UsersRound,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { OfflineNote } from '#/components/offline-note'
import { ResponsiveDialog } from '#/components/responsive-dialogue'
import { formatClockRange, formatShortDate } from '#/lib/calendar'
import { formatLongDate } from '#/lib/day'
import { useOnline } from '#/lib/online'
import {
  REMINDERS,
  deleteEvent,
  describeRepeat,
  eventQueryOptions,
  repeatsWithinAWeek,
} from '#/lib/school-calendar'
import type { Occurrence, Scope, SchoolEvent } from '#/lib/school-calendar'
import { displayName } from '#/lib/staff'
import type { StaffDirectory } from '#/lib/staff'

/**
 * One date of an event: when, where, who, reminders, notes; Edit and
 * Delete. A past date is history: read only (a one-time past event can
 * still be deleted).
 */
export function EventSheet({
  occurrence,
  onClose,
  onEdit,
  directory,
  emailsOn,
}: {
  occurrence: Occurrence | null
  onClose: () => void
  onEdit: (event: SchoolEvent, date: string) => void
  directory: StaffDirectory | undefined
  /** Reminder and update emails go out. */
  emailsOn: boolean
}) {
  return (
    <ResponsiveDialog
      isOpen={occurrence !== null}
      setIsOpen={(open: boolean) => !open && onClose()}
      title={occurrence?.title ?? 'Event'}
      description={occurrence ? formatLongDate(occurrence.date) : undefined}
      showDescription
    >
      {occurrence && (
        <Details
          key={`${occurrence.event_id}:${occurrence.date}`}
          occurrence={occurrence}
          onClose={onClose}
          onEdit={onEdit}
          directory={directory}
          emailsOn={emailsOn}
        />
      )}
    </ResponsiveDialog>
  )
}

function Details({
  occurrence,
  onClose,
  onEdit,
  directory,
  emailsOn,
}: {
  occurrence: Occurrence
  onClose: () => void
  onEdit: (event: SchoolEvent, date: string) => void
  directory: StaffDirectory | undefined
  emailsOn: boolean
}) {
  const online = useOnline()
  const event = useQuery(eventQueryOptions(occurrence.event_id))
  const [deleting, setDeleting] = useState(false)

  if (!event.data) {
    return event.isError ? (
      <p role="alert" className="flex items-center gap-2 font-medium">
        <CircleAlert className="size-5 text-destructive" />
        Couldn’t open the event.
      </p>
    ) : (
      <p
        role="status"
        className="flex items-center gap-2 py-4 text-muted-foreground"
      >
        <Spinner aria-hidden className="size-5" />
        Opening…
      </p>
    )
  }
  const e = event.data
  const isSeries = !!e.repeat
  const canDelete = !occurrence.past || !isSeries
  const who = describeWho(e, directory)

  if (deleting) {
    return (
      <DeleteForm
        event={e}
        date={occurrence.date}
        tellsPeople={emailsOn && !occurrence.past}
        onCancel={() => setDeleting(false)}
        onDone={onClose}
      />
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <dl className="flex flex-col gap-3 text-base">
        <Row icon={Clock} label="When">
          {e.all_day
            ? 'All day'
            : formatClockRange(occurrence.start, occurrence.end)}
        </Row>
        {e.repeat && (
          <Row icon={Repeat} label="Repeats">
            {describeRepeat(e.repeat, e.date)}
            {e.until ? `, until ${formatShortDate(e.until)}` : ''}
          </Row>
        )}
        {e.series_id && e.original_date && (
          <Row icon={CalendarDays} label="Changed">
            Moved or changed from {formatShortDate(e.original_date)} in its
            series
          </Row>
        )}
        {e.location && (
          <Row icon={MapPin} label="Where">
            {e.location}
          </Row>
        )}
        <Row icon={UsersRound} label="Who">
          {who}
        </Row>
        <Row icon={Bell} label="Reminders">
          {e.reminders.length === 0
            ? 'None'
            : REMINDERS.filter((r) => e.reminders.includes(r.value))
                .map((r) => r.label)
                .join(', ')}
        </Row>
      </dl>
      {e.notes && (
        <p className="rounded-lg bg-muted px-3 py-2 text-sm whitespace-pre-line wrap-break-word">
          {e.notes}
        </p>
      )}
      {occurrence.past && (
        <p className="text-sm text-muted-foreground">
          This date has passed, so it can’t be changed.
        </p>
      )}
      <OfflineNote action="change events" />
      <div className="flex flex-wrap gap-2">
        {!occurrence.past && (
          <Button
            onClick={() => onEdit(e, occurrence.date)}
            disabled={!online}
            className="h-11 rounded-lg px-4 font-bold"
          >
            <Pencil />
            Edit
          </Button>
        )}
        {canDelete && (
          <Button
            variant="outline"
            onClick={() => setDeleting(true)}
            disabled={!online}
            className="h-11 rounded-lg border-2 px-4 font-bold"
          >
            <Trash2 className="text-destructive" />
            Delete
          </Button>
        )}
      </div>
    </div>
  )
}

function Row({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof Clock
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex gap-3">
      <dt className="sr-only">{label}</dt>
      <Icon
        aria-hidden
        className="mt-1 size-4 shrink-0 text-muted-foreground"
      />
      <dd className="min-w-0 wrap-break-word">{children}</dd>
    </div>
  )
}

function describeWho(e: SchoolEvent, directory: StaffDirectory | undefined) {
  if (e.everyone) return 'Everyone on staff'
  if (!directory) return '…'
  const groups = directory.groups
    .filter((g) => e.group_ids.includes(g.id))
    .map((g) => g.name)
  const people = directory.people
    .filter((p) => e.staff_ids.includes(p.id))
    .map(displayName)
  const parts = [...groups, ...people]
  if (parts.length === 0) return 'Nobody invited'
  return parts.length > 8
    ? `${parts.slice(0, 8).join(', ')} and ${parts.length - 8} more`
    : parts.join(', ')
}

/** "Delete this event / this week / this and all future events". */
function DeleteForm({
  event,
  date,
  tellsPeople,
  onCancel,
  onDone,
}: {
  event: SchoolEvent
  date: string
  /** Deleting emails everyone invited that it's cancelled. */
  tellsPeople: boolean
  onCancel: () => void
  onDone: () => void
}) {
  const id = useId()
  const queryClient = useQueryClient()
  const isSeries = !!event.repeat
  const choices: Array<{ scope: Scope; label: string }> = isSeries
    ? [
        { scope: 'one', label: `Only ${formatShortDate(date)}` },
        ...(repeatsWithinAWeek(event.repeat)
          ? [
              {
                scope: 'week' as Scope,
                label: `The week of ${formatShortDate(date)}`,
              },
            ]
          : []),
        {
          scope: 'future',
          label: `${formatShortDate(date)} and every date after`,
        },
      ]
    : []
  const [scope, setScope] = useState<Scope>('one')
  const remove = useMutation({
    mutationFn: () => deleteEvent(event.id, date, scope),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['school-calendar'] })
      void queryClient.invalidateQueries({ queryKey: ['school-event'] })
      onDone()
      toast.success(
        !isSeries
          ? 'Event deleted'
          : scope === 'one'
            ? 'Date cancelled'
            : scope === 'week'
              ? 'Week cancelled'
              : 'Future dates deleted',
      )
    },
    onError: (error) => {
      console.error('Deleting the event failed:', error)
      toast.error('Couldn’t delete. Try again.')
    },
  })
  const busy = remove.isPending
  return (
    <div className="flex flex-col gap-4">
      {isSeries ? (
        <fieldset disabled={busy} className="flex flex-col gap-2">
          <legend className="mb-1 font-bold">Delete which dates?</legend>
          {choices.map((c) => (
            <label
              key={c.scope}
              className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border-2 border-border bg-card px-3 py-2 font-bold has-checked:border-primary has-checked:bg-primary/10"
            >
              <input
                type="radio"
                name={`${id}-scope`}
                checked={scope === c.scope}
                onChange={() => setScope(c.scope)}
                className="size-4 shrink-0 accent-primary"
              />
              {c.label}
            </label>
          ))}
          <p className="text-sm text-muted-foreground">
            Earlier dates stay on the calendar.
          </p>
        </fieldset>
      ) : (
        <p className="font-bold">Delete {event.title}?</p>
      )}
      {tellsPeople && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Mail className="size-4 shrink-0" />
          Everyone invited gets an email that it’s cancelled.
        </p>
      )}
      <div className="flex gap-2">
        <Button
          variant="destructive"
          onClick={() => remove.mutate()}
          disabled={busy}
          className="h-11 rounded-lg px-4 font-bold"
        >
          {busy && <Spinner aria-hidden className="size-4" />}
          Delete
        </Button>
        <Button
          variant="outline"
          onClick={onCancel}
          disabled={busy}
          className="h-11 rounded-lg border-2 px-4 font-bold"
        >
          Keep it
        </Button>
      </div>
    </div>
  )
}
