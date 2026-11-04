import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Check, Maximize, Minimize } from 'lucide-react'
import { cn } from '@/lib/utils'
import { clockMinutes, formatClockRange } from '#/lib/calendar'
import { isSectionDone, linesOf, progress } from '#/lib/lesson-plans'
import type { PlanDay, PlanItem, PlanSection } from '#/lib/lesson-plans'
import { isStandalone } from '#/lib/pwa-install'
import { ConnectionStatus } from '#/components/connection-status'
import { useWakeLock } from '#/hooks/useWakeLock'
import { Clock } from './clock'

/** The class over the notes is open (see classView). */
export type ClassViewState = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * The day's plan filling the whole screen, for the phone in a teacher's hand
 * while teaching: every section with its time, every line a big row that
 * crosses off with a tap. The screen stays on while it's open. A round
 * button in the corner can bring up the class, to give marks without losing
 * the place (classView).
 *
 * Used by the teacher (lesson-plans.$date_.present.tsx) and by a substitute
 * opening a shared link (components/sub), who each say how a checkmark is
 * saved and what the corner and top bar hold.
 */
export function PresenterView({
  day,
  isToday,
  heading,
  onCheck,
  onCheckSection,
  exit,
  emptyAction,
  classView,
}: {
  day: PlanDay
  isToday: boolean
  /** The top bar's title: "Today", "Tue, Nov 5", "Ms. Lee’s plan". */
  heading: string
  /**
   * A line was tapped: check it off, or uncheck it. Left out, lines can't be
   * checked (a co-teacher who can only view the plan).
   */
  onCheck?: (item: PlanItem) => void
  /**
   * A section's own box was tapped: check it off (with all its lines), or
   * uncheck it. Left out, like onCheck.
   */
  onCheckSection?: (section: PlanSection) => void
  /** Top left, e.g. the teacher's close button. */
  exit?: ReactNode
  /** Under "Nothing planned for this day.", e.g. a link to plan it. */
  emptyAction?: ReactNode
  /** The class over the notes, with the round button that opens it. */
  classView?: (state: ClassViewState) => ReactNode
}) {
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
      day.sections.find((s) => !isSectionDone(s))
    if (start && start !== day.sections[0]) {
      const jump = () =>
        document
          .getElementById(sectionId(start.id))
          ?.scrollIntoView({ block: 'start' })
      jump()
      // The router puts the page back at the top once the route has
      // rendered (scrollRestoration in main.tsx), right after this runs.
      // Jump again after that, before anything is painted. Not cancelled on
      // cleanup, so it survives StrictMode's double run; unmounted, it finds
      // no section and does nothing.
      requestAnimationFrame(jump)
    }
  }, [day.sections, isToday])

  return (
    <>
      {/* Covered, and out of reach of keyboards and screen readers, while
          the class is open. */}
      <div
        inert={classOpen}
        className="flex min-h-dvh flex-col bg-background text-foreground"
      >
        <header className="sticky top-0 z-10 border-b-2 border-border bg-card pt-[env(safe-area-inset-top)]">
          <div
            className={cn(
              'flex items-center gap-2 py-1.5 pr-3',
              exit ? 'pl-1.5' : 'pl-4',
            )}
          >
            {exit}
            <div className="flex min-w-0 flex-1 flex-col">
              <h1 className="truncate leading-tight font-bold">{heading}</h1>
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
            aria-label="Checked off"
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
            {emptyAction}
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
                onCheck={onCheck}
                onCheckSection={onCheckSection}
              />
            ))}
          </main>
        )}
      </div>
      {classView?.({ open: classOpen, onOpenChange: setClassOpen })}
    </>
  )
}

const sectionId = (id: string) => `present-${id}`

function PresenterSection({
  section,
  isNow,
  onCheck,
  onCheckSection,
}: {
  section: PlanSection
  isNow: boolean
  onCheck?: (item: PlanItem) => void
  onCheckSection?: (section: PlanSection) => void
}) {
  const lines = linesOf(section)
  const { done, total } = progress([section])
  const complete = isSectionDone(section)
  const time = formatClockRange(section.start_time, section.end_time)
  const name = section.title.trim() || 'Untitled section'
  // With no lines, the whole header is the box: there's nothing else to tap.
  // With lines, only the box, so a stray tap on the title can't check them
  // all.
  const wholeHeader = lines.length === 0 && !!onCheckSection

  return (
    <section
      id={sectionId(section.id)}
      aria-label={name}
      className={cn(
        // Lands just under the top bar when scrolled to.
        'scroll-mt-[calc(4.5rem+env(safe-area-inset-top))] break-inside-avoid border-b-2 border-border',
        isNow && 'border-l-8 border-l-primary',
      )}
    >
      <header
        className={cn(
          'relative flex items-center gap-3 px-4 pt-4',
          lines.length > 0 ? 'pb-2' : 'pb-4',
          isNow && 'bg-primary/10',
          wholeHeader && 'hover:bg-muted/50 active:bg-muted',
        )}
      >
        <button
          type="button"
          role="checkbox"
          aria-checked={complete}
          aria-label={`${name} (whole subject)`}
          onClick={onCheckSection && (() => onCheckSection(section))}
          disabled={!onCheckSection}
          className={cn(
            // 44px to tap; the box inside lines up with the lines' boxes.
            '-ml-1.5 flex size-11 shrink-0 items-center justify-center rounded-lg outline-none select-none focus-visible:ring-4 focus-visible:ring-ring',
            wholeHeader && 'after:absolute after:inset-0',
          )}
        >
          <span
            aria-hidden
            className={cn(
              'flex size-8 items-center justify-center rounded-md border-2 border-border transition-colors motion-reduce:transition-none',
              complete ? 'bg-chart-5' : 'bg-card',
            )}
          >
            {complete && <Check className="size-5" strokeWidth={3} />}
          </span>
        </button>
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
            {name}
          </h2>
        </div>
        {lines.length > 0 && (
          <span
            className={cn(
              'flex h-8 shrink-0 items-center rounded-full border-2 border-border px-2.5 text-sm font-bold tabular-nums',
              complete ? 'bg-chart-5' : 'bg-card',
            )}
          >
            <span aria-hidden>
              {done}/{total}
            </span>
            <span className="sr-only">
              {complete ? 'All done' : `${done} of ${total} done`}
            </span>
          </span>
        )}
      </header>

      {lines.length > 0 && (
        <ul className="pb-2">
          {lines.map((item) => (
            <li key={item.id}>
              <PresenterRow
                item={item}
                onCheck={onCheck && (() => onCheck(item))}
              />
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
  /** Left out: shown, but can't be checked. */
  onCheck?: () => void
}) {
  const sub = item.indent > 0
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={item.done}
      onClick={onCheck}
      disabled={!onCheck}
      className={cn(
        'flex min-h-14 w-full items-start gap-3 py-2.5 pr-4 text-left outline-none select-none focus-visible:ring-4 focus-visible:ring-ring focus-visible:ring-inset',
        onCheck && 'hover:bg-muted/50 active:bg-muted',
        { 0: 'pl-4', 1: 'pl-14', 2: 'pl-24' }[item.indent],
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
