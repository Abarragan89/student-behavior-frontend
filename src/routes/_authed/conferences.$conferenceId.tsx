import { useEffect, useState } from 'react'
import { flushSync } from 'react-dom'
import { Link, createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  CalendarClock,
  CalendarPlus,
  CalendarX,
  ChevronLeft,
  CircleAlert,
  Printer,
  RefreshCw,
  Settings,
} from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
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
import { CUTOFF_HOURS, conferenceQueryOptions } from '#/lib/conferences'
import type {
  Conference,
  ConferenceNotice,
  ConferenceSlot,
  ConferenceStudent,
} from '#/lib/conferences'
import { useOnline } from '#/lib/online'
import { OfflineNote } from '#/components/offline-note'
import { FamilyChanges } from '#/components/conferences/family-changes'
import {
  StudentPickerDialog,
  TimePickerDialog,
} from '#/components/conferences/pickers'
import { PrintNotices } from '#/components/conferences/print-notices'
import { PrintNoticesDialog } from '#/components/conferences/print-notices-dialog'
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
  loader: ({ context: { queryClient }, params }) => {
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
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [printOpen, setPrintOpen] = useState(false)
  const [pickFor, setPickFor] = useState<ConferenceSlot | null>(null)
  const [editing, setEditing] = useState<ConferenceSlot | null>(null)
  const [timeFor, setTimeFor] = useState<ConferenceStudent | null>(null)
  // Families' changes that came in with the last Refresh.
  const [fresh, setFresh] = useState<ReadonlySet<string>>(new Set())

  // The notices being printed. They hold every family's code, so they're
  // kept only for the print and dropped as soon as it's done.
  const [notices, setNotices] = useState<Array<ConferenceNotice> | null>(null)
  useEffect(() => {
    const done = () => setNotices(null)
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

  return (
    <>
      <main className="mx-auto flex w-full max-w-3xl min-w-0 flex-1 flex-col gap-5 px-4 py-6 sm:py-8 print:hidden">
        <BackLink />

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
        </header>

        <section className="flex flex-col gap-1 rounded-xl border-2 border-border bg-card p-4 shadow-md">
          <p className="text-lg font-bold">
            {withTime} of {students.length}{' '}
            {students.length === 1 ? 'student has' : 'students have'} a time
          </p>
          <p className="text-sm text-muted-foreground">
            {conference.parent_changes
              ? `Families can change their time online until ${CUTOFF_HOURS} hours before it.`
              : 'Family changes are off: families can see their time but not change it.'}
          </p>
        </section>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={() => setAddOpen(true)}
            disabled={!online}
            className="h-12 flex-1 rounded-lg border-2 border-border text-base font-bold shadow-sm sm:flex-none sm:px-5"
          >
            <CalendarPlus className="size-5" />
            Add times
          </Button>
          <Button
            variant="outline"
            onClick={() => setPrintOpen(true)}
            disabled={!online || !hasSlots}
            className="h-12 flex-1 rounded-lg border-2 border-border bg-card text-base font-bold sm:flex-none sm:px-5"
          >
            <Printer className="size-5" />
            Print notices
          </Button>
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
        <OfflineNote action="change this conference" />

        <UnscheduledPanel conference={conference} onPick={setTimeFor} />

        {hasSlots ? (
          <SlotList
            conference={conference}
            onPickStudent={setPickFor}
            onEditTime={setEditing}
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
            <EmptyContent>
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

      <PrintNotices conference={conference} notices={notices} />
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
    </>
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
