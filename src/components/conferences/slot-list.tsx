import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Check,
  Clock,
  EllipsisVertical,
  KeyRound,
  MessageSquareText,
  Plus,
  Printer,
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
  deleteDay,
  formatSlotDay,
  formatSlotRange,
  fullName,
  latestSlot,
  latestVersion,
  markCompleted,
  meetingState,
  newCode,
  noticeStatus,
  removeTime,
  shortName,
  slotsByDay,
} from '#/lib/conferences'
import type {
  Conference,
  ConferenceSlot,
  ConferenceStudent,
  MeetingState,
} from '#/lib/conferences'
import { useCanSave } from '#/lib/workspace'
import { useSaveConference } from './use-save'

/**
 * The conference's times by day, each with who has it, a round checkbox to
 * check the meeting off, and the note icon when the teacher wrote one.
 */
export function SlotList({
  conference,
  now,
  onPickStudent,
  onEditTime,
  onNote,
  onPrintDay,
}: {
  conference: Conference
  /** Date.now(), ticking: a meeting that ends becomes a no-show. */
  now: number
  onPickStudent: (slot: ConferenceSlot) => void
  onEditTime: (slot: ConferenceSlot) => void
  /** Opens the note on the student's meeting. */
  onNote: (student: ConferenceStudent) => void
  /** Prints the schedule for day ("2026-11-12"). */
  onPrintDay: (day: string) => void
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
          {/* The ⋯ lines up with the rows' (their border and padding). */}
          <div className="flex items-center gap-2 pr-2 sm:pr-2.5">
            <h2 className="min-w-0 flex-1 text-lg font-bold">
              {formatSlotDay(slots[0].starts_at, tz)}
            </h2>
            <DayMenu
              conference={conference}
              day={day}
              slots={slots}
              onPrint={() => onPrintDay(day)}
            />
          </div>
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
                  now={now}
                  picked={
                    !!student &&
                    pickedByFamily.has(
                      `${student.id}@${Date.parse(slot.starts_at)}`,
                    )
                  }
                  onPickStudent={() => onPickStudent(slot)}
                  onEditTime={() => onEditTime(slot)}
                  onNote={onNote}
                />
              )
            })}
          </ul>
        </section>
      ))}
    </div>
  )
}

/** A day's ⋯ menu: print just that day, or delete all its times. */
function DayMenu({
  conference,
  day,
  slots,
  onPrint,
}: {
  conference: Conference
  day: string
  slots: Array<ConferenceSlot>
  onPrint: () => void
}) {
  const queryClient = useQueryClient()
  // Online, and allowed: a co-teacher may only view conferences.
  const canSave = useCanSave('conferences')
  const save = useSaveConference(conference.id)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const label = formatSlotDay(slots[0].starts_at, conference.timezone)
  const times = `${slots.length} ${slots.length === 1 ? 'time' : 'times'}`
  const booked = slots.filter((s) => s.student_id).length

  // Sent with the version the page shows: if a family moved meanwhile, the
  // server refuses, the page reloads, and this dialog shows the new counts.
  const remove = () =>
    save.mutate(
      () =>
        deleteDay(conference.id, day, latestVersion(queryClient, conference)),
      {
        onSuccess: () => {
          setDeleteOpen(false)
          toast.success(`Deleted ${label}`, { description: `${times} removed` })
        },
      },
    )

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={`More for ${label}`}
          className="flex size-10 shrink-0 items-center justify-center rounded-lg text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-4 focus-visible:ring-ring"
        >
          <EllipsisVertical className="size-5" />
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="w-60 rounded-lg border-2 border-border p-1 shadow-md ring-0"
        >
          <DropdownMenuItem
            className="h-10 rounded-md font-bold"
            onClick={onPrint}
          >
            <Printer />
            Print this day
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            className="h-10 rounded-md font-bold"
            disabled={!canSave}
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 />
            Delete this day
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Confirm
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`Delete ${label}?`}
        body={
          `This removes all ${times} on this day.` +
          (booked === 0
            ? ''
            : booked === 1
              ? ' 1 student loses their time and moves to No time yet: give them a new time, then print them a new notice.'
              : ` ${booked} students lose their time and move to No time yet: give them new times, then print them new notices.`)
        }
        action="Delete day"
        busy={save.isPending}
        onConfirm={remove}
      />
    </>
  )
}

function SlotRow({
  conference,
  slot,
  student,
  now,
  picked,
  onPickStudent,
  onEditTime,
  onNote,
}: {
  conference: Conference
  slot: ConferenceSlot
  student: ConferenceStudent | undefined
  now: number
  picked: boolean
  onPickStudent: () => void
  onEditTime: () => void
  onNote: (student: ConferenceStudent) => void
}) {
  const queryClient = useQueryClient()
  // Online, and allowed: a co-teacher may only view conferences.
  const canSave = useCanSave('conferences')
  const save = useSaveConference(conference.id)
  // Its own, so a check going out doesn't show the remove dialog as busy.
  const check = useSaveConference(conference.id)
  const [removeOpen, setRemoveOpen] = useState(false)
  const [codeOpen, setCodeOpen] = useState(false)
  // The check the teacher just tapped, shown until the server answers.
  const [checking, setChecking] = useState<boolean | null>(null)
  const tz = conference.timezone
  const time = formatSlotRange(slot.starts_at, slot.ends_at, tz)
  const past = Date.parse(slot.ends_at) <= now
  const completed = checking ?? slot.completed
  const state: MeetingState = student
    ? meetingState({ ...slot, completed }, now)
    : 'open'
  // Once the meeting is over, the notice doesn't matter anymore.
  const notice =
    student && !past
      ? noticeStatus(conference, student.id, slot.starts_at)
      : null

  const toggle = () => {
    const next = !completed
    setChecking(next)
    check.mutate(
      () =>
        markCompleted(
          conference.id,
          latestSlot(queryClient, conference.id, slot),
          next,
        ),
      { onSettled: () => setChecking(null) },
    )
  }

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
        'flex items-center gap-1.5 rounded-lg border-2 border-border bg-card p-1.5 shadow-sm transition-colors motion-reduce:transition-none sm:gap-2 sm:p-2',
        state === 'completed' && 'border-success bg-success/10',
        state === 'no_show' && 'border-destructive bg-destructive/10',
        state === 'open' && past && 'opacity-60',
      )}
    >
      {student ? (
        <CompleteToggle
          checked={completed}
          missed={state === 'no_show'}
          label={`Meeting with ${fullName(student)}, ${time}, complete`}
          disabled={!canSave}
          onToggle={toggle}
        />
      ) : (
        <span aria-hidden className="size-10 shrink-0" />
      )}
      <span className="w-26 shrink-0 text-sm font-bold tabular-nums sm:w-36 sm:text-base">
        {time}
      </span>
      <button
        type="button"
        onClick={onPickStudent}
        disabled={!canSave}
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
              {state === 'no_show' && (
                <Badge className="bg-destructive font-bold text-destructive-foreground">
                  No show
                </Badge>
              )}
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
            {/* Phones have room for "Add" only; screen readers hear it all. */}
            <span>
              Add<span className="sr-only sm:not-sr-only"> a student</span>
            </span>
          </span>
        )}
      </button>

      {/* Beside the name, not in its button: a button can't hold another.
          Open to view-only co-teachers too, so they can read it. */}
      {student?.note && (
        <button
          type="button"
          onClick={() => onNote(student)}
          aria-label={`Note for ${fullName(student)}`}
          title={student.note}
          className="flex size-10 shrink-0 items-center justify-center rounded-lg text-primary outline-none hover:bg-muted focus-visible:ring-4 focus-visible:ring-ring"
        >
          <MessageSquareText className="size-5" />
        </button>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={`More for ${time}`}
          disabled={!canSave}
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
                onClick={() => onNote(student)}
              >
                <MessageSquareText />
                Note
              </DropdownMenuItem>
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

/**
 * The round checkbox that checks a meeting off: an empty ring, filled with
 * the success color and a check once complete. A missed meeting's ring is
 * the destructive color.
 */
function CompleteToggle({
  checked,
  missed,
  label,
  disabled,
  onToggle,
}: {
  checked: boolean
  missed: boolean
  label: string
  disabled: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      title={checked ? 'Complete' : 'Mark complete'}
      disabled={disabled}
      onClick={onToggle}
      className="group flex size-10 shrink-0 items-center justify-center rounded-full outline-none focus-visible:ring-4 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
    >
      <span
        aria-hidden
        className={cn(
          'flex size-7 items-center justify-center rounded-full border-2 transition-colors motion-reduce:transition-none',
          checked
            ? 'border-success bg-success text-success-foreground'
            : cn(
                'bg-card group-hover:bg-success/15 group-disabled:group-hover:bg-card',
                missed ? 'border-destructive' : 'border-border',
              ),
        )}
      >
        {checked && <Check className="size-4" strokeWidth={3} />}
      </span>
    </button>
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
  // Online, and allowed: a co-teacher may only view conferences.
  const canSave = useCanSave('conferences')
  const scheduled = new Set(conference.slots.map((s) => s.student_id))
  const waiting = conference.students.filter(
    (s) => s.in_classes && !scheduled.has(s.id),
  )
  // Whose family already has a sign-up notice (no time, printed).
  const signedUp = new Set(
    waiting
      .filter((s) => noticeStatus(conference, s.id, null) === 'printed')
      .map((s) => s.id),
  )
  if (waiting.length === 0) return null
  return (
    <section className="flex flex-col gap-2 rounded-xl border-2 border-dashed border-border p-4">
      <h2 className="font-bold">
        No time yet{' '}
        <span className="text-muted-foreground">({waiting.length})</span>
      </h2>
      <p className="text-sm text-muted-foreground">
        Tap a name to give them an open time
        {conference.parent_changes &&
          ', or print them a sign-up notice so their family can choose one'}
        .
        {signedUp.size > 0 &&
          ` ${signedUp.size} ${signedUp.size === 1 ? 'has' : 'have'} a sign-up notice.`}
      </p>
      <ul className="flex flex-wrap gap-2">
        {waiting.map((s) => (
          <li key={s.id}>
            <button
              type="button"
              disabled={!canSave}
              onClick={() => onPick(s)}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-full border-2 border-border bg-card px-3 text-sm font-bold transition-colors hover:bg-primary/10 focus-visible:ring-4 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-50 motion-reduce:transition-none"
            >
              {shortName(s)}
              {signedUp.has(s.id) && (
                <>
                  <Printer
                    aria-hidden
                    className="size-3.5 text-muted-foreground"
                  />
                  <span className="sr-only">(sign-up notice printed)</span>
                </>
              )}
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
