import { useEffect, useRef, useState } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import {
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Printer,
  RefreshCw,
  Trash2,
  UserX,
} from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'
import { ApiError } from '#/lib/api'
import { useMe } from '#/lib/auth'
import {
  addDays,
  formatHourSpan,
  formatLongDate,
  formatTime,
  isDateString,
  minutesIntoDay,
  timeZoneLabel,
  useToday,
} from '#/lib/day'
import { localDate, markTime, timeZone } from '#/lib/marks'
import type { Mark } from '#/lib/marks'
import { busiestHour, schoolDaysEnding } from '#/lib/mark-stats'
import {
  studentDailyQueryOptions,
  studentFromMe,
  studentMarksQueryOptions,
  studentQueryOptions,
} from '#/lib/students'
import type { StudentDetail } from '#/lib/students'
import { DayTimeline } from '#/components/day-timeline'
import { DeleteMarkDialog } from '#/components/delete-mark-dialog'
import type { DeleteMarkTarget } from '#/components/delete-mark-dialog'
import { DeleteStudentDialog } from '#/components/delete-student-dialog'
import type { DeleteStudentTarget } from '#/components/delete-student-dialog'
import { StudentNameForm } from '#/components/forms/student-name-form'
import { StudentReport } from '#/components/student-report'
import { MarkRing, initials } from '#/components/student-card'

export const Route = createFileRoute('/_authed/students/$studentId')({
  // ?date=YYYY-MM-DD picks the day; left out, it's today.
  validateSearch: (search: Record<string, unknown>): { date?: string } => ({
    date: isDateString(search.date) ? search.date : undefined,
  }),
  loaderDeps: ({ search }) => ({ date: search.date }),
  // Started early, not waited for: the page shows what it has meanwhile.
  loader: ({ context, params, deps }) => {
    const { queryClient } = context
    void queryClient
      .query(studentQueryOptions(params.studentId))
      .catch(() => null)
    void queryClient
      .query(
        studentMarksQueryOptions(params.studentId, deps.date ?? localDate()),
      )
      .catch(() => null)
  },
  component: StudentPage,
})

const cardClass =
  'gap-5 rounded-xl border-2 border-border p-4 shadow-md ring-0 sm:p-6'

// How many school days the printed report shows for context.
const RECENT_DAYS = 10

function StudentPage() {
  const { studentId } = Route.useParams()
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const { data: me } = useMe()

  const today = useToday()
  const date = search.date ?? today

  const student = useQuery({
    ...studentQueryOptions(studentId),
    // Their name shows at once if they're in the open class; the rest (like
    // all their classes) arrives with the fetch.
    initialData: () => studentFromMe(me, studentId),
    initialDataUpdatedAt: 0,
  })

  // The day is in the address bar, so a link or reload opens the same day.
  // Replaced, not pushed: Back still goes back to the class.
  function showDay(next: string) {
    void navigate({
      search: { date: next === today ? undefined : next },
      replace: true,
    })
  }

  if (!student.data) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center px-4 py-10">
        {student.isPending ? (
          <p
            role="status"
            className="flex items-center gap-2 font-medium text-muted-foreground"
          >
            <Spinner aria-hidden className="size-5" />
            Loading student…
          </p>
        ) : (
          <StudentMissing
            // 404: not this teacher's student. 400: the link's ID is broken.
            notFound={
              student.error instanceof ApiError &&
              (student.error.status === 404 || student.error.status === 400)
            }
            onRetry={() => void student.refetch()}
            retrying={student.isFetching}
          />
        )}
      </main>
    )
  }

  return (
    <StudentDay
      student={student.data}
      date={date}
      today={today}
      onShowDay={showDay}
      teacherName={me?.teacher.name ?? ''}
      openClassId={me?.classroom.id}
      onDeleted={() => navigate({ to: '/classes' })}
      classroomNames={
        new Map([
          ...(me?.classrooms ?? []).map((c) => [c.id, c.name] as const),
          ...student.data.classrooms.map((c) => [c.id, c.name] as const),
        ])
      }
    />
  )
}

function StudentDay({
  student,
  date,
  today,
  onShowDay,
  teacherName,
  openClassId,
  onDeleted,
  classroomNames,
}: {
  student: StudentDetail
  date: string
  today: string
  onShowDay: (date: string) => void
  teacherName: string
  /** The class open on the Classes page. */
  openClassId?: string
  /** The student was deleted: leave their page. */
  onDeleted: () => Promise<void>
  classroomNames: Map<string, string>
}) {
  // "Delete student" at the bottom. A snapshot of the student when it was
  // opened, and a fresh dialog each time (so the typing and class start over).
  const [deleteTarget, setDeleteTarget] = useState<DeleteStudentTarget | null>(
    null,
  )
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteKey, setDeleteKey] = useState(0)

  // The trash can on a mark in "All marks". Kept after the mark is deleted,
  // so the dialog doesn't blank out while it closes.
  const [markTarget, setMarkTarget] = useState<DeleteMarkTarget | null>(null)
  const [markOpen, setMarkOpen] = useState(false)
  // The trash can that opened the dialog goes with its mark, so focus lands
  // on the day's heading instead.
  const markDeleted = useRef(false)
  const dayHeadingRef = useRef<HTMLHeadingElement>(null)

  // The teacher's own time zone: the day is fetched in it, and every time on
  // the page is shown on its clock.
  const zone = timeZone()
  const marks = useQuery(studentMarksQueryOptions(student.id, date))
  const now = useMinutesNow(date === today, zone)
  // For the printed report only: the school days leading up to this one.
  const trend = useQuery(
    studentDailyQueryOptions(
      student.id,
      schoolDaysEnding(date, RECENT_DAYS)[0],
      date,
    ),
  )
  // The day's own marks are needed; recent days print if they can, but
  // aren't waited for when offline or failing.
  const reportReady =
    marks.data !== undefined &&
    !marks.isPlaceholderData &&
    !(trend.isPending && trend.fetchStatus === 'fetching')

  const list = marks.data ?? []
  const positive = list.filter((m) => m.is_positive).length
  const negative = list.length - positive
  // Only label marks with their class when the student is in more than one.
  const classroomName =
    student.classrooms.length > 1
      ? (id: string) => classroomNames.get(id)
      : undefined

  return (
    <>
      <main className="mx-auto flex w-full max-w-3xl min-w-0 flex-1 flex-col gap-6 px-4 py-6 sm:py-8 print:hidden">
        <Link
          to="/classes"
          className={cn(
            buttonVariants({ variant: 'link' }),
            'h-auto self-start px-0 text-base font-bold',
          )}
        >
          <ChevronLeft className="size-5" />
          Classes
        </Link>

        <header className="flex items-start gap-4">
          {/* The same ring as the class grid, for the day shown. */}
          <MarkRing
            today={marks.data ? { positive, negative } : null}
            className="size-16 sm:size-20"
          >
            <Avatar aria-hidden className="size-full after:hidden">
              <AvatarFallback className="bg-muted text-lg font-bold text-foreground sm:text-xl">
                {initials(student.first_name, student.last_name)}
              </AvatarFallback>
            </Avatar>
          </MarkRing>
          <div className="flex min-w-0 flex-1 flex-col gap-1 sm:pt-2">
            {/* A new form for each student, so an open edit doesn't carry over. */}
            <StudentNameForm key={student.id} student={student} />
            {student.classrooms.length > 0 && (
              <p className="text-sm text-muted-foreground">
                {student.classrooms.map((c) => c.name).join(' · ')}
              </p>
            )}
          </div>
        </header>

        <div className="flex flex-wrap items-center gap-2">
          <DayPicker date={date} today={today} onChange={onShowDay} />
          <Button
            variant="outline"
            onClick={() => window.print()}
            disabled={!reportReady}
            className="ml-auto h-10 rounded-lg border-2 border-border bg-card px-3 text-base font-bold"
          >
            <Printer className="size-5" />
            Print report
          </Button>
        </div>

        <Card className={cardClass}>
          <div className="flex flex-col gap-1">
            <h2
              ref={dayHeadingRef}
              tabIndex={-1}
              className="text-lg font-bold outline-none"
            >
              {date === today
                ? `Today, ${formatLongDate(date)}`
                : formatLongDate(date)}
            </h2>
            <p className="text-sm text-muted-foreground">
              Each dot is one mark, placed at the time it was given. Times are
              in {timeZoneLabel(date, zone)}.
            </p>
          </div>

          {marks.data ? (
            <>
              <DaySummary
                positive={positive}
                negative={negative}
                busiest={busiestHour(list, zone)}
              />
              <DayTimeline
                marks={list}
                timeZone={zone}
                now={now}
                classroomName={classroomName}
                emptyText={
                  date === today ? 'No marks yet today' : 'No marks this day'
                }
                faded={marks.isPlaceholderData}
              />
            </>
          ) : marks.isError ? (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <p className="flex items-center gap-2 text-sm font-medium">
                <CircleAlert className="size-5 shrink-0 text-destructive" />
                Couldn’t load this day’s marks.
              </p>
              <Button
                variant="outline"
                onClick={() => void marks.refetch()}
                disabled={marks.isFetching}
                className="rounded-lg border-2 border-border font-bold"
              >
                <RefreshCw className={cn(marks.isFetching && 'animate-spin')} />
                Try again
              </Button>
            </div>
          ) : (
            <p
              role="status"
              className="flex items-center justify-center gap-2 py-16 text-sm font-medium text-muted-foreground"
            >
              <Spinner aria-hidden className="size-4" />
              Loading marks…
            </p>
          )}
        </Card>

        {list.length > 0 && (
          <Card className={cn(cardClass, 'gap-2')}>
            <h2 className="text-lg font-bold">All marks</h2>
            <MarkList
              marks={list}
              timeZone={zone}
              classroomName={classroomName}
              // Not while another day's marks stand in for the one loading.
              onDelete={
                marks.isPlaceholderData
                  ? undefined
                  : (mark) => {
                      setMarkTarget({
                        mark,
                        date,
                        time: formatTime(markTime(mark), zone),
                        studentName: student.first_name || student.last_name,
                      })
                      setMarkOpen(true)
                    }
              }
            />
          </Card>
        )}

        {/* Not for a student in no current class: there's nothing to delete
            them from here. */}
        {student.classrooms.length > 0 && (
          <div className="border-t-2 border-border pt-6">
            <Button
              variant="outline"
              onClick={() => {
                setDeleteTarget({
                  id: student.id,
                  first_name: student.first_name,
                  last_name: student.last_name,
                  classrooms: student.classrooms,
                })
                setDeleteKey((k) => k + 1)
                setDeleteOpen(true)
              }}
              className="h-11 rounded-lg border-2 px-4 font-bold"
            >
              <Trash2 />
              Delete student
            </Button>
          </div>
        )}
      </main>

      {deleteTarget && (
        <DeleteStudentDialog
          key={deleteKey}
          target={deleteTarget}
          openClassId={openClassId}
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          onDeleted={onDeleted}
        />
      )}

      {markTarget && (
        <DeleteMarkDialog
          target={markTarget}
          open={markOpen}
          onOpenChange={setMarkOpen}
          onDeleted={() => {
            markDeleted.current = true
          }}
          finalFocus={() => {
            if (!markDeleted.current) return true
            markDeleted.current = false
            return dayHeadingRef.current
          }}
        />
      )}

      {/* Only on paper. Rendered once the day is in (not while a different
        day's marks stand in), so Print never shows the wrong day. */}
      {reportReady && (
        <StudentReport
          student={student}
          date={date}
          marks={list}
          trend={trend.data}
          teacherName={teacherName}
          timeZone={zone}
          classroomName={classroomName}
        />
      )}
    </>
  )
}

/** Previous day, a date picker, next day (not past today), and Today. */
function DayPicker({
  date,
  today,
  onChange,
}: {
  date: string
  today: string
  onChange: (date: string) => void
}) {
  const arrowClass = 'size-10 rounded-lg border-2 border-border'
  return (
    <div
      role="group"
      aria-label="Day"
      className="flex flex-wrap items-center gap-2"
    >
      <Button
        variant="outline"
        size="icon"
        aria-label="Previous day"
        onClick={() => onChange(addDays(date, -1))}
        className={arrowClass}
      >
        <ChevronLeft className="size-5" />
      </Button>
      <Input
        type="date"
        aria-label="Pick a day"
        value={date}
        max={today}
        onChange={(e) => {
          const picked = e.target.value
          if (isDateString(picked) && picked <= today) onChange(picked)
        }}
        className="h-10 w-auto rounded-lg border-2 border-border bg-card px-3 text-base font-bold"
      />
      <Button
        variant="outline"
        size="icon"
        aria-label="Next day"
        disabled={date >= today}
        onClick={() => onChange(addDays(date, 1))}
        className={arrowClass}
      >
        <ChevronRight className="size-5" />
      </Button>
      {date !== today && (
        <Button
          variant="link"
          onClick={() => onChange(today)}
          className="text-base font-bold"
        >
          Today
        </Button>
      )}
    </div>
  )
}

/** The day in three numbers: positive, negative, and the busiest hour. */
function DaySummary({
  positive,
  negative,
  busiest,
}: {
  positive: number
  negative: number
  busiest: { hour: number; count: number } | null
}) {
  return (
    // Two across on phones, with the busiest hour on its own row below.
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      <Stat label="Positive" keyClass="bg-chart-5" value={String(positive)} />
      <Stat
        label="Negative"
        keyClass="bg-destructive"
        value={String(negative)}
      />
      <Stat
        className="col-span-2 sm:col-span-1"
        label="Busiest hour"
        value={busiest ? formatHourSpan(busiest.hour) : '—'}
        note={busiest ? `${busiest.count} marks` : undefined}
      />
    </dl>
  )
}

function Stat({
  label,
  value,
  keyClass,
  note,
  className,
}: {
  className?: string
  label: string
  value: string
  /** A small dot in the series color, beside the label. */
  keyClass?: string
  note?: string
}) {
  return (
    <div
      className={cn(
        'flex min-w-0 flex-col gap-0.5 rounded-lg bg-muted px-3 py-2',
        className,
      )}
    >
      <dt className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        {keyClass && (
          <span
            aria-hidden
            className={cn('size-2 shrink-0 rounded-full', keyClass)}
          />
        )}
        <span className="truncate">{label}</span>
      </dt>
      <dd className="text-xl font-bold">
        {value}
        {note && (
          <span className="block text-xs font-medium text-muted-foreground">
            {note}
          </span>
        )}
      </dd>
    </div>
  )
}

/**
 * Every mark in words, earliest first: the chart's table view. Each has a
 * trash can to delete it (it asks first).
 */
function MarkList({
  marks,
  timeZone: zone,
  classroomName,
  onDelete,
}: {
  marks: Array<Mark>
  timeZone: string
  classroomName?: (id: string) => string | undefined
  /** The trash can was pressed. Left out, the trash cans are off. */
  onDelete?: (mark: Mark) => void
}) {
  const sorted = [...marks].sort((a, b) =>
    markTime(a).localeCompare(markTime(b)),
  )
  return (
    <ol className="flex flex-col divide-y divide-foreground/10">
      {sorted.map((mark) => (
        <li key={mark.id} className="flex items-center gap-3 py-2.5">
          <span className="w-18 shrink-0 text-sm text-muted-foreground tabular-nums">
            {formatTime(markTime(mark), zone)}
          </span>
          <span
            aria-hidden
            className={cn(
              'size-2.5 shrink-0 rounded-full',
              mark.is_positive ? 'bg-chart-5' : 'bg-destructive',
            )}
          />
          <span className="min-w-0 flex-1 truncate text-sm font-bold">
            {mark.name}
          </span>
          {/* Given through a link the teacher shared with a substitute. */}
          {mark.from_sub && (
            <span className="shrink-0 rounded-full border-2 border-border bg-muted px-2 text-xs font-bold">
              Sub
              <span className="sr-only"> (given by a substitute)</span>
            </span>
          )}
          <span className="shrink-0 text-right text-xs text-muted-foreground">
            {mark.is_positive ? 'Positive' : 'Negative'}
            {classroomName && (
              <span className="block">{classroomName(mark.classroom_id)}</span>
            )}
          </span>
          {/* Small and quiet, but a 36px target. The negative margins keep
              the row as tall as before. */}
          <Button
            variant="ghost"
            size="icon-lg"
            aria-label={`Delete “${mark.name}” at ${formatTime(markTime(mark), zone)}`}
            disabled={!onDelete}
            onClick={() => onDelete?.(mark)}
            className="-my-1.5 -mr-2 rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive dark:hover:bg-destructive/20"
          >
            <Trash2 className="size-4" />
          </Button>
        </li>
      ))}
    </ol>
  )
}

function StudentMissing({
  notFound,
  onRetry,
  retrying,
}: {
  notFound: boolean
  onRetry: () => void
  retrying: boolean
}) {
  return (
    <Empty className="max-w-md">
      <EmptyHeader>
        <EmptyMedia
          variant="icon"
          className="size-14 rounded-lg border-2 border-border bg-muted text-foreground"
        >
          {notFound ? (
            <UserX className="size-7" />
          ) : (
            <CircleAlert className="size-7" />
          )}
        </EmptyMedia>
        <EmptyTitle className="text-2xl font-bold">
          {notFound ? 'Student not found' : 'Couldn’t load this student'}
        </EmptyTitle>
        <EmptyDescription className="text-base">
          {notFound
            ? 'They may have been removed from your classes.'
            : 'Check your connection and try again.'}
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        {notFound ? (
          <Link to="/classes" className={buttonVariants({ size: 'lg' })}>
            Back to classes
          </Link>
        ) : (
          <Button onClick={onRetry} disabled={retrying} size="lg">
            <RefreshCw className={cn(retrying && 'animate-spin')} />
            Try again
          </Button>
        )}
      </EmptyContent>
    </Empty>
  )
}

/** Minutes into the day now, ticking every 30 seconds; null when off. */
function useMinutesNow(on: boolean, zone: string) {
  const [now, setNow] = useState(() => minutesIntoDay(new Date(), zone))
  useEffect(() => {
    if (!on) return
    const timer = setInterval(
      () => setNow(minutesIntoDay(new Date(), zone)),
      30_000,
    )
    return () => clearInterval(timer)
  }, [on, zone])
  return on ? now : null
}
