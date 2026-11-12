import { lazy, Suspense, useId, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ChevronLeft, CircleAlert, Lock, UserX, UsersRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'
import { ReminderChips } from '#/components/calendar/reminder-chips'
import { FileDropBox } from '#/components/file-drop-box'
import { OfflineNote } from '#/components/offline-note'
import { ResponsiveDialog } from '#/components/responsive-dialogue'
import { ApiError } from '#/lib/api'
import { formatClockRange, formatShortDate } from '#/lib/calendar'
import {
  CalendarFileError,
  SKIP_REASONS,
  readCalendarFile,
  rowsOf,
  toWire,
} from '#/lib/calendar-import'
import type {
  ImportCalendar,
  ImportContext,
  ImportItem,
  SkipReason,
} from '#/lib/calendar-import'
import { useOnline } from '#/lib/online'
import {
  describeRepeat,
  importEvents,
  invalidateCalendar,
  timedOnly,
  undoImport,
} from '#/lib/school-calendar'
import type { EventCategory, Reminder } from '#/lib/school-calendar'
import type { StaffDirectory } from '#/lib/staff'
import { uuidv7 } from '#/lib/uuid'
import { isXlsx } from '#/lib/xlsx'

// The spreadsheet steps load only when a spreadsheet is chosen.
const SheetImport = lazy(() =>
  import('#/components/calendar/sheet-import').then((m) => ({
    default: m.SheetImport,
  })),
)

/**
 * Bring events over from Google Calendar (or any calendar app's .ics), or
 * from a school's color-coded spreadsheet: the file is read here, the
 * administrator ticks what to keep, and only that is sent. Quiet: no invite
 * emails, just reminders from now on (none, for a spreadsheet).
 */
export function CalendarImportDialog({
  open,
  onOpenChange,
  ...flow
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
} & Omit<FlowProps, 'onDone'>) {
  return (
    <ResponsiveDialog
      isOpen={open}
      setIsOpen={onOpenChange}
      title="Import a calendar"
      description="Bring your events over from Google Calendar, another calendar app, or your school’s spreadsheet."
      showDescription
      className="sm:max-w-xl"
    >
      {open && <ImportFlow {...flow} onDone={() => onOpenChange(false)} />}
    </ResponsiveDialog>
  )
}

type FlowProps = {
  directory: StaffDirectory
  schoolTz: string
  today: string
  yourEmail: string
  /** How many more events the calendar holds. */
  eventsLeft: number
  emailsOn: boolean
  categories: Array<EventCategory>
  onDone: () => void
}

/** A spreadsheet chosen in the file step. */
export type SheetFile = { bytes: Uint8Array<ArrayBuffer>; name: string }

function ImportFlow({ onDone, ...props }: FlowProps) {
  const [calendars, setCalendars] = useState<Array<ImportCalendar> | null>(null)
  const [sheet, setSheet] = useState<SheetFile | null>(null)
  const [picked, setPicked] = useState<Set<number>>(new Set())
  const [step, setStep] = useState<'file' | 'calendars' | 'preview'>('file')
  const ctx = useMemo<ImportContext>(
    () => ({
      schoolTz: props.schoolTz,
      today: props.today,
      yourEmail: props.yourEmail.toLowerCase(),
      staffByEmail: new Map(
        props.directory.people.map((p) => [p.email.toLowerCase(), p.id]),
      ),
    }),
    [props.schoolTz, props.today, props.yourEmail, props.directory],
  )

  if (sheet) {
    return (
      <Suspense
        fallback={
          <p
            role="status"
            className="flex items-center gap-2 font-medium text-muted-foreground"
          >
            <Spinner aria-hidden className="size-5" />
            Reading the spreadsheet…
          </p>
        }
      >
        <SheetImport
          file={sheet}
          today={props.today}
          categories={props.categories}
          eventsLeft={props.eventsLeft}
          onBack={() => setSheet(null)}
          onDone={onDone}
        />
      </Suspense>
    )
  }
  if (step === 'file' || !calendars) {
    return (
      <FileStep
        ctx={ctx}
        onSheet={setSheet}
        onRead={(cals) => {
          setCalendars(cals)
          // One calendar: straight to the events. Several: choose first
          // (none ticked, so a personal one isn't brought in by accident).
          setPicked(cals.length === 1 ? new Set([0]) : new Set())
          setStep(cals.length === 1 ? 'preview' : 'calendars')
        }}
      />
    )
  }
  if (step === 'calendars') {
    return (
      <CalendarsStep
        calendars={calendars}
        picked={picked}
        onPick={setPicked}
        onBack={() => setStep('file')}
        onNext={() => setStep('preview')}
      />
    )
  }
  return (
    <PreviewStep
      // A new choice of calendars starts the ticks over.
      key={[...picked].join()}
      calendars={calendars.filter((_, i) => picked.has(i))}
      {...props}
      onBack={() => setStep(calendars.length > 1 ? 'calendars' : 'file')}
      onDone={onDone}
    />
  )
}

export function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <Button
      type="button"
      variant="link"
      onClick={onClick}
      className="h-auto self-start px-0 font-bold"
    >
      <ChevronLeft />
      Back
    </Button>
  )
}

/** Step 1: Google's export or a spreadsheet, dropped or chosen. */
function FileStep({
  ctx,
  onRead,
  onSheet,
}: {
  ctx: ImportContext
  onRead: (calendars: Array<ImportCalendar>) => void
  onSheet: (file: SheetFile) => void
}) {
  const id = useId()
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)

  async function read(file: File) {
    setProblem(null)
    if (file.size > 50 * 1024 * 1024) {
      setProblem('That file is too big. Export just your school’s calendar.')
      return
    }
    if (/\.(xls|numbers|ods|csv)$/i.test(file.name)) {
      setProblem(
        'Save the spreadsheet as an Excel workbook (.xlsx) first: in Google Sheets, File → Download → Microsoft Excel.',
      )
      return
    }
    setBusy(true)
    try {
      const bytes = new Uint8Array(await file.arrayBuffer())
      // An .xlsx is a ZIP too: look inside before reading it as calendars.
      if (/\.xlsx$/i.test(file.name) || (await isXlsx(bytes))) {
        onSheet({ bytes, name: file.name })
        return
      }
      const cals = await readCalendarFile(bytes, file.name, ctx)
      if (cals.every((c) => c.items.length + c.skipped.length === 0)) {
        setProblem('There are no events in that file.')
        return
      }
      onRead(cals)
    } catch (error) {
      if (!(error instanceof CalendarFileError)) {
        console.error('Reading a calendar file failed:', error)
      }
      setProblem(
        error instanceof CalendarFileError && error.kind === 'empty-zip'
          ? 'That ZIP has no calendars (.ics files) in it.'
          : 'That isn’t a calendar file. Export it from Google Calendar again.',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-1.5 text-sm text-muted-foreground">
        <li>
          <span className="font-bold text-foreground">Google Calendar:</span>{' '}
          Settings → Import &amp; export → Export, then add the .zip it
          downloads (or one calendar’s .ics).
        </li>
        <li>
          <span className="font-bold text-foreground">
            Your school’s spreadsheet:
          </span>{' '}
          a month per sheet, color-coded. From Google Sheets, File → Download →
          Microsoft Excel (.xlsx). Its colors become categories.
        </li>
      </ul>
      <FileDropBox
        accept=".ics,.zip,.xlsx,text/calendar,application/zip,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        kinds=".ics, .zip or .xlsx"
        onFile={(file) => void read(file)}
        busy={busy}
        describedBy={`${id}-note`}
      />
      {problem && (
        <p role="alert" className="text-sm font-bold text-destructive">
          {problem}
        </p>
      )}
      <p id={`${id}-note`} className="text-xs text-muted-foreground">
        The file is read on this device. Only the events you choose are sent.
      </p>
    </div>
  )
}

/** Step 2, for a ZIP of several: which calendars. */
function CalendarsStep({
  calendars,
  picked,
  onPick,
  onBack,
  onNext,
}: {
  calendars: Array<ImportCalendar>
  picked: Set<number>
  onPick: (next: Set<number>) => void
  onBack: () => void
  onNext: () => void
}) {
  const count = calendars
    .filter((_, i) => picked.has(i))
    .reduce((n, c) => n + c.items.length, 0)
  return (
    <div className="flex flex-col gap-5">
      <BackButton onClick={onBack} />
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-base font-bold">Which calendars?</legend>
        <p className="-mt-1 text-sm text-muted-foreground">
          The file has {calendars.length}. Choose your school’s, not personal
          ones.
        </p>
        <ul className="flex flex-col gap-1.5">
          {calendars.map((c, i) => (
            <li key={i}>
              <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border-2 border-border bg-card px-3 py-2 transition-colors has-checked:border-primary has-checked:bg-primary/10 motion-reduce:transition-none">
                <input
                  type="checkbox"
                  checked={picked.has(i)}
                  onChange={(e) => {
                    const next = new Set(picked)
                    if (e.target.checked) next.add(i)
                    else next.delete(i)
                    onPick(next)
                  }}
                  className="size-5 shrink-0 accent-primary"
                />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-bold">{c.name}</span>
                  {c.personal && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Lock aria-hidden className="size-3.5" />
                      Looks like your personal calendar
                    </span>
                  )}
                </span>
                <span className="shrink-0 text-sm text-muted-foreground tabular-nums">
                  {c.items.length} {c.items.length === 1 ? 'event' : 'events'}
                </span>
              </label>
            </li>
          ))}
        </ul>
      </fieldset>
      <Button
        onClick={onNext}
        disabled={picked.size === 0}
        className="h-12 rounded-lg text-base font-bold"
      >
        {picked.size === 0
          ? 'Choose a calendar'
          : `Next: check ${count} ${count === 1 ? 'event' : 'events'}`}
      </Button>
    </div>
  )
}

const CAUTIONS: Record<
  NonNullable<ImportItem['caution']>,
  { icon: typeof Lock; text: string }
> = {
  private: { icon: Lock, text: 'Private in Google' },
  declined: { icon: UserX, text: 'You declined' },
  outside: { icon: UsersRound, text: 'Guests aren’t on your staff list' },
}

/** Step 3: what's in it, ticked or not, and the reminders; then import. */
function PreviewStep({
  calendars,
  directory,
  eventsLeft,
  emailsOn,
  onBack,
  onDone,
}: FlowProps & { calendars: Array<ImportCalendar>; onBack: () => void }) {
  const online = useOnline()
  const queryClient = useQueryClient()
  // One event in two calendars (a shared one) comes in once.
  const { items, skipped } = useMemo(() => {
    const seen = new Set<string>()
    return {
      items: calendars
        .flatMap((c) => c.items)
        .filter((i) => !seen.has(i.event.uid) && !!seen.add(i.event.uid)),
      skipped: calendars.flatMap((c) => c.skipped),
    }
  }, [calendars])
  const [on, setOn] = useState(
    () => new Set(items.filter((i) => !i.caution).map((i) => i.event.uid)),
  )
  const [asBreak, setAsBreak] = useState(
    () =>
      new Set(
        items.filter((i) => i.asBreak && i.breakFirst).map((i) => i.event.uid),
      ),
  )
  const [reminders, setReminders] = useState<Set<Reminder>>(new Set(['day']))
  const [progress, setProgress] = useState<number | null>(null)

  const isBreak = (i: ImportItem) => !!i.asBreak && asBreak.has(i.event.uid)
  const chosen = items.filter((i) => on.has(i.event.uid))
  const breaks = chosen.filter(isBreak)
  const events = chosen.filter((i) => !isBreak(i))
  const rows = events.reduce((n, i) => n + rowsOf(i.event), 0)
  const tooMany = rows > eventsLeft
  // Who reminders could reach (not those who stopped the emails).
  const listening = directory.people.filter((p) => !p.opted_out)
  const invited = new Set(events.flatMap((i) => i.event.staff_ids))
  const reach = events.some((i) => i.event.everyone)
    ? listening.length
    : listening.filter((p) => invited.has(p.id)).length

  const groups = [
    {
      title: 'All day',
      hint: 'A school break skips repeating events on those days, like staff meetings over winter break.',
      items: items.filter((i) => i.asBreak),
    },
    {
      title: 'Repeating',
      hint: null,
      items: items.filter((i) => !i.asBreak && i.event.repeat),
    },
    {
      title: 'One-time',
      hint: null,
      items: items.filter((i) => !i.asBreak && !i.event.repeat),
    },
  ].filter((g) => g.items.length > 0)

  // One id for every batch of this import, so Undo takes it all back.
  const [importId] = useState(() => uuidv7())
  const run = useMutation({
    mutationFn: () =>
      importEvents(
        events.map((i) => toWire(i.event, [...reminders], timedOnly)),
        breaks.flatMap((i) => (i.asBreak ? [i.asBreak] : [])),
        importId,
        setProgress,
      ),
    onSuccess: (res) => {
      refresh()
      onDone()
      const parts = [
        res.breaks > 0 &&
          `${res.breaks} ${res.breaks === 1 ? 'break' : 'breaks'}`,
        res.already > 0 && `${res.already} were already imported`,
        res.skipped.length > 0 &&
          `${res.skipped.length} skipped (${res.skipped[0].reason})`,
      ].filter(Boolean)
      toast.success(
        res.added > 0
          ? `Imported ${res.added} ${res.added === 1 ? 'event' : 'events'}`
          : 'Your calendar is up to date',
        {
          description: parts.join(' · ') || undefined,
          duration: res.added + res.breaks > 0 ? 20_000 : undefined,
          action:
            res.added + res.breaks > 0
              ? {
                  label: 'Undo',
                  onClick: () =>
                    void undoImport(importId).then(
                      () => {
                        refresh()
                        toast.success('Import undone')
                      },
                      (error: unknown) => {
                        console.error('Undoing an import failed:', error)
                        toast.error('Couldn’t undo the import. Try again.')
                      },
                    ),
                }
              : undefined,
        },
      )
    },
    onError: (error) => {
      console.error('Importing a calendar failed:', error)
      refresh()
      const some = (progress ?? 0) > 0
      toast.error(
        error instanceof ApiError && error.reason === 'too_many_events'
          ? 'Your calendar is full: it holds up to 2,000 upcoming events. Untick some and try again.'
          : some
            ? 'The import stopped partway. Import the file again to add the rest (ones already added are skipped).'
            : 'Couldn’t import. Try again.',
      )
    },
    onSettled: () => setProgress(null),
  })
  const busy = run.isPending

  function refresh() {
    invalidateCalendar(queryClient)
  }

  const label = [
    events.length > 0 &&
      `${events.length} ${events.length === 1 ? 'event' : 'events'}`,
    breaks.length > 0 &&
      `${breaks.length} ${breaks.length === 1 ? 'break' : 'breaks'}`,
  ]
    .filter(Boolean)
    .join(' and ')

  return (
    <div className="flex flex-col gap-5">
      <BackButton onClick={onBack} />
      <dl className="grid grid-cols-3 gap-2 text-center">
        {(
          [
            ['Events', events.length],
            ['School breaks', breaks.length],
            ['Skipped', skipped.length],
          ] as const
        ).map(([name, n]) => (
          <div key={name} className="rounded-lg bg-muted px-2 py-3">
            <dd className="text-2xl font-bold tabular-nums">{n}</dd>
            <dt className="text-xs text-muted-foreground">{name}</dt>
          </div>
        ))}
      </dl>

      {groups.map((g) => (
        <ItemGroup
          key={g.title}
          title={g.title}
          hint={g.hint}
          items={g.items}
          on={on}
          onToggle={setOn}
          isBreak={isBreak}
          onBreak={(uid, yes) => {
            const next = new Set(asBreak)
            if (yes) next.add(uid)
            else next.delete(uid)
            setAsBreak(next)
          }}
          disabled={busy}
        />
      ))}

      {skipped.length > 0 && <Skipped skipped={skipped} />}

      <fieldset disabled={busy} className="flex flex-col gap-2">
        <legend className="mb-1 text-base font-bold">Email reminders</legend>
        <ReminderChips value={reminders} onChange={setReminders} />
        <p className="text-sm text-muted-foreground">
          {!emailsOn
            ? 'Reminder emails aren’t turned on yet, so none go out for now. Your choice is saved for when they are.'
            : reminders.size === 0
              ? 'No reminder emails. No emails go out now either.'
              : `No emails go out now. Staff get reminders before each event${reach > 0 ? ` (up to ${reach} ${reach === 1 ? 'person' : 'people'})` : ''}. “1 hour” and “10 min” skip all-day events.`}
        </p>
      </fieldset>

      {tooMany ? (
        <p role="alert" className="text-sm font-bold text-destructive">
          Your calendar has room for {eventsLeft} more{' '}
          {eventsLeft === 1 ? 'event' : 'events'}. Untick some.
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">
          Your calendar has room for {eventsLeft} more events.
        </p>
      )}
      <OfflineNote action="import events" />
      <Button
        onClick={() => run.mutate()}
        disabled={!online || busy || chosen.length === 0 || tooMany}
        aria-busy={busy}
        className="h-12 rounded-lg text-base font-bold"
      >
        {busy && <Spinner aria-hidden className="size-4" />}
        {busy
          ? progress !== null && events.length > 0
            ? `Importing ${progress} of ${events.length}…`
            : 'Importing…'
          : chosen.length === 0
            ? 'Tick something to import'
            : `Import ${label}`}
      </Button>
    </div>
  )
}

export function ItemGroup({
  title,
  lead,
  hint,
  items,
  on,
  onToggle,
  isBreak,
  onBreak,
  disabled,
  folded = false,
}: {
  title: string
  /** Before the title: a category's color. */
  lead?: ReactNode
  hint: string | null
  items: Array<ImportItem>
  on: Set<string>
  onToggle: (next: Set<string>) => void
  isBreak: (i: ImportItem) => boolean
  onBreak: (uid: string, yes: boolean) => void
  disabled: boolean
  /** The list starts closed (a spreadsheet's many groups). */
  folded?: boolean
}) {
  const ticked = items.filter((i) => on.has(i.event.uid)).length
  const all = ticked === items.length
  const list = (
    <ul className="flex max-h-80 flex-col gap-1.5 overflow-y-auto">
      {items.map((i) => (
        <ItemRow
          key={i.event.uid}
          item={i}
          checked={on.has(i.event.uid)}
          onCheck={(yes) => {
            const next = new Set(on)
            if (yes) next.add(i.event.uid)
            else next.delete(i.event.uid)
            onToggle(next)
          }}
          asBreak={isBreak(i)}
          onBreak={(yes) => onBreak(i.event.uid, yes)}
          disabled={disabled}
        />
      ))}
    </ul>
  )
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex min-w-0 items-center gap-2 text-base font-bold">
          {lead}
          <span className="min-w-0 truncate">{title}</span>
          <span className="shrink-0 font-normal text-muted-foreground tabular-nums">
            ({ticked} of {items.length})
          </span>
        </h3>
        <Button
          type="button"
          variant="link"
          disabled={disabled}
          onClick={() => {
            const next = new Set(on)
            for (const i of items) {
              if (all) next.delete(i.event.uid)
              else next.add(i.event.uid)
            }
            onToggle(next)
          }}
          className="h-auto px-0 font-bold"
        >
          {all ? 'Untick all' : 'Tick all'}
        </Button>
      </div>
      {hint && <p className="-mt-1 text-sm text-muted-foreground">{hint}</p>}
      {folded ? (
        <details className="group">
          <summary className="cursor-pointer text-sm font-bold text-muted-foreground hover:text-foreground">
            <span className="group-open:hidden">Show them</span>
            <span className="hidden group-open:inline">Hide them</span>
          </summary>
          <div className="mt-2">{list}</div>
        </details>
      ) : (
        list
      )}
    </section>
  )
}

function ItemRow({
  item,
  checked,
  onCheck,
  asBreak,
  onBreak,
  disabled,
}: {
  item: ImportItem
  checked: boolean
  onCheck: (yes: boolean) => void
  asBreak: boolean
  onBreak: (yes: boolean) => void
  disabled: boolean
}) {
  const id = useId()
  const e = item.event
  const caution = item.caution ? CAUTIONS[item.caution] : null
  const changes = [
    e.overrides.length > 0 && `${e.overrides.length} changed`,
    e.cancelled.length > 0 && `${e.cancelled.length} cancelled`,
  ].filter(Boolean)
  return (
    <li
      className={cn(
        'flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border-2 border-border bg-card px-3 py-2 transition-colors motion-reduce:transition-none',
        checked && 'border-primary bg-primary/5',
      )}
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(ev) => onCheck(ev.target.checked)}
        className="size-5 shrink-0 accent-primary"
      />
      <label
        htmlFor={id}
        className="flex min-w-48 flex-1 cursor-pointer flex-col"
      >
        <span className="truncate font-bold">{e.title}</span>
        <span className="text-sm text-muted-foreground">
          {whenText(item, asBreak)}
          {!asBreak && changes.length > 0 && ` · ${changes.join(', ')}`}
        </span>
        {!asBreak && whoText(item) && (
          <span className="text-xs text-muted-foreground">{whoText(item)}</span>
        )}
        {caution && (
          <span className="mt-0.5 flex items-center gap-1 text-xs font-bold text-muted-foreground">
            <caution.icon aria-hidden className="size-3.5" />
            {caution.text}
          </span>
        )}
      </label>
      {item.asBreak && checked && (
        <div
          role="group"
          aria-label={`${e.title}: school break or event`}
          className="flex shrink-0 gap-0.5 rounded-lg border-2 border-border bg-card p-0.5 max-sm:ml-8"
        >
          {(
            [
              [true, 'School break'],
              [false, 'Event'],
            ] as const
          ).map(([value, text]) => (
            <button
              key={text}
              type="button"
              aria-pressed={asBreak === value}
              disabled={disabled}
              onClick={() => onBreak(value)}
              className={cn(
                'min-h-8 rounded-md px-2.5 text-xs font-bold transition-colors outline-none focus-visible:ring-4 focus-visible:ring-ring motion-reduce:transition-none',
                asBreak === value
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-muted',
              )}
            >
              {text}
            </button>
          ))}
        </div>
      )}
    </li>
  )
}

function range(first: string, last: string) {
  return first === last
    ? formatShortDate(first)
    : `${formatShortDate(first)} – ${formatShortDate(last)}`
}

/** "Every 2 weeks on Tuesday · 3:15–4:00 PM", "Tue, Dec 8 · All day". */
function whenText(item: ImportItem, asBreak: boolean) {
  const e = item.event
  if (item.asBreak && asBreak) {
    return range(item.asBreak.first_day, item.asBreak.last_day)
  }
  const time = e.all_day ? 'All day' : formatClockRange(e.start, e.end)
  if (e.end_date) {
    return `${range(e.date, e.end_date)} · ${e.all_day ? 'All day' : `${time} each day`}`
  }
  if (item.asBreak && e.repeat && e.until) {
    return `${range(e.date, e.until)} · All day, each day`
  }
  if (e.repeat) {
    const until = e.until ? ` · until ${formatShortDate(e.until)}` : ''
    return `${describeRepeat(e.repeat, e.date)} · ${time}${until}`
  }
  return `${formatShortDate(e.date)} · ${time}`
}

/** Who's invited; nothing for a spreadsheet's events (no one is). */
function whoText(item: ImportItem) {
  const { staff, outside } = item.guests
  if (!item.event.everyone && staff === 0 && outside === 0) return ''
  const who = item.event.everyone
    ? 'Everyone on staff'
    : `${staff} ${staff === 1 ? 'guest' : 'guests'}`
  return outside > 0 ? `${who} · ${outside} not on your staff list` : who
}

/** What was left out, by reason. */
export function Skipped({
  skipped,
}: {
  skipped: Array<{ title: string; reason: SkipReason }>
}) {
  const byReason = useMemo(() => {
    const m = new Map<SkipReason, Array<string>>()
    for (const s of skipped)
      m.set(s.reason, [...(m.get(s.reason) ?? []), s.title])
    return [...m.entries()].sort((a, b) => b[1].length - a[1].length)
  }, [skipped])
  return (
    <section className="flex flex-col gap-1.5">
      <h3 className="flex items-center gap-1.5 text-base font-bold">
        <CircleAlert aria-hidden className="size-4" />
        Skipped
      </h3>
      <ul className="flex flex-col gap-1 text-sm">
        {byReason.map(([reason, titles]) => (
          <li key={reason}>
            <details>
              <summary className="cursor-pointer">
                {SKIP_REASONS[reason]}{' '}
                <span className="text-muted-foreground tabular-nums">
                  ({titles.length})
                </span>
              </summary>
              <p className="mt-1 pl-4 text-muted-foreground">
                {titles.slice(0, 30).join(', ')}
                {titles.length > 30 && `, and ${titles.length - 30} more`}
              </p>
            </details>
          </li>
        ))}
      </ul>
    </section>
  )
}
