import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  CalendarCheck,
  CalendarClock,
  CircleAlert,
  Languages,
  Link2Off,
  Lock,
  RefreshCw,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'
import { ApiError } from '#/lib/api'
import {
  capitalize,
  familyStrings,
  formatClockTime,
  formatDay,
  formatRange,
  formatWhen,
  pickLanguage,
  timeZoneNote,
} from '#/lib/conference-i18n'
import type { Lang } from '#/lib/conference-i18n'
import {
  MoveConflict,
  acceptView,
  familyViewQueryOptions,
  keepLanguage,
  moveTo,
  storedLanguage,
} from '#/lib/conference-link'
import type { FamilyView } from '#/lib/conference-link'
import { slotsByDay } from '#/lib/conferences'
import { useConferenceStream } from '#/lib/conference-stream'
import type { StreamStatus } from '#/lib/conference-stream'
import { LIVE_REFRESH_MS } from '#/lib/freshness'
import { useOnline } from '#/lib/online'
import { Wordmark } from '#/components/Wordmark'
import { ResponsiveDialog } from '#/components/responsive-dialogue'

type Strings = (typeof familyStrings)[Lang]
type Slot = FamilyView['slots'][number]

/**
 * What a family sees from the QR code on their conference notice
 * (/conference): their child's time, and the other times as open or
 * unavailable (never whose), live. In English or Spanish.
 */
export function FamilyPage({ hasKey }: { hasKey: boolean }) {
  const [lang, setLang] = useState<Lang>(() => pickLanguage(storedLanguage()))
  const t = familyStrings[lang]
  useDocumentLanguage(lang)

  const toggle = (
    <LanguageToggle
      lang={lang}
      onToggle={() => {
        const next = lang === 'en' ? 'es' : 'en'
        keepLanguage(next)
        setLang(next)
      }}
    />
  )
  if (!hasKey) {
    return (
      <Note
        icon={Link2Off}
        title={t.missingKeyTitle}
        body={t.missingKey}
        toggle={toggle}
      />
    )
  }
  return <FamilyConference lang={lang} t={t} toggle={toggle} />
}

function FamilyConference({
  lang,
  t,
  toggle,
}: {
  lang: Lang
  t: Strings
  toggle: ReactNode
}) {
  const online = useOnline()
  const stream = useConferenceStream(true)
  const view = useQuery({
    ...familyViewQueryOptions,
    // Asks on its own only while live updates can't get through.
    refetchInterval:
      stream === 'polling' || stream === 'reconnecting'
        ? LIVE_REFRESH_MS
        : false,
  })

  if (
    (view.error instanceof ApiError && view.error.status === 404) ||
    (stream === 'gone' && !view.data)
  ) {
    return (
      <Note
        icon={Link2Off}
        title={t.notWorkingTitle}
        body={t.notWorking}
        toggle={toggle}
      />
    )
  }
  if (view.data?.status === 'ended') {
    return (
      <Note
        icon={CalendarCheck}
        title={t.endedTitle}
        body={t.ended}
        toggle={toggle}
      />
    )
  }
  if (view.data) {
    return (
      <Conference
        view={view.data}
        lang={lang}
        t={t}
        toggle={toggle}
        status={online ? stream : 'offline'}
      />
    )
  }
  if (view.isError) {
    return (
      <Note
        icon={CircleAlert}
        title={t.loadFailed}
        body=""
        toggle={toggle}
        action={
          <Button
            variant="outline"
            onClick={() => void view.refetch()}
            disabled={view.isFetching}
            className="h-11 rounded-lg border-2 border-border font-bold"
          >
            <RefreshCw className={cn(view.isFetching && 'animate-spin')} />
            {t.tryAgain}
          </Button>
        }
      />
    )
  }
  return (
    <main className="flex min-h-dvh items-center justify-center px-6">
      <p
        role="status"
        className="flex items-center gap-2 font-medium text-muted-foreground"
      >
        <Spinner aria-hidden className="size-5" />
        {t.opening}
      </p>
    </main>
  )
}

function Conference({
  view,
  lang,
  t,
  toggle,
  status,
}: {
  view: FamilyView
  lang: Lang
  t: Strings
  toggle: ReactNode
  status: StreamStatus | 'offline'
}) {
  const [target, setTarget] = useState<Slot | null>(null)
  const tz = view.timezone
  const tzNote = timeZoneNote(tz, lang)

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col gap-5 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))]">
      <header className="flex items-center justify-between gap-3">
        <Wordmark className="h-10" />
        {toggle}
      </header>

      <div className="flex flex-col gap-1">
        <h1 className="text-2xl leading-tight font-bold text-balance">
          {t.title(view.first_name)}
        </h1>
        <p className="text-muted-foreground">
          {t.withTeacher(view.teacher_name)}
          {view.location && ` · ${view.location}`}
        </p>
        <LiveStatus status={status} t={t} />
      </div>

      <CurrentTime view={view} lang={lang} t={t} />

      {view.can_change && (
        <section
          aria-labelledby="change-heading"
          className="flex flex-col gap-3"
        >
          <div>
            <h2 id="change-heading" className="text-lg font-bold">
              {view.mine ? t.changeHeading : t.pickBelow}
            </h2>
            {view.mine && (
              <p className="text-sm text-muted-foreground">{t.tapOpen}</p>
            )}
          </div>
          <SlotGrid view={view} lang={lang} t={t} onPick={setTarget} />
        </section>
      )}

      <p className="text-sm text-muted-foreground">
        {t.privacy(view.first_name)}
        {tzNote && ` ${t.tzNote(tzNote)}`}
      </p>

      <MoveSheet
        view={view}
        target={target}
        onClose={() => setTarget(null)}
        lang={lang}
        t={t}
      />
    </main>
  )
}

/** The family's own time, and why they can or can't change it. */
function CurrentTime({
  view,
  lang,
  t,
}: {
  view: FamilyView
  lang: Lang
  t: Strings
}) {
  const { mine, timezone: tz } = view
  let note: string | null = null
  if (mine?.locked) note = t.lockedMine(view.cutoff_hours, view.teacher_name)
  else if (!view.changes_open) note = t.closed(view.teacher_name)

  return (
    <section className="flex flex-col gap-2 rounded-xl border-2 border-border bg-card p-4 shadow-md">
      <h2 className="text-sm font-bold tracking-wide text-muted-foreground uppercase">
        {t.yourTime}
      </h2>
      {mine ? (
        <p className="flex flex-col">
          <span className="text-xl font-bold">
            {capitalize(formatDay(mine.starts_at, tz, lang))}
          </span>
          <span className="text-2xl font-bold text-primary">
            {formatRange(mine.starts_at, mine.ends_at, tz, lang)}
          </span>
        </p>
      ) : (
        <p className="font-medium">{t.noTime(view.first_name)}</p>
      )}
      {note && (
        <p className="flex items-start gap-2 rounded-lg border-2 border-border bg-chart-3/25 p-3 text-sm">
          <Lock aria-hidden className="mt-0.5 size-4 shrink-0" />
          <span>{note}</span>
        </p>
      )}
    </section>
  )
}

/** The times to come, by day: open ones can be tapped. */
function SlotGrid({
  view,
  lang,
  t,
  onPick,
}: {
  view: FamilyView
  lang: Lang
  t: Strings
  onPick: (slot: Slot) => void
}) {
  const tz = view.timezone
  const days = slotsByDay(view.slots, tz)
  const anyOpen = view.slots.some((s) => s.state === 'open')

  return (
    <div className="flex flex-col gap-4">
      {!anyOpen && (
        <p className="rounded-lg border-2 border-dashed border-border p-3 text-sm font-medium">
          {t.noneOpen}
        </p>
      )}
      {days.map(({ day, slots }) => (
        <div key={day} className="flex flex-col gap-2">
          <h3 className="font-bold">
            {capitalize(formatDay(slots[0].starts_at, tz, lang))}
          </h3>
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {slots.map((s) => {
              const time = formatClockTime(s.starts_at, tz, lang)
              const label =
                s.state === 'open'
                  ? t.open
                  : s.state === 'mine'
                    ? t.mine
                    : t.unavailable
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    disabled={s.state !== 'open'}
                    onClick={() => onPick(s)}
                    aria-label={`${time}, ${label}`}
                    className={cn(
                      'flex min-h-14 w-full flex-col items-center justify-center rounded-lg border-2 px-2 py-1.5 text-center transition-colors motion-reduce:transition-none',
                      s.state === 'open' &&
                        'border-border bg-card font-bold shadow-sm hover:bg-primary/10 focus-visible:ring-4 focus-visible:ring-ring focus-visible:outline-none active:translate-y-px',
                      s.state === 'mine' &&
                        'border-primary bg-primary text-primary-foreground',
                      s.state === 'unavailable' &&
                        'cursor-not-allowed border-dashed border-border bg-muted text-muted-foreground',
                    )}
                  >
                    <span
                      className={cn(
                        'text-base font-bold',
                        s.state === 'unavailable' && 'line-through',
                      )}
                    >
                      {time}
                    </span>
                    <span className="text-xs font-medium">{label}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </div>
  )
}

/** "Switch to this time?" Moving happens only once they say yes. */
function MoveSheet({
  view,
  target,
  onClose,
  lang,
  t,
}: {
  view: FamilyView
  target: Slot | null
  onClose: () => void
  lang: Lang
  t: Strings
}) {
  const queryClient = useQueryClient()
  // The tapped time as it is now: it grays out here too if another family
  // takes it while this is open.
  const current = target
    ? view.slots.find((s) => s.id === target.id)
    : undefined
  const stillOpen = current?.state === 'open'
  const tz = view.timezone

  const move = useMutation({
    mutationFn: (slot: Slot) => moveTo(slot.id, view.mine?.id ?? null),
    onSuccess: (next, slot) => {
      acceptView(queryClient, next)
      onClose()
      toast.success(t.moved(formatWhen(slot.starts_at, slot.ends_at, tz, lang)))
    },
    onError: (error) => {
      if (error instanceof MoveConflict) {
        if (error.view) acceptView(queryClient, error.view)
        else
          void queryClient.invalidateQueries({
            queryKey: familyViewQueryOptions.queryKey,
          })
        onClose()
        toast.error(
          {
            taken: t.taken,
            locked: t.lockedTarget(view.cutoff_hours),
            closed: t.closed(view.teacher_name),
            stale: t.stale,
          }[error.reason],
        )
        return
      }
      console.error('Moving the conference failed:', error)
      toast.error(
        error instanceof ApiError && error.status === 429
          ? t.tooMany
          : error instanceof ApiError && error.status === 404
            ? t.notWorking
            : t.failed,
      )
    },
  })
  const busy = move.isPending

  return (
    <ResponsiveDialog
      isOpen={target !== null}
      setIsOpen={(open: boolean) => {
        if (!open && !busy) onClose()
      }}
      title={t.confirmTitle}
    >
      {target && (
        <div className="flex flex-col gap-4" lang={lang}>
          <p>
            {view.mine
              ? t.confirmBody(
                  formatWhen(view.mine.starts_at, view.mine.ends_at, tz, lang),
                  formatWhen(target.starts_at, target.ends_at, tz, lang),
                )
              : t.confirmBodyNew(
                  formatWhen(target.starts_at, target.ends_at, tz, lang),
                )}
          </p>
          {!stillOpen && !busy && (
            <p
              role="alert"
              className="flex items-start gap-2 rounded-lg border-2 border-border bg-chart-3/25 p-3 text-sm font-medium"
            >
              <CalendarClock aria-hidden className="mt-0.5 size-4 shrink-0" />
              {t.justTaken}
            </p>
          )}
          <div className="flex flex-col gap-2">
            <Button
              onClick={() => move.mutate(target)}
              disabled={!stillOpen || busy}
              aria-busy={busy}
              className="h-12 rounded-lg border-2 border-border text-base font-bold shadow-sm"
            >
              {busy && <Spinner aria-hidden className="size-5" />}
              {busy ? t.moving : t.confirmYes}
            </Button>
            <Button
              variant="outline"
              onClick={onClose}
              disabled={busy}
              className="h-12 rounded-lg border-2 border-border bg-card text-base font-bold"
            >
              {t.cancel}
            </Button>
          </div>
        </div>
      )}
    </ResponsiveDialog>
  )
}

function LiveStatus({
  status,
  t,
}: {
  status: StreamStatus | 'offline'
  t: Strings
}) {
  if (status === 'paused' || status === 'gone' || status === 'ended')
    return null
  const live = status === 'live'
  const text = status === 'offline' ? t.offline : live ? t.live : t.reconnecting
  return (
    <p
      role="status"
      className="mt-1 flex items-center gap-2 text-sm font-medium text-muted-foreground"
    >
      <span
        aria-hidden
        className={cn(
          'size-2.5 rounded-full',
          live ? 'bg-chart-2 motion-safe:animate-pulse' : 'bg-muted-foreground',
        )}
      />
      {text}
    </p>
  )
}

function LanguageToggle({
  lang,
  onToggle,
}: {
  lang: Lang
  onToggle: () => void
}) {
  const t = familyStrings[lang]
  const other: Lang = lang === 'en' ? 'es' : 'en'
  return (
    <Button
      variant="outline"
      onClick={onToggle}
      lang={other}
      aria-label={t.switchToLabel}
      className="h-10 rounded-lg border-2 border-border bg-card font-bold"
    >
      <Languages aria-hidden className="size-4" />
      {t.switchTo}
    </Button>
  )
}

function Note({
  icon: Icon,
  title,
  body,
  toggle,
  action,
}: {
  icon: typeof CircleAlert
  title: string
  body: string
  toggle: ReactNode
  action?: ReactNode
}) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] text-center">
      <Wordmark className="h-24" />
      <div className="flex max-w-sm flex-col items-center gap-3">
        <span className="flex size-14 items-center justify-center rounded-lg border-2 border-border bg-chart-3 text-foreground">
          <Icon className="size-7" />
        </span>
        <h1 className="text-xl font-bold text-balance">{title}</h1>
        {body && <p className="text-muted-foreground">{body}</p>}
        {action}
      </div>
      {toggle}
    </main>
  )
}

/** The page's language, for screen readers and spelling. */
function useDocumentLanguage(lang: Lang) {
  useEffect(() => {
    const root = document.documentElement
    const previous = root.lang
    root.lang = lang
    return () => {
      root.lang = previous
    }
  }, [lang])
}
