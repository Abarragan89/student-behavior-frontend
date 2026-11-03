import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Search, UserMinus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import {
  assignStudent,
  formatSlotDay,
  formatSlotMoment,
  formatSlotRange,
  fullName,
  latestSlot,
  slotsByDay,
} from '#/lib/conferences'
import type {
  Conference,
  ConferenceSlot,
  ConferenceStudent,
} from '#/lib/conferences'
import { useCanSave } from '#/lib/workspace'
import { OfflineNote } from '#/components/offline-note'
import { ResponsiveDialog } from '#/components/responsive-dialogue'
import { useSaveConference } from './use-save'

/**
 * Who has this time: students without a time first, then the ones who have
 * one (picking them moves them here), then anyone who has left the
 * conference's classes but still has a time.
 */
export function StudentPickerDialog({
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
      title="Who has this time?"
      description={
        slot
          ? `${formatSlotDay(slot.starts_at, conference.timezone)}, ${formatSlotRange(slot.starts_at, slot.ends_at, conference.timezone)}`
          : undefined
      }
      showDescription
    >
      {slot && (
        <StudentList
          conference={conference}
          // As it is now: a family may have moved in since it was tapped.
          slot={conference.slots.find((s) => s.id === slot.id) ?? slot}
          onDone={onClose}
        />
      )}
    </ResponsiveDialog>
  )
}

function StudentList({
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
  const [search, setSearch] = useState('')
  const tz = conference.timezone

  const slotOf = new Map(
    conference.slots
      .filter((s) => s.student_id !== null)
      .map((s) => [s.student_id as string, s]),
  )
  const byId = new Map(conference.students.map((s) => [s.id, s]))
  const holder = slot.student_id ? byId.get(slot.student_id) : undefined
  const query = search.trim().toLowerCase()
  const matches = (s: ConferenceStudent) =>
    !query || fullName(s).toLowerCase().includes(query)
  const others = conference.students.filter(
    (s) => s.id !== slot.student_id && matches(s),
  )
  const groups = [
    {
      title: 'No time yet',
      students: others.filter((s) => !slotOf.has(s.id) && s.in_classes),
    },
    {
      title: 'Have a time (moves them here)',
      students: others.filter((s) => slotOf.has(s.id) && s.in_classes),
    },
    {
      title: 'Not in these classes anymore',
      students: others.filter((s) => !s.in_classes),
    },
  ].filter((g) => g.students.length > 0)

  function pick(student: ConferenceStudent | null) {
    save.mutate(
      () =>
        assignStudent(
          conference.id,
          latestSlot(queryClient, conference.id, slot),
          student?.id ?? null,
        ),
      {
        onSuccess: () => {
          onDone()
          const from = student ? slotOf.get(student.id) : undefined
          if (student && from) {
            toast.success(`Moved ${student.first_name}`, {
              description: `From ${formatSlotMoment(from.starts_at, tz)}${holder ? `. ${holder.first_name} no longer has a time.` : ''}`,
            })
          } else if (holder) {
            toast.success(`${holder.first_name} no longer has a time`)
          }
        },
      },
    )
  }

  const busy = save.isPending
  const disabled = busy || !canSave

  return (
    <div className="flex flex-col gap-4">
      <OfflineNote action="change who has a time" />
      {holder && (
        <div className="flex items-center gap-3 rounded-lg border-2 border-primary bg-primary/10 p-3">
          <span className="min-w-0 flex-1 truncate font-bold">
            {fullName(holder)}
          </span>
          <Button
            variant="outline"
            disabled={disabled}
            onClick={() => pick(null)}
            className="h-10 rounded-lg border-2 border-border bg-card font-bold"
          >
            <UserMinus className="size-4" />
            Clear
          </Button>
        </div>
      )}
      <div className="relative">
        <Search
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          type="search"
          aria-label="Find a student"
          placeholder="Find a student"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-11 rounded-lg border-2 border-border bg-card pr-3 pl-9 text-base"
        />
      </div>
      {groups.length === 0 && (
        <p className="text-sm text-muted-foreground">
          {conference.students.length === 0
            ? 'No students in this conference’s classes. Pick classes in Settings.'
            : 'No one matches.'}
        </p>
      )}
      {groups.map((g) => (
        <section key={g.title} className="flex flex-col gap-2">
          <h3 className="text-sm font-bold text-muted-foreground">{g.title}</h3>
          <ul className="flex flex-col gap-2">
            {g.students.map((s) => {
              const current = slotOf.get(s.id)
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => pick(s)}
                    className="flex min-h-12 w-full items-center gap-3 rounded-lg border-2 border-border bg-card px-4 py-2 text-left font-bold transition-colors hover:bg-muted focus-visible:ring-4 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-50 motion-reduce:transition-none"
                  >
                    <span className="min-w-0 flex-1 truncate">
                      {fullName(s)}
                    </span>
                    {current && (
                      <span className="shrink-0 text-sm font-medium text-muted-foreground">
                        {formatSlotMoment(current.starts_at, tz)}
                      </span>
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </div>
  )
}

/** Picks an open time for a student who has none. */
export function TimePickerDialog({
  conference,
  student,
  onClose,
}: {
  conference: Conference
  student: ConferenceStudent | null
  onClose: () => void
}) {
  return (
    <ResponsiveDialog
      isOpen={student !== null}
      setIsOpen={(open: boolean) => {
        if (!open) onClose()
      }}
      title={student ? `Pick a time for ${student.first_name}` : 'Pick a time'}
    >
      {student && (
        <OpenTimes conference={conference} student={student} onDone={onClose} />
      )}
    </ResponsiveDialog>
  )
}

function OpenTimes({
  conference,
  student,
  onDone,
}: {
  conference: Conference
  student: ConferenceStudent
  onDone: () => void
}) {
  const queryClient = useQueryClient()
  // Online, and allowed: a co-teacher may only view conferences.
  const canSave = useCanSave('conferences')
  const save = useSaveConference(conference.id)
  const tz = conference.timezone
  const now = Date.now()
  const open = conference.slots.filter(
    (s) => s.student_id === null && Date.parse(s.starts_at) > now,
  )
  const days = slotsByDay(open, tz)
  const disabled = save.isPending || !canSave

  return (
    <div className="flex flex-col gap-4">
      <OfflineNote action="give times" />
      {days.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No open times left. Add more with Add times.
        </p>
      )}
      {days.map(({ day, slots }) => (
        <section key={day} className="flex flex-col gap-2">
          <h3 className="font-bold">{formatSlotDay(slots[0].starts_at, tz)}</h3>
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {slots.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() =>
                    save.mutate(
                      () =>
                        assignStudent(
                          conference.id,
                          latestSlot(queryClient, conference.id, s),
                          student.id,
                        ),
                      { onSuccess: onDone },
                    )
                  }
                  className={cn(
                    'flex min-h-12 w-full items-center justify-center rounded-lg border-2 border-border bg-card px-2 py-2 text-sm font-bold transition-colors hover:bg-primary/10 focus-visible:ring-4 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-50 motion-reduce:transition-none',
                  )}
                >
                  {formatSlotRange(s.starts_at, s.ends_at, tz)}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
