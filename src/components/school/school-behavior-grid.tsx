import type { ReactNode } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Building2, CircleAlert, RefreshCw, WifiOff } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'
import { OfflineNote } from '#/components/offline-note'
import { MarkCounts, MarkRing } from '#/components/student-card'
import { TeacherAvatar } from '#/components/teacher-avatar'
import { formatLongDate } from '#/lib/day'
import { LIVE_REFRESH_MS } from '#/lib/freshness'
import { useOnline } from '#/lib/online'
import { schoolBehaviorQueryOptions } from '#/lib/school'
import type { MarkCounts as Counts } from '#/lib/school'
import { useSwitchSpace } from '#/lib/workspace'

/**
 * The administrator's dashboard for one day, like a teacher's Classes page:
 * the school's ring with its name beside it (as a class's ring heads its
 * students), the day picker, then a ring for each teacher. Tapping a teacher
 * opens their own Classes page, view only.
 */
export function SchoolBehaviorGrid({
  date,
  today,
  schoolName,
  dayPicker,
}: {
  date: string
  today: string
  schoolName: string
  /** Between the school's ring and the teachers'. */
  dayPicker: ReactNode
}) {
  const online = useOnline()
  const { switchTo, switching } = useSwitchSpace()
  const isToday = date === today
  const behavior = useQuery({
    ...schoolBehaviorQueryOptions(date),
    // Like the teacher's own screen: today's counts keep up on their own.
    refetchInterval: isToday ? LIVE_REFRESH_MS : false,
    // Another day's counts stay (faded) until the new day's arrive.
    placeholderData: keepPreviousData,
  })
  const data = behavior.data
  const stale = behavior.isPlaceholderData
  const busy = switching !== undefined
  const day = isToday ? 'Today' : formatLongDate(date)

  return (
    <div className="flex flex-col gap-5">
      <SchoolHeader
        name={schoolName}
        counts={data?.school ?? null}
        teachers={data?.teachers.length}
        day={day}
        isToday={isToday}
      />
      {dayPicker}
      {!data ? (
        <Status behavior={behavior} />
      ) : (
        <div className="flex flex-col gap-3">
          <ul
            aria-label="Teachers"
            aria-busy={stale || undefined}
            className={cn(
              'grid grid-cols-2 gap-3 transition-opacity sm:grid-cols-3 lg:grid-cols-4',
              stale && 'opacity-60',
            )}
          >
            {data.teachers.map((t) => (
              <li key={t.user_id} className="flex">
                <Card
                  size="sm"
                  className="relative w-full items-center gap-2 rounded-xl border-2 border-border px-2 py-4 text-center shadow-md ring-0 transition-[background-color,scale] has-[>button:focus-visible]:ring-4 has-[>button:focus-visible]:ring-ring has-[>button:hover]:bg-muted has-[>button:active]:scale-95 motion-reduce:transition-none"
                >
                  <MarkRing today={t} className="size-16 sm:size-20">
                    <TeacherAvatar
                      teacher={{ name: t.name }}
                      className="size-full after:hidden"
                      fallbackClassName="text-base sm:text-lg"
                    />
                  </MarkRing>
                  <span className="line-clamp-2 w-full px-1 font-bold wrap-break-word">
                    {t.name}
                  </span>
                  <CountsLine
                    counts={t}
                    empty={isToday ? 'No marks yet today' : 'No marks this day'}
                  />
                  {switching === t.user_id && (
                    <Spinner
                      aria-hidden
                      className="absolute top-2 right-2 size-4"
                    />
                  )}
                  <button
                    type="button"
                    onClick={() =>
                      void switchTo(t.user_id, {
                        to: '/classes',
                        asAdmin: true,
                      })
                    }
                    disabled={busy || !online}
                    title={t.name}
                    aria-label={`${summary(t.name, t, isToday)}. Open their classes, view only`}
                    className="absolute inset-0 rounded-xl outline-none disabled:cursor-not-allowed"
                  />
                </Card>
              </li>
            ))}

            {data.teachers.length === 0 && (
              <li className="col-span-2 flex sm:col-span-3 lg:col-span-4">
                <p className="flex w-full items-center rounded-xl border-2 border-dashed border-border p-4 text-sm text-muted-foreground">
                  No teachers yet. When teachers join with your link, each one
                  gets a card here.
                </p>
              </li>
            )}
          </ul>
          <OfflineNote action="open a teacher’s classes" />
        </div>
      )}
    </div>
  )
}

/**
 * The school's ring with its name beside it and a line under the name: like
 * the class ring at the top of a teacher's Classes page, a little bigger, and
 * with its line on phones too.
 */
function SchoolHeader({
  name,
  counts,
  teachers,
  day,
  isToday,
}: {
  name: string
  /** null while loading. */
  counts: Counts | null
  /** undefined while loading. */
  teachers: number | undefined
  /** "Today", or the day picked. */
  day: string
  isToday: boolean
}) {
  return (
    <header className="flex items-center gap-4 sm:items-start sm:gap-5">
      <MarkRing today={counts} className="size-16 sm:size-24">
        <Avatar aria-hidden className="size-full after:hidden">
          <AvatarFallback className="bg-muted text-foreground">
            <Building2 className="size-6 sm:size-9" />
          </AvatarFallback>
        </Avatar>
      </MarkRing>
      <div className="flex min-w-0 flex-1 flex-col gap-1 sm:pt-3">
        <h2 className="text-xl font-bold wrap-break-word sm:text-2xl">
          {name}
        </h2>
        {counts && teachers !== undefined && (
          <p className="text-sm text-muted-foreground sm:text-base">
            {formatTeacherCount(teachers)}
            {' · '}
            {counts.positive + counts.negative === 0
              ? isToday
                ? 'No marks yet today'
                : `No marks on ${day}`
              : `${day}: ${counts.positive} positive, ${counts.negative} negative`}
          </p>
        )}
      </div>
    </header>
  )
}

function formatTeacherCount(count: number) {
  return `${count} ${count === 1 ? 'teacher' : 'teachers'}`
}

/** While the day's counts load, or if they can't. */
function Status({
  behavior,
}: {
  behavior: {
    fetchStatus: string
    isError: boolean
    isFetching: boolean
    refetch: () => unknown
  }
}) {
  if (behavior.fetchStatus === 'paused') {
    return (
      <p
        role="status"
        className="flex items-center gap-2 text-sm font-medium text-muted-foreground"
      >
        <WifiOff className="size-4 shrink-0" />
        You’re offline. Connect to the internet to see your school’s marks.
      </p>
    )
  }
  if (behavior.isError) {
    return (
      <div role="alert" className="flex flex-col items-start gap-3">
        <p className="flex items-center gap-2 font-medium">
          <CircleAlert className="size-5 shrink-0 text-destructive" />
          Couldn’t load your school’s marks.
        </p>
        <Button
          variant="outline"
          onClick={() => void behavior.refetch()}
          disabled={behavior.isFetching}
          className="h-10 rounded-lg border-2 font-bold"
        >
          <RefreshCw className={cn(behavior.isFetching && 'animate-spin')} />
          Try again
        </Button>
      </div>
    )
  }
  return (
    <p
      role="status"
      className="flex items-center gap-2 font-medium text-muted-foreground"
    >
      <Spinner aria-hidden className="size-5" />
      Loading your school’s marks…
    </p>
  )
}

/** "+3 −1", or a short line when there are none. */
function CountsLine({ counts, empty }: { counts: Counts; empty: string }) {
  const total = counts.positive + counts.negative
  return (
    <span
      aria-hidden
      className="flex h-5 items-center justify-center gap-2 text-sm font-bold tabular-nums"
    >
      {total === 0 ? (
        <span className="text-xs font-medium whitespace-nowrap text-muted-foreground">
          {empty}
        </span>
      ) : (
        <MarkCounts positive={counts.positive} negative={counts.negative} />
      )}
    </span>
  )
}

function summary(name: string, c: Counts, isToday: boolean) {
  const when = isToday ? 'today' : 'that day'
  return c.positive + c.negative === 0
    ? `${name}, no marks ${when}`
    : `${name}, ${c.positive} positive, ${c.negative} negative ${when}`
}
