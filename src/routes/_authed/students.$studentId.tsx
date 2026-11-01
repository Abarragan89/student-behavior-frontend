import { useEffect, useState } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import {
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  RefreshCw,
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
} from '#/lib/day'
import { localDate, timeZone } from '#/lib/marks'
import type { Mark } from '#/lib/marks'
import {
  studentFromMe,
  studentMarksQueryOptions,
  studentQueryOptions,
} from '#/lib/students'
import type { StudentDetail } from '#/lib/students'
import { DayTimeline } from '#/components/day-timeline'
import { StudentNameForm } from '#/components/forms/student-name-form'
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

function StudentPage() {
  const { studentId } = Route.useParams()
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const { data: me } = useMe()

  const today = localDate()
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
  classroomNames,
}: {
  student: StudentDetail
  date: string
  today: string
  onShowDay: (date: string) => void
  classroomNames: Map<string, string>
}) {
  // The teacher's own time zone: the day is fetched in it, and every time on
  // the page is shown on its clock.
  const zone = timeZone()
  const marks = useQuery(studentMarksQueryOptions(student.id, date))
  const now = useMinutesNow(date === today, zone)

  const list = marks.data ?? []
  const positive = list.filter((m) => m.is_positive).length
  const negative = list.length - positive
  // Only label marks with their class when the student is in more than one.
  const classroomName =
    student.classrooms.length > 1
      ? (id: string) => classroomNames.get(id)
      : undefined

  return (
    <main className="mx-auto flex w-full max-w-3xl min-w-0 flex-1 flex-col gap-6 px-4 py-6 sm:py-8">
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

      <DayPicker date={date} today={today} onChange={onShowDay} />

      <Card className={cardClass}>
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-bold">
            {date === today
              ? `Today, ${formatLongDate(date)}`
              : formatLongDate(date)}
          </h2>
          <p className="text-sm text-muted-foreground">
            Each dot is one mark, placed at the time it was given. Times are in{' '}
            {timeZoneLabel(date, zone)}.
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
          />
        </Card>
      )}
    </main>
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

/** Every mark in words, earliest first: the chart's table view. */
function MarkList({
  marks,
  timeZone: zone,
  classroomName,
}: {
  marks: Array<Mark>
  timeZone: string
  classroomName?: (id: string) => string | undefined
}) {
  const sorted = [...marks].sort((a, b) =>
    a.created_at.localeCompare(b.created_at),
  )
  return (
    <ol className="flex flex-col divide-y divide-foreground/10">
      {sorted.map((mark) => (
        <li key={mark.id} className="flex items-center gap-3 py-2.5">
          <span className="w-18 shrink-0 text-sm text-muted-foreground tabular-nums">
            {formatTime(mark.created_at, zone)}
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
          <span className="shrink-0 text-right text-xs text-muted-foreground">
            {mark.is_positive ? 'Positive' : 'Negative'}
            {classroomName && (
              <span className="block">{classroomName(mark.classroom_id)}</span>
            )}
          </span>
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

/**
 * The hour (on the wall clock) with the most marks, earliest on a tie. Null
 * when no hour has more than one: one mark isn't a pattern.
 */
function busiestHour(marks: Array<Mark>, zone: string) {
  const perHour = new Map<number, number>()
  for (const mark of marks) {
    const hour = Math.floor(minutesIntoDay(mark.created_at, zone) / 60)
    perHour.set(hour, (perHour.get(hour) ?? 0) + 1)
  }
  let best: { hour: number; count: number } | null = null
  for (const [hour, count] of perHour) {
    if (
      count > 1 &&
      (!best ||
        count > best.count ||
        (count === best.count && hour < best.hour))
    ) {
      best = { hour, count }
    }
  }
  return best
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
