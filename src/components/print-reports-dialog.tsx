import { useId, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CircleAlert, Printer, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import type { Student } from '#/lib/auth'
import { isDateString, useToday } from '#/lib/day'
import { classReportsQueryOptions } from '#/lib/students'
import type { ClassReports } from '#/lib/students'
import { OfflineNote } from '#/components/offline-note'
import { ResponsiveDialog } from '#/components/responsive-dialogue'

/** What goes on paper: the students to print, in order, and their data. */
export type ReportsToPrint = {
  classroomId: string
  date: string
  students: Array<Student>
  data: ClassReports
}

/**
 * Print the picked students' behavior reports (see StudentReport), one page
 * each. The class's reports load in one request when it opens; the Print
 * button then starts the print straight from its tap, since browsers can
 * refuse a print that starts later.
 *
 * Starts on today, with a day field for printing another day. Students with
 * no marks that day are left out unless the teacher unticks "Skip".
 */
export function PrintReportsDialog({
  open,
  onOpenChange,
  classroomId,
  students,
  onPrint,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  classroomId: string
  /** The picked students, in roster order. */
  students: Array<Student>
  onPrint: (reports: ReportsToPrint) => void
}) {
  return (
    <ResponsiveDialog
      isOpen={open}
      setIsOpen={onOpenChange}
      title="Print reports"
      description="One page per student for their family: the day’s marks, their recent days, and lines to sign."
      showDescription
    >
      {open && (
        <PrintReportsSteps
          classroomId={classroomId}
          students={students}
          onPrint={onPrint}
        />
      )}
    </ResponsiveDialog>
  )
}

function PrintReportsSteps({
  classroomId,
  students,
  onPrint,
}: {
  classroomId: string
  students: Array<Student>
  onPrint: (reports: ReportsToPrint) => void
}) {
  const today = useToday()
  const [date, setDate] = useState(today)
  const [skipEmpty, setSkipEmpty] = useState(true)
  const dayId = useId()

  const reports = useQuery(classReportsQueryOptions(classroomId, date))
  // Not while refetching: what's cached may be missing a mark just given.
  const ready = reports.data !== undefined && !reports.isFetching

  // Students who've left the class since they were picked aren't in the
  // reports, and are left out.
  const byId = new Map(reports.data?.students.map((s) => [s.student_id, s]))
  const found = students.filter((s) => byId.has(s.id))
  const withMarks = found.filter((s) => (byId.get(s.id)?.marks.length ?? 0) > 0)
  const emptyCount = found.length - withMarks.length
  // Skipping is offered only when some, not all, have no marks.
  const canSkip = emptyCount > 0 && withMarks.length > 0
  const toPrint = canSkip && skipEmpty ? withMarks : found

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor={dayId} className="text-sm font-bold">
          Day
        </label>
        <Input
          id={dayId}
          type="date"
          value={date}
          max={today}
          onChange={(e) => {
            const picked = e.target.value
            if (isDateString(picked) && picked <= today) setDate(picked)
          }}
          className="h-11 w-auto self-start rounded-lg border-2 border-border bg-card px-3 text-base font-bold"
        />
      </div>

      {ready ? (
        <>
          {canSkip && (
            <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border-2 border-border bg-card px-4 py-2 transition-colors has-checked:border-primary has-checked:bg-primary/10 motion-reduce:transition-none">
              <input
                type="checkbox"
                checked={skipEmpty}
                onChange={(e) => setSkipEmpty(e.target.checked)}
                className="size-5 shrink-0 accent-primary"
              />
              <span className="font-bold">
                Skip the {emptyCount} with no marks that day
              </span>
            </label>
          )}
          {found.length > 0 && withMarks.length === 0 && (
            <p className="text-muted-foreground">
              None of them got marks that day. Each page will say so.
            </p>
          )}
          {found.length === 0 && (
            <p className="text-muted-foreground">
              These students aren’t in this class anymore.
            </p>
          )}
        </>
      ) : reports.isError && !reports.isFetching ? (
        <div className="flex flex-col items-start gap-3">
          <p
            role="alert"
            className="flex items-center gap-2 text-sm font-medium"
          >
            <CircleAlert className="size-5 shrink-0 text-destructive" />
            Couldn’t get the reports ready.
          </p>
          <Button
            variant="outline"
            onClick={() => void reports.refetch()}
            className="h-10 rounded-lg border-2 border-border bg-card font-bold"
          >
            <RefreshCw />
            Try again
          </Button>
        </div>
      ) : reports.fetchStatus === 'paused' ? null : (
        <p
          role="status"
          className="flex items-center gap-2 text-sm font-medium text-muted-foreground"
        >
          <Spinner aria-hidden className="size-4" />
          Getting {students.length}{' '}
          {students.length === 1 ? 'report' : 'reports'} ready…
        </p>
      )}

      <div className="flex flex-col gap-2">
        <OfflineNote action="print reports" />
        <Button
          onClick={() => {
            if (!reports.data) return
            onPrint({
              classroomId,
              date,
              students: toPrint,
              data: reports.data,
            })
          }}
          disabled={!ready || toPrint.length === 0}
          className="h-12 rounded-lg border-2 border-border text-base font-bold shadow-sm"
        >
          <Printer className="size-5" />
          {ready
            ? `Print ${toPrint.length} ${toPrint.length === 1 ? 'report' : 'reports'}`
            : 'Print reports'}
        </Button>
      </div>
    </div>
  )
}
