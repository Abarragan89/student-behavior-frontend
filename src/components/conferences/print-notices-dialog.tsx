import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ChevronLeft, Printer, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import {
  CUTOFF_HOURS,
  conferenceQueryOptions,
  conflictMessage,
  formatSlotMoment,
  fullName,
  noticeStatus,
  openForSignUp,
  prepareNotices,
} from '#/lib/conferences'
import type {
  Conference,
  ConferenceNotice,
  ConferenceSlot,
  ConferenceStudent,
  NoticeStatus,
} from '#/lib/conferences'
import { useCanSave } from '#/lib/workspace'
import { OfflineNote } from '#/components/offline-note'
import { ResponsiveDialog } from '#/components/responsive-dialogue'

/**
 * Print notices, in two steps: pick whose (everyone, to start), then print.
 * The codes are fetched in between, so the print itself starts straight from
 * a tap (browsers can refuse a print that starts later).
 *
 * A student without a time gets a sign-up notice: their QR code lets the
 * family choose an open time, first come, first served. That only works
 * while families can choose times online, so with family changes off they
 * can't be picked (and the server skips them too).
 */
export function PrintNoticesDialog({
  open,
  onOpenChange,
  conference,
  onPrint,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  conference: Conference
  onPrint: (notices: Array<ConferenceNotice>) => void
}) {
  return (
    <ResponsiveDialog
      isOpen={open}
      setIsOpen={onOpenChange}
      title="Print notices"
      description="One page per student: English on the top half, Spanish on the bottom, each with the family’s QR code."
      showDescription
    >
      {open && <PrintSteps conference={conference} onPrint={onPrint} />}
    </ResponsiveDialog>
  )
}

function PrintSteps({
  conference,
  onPrint,
}: {
  conference: Conference
  onPrint: (notices: Array<ConferenceNotice>) => void
}) {
  const queryClient = useQueryClient()
  // Online, and allowed: a co-teacher may only view conferences.
  const canSave = useCanSave('conferences')
  const tz = conference.timezone
  const signUpsOn = conference.parent_changes
  // Everyone with a time, and everyone in the classes without one, in name
  // order (the order they print in).
  const slotOf = new Map(
    conference.slots.flatMap((s) => (s.student_id ? [[s.student_id, s]] : [])),
  )
  const rows: Array<Row> = conference.students
    .filter((s) => slotOf.has(s.id) || s.in_classes)
    .map((student) => {
      const slot = slotOf.get(student.id) ?? null
      return {
        student,
        slot,
        status: noticeStatus(conference, student.id, slot?.starts_at ?? null),
        disabled: !slot && !signUpsOn,
      }
    })
  const printable = rows.filter((r) => !r.disabled)
  const signUps = printable.filter((r) => !r.slot)
  const blocked = rows.length - printable.length

  const [picked, setPicked] = useState<Array<string>>(
    printable.map((r) => r.student.id),
  )
  // Captured once: the open-times warning shouldn't flicker as time passes.
  const [openTimes] = useState(() => openForSignUp(conference, Date.now()))
  const [ready, setReady] = useState<Array<ConferenceNotice> | null>(null)

  const prepare = useMutation({
    mutationFn: () =>
      prepareNotices(
        conference.id,
        printable
          .filter((r) => picked.includes(r.student.id))
          .map((r) => r.student.id),
      ),
    onSuccess: ({ notices }) => {
      setReady(notices)
      // The page now knows they're printed.
      void queryClient.invalidateQueries({
        queryKey: conferenceQueryOptions(conference.id).queryKey,
      })
    },
    onError: (error) => {
      console.error('Preparing notices failed:', error)
      toast.error('Couldn’t get the notices ready', {
        description: conflictMessage(error),
      })
    },
  })

  if (ready) {
    return (
      <div className="flex flex-col gap-4">
        <p>
          {ready.length} {ready.length === 1 ? 'notice is' : 'notices are'}{' '}
          ready, one page each.
        </p>
        <Button
          onClick={() => onPrint(ready)}
          className="h-12 rounded-lg border-2 border-border text-base font-bold shadow-sm"
        >
          <Printer className="size-5" />
          Print {ready.length} {ready.length === 1 ? 'notice' : 'notices'}
        </Button>
        <Button
          variant="outline"
          onClick={() => setReady(null)}
          className="h-12 rounded-lg border-2 border-border bg-card text-base font-bold"
        >
          <ChevronLeft className="size-5" />
          Back
        </Button>
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <p className="text-muted-foreground">
        There are no students in this conference’s classes yet. Add students
        first, then print their notices.
      </p>
    )
  }

  const outdated = printable.filter((r) => r.status !== 'printed')
  const pickedSignUps = signUps.filter((r) =>
    picked.includes(r.student.id),
  ).length
  const busy = prepare.isPending

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          onClick={() => setPicked(printable.map((r) => r.student.id))}
          className="h-10 rounded-lg border-2 border-border bg-card font-bold"
        >
          Everyone ({printable.length})
        </Button>
        {outdated.length > 0 && outdated.length < printable.length && (
          <Button
            variant="outline"
            onClick={() => setPicked(outdated.map((r) => r.student.id))}
            className="h-10 rounded-lg border-2 border-border bg-card font-bold"
          >
            Only new or changed ({outdated.length})
          </Button>
        )}
        {signUps.length > 0 && signUps.length < printable.length && (
          <Button
            variant="outline"
            onClick={() => setPicked(signUps.map((r) => r.student.id))}
            className="h-10 rounded-lg border-2 border-border bg-card font-bold"
          >
            Only students without a time ({signUps.length})
          </Button>
        )}
        <Button
          variant="outline"
          onClick={() => setPicked([])}
          className="h-10 rounded-lg border-2 border-border bg-card font-bold"
        >
          None
        </Button>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="sr-only">Whose notices</legend>
        <ul className="flex flex-col gap-2">
          {rows.map(({ slot, student, status, disabled }) => (
            <li key={student.id}>
              <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border-2 border-border bg-card px-4 py-2 transition-colors has-checked:border-primary has-checked:bg-primary/10 has-disabled:cursor-not-allowed has-disabled:opacity-60 motion-reduce:transition-none">
                <input
                  type="checkbox"
                  disabled={disabled}
                  checked={!disabled && picked.includes(student.id)}
                  onChange={(e) =>
                    setPicked(
                      e.target.checked
                        ? [...picked, student.id]
                        : picked.filter((id) => id !== student.id),
                    )
                  }
                  className="size-5 shrink-0 accent-primary"
                />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-bold">
                    {fullName(student)}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {describe(slot, status, tz)}
                  </span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      </fieldset>
      {blocked > 0 && (
        <p className="text-sm text-muted-foreground">
          {blocked} {blocked === 1 ? 'student has' : 'students have'} no time.
          Turn on family changes in Settings to print them sign-up notices.
        </p>
      )}
      {pickedSignUps > openTimes && (
        <p className="flex items-start gap-2 rounded-lg border-2 border-destructive bg-destructive/10 p-3 text-sm">
          <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
          <span>
            {pickedSignUps} sign-up {pickedSignUps === 1 ? 'notice' : 'notices'}{' '}
            but{' '}
            {openTimes === 0
              ? 'no open times'
              : `only ${openTimes} open ${openTimes === 1 ? 'time' : 'times'}`}{' '}
            families can still choose. Add times so every family can find one.
          </span>
        </p>
      )}

      {/* Paper gets left around: say plainly what the code can do. */}
      <p className="flex items-start gap-2 rounded-lg border-2 border-border bg-chart-3/25 p-3 text-sm">
        <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
        <span>
          {conference.parent_changes
            ? `Whoever has a notice can use its QR code to choose or change that student’s time, until ${CUTOFF_HOURS} hours before.`
            : 'Whoever has a notice can use its QR code to see that student’s time.'}{' '}
          Send notices home in folders, not left out on desks. If one gets lost,
          use Make a new QR code: the old one stops working.
        </span>
      </p>

      <div className="flex flex-col gap-2">
        <OfflineNote action="print notices" />
        <Button
          onClick={() => prepare.mutate()}
          disabled={picked.length === 0 || busy || !canSave}
          aria-busy={busy}
          className="h-12 rounded-lg border-2 border-border text-base font-bold shadow-sm"
        >
          {busy && <Spinner aria-hidden className="size-5" />}
          Next: {picked.length} {picked.length === 1 ? 'notice' : 'notices'}
        </Button>
      </div>
    </div>
  )
}

type Row = {
  student: ConferenceStudent
  /** null: no time yet, so a sign-up notice. */
  slot: ConferenceSlot | null
  status: NoticeStatus
  /** A sign-up notice while family changes are off. */
  disabled: boolean
}

/** "Thu, Nov 5, 3:00 PM · printed", or "No time yet · sign-up notice". */
function describe(
  slot: ConferenceSlot | null,
  status: NoticeStatus,
  tz: string,
) {
  if (!slot) {
    return `No time yet · sign-up notice${status === 'printed' ? ' · printed' : ''}`
  }
  const when = formatSlotMoment(slot.starts_at, tz)
  if (status === 'printed') return `${when} · printed`
  if (status === 'outdated') return `${when} · time changed since printing`
  return when
}
