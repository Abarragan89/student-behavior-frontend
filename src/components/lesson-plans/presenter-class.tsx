import {
  memo,
  useEffect,
  useEffectEvent,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import type { ReactNode } from 'react'
import { useSuspenseQuery } from '@tanstack/react-query'
import { ArrowLeft, CircleAlert, NotebookText, Users } from 'lucide-react'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'
import { meQueryOptions } from '#/lib/auth'
import type { Me, OpenClassroom } from '#/lib/auth'
import { canEdit } from '#/lib/workspace'
import { ClassHeader } from '#/components/class-header'
import { ClassRoster } from '#/components/class-roster'
import { ConnectionStatus } from '#/components/connection-status'
import { MarkRing } from '#/components/student-card'
import type { Today } from '#/components/student-card'
import { SwitchClassDialog } from '#/components/switch-class-dialog'
import { useClassToday } from '#/hooks/useClassToday'
import { useClassroomSwitch } from '#/hooks/useClassroomSwitch'
import { Clock } from './clock'

/**
 * The open class, over the presenter's notes, for giving marks mid-lesson:
 * Switch, Select and Select all, but no links away, so the lesson stays one
 * tap away. A round button in the corner (today's class ring around a
 * people icon) slides it in, and the same button slides it back out.
 *
 * It stays mounted while hidden, so it opens at once with the counts already
 * loaded, and the notes underneath never move: they keep their scroll spot,
 * the screen stays awake, and select mode survives a look at the notes.
 */
export const PresenterClass = memo(function PresenterClass({
  open,
  onOpenChange,
  isToday,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  isToday: boolean
}) {
  // Already loaded by the login check (see _authed.tsx).
  const { data: me } = useSuspenseQuery(meQueryOptions)
  // No class: a co-teacher who can't see this teacher's classes.
  if (!me?.classroom) return null
  return (
    <TeacherClass
      me={me}
      classroom={me.classroom}
      open={open}
      onOpenChange={onOpenChange}
      isToday={isToday}
    />
  )
})

function TeacherClass({
  me,
  classroom,
  open,
  onOpenChange,
  isToday,
}: {
  me: Me
  classroom: OpenClassroom
  open: boolean
  onOpenChange: (open: boolean) => void
  isToday: boolean
}) {
  // Switching saves the open class on the server, like on the Classes page.
  const { shownId, isLoading, error, select } = useClassroomSwitch(classroom.id)
  const [switchOpen, setSwitchOpen] = useState(false)
  const shownName =
    me.classrooms.find((c) => c.id === shownId)?.name ?? classroom.name
  const today = useClassToday(classroom.id, !isLoading)
  const headingId = useId()

  return (
    <ClassLayerShell
      open={open}
      onOpenChange={onOpenChange}
      isToday={isToday}
      today={today}
      busy={isLoading}
      headingId={headingId}
    >
      <ClassHeader
        classroom={classroom}
        name={shownName}
        loading={isLoading}
        onSwitch={() => setSwitchOpen(true)}
        headingLevel="h2"
        headingId={headingId}
      />

      {/* Red icon, black text: small red text on white is hard to read. */}
      {error && (
        <p role="alert" className="flex items-center gap-2 text-sm font-medium">
          <CircleAlert className="size-5 shrink-0 text-destructive" />
          {error}
        </p>
      )}

      {isLoading ? (
        <OpeningClass name={shownName} />
      ) : classroom.students.length > 0 ? (
        // Keyed by class, so switching classes starts fresh (no picks
        // carried over).
        <ClassRoster
          key={classroom.id}
          classroom={classroom}
          pageLinks={false}
          // A co-teacher with View on Classes sees the class, gives nothing.
          readOnly={!canEdit(me, 'classes')}
        />
      ) : (
        // Adding students opens the Classes page, so it waits for later.
        <p className="py-16 text-center text-muted-foreground">
          No students in {classroom.name} yet. Add them on the Classes page
          after class.
        </p>
      )}

      <SwitchClassDialog
        classrooms={me.classrooms}
        openId={shownId}
        open={switchOpen}
        onOpenChange={setSwitchOpen}
        onPick={select}
      />
    </ClassLayerShell>
  )
}

/** While a class's students are on their way. */
export function OpeningClass({ name }: { name: string }) {
  return (
    <p
      role="status"
      className="flex items-center justify-center gap-2 py-16 font-medium text-muted-foreground"
    >
      <Spinner aria-hidden className="size-5" />
      Opening {name}…
    </p>
  )
}

/**
 * The layer that slides over the presenter's notes, and the round button
 * that brings it in and out: a top bar with "Back to notes", the clock and
 * the connection, then children (the class). The teacher's (above) and a
 * substitute's (components/sub) fill it with their own class.
 */
export function ClassLayerShell({
  open,
  onOpenChange,
  isToday,
  today,
  busy,
  headingId,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  isToday: boolean
  /** Today's marks for the whole class, for the button's ring. */
  today: Today
  /** The class is loading (a switch). */
  busy: boolean
  /** The class name's heading, which names the layer. */
  headingId: string
  children: ReactNode
}) {
  const layerId = useId()
  const layerRef = useRef<HTMLElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  function close() {
    // Before the class goes inert, which would leave focus on nothing.
    if (layerRef.current?.contains(document.activeElement)) {
      buttonRef.current?.focus({ preventScroll: true })
    }
    onOpenChange(false)
  }

  // Into the class when it opens, so keyboards and screen readers start
  // there (and Escape has somewhere to come from).
  const wasOpen = useRef(open)
  useEffect(() => {
    if (open && !wasOpen.current) {
      layerRef.current?.focus({ preventScroll: true })
    }
    wasOpen.current = open
  }, [open])

  usePageScrollLock(open)
  useCloseRequests(open, close)

  return (
    <>
      <section
        ref={layerRef}
        id={layerId}
        aria-labelledby={headingId}
        aria-busy={busy || undefined}
        tabIndex={-1}
        inert={!open}
        className={cn(
          'fixed inset-0 z-20 overflow-y-auto overscroll-contain bg-background text-foreground outline-none',
          // Fixed boxes skip the body's side padding for the notch.
          'pr-[env(safe-area-inset-right)] pl-[env(safe-area-inset-left)]',
          // Tailwind's translate-* sets `translate`, not `transform`. Shown
          // at once on the way in (so it can take focus straight away), and
          // hidden only once it has slid out.
          'duration-200 ease-out motion-reduce:transition-none',
          open
            ? 'visible translate-none transition-[translate]'
            : 'invisible translate-x-full transition-[translate,visibility]',
        )}
      >
        {/* The same bar as the notes', so the swap reads as one screen. */}
        <header className="sticky top-0 z-10 border-b-2 border-border bg-card pt-[env(safe-area-inset-top)]">
          <div className="flex items-center gap-2 py-1.5 pr-3 pl-1.5">
            <button
              type="button"
              onClick={close}
              className="flex h-11 shrink-0 items-center gap-2 rounded-lg px-2.5 text-base font-bold outline-none hover:bg-muted focus-visible:ring-4 focus-visible:ring-ring"
            >
              <ArrowLeft className="size-6" />
              Back to notes
            </button>
            <span className="flex-1" />
            <ConnectionStatus />
            {isToday && <Clock />}
          </div>
        </header>

        {/* Room at the bottom for the round button, so it never covers
            the last row of students. */}
        <div className="mx-auto flex w-full max-w-5xl min-w-0 flex-col gap-2 px-4 pt-4 pb-[calc(6rem+env(safe-area-inset-bottom))] sm:pt-6">
          {children}
        </div>
      </section>

      {/* Outside the class, so it's never hidden with it. Its name says
          what a tap does, so it has no pressed state on top. */}
      <button
        ref={buttonRef}
        type="button"
        aria-controls={layerId}
        aria-label={open ? 'Back to notes' : 'Show class'}
        title={open ? 'Back to notes' : 'Show class'}
        onClick={() => (open ? close() : onOpenChange(true))}
        className="fixed right-[calc(1rem+env(safe-area-inset-right))] bottom-[calc(1rem+env(safe-area-inset-bottom))] z-30 size-16 rounded-full border-2 border-border bg-card p-0.5 text-foreground shadow-md outline-none transition-[scale] focus-visible:ring-4 focus-visible:ring-ring active:scale-95 motion-reduce:transition-none"
      >
        <MarkRing today={today} className="size-full sm:size-full">
          <span className="flex size-full items-center justify-center rounded-full bg-primary text-primary-foreground">
            {open ? (
              <NotebookText className="size-5" />
            ) : (
              <Users className="size-5" />
            )}
          </span>
        </MarkRing>
      </button>
    </>
  )
}

/**
 * While the class is over the notes, the page itself can't scroll, so the
 * notes stay where the teacher left them. (A class short enough to fit the
 * screen would otherwise pass wheel and swipe scrolling on to them.)
 */
function usePageScrollLock(locked: boolean) {
  useLayoutEffect(() => {
    if (!locked) return
    const html = document.documentElement
    const { overflow, scrollbarGutter } = html.style
    // Laptops with always-on scrollbars: keep the bar's space, so nothing
    // shifts sideways.
    if (window.innerWidth > html.clientWidth) {
      html.style.scrollbarGutter = 'stable'
    }
    html.style.overflow = 'hidden'
    return () => {
      html.style.overflow = overflow
      html.style.scrollbarGutter = scrollbarGutter
    }
  }, [locked])
}

type CloseWatcherLike = {
  onclose: (() => void) | null
  destroy: () => void
}

/**
 * Escape, and Android's back gesture, go back to the notes instead of
 * leaving the presenter.
 */
function useCloseRequests(open: boolean, onClose: () => void) {
  // The newest onClose, without re-making the listeners every render.
  const close = useEffectEvent(onClose)
  useEffect(() => {
    if (!open) return
    function onKeyDown(e: KeyboardEvent) {
      // Already used: a dialog closing itself, or leaving select mode.
      if (e.key !== 'Escape' || e.defaultPrevented) return
      if (
        e.target instanceof Element &&
        e.target.closest('[role=dialog], [role=alertdialog], [role=menu]')
      ) {
        return
      }
      e.preventDefault()
      close()
    }
    // Bubbling, so the student grid's own Escape (leaving select mode) goes
    // first.
    window.addEventListener('keydown', onKeyDown)

    // Like the app's bottom drawers: Android only, since elsewhere it would
    // take Escape too. An open drawer's watcher is newer, so back closes it
    // first.
    const Watcher = (
      window as unknown as { CloseWatcher?: new () => CloseWatcherLike }
    ).CloseWatcher
    const watcher =
      Watcher && /Android/i.test(navigator.userAgent) ? new Watcher() : null
    if (watcher) watcher.onclose = () => close()

    return () => {
      window.removeEventListener('keydown', onKeyDown)
      watcher?.destroy()
    }
  }, [open])
}
