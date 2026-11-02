import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { Check, Maximize, Minimize, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { clockMinutes, formatClockRange, formatShortDate } from '#/lib/calendar'
import { isBlank, progress } from '#/lib/lesson-plans'
import type { PlanDay, PlanItem, PlanSection } from '#/lib/lesson-plans'
import { flushDrafts, runOp } from '#/lib/lesson-plan-queue'
import { isStandalone } from '#/lib/pwa-install'
import { ConnectionStatus } from '#/components/connection-status'
import { useWakeLock } from '#/hooks/useWakeLock'
import { Clock } from './clock'
import { PresenterClass } from './presenter-class'

/**
 * The day's plan filling the whole screen, for the phone in a teacher's hand
 * while teaching: every section with its time, every line a big row that
 * crosses off with a tap. The screen stays on while it's open. Checkmarks
 * work offline in the installed app and are sent when the connection is back.
 * A round button in the corner brings up the class, to give marks without
 * losing the place (see PresenterClass).
 */
export function PresenterView({
  day,
  isToday,
}: {
  day: PlanDay
  isToday: boolean
}) {
  const queryClient = useQueryClient()
  const now = useMinutesNow()
  useWakeLock()
  // The class over the notes. Not in the address, so flipping is instant.
  const [classOpen, setClassOpen] = useState(false)

  const { done, total } = progress(day.sections)
  const current = isToday
    ? day.sections.find((s) => isDuring(s, now))
    : undefined

  // Opens where the teacher is in the day: the section happening now, else
  // the first with something left to do. Only on arrival: checking things
  // off never moves the page.
  const arrived = useRef(false)
  useLayoutEffect(() => {
    if (arrived.current) return
    arrived.current = true
    const start =
      (isToday && day.sections.find((s) => isDuring(s, minutesNow()))) ||
      day.sections.find((s) => progress([s]).done < progress([s]).total)
    if (start && start !== day.sections[0]) {
      document
        .getElementById(sectionId(start.id))
        ?.scrollIntoView({ block: 'start' })
    }
  }, [day.sections, isToday])

  function check(item: PlanItem) {
    runOp(queryClient, {
      kind: 'done',
      date: day.date,
      id: item.id,
      done: !item.done,
    })
  }

  return (
    <>
      {/* Covered, and out of reach of keyboards and screen readers, while
          the class is open. */}
      <div
        inert={classOpen}
        className="flex min-h-dvh flex-col bg-background text-foreground"
      >
        <header className="sticky top-0 z-10 border-b-2 border-border bg-card pt-[env(safe-area-inset-top)]">
          <div className="flex items-center gap-2 py-1.5 pr-3 pl-1.5">
            <Link
              to="/lesson-plans/$date"
              params={{ date: day.date }}
              onClick={flushDrafts}
              aria-label="Close presenter view"
              className="flex size-11 shrink-0 items-center justify-center rounded-lg outline-none hover:bg-muted focus-visible:ring-4 focus-visible:ring-ring"
            >
              <X className="size-6" />
            </Link>
            <div className="flex min-w-0 flex-1 flex-col">
              <h1 className="truncate leading-tight font-bold">
                {isToday ? 'Today' : formatShortDate(day.date)}
              </h1>
              <p className="text-sm text-muted-foreground tabular-nums">
                {total === 0
                  ? 'Nothing to check off'
                  : done === total
                    ? 'All done!'
                    : `${done} of ${total} done`}
              </p>
            </div>
            <ConnectionStatus />
            {isToday && <Clock />}
            <FullScreenButton />
          </div>
          <div
            role="progressbar"
            aria-label="Lines checked off"
            aria-valuemin={0}
            aria-valuemax={total}
            aria-valuenow={done}
            className="h-1.5 bg-muted"
          >
            <div
              className="h-full bg-chart-5 transition-[width] duration-300 motion-reduce:transition-none"
              style={{ width: `${total ? (done / total) * 100 : 0}%` }}
            />
          </div>
        </header>

        {day.sections.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
            <p className="text-xl font-bold">Nothing planned for this day.</p>
            <Link
              to="/lesson-plans/$date"
              params={{ date: day.date }}
              className="text-lg font-bold text-primary underline-offset-4 hover:underline"
            >
              Plan it
            </Link>
          </div>
        ) : (
          // One column on phones; on tablets and laptops the sections flow
          // into columns, so more of the day fits on the screen. Room at the
          // bottom for the class button, so it never covers the last lines.
          <main className="flex-1 pb-[calc(6rem+env(safe-area-inset-bottom))] md:columns-2 md:gap-0 md:[column-rule:2px_solid_var(--border)] xl:columns-3">
            {day.sections.map((section) => (
              <PresenterSection
                key={section.id}
                section={section}
                isNow={section === current}
                onCheck={check}
              />
            ))}
          </main>
        )}
      </div>
      <PresenterClass
        open={classOpen}
        onOpenChange={setClassOpen}
        isToday={isToday}
      />
    </>
  )
}

const sectionId = (id: string) => `present-${id}`

function PresenterSection({
  section,
  isNow,
  onCheck,
}: {
  section: PlanSection
  isNow: boolean
  onCheck: (item: PlanItem) => void
}) {
  const lines = section.items.filter((i) => !isBlank(i))
  const { done, total } = progress([section])
  const complete = total > 0 && done === total
  const time = formatClockRange(section.start_time, section.end_time)

  return (
    <section
      id={sectionId(section.id)}
      aria-label={section.title.trim() || 'Untitled section'}
      className={cn(
        // Lands just under the top bar when scrolled to.
        'scroll-mt-[calc(4.5rem+env(safe-area-inset-top))] break-inside-avoid border-b-2 border-border',
        isNow && 'border-l-8 border-l-primary',
      )}
    >
      <header
        className={cn(
          'flex items-start gap-3 px-4 pt-4 pb-2',
          isNow && 'bg-primary/10',
        )}
      >
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          {(time || isNow) && (
            <p className="flex items-center gap-2 text-base font-bold text-muted-foreground tabular-nums">
              {isNow && (
                <span className="rounded-full border-2 border-border bg-primary px-2 text-sm text-primary-foreground">
                  Now
                </span>
              )}
              {time}
            </p>
          )}
          <h2
            className={cn(
              'text-2xl leading-tight font-bold wrap-break-word',
              complete && 'text-muted-foreground',
            )}
          >
            {section.title.trim() || 'Untitled section'}
          </h2>
        </div>
        {total > 0 && (
          <span
            className={cn(
              'mt-0.5 flex h-8 shrink-0 items-center gap-1 rounded-full border-2 border-border px-2.5 text-sm font-bold tabular-nums',
              complete ? 'bg-chart-5' : 'bg-card',
            )}
          >
            {complete && <Check className="size-4" strokeWidth={3} />}
            <span aria-hidden>
              {done}/{total}
            </span>
            <span className="sr-only">
              {complete ? 'All done' : `${done} of ${total} done`}
            </span>
          </span>
        )}
      </header>

      {lines.length === 0 ? (
        <p className="px-4 pb-4 text-muted-foreground">
          No lines to check off.
        </p>
      ) : (
        <ul className="pb-2">
          {lines.map((item) => (
            <li key={item.id}>
              <PresenterRow item={item} onCheck={() => onCheck(item)} />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/** A line: the whole row is the checkbox, easy to hit mid-lesson. */
function PresenterRow({
  item,
  onCheck,
}: {
  item: PlanItem
  onCheck: () => void
}) {
  const sub = item.indent === 1
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={item.done}
      onClick={onCheck}
      className={cn(
        'flex min-h-14 w-full items-start gap-3 py-2.5 pr-4 text-left outline-none select-none hover:bg-muted/50 focus-visible:ring-4 focus-visible:ring-ring focus-visible:ring-inset active:bg-muted',
        sub ? 'pl-14' : 'pl-4',
      )}
    >
      <span
        aria-hidden
        className={cn(
          'flex shrink-0 items-center justify-center border-2 border-border transition-colors motion-reduce:transition-none',
          sub ? 'mt-0.5 size-7 rounded-full' : 'size-8 rounded-md',
          item.done ? 'bg-chart-5' : 'bg-card',
        )}
      >
        {item.done && (
          <Check className={sub ? 'size-4' : 'size-5'} strokeWidth={3} />
        )}
      </span>
      <span
        className={cn(
          'min-w-0 flex-1 leading-snug wrap-break-word whitespace-pre-wrap',
          sub ? 'pt-0.5 text-lg' : 'pt-0.5 text-xl',
          item.done &&
            'text-muted-foreground line-through decoration-2 decoration-foreground/60',
        )}
      >
        {item.text}
      </span>
    </button>
  )
}

/**
 * Hides the browser's own bars where that's possible (Android, tablets,
 * laptops). Not on iPhones, and not needed in the installed app.
 */
function FullScreenButton() {
  const [on, setOn] = useState(() => !!document.fullscreenElement)
  useEffect(() => {
    const onChange = () => setOn(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])
  if (!document.fullscreenEnabled || isStandalone()) return null

  return (
    <button
      type="button"
      aria-label={on ? 'Exit full screen' : 'Full screen'}
      aria-pressed={on}
      onClick={() =>
        void (
          on
            ? document.exitFullscreen()
            : document.documentElement.requestFullscreen()
        ).catch(() => {})
      }
      className="flex size-11 shrink-0 items-center justify-center rounded-lg outline-none hover:bg-muted focus-visible:ring-4 focus-visible:ring-ring"
    >
      {on ? <Minimize className="size-5" /> : <Maximize className="size-5" />}
    </button>
  )
}

/** Minutes since local midnight, updated every minute. */
function useMinutesNow() {
  const [now, setNow] = useState(minutesNow)
  useEffect(() => {
    const timer = setInterval(() => setNow(minutesNow()), 30_000)
    return () => clearInterval(timer)
  }, [])
  return now
}

function minutesNow() {
  const d = new Date()
  return d.getHours() * 60 + d.getMinutes()
}

function isDuring(section: PlanSection, minutes: number) {
  if (!section.start_time || !section.end_time) return false
  return (
    clockMinutes(section.start_time) <= minutes &&
    minutes < clockMinutes(section.end_time)
  )
}
