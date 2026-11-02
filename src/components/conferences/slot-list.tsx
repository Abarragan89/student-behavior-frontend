import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Clock,
  EllipsisVertical,
  KeyRound,
  Plus,
  Trash2,
  UserMinus,
} from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'
import {
  assignStudent,
  conferenceQueryOptions,
  formatSlotDay,
  formatSlotRange,
  fullName,
  latestSlot,
  newCode,
  removeTime,
  shortName,
  slotsByDay,
} from '#/lib/conferences'
import type {
  Conference,
  ConferenceSlot,
  ConferenceStudent,
} from '#/lib/conferences'
import { useOnline } from '#/lib/online'
import { useSaveConference } from './use-save'

/** What the teacher should know about a student's notice. */
export type NoticeStatus = 'none' | 'printed' | 'outdated'

/**
 * 'outdated': the time the family was last told about (on paper, or picked
 * themselves) isn't their time anymore, because the teacher moved it.
 */
export function noticeStatus(
  conference: Conference,
  slot: ConferenceSlot,
): NoticeStatus {
  const n = conference.notices.find((x) => x.student_id === slot.student_id)
  if (!n?.printed_at) return 'none'
  if (
    !n.notified_starts_at ||
    Date.parse(n.notified_starts_at) !== Date.parse(slot.starts_at)
  ) {
    return 'outdated'
  }
  return 'printed'
}

/** The conference's times by day, each with who has it. */
export function SlotList({
  conference,
  onPickStudent,
  onEditTime,
}: {
  conference: Conference
  onPickStudent: (slot: ConferenceSlot) => void
  onEditTime: (slot: ConferenceSlot) => void
}) {
  const tz = conference.timezone
  const students = new Map(conference.students.map((s) => [s.id, s]))
  // The family's latest move, to say which times they picked themselves.
  const pickedByFamily = new Set<string>()
  const seen = new Set<string>()
  for (const c of conference.changes) {
    if (seen.has(c.student_id)) continue
    seen.add(c.student_id)
    pickedByFamily.add(`${c.student_id}@${Date.parse(c.to_starts_at)}`)
  }

  return (
    <div className="flex flex-col gap-5">
      {slotsByDay(conference.slots, tz).map(({ day, slots }) => (
        <section key={day} className="flex flex-col gap-2">
          <h2 className="text-lg font-bold">
            {formatSlotDay(slots[0].starts_at, tz)}
          </h2>
          <ul className="flex flex-col gap-2">
            {slots.map((slot) => {
              const student = slot.student_id
                ? students.get(slot.student_id)
                : undefined
              return (
                <SlotRow
                  key={slot.id}
                  conference={conference}
                  slot={slot}
                  student={student}
                  picked={
                    !!student &&
                    pickedByFamily.has(
                      `${student.id}@${Date.parse(slot.starts_at)}`,
                    )
                  }
                  onPickStudent={() => onPickStudent(slot)}
                  onEditTime={() => onEditTime(slot)}
                />
              )
            })}
          </ul>
        </section>
      ))}
    </div>
  )
}

function SlotRow({
  conference,
  slot,
  student,
  picked,
  onPickStudent,
  onEditTime,
}: {
  conference: Conference
  slot: ConferenceSlot
  student: ConferenceStudent | undefined
  picked: boolean
  onPickStudent: () => void
  onEditTime: () => void
}) {
  const queryClient = useQueryClient()
  const online = useOnline()
  const save = useSaveConference(conference.id)
  const [removeOpen, setRemoveOpen] = useState(false)
  const [codeOpen, setCodeOpen] = useState(false)
  const tz = conference.timezone
  const time = formatSlotRange(slot.starts_at, slot.ends_at, tz)
  const past = Date.parse(slot.ends_at) < Date.now()
  const notice = student ? noticeStatus(conference, slot) : null

  const latest = () => latestSlot(queryClient, conference.id, slot)
  const remove = () =>
    save.mutate(() => removeTime(conference.id, latest()), {
      onSuccess: () => {
        setRemoveOpen(false)
        toast.success(`Removed ${time}`, {
          description: student
            ? `${student.first_name} no longer has a time.`
            : undefined,
        })
      },
    })

  return (
    <li
      className={cn(
        'flex items-center gap-2 rounded-lg border-2 border-border bg-card p-2 shadow-sm',
        past && 'opacity-60',
      )}
    >
      <span className="w-28 shrink-0 pl-1 text-sm font-bold tabular-nums sm:w-36 sm:text-base">
        {time}
      </span>
      <button
        type="button"
        onClick={onPickStudent}
        disabled={!online}
        className={cn(
          'flex min-h-11 min-w-0 flex-1 flex-col justify-center rounded-md px-2 py-1 text-left transition-colors hover:bg-muted focus-visible:ring-4 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-not-allowed motion-reduce:transition-none',
        )}
      >
        {student ? (
          <>
            <span className="truncate font-bold">
              <span className="sm:hidden">{shortName(student)}</span>
              <span className="hidden sm:inline">{fullName(student)}</span>
            </span>
            <span className="flex flex-wrap gap-1">
              {picked && <Badge variant="secondary">Picked by family</Badge>}
              {notice === 'outdated' && (
                <Badge className="bg-chart-3 text-foreground">
                  Needs a new notice
                </Badge>
              )}
              {notice === 'none' && (
                <Badge variant="outline">Notice not printed</Badge>
              )}
              {!student.in_classes && (
                <Badge variant="outline">Left the class</Badge>
              )}
            </span>
          </>
        ) : (
          <span className="flex items-center gap-1 font-medium whitespace-nowrap text-muted-foreground">
            <Plus aria-hidden className="size-4 shrink-0" />
            <span className="sr-only">Open. </span>
            Add a student
          </span>
        )}
      </button>

      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={`More for ${time}`}
          disabled={!online}
          className="flex size-10 shrink-0 items-center justify-center rounded-lg text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-4 focus-visible:ring-ring disabled:opacity-50"
        >
          <EllipsisVertical className="size-5" />
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="w-60 rounded-lg border-2 border-border p-1 shadow-md ring-0"
        >
          <DropdownMenuItem
            className="h-10 rounded-md font-bold"
            onClick={onEditTime}
          >
            <Clock />
            Change time
          </DropdownMenuItem>
          {student && (
            <>
              <DropdownMenuItem
                className="h-10 rounded-md font-bold"
                onClick={() =>
                  save.mutate(() =>
                    assignStudent(conference.id, latest(), null),
                  )
                }
              >
                <UserMinus />
                Clear {student.first_name}
              </DropdownMenuItem>
              <DropdownMenuItem
                className="h-10 rounded-md font-bold"
                onClick={() => setCodeOpen(true)}
              >
                <KeyRound />
                Make a new QR code
              </DropdownMenuItem>
            </>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            className="h-10 rounded-md font-bold"
            onClick={() => (student ? setRemoveOpen(true) : remove())}
          >
            <Trash2 />
            Remove time
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {student && (
        <>
          <Confirm
            open={removeOpen}
            onOpenChange={setRemoveOpen}
            title={`Remove ${time}?`}
            body={`${fullName(student)} has this time. They’ll have no time until you give them one, and their family can pick an open time with their QR code.`}
            action="Remove time"
            busy={save.isPending}
            onConfirm={remove}
          />
          <NewCodeDialog
            conference={conference}
            student={student}
            open={codeOpen}
            onOpenChange={setCodeOpen}
          />
        </>
      )}
    </li>
  )
}

/** Students in the classes who don't have a time yet. */
export function UnscheduledPanel({
  conference,
  onPick,
}: {
  conference: Conference
  onPick: (student: ConferenceStudent) => void
}) {
  const online = useOnline()
  const scheduled = new Set(conference.slots.map((s) => s.student_id))
  const waiting = conference.students.filter(
    (s) => s.in_classes && !scheduled.has(s.id),
  )
  if (waiting.length === 0) return null
  return (
    <section className="flex flex-col gap-2 rounded-xl border-2 border-dashed border-border p-4">
      <h2 className="font-bold">
        No time yet{' '}
        <span className="text-muted-foreground">({waiting.length})</span>
      </h2>
      <p className="text-sm text-muted-foreground">
        Tap a name to give them an open time.
      </p>
      <ul className="flex flex-wrap gap-2">
        {waiting.map((s) => (
          <li key={s.id}>
            <button
              type="button"
              disabled={!online}
              onClick={() => onPick(s)}
              className="min-h-10 rounded-full border-2 border-border bg-card px-3 text-sm font-bold transition-colors hover:bg-primary/10 focus-visible:ring-4 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-50 motion-reduce:transition-none"
            >
              {shortName(s)}
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}

/** Replaces a student's code, for a lost notice or one being misused. */
function NewCodeDialog({
  conference,
  student,
  open,
  onOpenChange,
}: {
  conference: Conference
  student: ConferenceStudent
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const make = useMutation({
    mutationFn: () => newCode(conference.id, student.id),
    onSuccess: () => {
      onOpenChange(false)
      void queryClient.invalidateQueries({
        queryKey: conferenceQueryOptions(conference.id).queryKey,
      })
      toast.success('New QR code made', {
        description: `Print ${student.first_name} a new notice: the old one doesn’t work anymore.`,
      })
    },
    onError: (error) => {
      console.error('Making a new code failed:', error)
      toast.error(
        'Couldn’t make a new code. Check your connection and try again.',
      )
    },
  })
  return (
    <Confirm
      open={open}
      onOpenChange={onOpenChange}
      title={`Make a new QR code for ${student.first_name}?`}
      body={`The code on ${possessive(student.first_name)} notice stops working right away, and anyone who has it can no longer see or change the time. Then print a new notice for the family.`}
      action="Make a new code"
      busy={make.isPending}
      onConfirm={() => make.mutate()}
    />
  )
}

function Confirm({
  open,
  onOpenChange,
  title,
  body,
  action,
  busy,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  body: string
  action: string
  busy: boolean
  onConfirm: () => void
}) {
  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!busy) onOpenChange(next)
      }}
    >
      <AlertDialogContent className="rounded-lg border-2 border-border ring-0">
        <AlertDialogHeader>
          <AlertDialogTitle className="font-bold wrap-break-word">
            {title}
          </AlertDialogTitle>
          <AlertDialogDescription>{body}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={busy}
            aria-busy={busy}
            className={cn(
              'relative bg-destructive font-bold text-destructive-foreground hover:bg-destructive/90',
              busy && 'disabled:opacity-100',
            )}
          >
            <span className={cn(busy && 'invisible')}>{action}</span>
            {busy && (
              <Spinner
                aria-label="Working"
                className="absolute inset-0 m-auto size-4"
              />
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

/** "Mia’s", "James’" */
function possessive(name: string) {
  return name.endsWith('s') ? `${name}’` : `${name}’s`
}
