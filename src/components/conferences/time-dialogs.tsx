import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { CircleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'
import {
  addTimes,
  cacheConference,
  clockIn,
  conflictMessage,
  dayIn,
  editTime,
  formatSlotDay,
  formatSlotRange,
  latestSlot,
  previewTimes,
} from '#/lib/conferences'
import type { Conference, ConferenceSlot } from '#/lib/conferences'
import { timeZoneLabel } from '#/lib/day'
import { timeZone } from '#/lib/marks'
import { useCanSave } from '#/lib/workspace'
import { OfflineNote } from '#/components/offline-note'
import { ResponsiveDialog } from '#/components/responsive-dialogue'
import { useSaveConference } from './use-save'

const LENGTHS = [10, 15, 20, 30]

const fieldClass =
  'h-11 rounded-lg border-2 border-border bg-card px-3 text-base'

/**
 * "Add times": a day, a start and an end, split into meetings of one
 * length. Times that overlap ones already there are skipped.
 */
export function AddTimesDialog({
  open,
  onOpenChange,
  conference,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  conference: Conference
}) {
  return (
    <ResponsiveDialog
      isOpen={open}
      setIsOpen={onOpenChange}
      title="Add times"
      description="Pick a day and the hours you’re free. They’re split into meetings you can adjust one by one."
      showDescription
    >
      {open && (
        <AddTimesForm
          conference={conference}
          onDone={() => onOpenChange(false)}
        />
      )}
    </ResponsiveDialog>
  )
}

function AddTimesForm({
  conference,
  onDone,
}: {
  conference: Conference
  onDone: () => void
}) {
  const queryClient = useQueryClient()
  // Online, and allowed: a co-teacher may only view conferences.
  const canSave = useCanSave('conferences')
  const tz = conference.timezone
  const today = dayIn(new Date().toISOString(), tz)
  const lastSlot = conference.slots.at(-1)
  const [date, setDate] = useState(
    lastSlot ? maxDate(dayIn(lastSlot.starts_at, tz), today) : today,
  )
  const [start, setStart] = useState('15:00')
  const [end, setEnd] = useState('18:00')
  const [minutes, setMinutes] = useState(15)
  const [custom, setCustom] = useState(false)
  const preview = previewTimes(start, end, minutes)

  const add = useMutation({
    mutationFn: () => addTimes(conference.id, { date, start, end, minutes }),
    onSuccess: ({ added, skipped, conference: saved }) => {
      cacheConference(queryClient, saved)
      onDone()
      if (added === 0) {
        toast.info('No times added', {
          description: 'They all overlap times you already have.',
        })
        return
      }
      toast.success(`Added ${added} ${added === 1 ? 'time' : 'times'}`, {
        description:
          skipped > 0
            ? `${skipped} overlapped times you already have, so ${skipped === 1 ? 'it was' : 'they were'} skipped.`
            : undefined,
      })
    },
    onError: (error) => {
      console.error('Adding times failed:', error)
      toast.error('Couldn’t add the times', {
        description: conflictMessage(error),
      })
    },
  })
  const busy = add.isPending

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault()
        if (preview && !busy) add.mutate()
      }}
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="times-date" className="font-bold">
          Day
        </Label>
        <Input
          id="times-date"
          type="date"
          min={today}
          required
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className={fieldClass}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="times-start" className="font-bold">
            From
          </Label>
          <Input
            id="times-start"
            type="time"
            step={300}
            required
            value={start}
            onChange={(e) => setStart(e.target.value)}
            className={fieldClass}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="times-end" className="font-bold">
            To
          </Label>
          <Input
            id="times-end"
            type="time"
            step={300}
            required
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            className={fieldClass}
          />
        </div>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-bold">Each meeting</legend>
        <div className="flex flex-wrap gap-2">
          {LENGTHS.map((m) => (
            <Button
              key={m}
              type="button"
              variant="outline"
              aria-pressed={!custom && minutes === m}
              onClick={() => {
                setCustom(false)
                setMinutes(m)
              }}
              className="h-11 rounded-lg border-2 border-border bg-card px-4 font-bold aria-pressed:border-primary aria-pressed:bg-primary/10"
            >
              {m} min
            </Button>
          ))}
          <Button
            type="button"
            variant="outline"
            aria-pressed={custom}
            onClick={() => setCustom(true)}
            className="h-11 rounded-lg border-2 border-border bg-card px-4 font-bold aria-pressed:border-primary aria-pressed:bg-primary/10"
          >
            Other
          </Button>
        </div>
        {custom && (
          <div className="flex items-center gap-2">
            <Input
              aria-label="Minutes per meeting"
              type="number"
              inputMode="numeric"
              min={5}
              max={120}
              step={5}
              value={minutes}
              onChange={(e) => setMinutes(Number(e.target.value))}
              className={cn(fieldClass, 'w-24')}
            />
            <span className="font-medium">minutes</span>
          </div>
        )}
      </fieldset>

      <p
        role="status"
        className={cn(
          'flex items-center gap-2 text-sm font-medium',
          !preview && 'text-muted-foreground',
        )}
      >
        {preview ? (
          `${preview.count} ${preview.count === 1 ? 'meeting' : 'meetings'}, ${formatClockSpan(start, preview.lastEnd)}`
        ) : (
          <>
            <CircleAlert className="size-4 shrink-0 text-destructive" />
            The end has to be at least one meeting after the start.
          </>
        )}
      </p>
      <TimeZoneNote date={date} timeZone={tz} />

      <div className="flex flex-col gap-2">
        <OfflineNote action="add times" />
        <Button
          type="submit"
          disabled={!preview || busy || !canSave}
          aria-busy={busy}
          className="h-12 rounded-lg border-2 border-border text-base font-bold shadow-sm"
        >
          {busy && <Spinner aria-hidden className="size-5" />}
          {preview ? `Add ${preview.count} times` : 'Add times'}
        </Button>
      </div>
    </form>
  )
}

/** Moves one time: a new day, start or end. */
export function EditTimeDialog({
  conference,
  slot,
  onClose,
}: {
  conference: Conference
  slot: ConferenceSlot | null
  onClose: () => void
}) {
  return (
    <ResponsiveDialog
      isOpen={slot !== null}
      setIsOpen={(open: boolean) => {
        if (!open) onClose()
      }}
      title="Change this time"
      description={
        slot
          ? `${formatSlotDay(slot.starts_at, conference.timezone)}, ${formatSlotRange(slot.starts_at, slot.ends_at, conference.timezone)}`
          : undefined
      }
      showDescription
    >
      {slot && (
        <EditTimeForm conference={conference} slot={slot} onDone={onClose} />
      )}
    </ResponsiveDialog>
  )
}

function EditTimeForm({
  conference,
  slot,
  onDone,
}: {
  conference: Conference
  slot: ConferenceSlot
  onDone: () => void
}) {
  const queryClient = useQueryClient()
  // Online, and allowed: a co-teacher may only view conferences.
  const canSave = useCanSave('conferences')
  const save = useSaveConference(conference.id)
  const tz = conference.timezone
  const [date, setDate] = useState(dayIn(slot.starts_at, tz))
  const [start, setStart] = useState(clockIn(slot.starts_at, tz))
  const [end, setEnd] = useState(clockIn(slot.ends_at, tz))
  const backwards = end <= start
  const busy = save.isPending

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault()
        if (backwards || busy) return
        save.mutate(
          () =>
            editTime(
              conference.id,
              latestSlot(queryClient, conference.id, slot),
              {
                date,
                start,
                end,
              },
            ),
          { onSuccess: onDone },
        )
      }}
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="slot-date" className="font-bold">
          Day
        </Label>
        <Input
          id="slot-date"
          type="date"
          required
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className={fieldClass}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="slot-start" className="font-bold">
            Starts
          </Label>
          <Input
            id="slot-start"
            type="time"
            step={300}
            required
            value={start}
            onChange={(e) => setStart(e.target.value)}
            className={fieldClass}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="slot-end" className="font-bold">
            Ends
          </Label>
          <Input
            id="slot-end"
            type="time"
            step={300}
            required
            value={end}
            aria-invalid={backwards || undefined}
            aria-describedby={backwards ? 'slot-time-error' : undefined}
            onChange={(e) => setEnd(e.target.value)}
            className={fieldClass}
          />
        </div>
      </div>
      {backwards && (
        <p
          id="slot-time-error"
          className="flex items-center gap-2 text-sm font-medium"
        >
          <CircleAlert className="size-4 shrink-0 text-destructive" />
          The end has to be after the start.
        </p>
      )}
      {slot.student_id && (
        <p className="text-sm text-muted-foreground">
          This family’s notice shows the old time, so the student will be marked
          “Needs a new notice”.
        </p>
      )}
      <TimeZoneNote date={date} timeZone={tz} />
      <div className="flex flex-col gap-2">
        <OfflineNote action="change times" />
        <Button
          type="submit"
          disabled={backwards || busy || !canSave}
          aria-busy={busy}
          className="h-12 rounded-lg border-2 border-border text-base font-bold shadow-sm"
        >
          {busy && <Spinner aria-hidden className="size-5" />}
          Save
        </Button>
      </div>
    </form>
  )
}

/** Shown when the teacher's device is in another time zone than the conference. */
function TimeZoneNote({
  date,
  timeZone: tz,
}: {
  date: string
  timeZone: string
}) {
  if (tz === timeZone() || !date) return null
  return (
    <p className="text-sm text-muted-foreground">
      Times are in {timeZoneLabel(date, tz)}, where this conference was set up.
    </p>
  )
}

/** "3:00 PM to 6:00 PM" from "15:00" and "18:00". */
function formatClockSpan(start: string, end: string) {
  const fmt = (t: string) => {
    const [h, m] = t.split(':').map(Number)
    return new Date(2000, 0, 1, h, m).toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    })
  }
  return `${fmt(start)} to ${fmt(end)}`
}

function maxDate(a: string, b: string) {
  return a > b ? a : b
}
