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
  prepareNotices,
} from '#/lib/conferences'
import type { Conference, ConferenceNotice } from '#/lib/conferences'
import { useCanSave } from '#/lib/workspace'
import { OfflineNote } from '#/components/offline-note'
import { ResponsiveDialog } from '#/components/responsive-dialogue'
import { noticeStatus } from './slot-list'

/**
 * Print notices, in two steps: pick whose (everyone with a time, to start),
 * then print. The codes are fetched in between, so the print itself starts
 * straight from a tap (browsers can refuse a print that starts later).
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
  const byId = new Map(conference.students.map((s) => [s.id, s]))
  // Everyone with a time, in name order (the order they print in).
  const rows = conference.slots
    .filter((s) => s.student_id && byId.has(s.student_id))
    .map((slot) => ({
      slot,
      student: byId.get(slot.student_id as string)!,
      status: noticeStatus(conference, slot),
    }))
    .sort(
      (a, b) =>
        conference.students.indexOf(a.student) -
        conference.students.indexOf(b.student),
    )
  const unscheduled = conference.students.filter(
    (s) => s.in_classes && !conference.slots.some((x) => x.student_id === s.id),
  ).length

  const [picked, setPicked] = useState<Array<string>>(
    rows.map((r) => r.student.id),
  )
  const [ready, setReady] = useState<Array<ConferenceNotice> | null>(null)

  const prepare = useMutation({
    mutationFn: () =>
      prepareNotices(
        conference.id,
        rows
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
        No one has a time yet. Give students times first, then print their
        notices.
      </p>
    )
  }

  const outdated = rows.filter((r) => r.status !== 'printed')
  const busy = prepare.isPending

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          onClick={() => setPicked(rows.map((r) => r.student.id))}
          className="h-10 rounded-lg border-2 border-border bg-card font-bold"
        >
          Everyone ({rows.length})
        </Button>
        {outdated.length > 0 && outdated.length < rows.length && (
          <Button
            variant="outline"
            onClick={() => setPicked(outdated.map((r) => r.student.id))}
            className="h-10 rounded-lg border-2 border-border bg-card font-bold"
          >
            Only new or changed ({outdated.length})
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
          {rows.map(({ slot, student, status }) => (
            <li key={student.id}>
              <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border-2 border-border bg-card px-4 py-2 transition-colors has-checked:border-primary has-checked:bg-primary/10 motion-reduce:transition-none">
                <input
                  type="checkbox"
                  checked={picked.includes(student.id)}
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
                    {formatSlotMoment(slot.starts_at, tz)}
                    {status === 'printed' && ' · printed'}
                    {status === 'outdated' && ' · time changed since printing'}
                  </span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      </fieldset>
      {unscheduled > 0 && (
        <p className="text-sm text-muted-foreground">
          {unscheduled} {unscheduled === 1 ? 'student has' : 'students have'} no
          time yet, so no notice.
        </p>
      )}

      {/* Paper gets left around: say plainly what the code can do. */}
      <p className="flex items-start gap-2 rounded-lg border-2 border-border bg-chart-3/25 p-3 text-sm">
        <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
        <span>
          {conference.parent_changes
            ? `Whoever has a notice can use its QR code to change that student’s time, until ${CUTOFF_HOURS} hours before.`
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
