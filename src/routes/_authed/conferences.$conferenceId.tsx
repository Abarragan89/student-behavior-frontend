import { useEffect, useState } from 'react'
import { flushSync } from 'react-dom'
import { Link, createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  CalendarClock,
  CalendarPlus,
  CalendarX,
  ChevronDown,
  ChevronLeft,
  CircleAlert,
  ClipboardList,
  Printer,
  QrCode,
  RefreshCw,
  Settings,
} from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'
import { ApiError } from '#/lib/api'
import {
  CUTOFF_HOURS,
  conferenceQueryOptions,
  dayIn,
  formatSlotDay,
  meetingState,
} from '#/lib/conferences'
import type {
  Conference,
  ConferenceNotice,
  ConferenceSlot,
  ConferenceStudent,
} from '#/lib/conferences'
import { useOnline } from '#/lib/online'
import { mayLoad, usePermission } from '#/lib/workspace'
import { useNow } from '#/hooks/useNow'
import { usePrintTitle } from '#/hooks/usePrintTitle'
import { OfflineNote } from '#/components/offline-note'
import { FamilyChanges } from '#/components/conferences/family-changes'
import { ConferenceNoteDialog } from '#/components/conferences/note-dialog'
import {
  StudentPickerDialog,
  TimePickerDialog,
} from '#/components/conferences/pickers'
import { PrintNotices } from '#/components/conferences/print-notices'
import { PrintNoticesDialog } from '#/components/conferences/print-notices-dialog'
import { PrintSchedule } from '#/components/conferences/print-schedule'
import { SettingsDialog } from '#/components/conferences/settings-dialog'
import { SlotList, UnscheduledPanel } from '#/components/conferences/slot-list'
import {
  AddTimesDialog,
  EditTimeDialog,
} from '#/components/conferences/time-dialogs'

// /conferences/<id>: one round of parent conferences. The teacher adds
// times, puts students in them and prints notices. Families' changes come
// in through their QR codes; Refresh shows them.
export const Route = createFileRoute('/_authed/conferences/$conferenceId')({
  // A co-teacher needs at least View on Conferences (_authed.tsx checks).
  staticData: { feature: { key: 'conferences', level: 'view' } },
  loader: ({ context: { queryClient }, params }) => {
    if (!mayLoad(queryClient, 'conferences')) return
    void queryClient
      .query(conferenceQueryOptions(params.conferenceId))
      .catch(() => null)
  },
  component: ConferencePage,
})

function ConferencePage() {
  const { conferenceId } = Route.useParams()
  const online = useOnline()
  const conference = useQuery(conferenceQueryOptions(conferenceId))

  if (conference.data) {
    return (
      <ConferenceEditor
        key={conferenceId}
        conference={conference.data}
        updatedAt={conference.dataUpdatedAt}
        refetch={() => conference.refetch()}
        refreshing={conference.isFetching}
      />
    )
  }
  return (
    <main className="mx-auto flex w-full max-w-3xl min-w-0 flex-1 flex-col gap-5 px-4 py-6 sm:py-8">
      <BackLink />
      {conference.error instanceof ApiError &&
      conference.error.status === 404 ? (
        <Empty className="rounded-xl border-2 border-dashed border-border px-4 py-10">
          <EmptyHeader>
            <EmptyMedia
              variant="icon"
              className="size-14 rounded-lg border-2 border-border bg-chart-3 text-foreground"
            >
              <CalendarX className="size-7" />
            </EmptyMedia>
            <EmptyTitle className="text-xl font-bold">
              This conference isn’t here
            </EmptyTitle>
            <EmptyDescription>
              It may have been deleted. Conferences are deleted on their own 30
              days after their last time.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : conference.isError ? (
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <p className="flex items-center gap-2 font-medium">
            <CircleAlert className="size-5 shrink-0 text-destructive" />
            {online
              ? 'Couldn’t load this conference.'
              : 'You’re offline. Connect to the internet to see this conference.'}
          </p>
          <Button
            variant="outline"
            onClick={() => void conference.refetch()}
            disabled={conference.isFetching}
            className="h-11 rounded-lg border-2 border-border font-bold"
          >
            <RefreshCw
              className={cn(conference.isFetching && 'animate-spin')}
            />
            Try again
          </Button>
        </div>
      ) : (
        <p
          role="status"
          className="flex items-center justify-center gap-2 py-16 font-medium text-muted-foreground"
        >
          <Spinner aria-hidden className="size-5" />
          Loading…
        </p>
      )}
    </main>
  )
}

function ConferenceEditor({
  conference,
  updatedAt,
  refetch,
  refreshing,
}: {
  conference: Conference
  updatedAt: number
  refetch: () => Promise<{ data?: Conference }>
  refreshing: boolean
}) {
  const online = useOnline()
  // A co-teacher with View only: the schedule, no changes.
  const editable = usePermission('conferences') === 'edit'
  // Ticks so a meeting that just ended shows as a no-show.
  const now = useNow(30_000)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [printOpen, setPrintOpen] = useState(false)
  const [pickFor, setPickFor] = useState<ConferenceSlot | null>(null)
  const [editing, setEditing] = useState<ConferenceSlot | null>(null)
  const [timeFor, setTimeFor] = useState<ConferenceStudent | null>(null)
  // Whose meeting note is open. Kept here, not in the time's row: it stays
  // open if their family moves meanwhile (the note goes with them).
  const [noteFor, setNoteFor] = useState<ConferenceStudent | null>(null)
  // Families' changes that came in with the last Refresh.
  const [fresh, setFresh] = useState<ReadonlySet<string>>(new Set())

  // What's on paper. Notices while they're being printed: they hold every
  // family's code, so they're kept only for printing, and dropped when the
  // teacher taps Done or leaves the page. Not on afterprint: some browsers
  // send it before they've printed the page (Chrome's system dialog, phones),
  // and a retry with Ctrl+P or the share sheet should still get the notices.
  // Otherwise the schedule, for every day unless one was picked, so a plain
  // Ctrl+P prints the schedule too.
  const [notices, setNotices] = useState<Array<ConferenceNotice> | null>(null)
  const [scheduleDay, setScheduleDay] = useState<string | null>(null)
  useEffect(() => {
    const done = () => setScheduleDay(null)
    window.addEventListener('afterprint', done)
    return () => window.removeEventListener('afterprint', done)
  }, [])
  function print(ready: Array<ConferenceNotice>) {
    // On the page before the print dialog opens; the dialog is hidden on
    // paper while it closes (styles.css).
    flushSync(() => {
      setPrintOpen(false)
      setNotices(ready)
    })
    window.print()
  }
  function printSchedule(day: string | null) {
    flushSync(() => {
      setNotices(null)
      setScheduleDay(day)
    })
    window.print()
  }
  const dayLabel = (() => {
    const first = scheduleDay
      ? conference.slots.find(
          (s) => dayIn(s.starts_at, conference.timezone) === scheduleDay,
        )
      : undefined
    return first
      ? ` – ${formatSlotDay(first.starts_at, conference.timezone)}`
      : ''
  })()
  usePrintTitle(
    notices
      ? `Conference notices – ${conference.title}`
      : `Conference schedule – ${conference.title}${dayLabel}`,
  )

  async function refresh() {
    const before = new Set(conference.changes.map((c) => c.id))
    const result = await refetch()
    if (!result.data) {
      toast.error('Couldn’t refresh. Check your connection and try again.')
      return
    }
    const added = result.data.changes.filter((c) => !before.has(c.id))
    setFresh(new Set(added.map((c) => c.id)))
    toast(
      added.length === 0
        ? 'No new changes from families'
        : `${added.length} new ${added.length === 1 ? 'change' : 'changes'} from families`,
    )
  }

  const students = conference.students.filter((s) => s.in_classes)
  const scheduled = new Set(conference.slots.map((s) => s.student_id))
  const withTime = students.filter((s) => scheduled.has(s.id)).length
  const hasSlots = conference.slots.length > 0
  const states = conference.slots.map((s) => meetingState(s, now))
  const complete = states.filter((s) => s === 'completed').length
  const noShows = states.filter((s) => s === 'no_show').length

  return (
    <>
      <main className="mx-auto flex w-full max-w-3xl min-w-0 flex-1 flex-col gap-5 px-4 py-6 sm:py-8 print:hidden">
        <BackLink />

        {notices && (
          <NoticesLoaded
            count={notices.length}
            onPrint={() => window.print()}
            onDone={() => setNotices(null)}
          />
        )}

        <header className="flex items-start gap-3">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <h1 className="text-2xl leading-tight font-bold wrap-break-word">
              {conference.title}
            </h1>
            <p className="text-muted-foreground">
              Signed {conference.notice_name}
              {conference.location && ` · ${conference.location}`}
            </p>
          </div>
          {editable && (
            <Button
              variant="outline"
              size="icon"
              aria-label="Conference settings"
              title="Settings"
              onClick={() => setSettingsOpen(true)}
              disabled={!online}
              className="size-12 shrink-0 rounded-lg border-2 border-border bg-card"
            >
              <Settings className="size-5" />
            </Button>
          )}
        </header>

        <section className="flex flex-col gap-1 rounded-xl border-2 border-border bg-card p-4 shadow-md">
          <p className="text-lg font-bold">
            {withTime} of {students.length}{' '}
            {students.length === 1 ? 'student has' : 'students have'} a time
          </p>
          {complete + noShows > 0 && (
            <p className="font-medium">
              {complete} complete · {noShows}{' '}
              {noShows === 1 ? 'no-show' : 'no-shows'}
            </p>
          )}
          <p className="text-sm text-muted-foreground">
            {conference.parent_changes
              ? `Families can change their time online until ${CUTOFF_HOURS} hours before it.`
              : 'Family changes are off: families can see their time but not change it.'}
          </p>
        </section>

        <div className="flex flex-wrap items-center gap-2">
          {editable && (
            <Button
              onClick={() => setAddOpen(true)}
              disabled={!online}
              className="h-12 flex-1 rounded-lg border-2 border-border text-base font-bold shadow-sm sm:flex-none sm:px-5"
            >
              <CalendarPlus className="size-5" />
              Add times
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger
              disabled={!hasSlots}
              className={cn(
                buttonVariants({ variant: 'outline' }),
                'h-12 flex-1 rounded-lg border-2 border-border bg-card text-base font-bold sm:flex-none sm:px-5',
              )}
            >
              <Printer className="size-5" />
              Print
              <ChevronDown aria-hidden className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              className="w-64 rounded-lg border-2 border-border p-1 shadow-md ring-0"
            >
              <DropdownMenuItem
                className="h-auto min-h-12 flex-col items-start gap-0 rounded-md py-2"
                // Notices make families' codes: a change to the conference.
                disabled={!online || !editable}
                onClick={() => setPrintOpen(true)}
              >
                <span className="flex items-center gap-2 font-bold">
                  <QrCode />
                  Notices for families…
                </span>
                <span className="pl-6 text-xs text-muted-foreground">
                  One page each, with their QR code
                </span>
              </DropdownMenuItem>
              <DropdownMenuItem
                className="h-auto min-h-12 flex-col items-start gap-0 rounded-md py-2"
                onClick={() => printSchedule(null)}
              >
                <span className="flex items-center gap-2 font-bold">
                  <ClipboardList />
                  Schedule
                </span>
                <span className="pl-6 text-xs text-muted-foreground">
                  Every day’s times and who has them, for you
                </span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            variant="outline"
            onClick={() => void refresh()}
            disabled={refreshing}
            aria-busy={refreshing}
            className="h-12 rounded-lg border-2 border-border bg-card px-4 text-base font-bold"
          >
            <RefreshCw className={cn('size-5', refreshing && 'animate-spin')} />
            Refresh
          </Button>
          <span className="text-sm text-muted-foreground">
            Updated{' '}
            {new Date(updatedAt).toLocaleTimeString(undefined, {
              hour: 'numeric',
              minute: '2-digit',
            })}
          </span>
        </div>
        {editable && <OfflineNote action="change this conference" />}

        <UnscheduledPanel conference={conference} onPick={setTimeFor} />

        {hasSlots ? (
          <SlotList
            conference={conference}
            now={now}
            onPickStudent={setPickFor}
            onEditTime={setEditing}
            onNote={setNoteFor}
            onPrintDay={printSchedule}
          />
        ) : (
          <Empty className="rounded-xl border-2 border-dashed border-border px-4 py-10">
            <EmptyHeader>
              <EmptyMedia
                variant="icon"
                className="size-14 rounded-lg border-2 border-border bg-chart-3 text-foreground"
              >
                <CalendarClock className="size-7" />
              </EmptyMedia>
              <EmptyTitle className="text-xl font-bold">
                No times yet
              </EmptyTitle>
              <EmptyDescription>
                Add a day’s hours and how long each meeting is. You can change
                any time afterward.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent className={cn(!editable && 'hidden')}>
              <Button
                onClick={() => setAddOpen(true)}
                disabled={!online}
                className="h-12 rounded-lg border-2 border-border px-6 text-base font-bold shadow-sm"
              >
                <CalendarPlus className="size-5" />
                Add times
              </Button>
            </EmptyContent>
          </Empty>
        )}

        <FamilyChanges conference={conference} fresh={fresh} />
      </main>

      {notices ? (
        <PrintNotices conference={conference} notices={notices} now={now} />
      ) : (
        <PrintSchedule conference={conference} day={scheduleDay} now={now} />
      )}
      <SettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        conference={conference}
      />
      <AddTimesDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        conference={conference}
      />
      <PrintNoticesDialog
        open={printOpen}
        onOpenChange={setPrintOpen}
        conference={conference}
        onPrint={print}
      />
      <StudentPickerDialog
        conference={conference}
        slot={pickFor}
        onClose={() => setPickFor(null)}
      />
      <EditTimeDialog
        conference={conference}
        slot={editing}
        onClose={() => setEditing(null)}
      />
      <TimePickerDialog
        conference={conference}
        student={timeFor}
        onClose={() => setTimeFor(null)}
      />
      <ConferenceNoteDialog
        conference={conference}
        student={noteFor}
        onClose={() => setNoteFor(null)}
      />
    </>
  )
}

/**
 * Shown after printing notices, while they're still on paper: a print that
 * didn't go through can be tried again (Ctrl+P works too), and Done drops
 * the families' codes from the page.
 */
function NoticesLoaded({
  count,
  onPrint,
  onDone,
}: {
  count: number
  onPrint: () => void
  onDone: () => void
}) {
  return (
    <section
      role="status"
      className="flex flex-col gap-3 rounded-xl border-2 border-primary bg-primary/10 p-4 sm:flex-row sm:items-center"
    >
      <p className="flex flex-1 items-start gap-2 font-medium">
        <QrCode aria-hidden className="mt-0.5 size-5 shrink-0" />
        <span>
          {count} {count === 1 ? 'notice is' : 'notices are'} ready to print.
          Didn’t print? Try again. Tap Done when you have them.
        </span>
      </p>
      <div className="flex gap-2">
        <Button
          variant="outline"
          onClick={onPrint}
          className="h-11 flex-1 rounded-lg border-2 border-border bg-card font-bold sm:flex-none"
        >
          <Printer className="size-5" />
          Print again
        </Button>
        <Button
          onClick={onDone}
          className="h-11 flex-1 rounded-lg border-2 border-border font-bold sm:flex-none sm:px-5"
        >
          Done
        </Button>
      </div>
    </section>
  )
}

function BackLink() {
  return (
    <Link
      to="/conferences"
      className={cn(
        buttonVariants({ variant: 'link' }),
        'h-auto self-start px-0 text-base font-bold',
      )}
    >
      <ChevronLeft className="size-5" />
      Conferences
    </Link>
  )
}
