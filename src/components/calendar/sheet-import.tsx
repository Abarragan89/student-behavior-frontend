import { useEffect, useId, useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  CalendarOff,
  CircleAlert,
  CircleCheck,
  Palette,
  Undo2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import {
  BackButton,
  ItemGroup,
  Skipped,
} from '#/components/calendar/import-dialog'
import type { SheetFile } from '#/components/calendar/import-dialog'
import {
  CategoryDot,
  ColorPicker,
  DISPLAY_OPTIONS,
} from '#/components/calendar/categories'
import { OfflineNote } from '#/components/offline-note'
import { ApiError } from '#/lib/api'
import { toWire } from '#/lib/calendar-import'
import type { ImportItem } from '#/lib/calendar-import'
import { useOnline } from '#/lib/online'
import {
  calendarQueryOptions,
  categoryNamed,
  createCategory,
  deleteCategory,
  importEvents,
  invalidateCalendar,
  MAX_CATEGORIES,
  MAX_CATEGORY_NAME,
  timedOnly,
  undoImport,
} from '#/lib/school-calendar'
import type {
  CategoryDisplay,
  EventCategory,
  ImportResult,
} from '#/lib/school-calendar'
import {
  SheetFileError,
  alreadyThere,
  colorFor,
  defaultChoices,
  displayFor,
  digestOf,
  readSheetCalendar,
  sheetItems,
  windowsOf,
} from '#/lib/sheet-import'
import type {
  ColorChoice,
  ColorGroup,
  ParsedSheet,
  SheetItem,
} from '#/lib/sheet-import'
import { uuidv7 } from '#/lib/uuid'
import { SpreadsheetError, readWorkbook } from '#/lib/xlsx'

// Importing a school's color-coded spreadsheet: read it here, choose what
// each color becomes (a category, a school break, nothing), check the
// events, import. Every event is public (the spreadsheet was the whole
// school's), nobody gets emails; Undo takes the whole import back. Nothing read from the file is kept on the device.

type Props = {
  file: SheetFile
  today: string
  categories: Array<EventCategory>
  eventsLeft: number
  onBack: () => void
  onDone: () => void
}

type Read =
  | { kind: 'reading' }
  | { kind: 'problem'; text: string }
  | { kind: 'ready'; parsed: ParsedSheet; digest: string }

export function SheetImport(props: Props) {
  const { file, today } = props
  const [read, setRead] = useState<Read>({ kind: 'reading' })
  useEffect(() => {
    const stop = new AbortController()
    void (async () => {
      try {
        const wb = await readWorkbook(file.bytes)
        const parsed = readSheetCalendar(wb, today)
        const digest = await digestOf(file.bytes)
        if (stop.signal.aborted) return
        if (parsed.entries.length === 0) {
          const past = parsed.skipped.some((s) => s.reason === 'past')
          setRead({
            kind: 'problem',
            text: past
              ? 'Everything in that spreadsheet has already happened.'
              : 'There’s nothing on the calendar in that spreadsheet.',
          })
          return
        }
        setRead({ kind: 'ready', parsed, digest })
      } catch (error) {
        if (stop.signal.aborted) return
        if (!(
          error instanceof SpreadsheetError || error instanceof SheetFileError
        ))
          console.error('Reading a spreadsheet failed:', error)
        setRead({
          kind: 'problem',
          text:
            error instanceof SheetFileError
              ? 'No month calendar found in that spreadsheet. It needs a sheet per month, with each day’s number in a box, like a printed calendar.'
              : error instanceof SpreadsheetError && error.kind === 'too-big'
                ? 'That spreadsheet is too big to read here.'
                : 'That isn’t an Excel workbook (.xlsx). Download it from Google Sheets or Excel again.',
        })
      }
    })()
    return () => {
      stop.abort()
    }
  }, [file, today])

  if (read.kind === 'reading') {
    return (
      <p
        role="status"
        className="flex items-center gap-2 font-medium text-muted-foreground"
      >
        <Spinner aria-hidden className="size-5" />
        Reading the spreadsheet…
      </p>
    )
  }
  if (read.kind === 'problem') {
    return (
      <div className="flex flex-col gap-3">
        <BackButton onClick={props.onBack} />
        <p role="alert" className="flex items-start gap-2 font-bold">
          <CircleAlert className="mt-0.5 size-5 shrink-0 text-destructive" />
          {read.text}
        </p>
      </div>
    )
  }
  return <SheetFlow {...props} parsed={read.parsed} digest={read.digest} />
}

type Step =
  | { kind: 'colors' }
  | { kind: 'preview' }
  | { kind: 'done'; result: ImportResult; created: Array<string> }

function SheetFlow({
  parsed,
  digest,
  categories,
  eventsLeft,
  onBack,
  onDone,
}: Props & { parsed: ParsedSheet; digest: string }) {
  const [step, setStep] = useState<Step>({ kind: 'colors' })
  const [choices, setChoices] = useState(() =>
    defaultChoices(parsed.groups, categories),
  )
  // One id for every batch, so Undo takes the whole import back.
  const [importId] = useState(() => uuidv7())

  if (step.kind === 'colors') {
    return (
      <ColorsStep
        groups={parsed.groups}
        choices={choices}
        onChoices={setChoices}
        categories={categories}
        onBack={onBack}
        onNext={() => setStep({ kind: 'preview' })}
      />
    )
  }
  if (step.kind === 'preview') {
    return (
      <PreviewStep
        parsed={parsed}
        digest={digest}
        choices={choices}
        categories={categories}
        eventsLeft={eventsLeft}
        importId={importId}
        onBack={() => setStep({ kind: 'colors' })}
        onImported={(result, created) =>
          setStep({ kind: 'done', result, created })
        }
      />
    )
  }
  return (
    <DoneStep
      result={step.result}
      created={step.created}
      importId={importId}
      onDone={onDone}
    />
  )
}

// ---------- Colors ----------

/** What a choice is called in the select. */
function choiceValue(c: ColorChoice) {
  return c.kind === 'category' ? `category:${c.id}` : c.kind
}

function ColorsStep({
  groups,
  choices,
  onChoices,
  categories,
  onBack,
  onNext,
}: {
  groups: Array<ColorGroup>
  choices: Map<string, ColorChoice>
  onChoices: (next: Map<string, ColorChoice>) => void
  categories: Array<EventCategory>
  onBack: () => void
  onNext: () => void
}) {
  const choose = (key: string, c: ColorChoice) =>
    onChoices(new Map(choices).set(key, c))
  const newNames = new Set(
    [...choices.values()].flatMap((c) =>
      c.kind === 'new' && !categoryNamed(categories, c.name)
        ? [c.name.trim().toLocaleLowerCase()]
        : [],
    ),
  )
  const unnamed = [...choices.values()].some(
    (c) => c.kind === 'new' && c.name.trim() === '',
  )
  const tooMany = categories.length + newNames.size > MAX_CATEGORIES
  const importing = groups
    .filter((g) => (choices.get(g.key)?.kind ?? 'none') !== 'skip')
    .reduce((n, g) => n + g.count, 0)

  return (
    <div className="flex flex-col gap-5">
      <BackButton onClick={onBack} />
      <div className="flex flex-col gap-1">
        <h3 className="flex items-center gap-2 text-base font-bold">
          <Palette aria-hidden className="size-5" />
          What each color means
        </h3>
        <p className="text-sm text-muted-foreground">
          Your spreadsheet’s colors become categories, read from its legend.
          Check each one; colors the legend doesn’t name are yours to place.
        </p>
      </div>
      <ul className="flex flex-col gap-2">
        {groups.map((g) => (
          <ColorRow
            key={g.key}
            group={g}
            choice={choices.get(g.key) ?? { kind: 'none' }}
            onChoice={(c) => choose(g.key, c)}
            categories={categories}
            suggested={
              g.suggestion ? (choices.get(g.suggestion.key) ?? null) : null
            }
          />
        ))}
      </ul>
      {tooMany && (
        <p role="alert" className="text-sm font-bold text-destructive">
          That’s more than {MAX_CATEGORIES} categories. Put some colors in the
          same one, or in no category.
        </p>
      )}
      <Button
        onClick={onNext}
        disabled={unnamed || tooMany || importing === 0}
        className="h-12 rounded-lg text-base font-bold"
      >
        {unnamed
          ? 'Name each new category'
          : `Next: check ${importing} ${importing === 1 ? 'entry' : 'entries'}`}
      </Button>
    </div>
  )
}

function Swatches({ group }: { group: ColorGroup }) {
  if (group.kind === 'plain') {
    return (
      <span
        aria-hidden
        className="size-6 shrink-0 rounded-md border-2 border-dashed border-border"
      />
    )
  }
  if (group.kind === 'birthdays' || group.swatches.length === 0) {
    return (
      <span
        aria-hidden
        className="flex size-6 shrink-0 items-center justify-center rounded-md bg-muted text-sm"
      >
        🎂
      </span>
    )
  }
  return (
    <span aria-hidden className="flex shrink-0 -space-x-2">
      {group.swatches.slice(0, 3).map((hex) => (
        <span
          key={hex}
          className="size-6 rounded-md border-2 border-card shadow-sm"
          style={{ backgroundColor: `#${hex}` }}
        />
      ))}
    </span>
  )
}

function ColorRow({
  group,
  choice,
  onChoice,
  categories,
  suggested,
}: {
  group: ColorGroup
  choice: ColorChoice
  onChoice: (c: ColorChoice) => void
  categories: Array<EventCategory>
  /** What the suggested legend color became, to copy. */
  suggested: ColorChoice | null
}) {
  const id = useId()
  const [picking, setPicking] = useState(false)
  const title =
    group.kind === 'plain'
      ? 'No color'
      : group.kind === 'unlisted'
        ? 'Not in your legend'
        : (group.label ?? 'Color')
  const fresh = (): ColorChoice => ({
    kind: 'new',
    name: group.label ?? '',
    color: colorFor(
      group.color ?? group.swatches.at(0) ?? 'F472B6',
      categories.map((c) => c.color),
    ),
    display: displayFor(group),
  })
  const existing =
    choice.kind === 'new' ? categoryNamed(categories, choice.name) : undefined

  return (
    <li className="flex flex-col gap-2 rounded-lg border-2 border-border bg-card p-3">
      <div className="flex items-start gap-3">
        <Swatches group={group} />
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="flex flex-wrap items-baseline gap-x-2 font-bold">
            {title}
            <span className="text-sm font-medium text-muted-foreground tabular-nums">
              {group.count} {group.count === 1 ? 'entry' : 'entries'}
            </span>
          </span>
          <span className="truncate text-sm text-muted-foreground">
            {group.samples.map((s) => `“${s}”`).join(', ')}
          </span>
          {group.shades && (
            <span className="text-xs text-muted-foreground">
              Includes{' '}
              {group.swatches.length > 1 ? 'other shades' : 'a lighter shade'}{' '}
              of this color.
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor={`${id}-choice`} className="sr-only">
          {title} becomes
        </label>
        <select
          id={`${id}-choice`}
          value={choiceValue(choice)}
          onChange={(e) => {
            const v = e.target.value
            if (v === 'new') onChoice(fresh())
            else if (v.startsWith('category:'))
              onChoice({ kind: 'category', id: v.slice('category:'.length) })
            else onChoice({ kind: v as 'none' | 'break' | 'skip' })
          }}
          className="h-10 min-w-0 rounded-lg border-2 border-border bg-card px-2 text-sm font-bold outline-none focus-visible:ring-4 focus-visible:ring-ring"
        >
          <option value="new">New category</option>
          {categories.length > 0 && (
            <optgroup label="Your categories">
              {categories.map((c) => (
                <option key={c.id} value={`category:${c.id}`}>
                  {c.name}
                </option>
              ))}
            </optgroup>
          )}
          <option value="break">School break (no school)</option>
          <option value="none">No category</option>
          <option value="skip">Don’t import</option>
        </select>
        {choice.kind === 'new' && (
          <>
            <label htmlFor={`${id}-name`} className="sr-only">
              Category name
            </label>
            <Input
              id={`${id}-name`}
              value={choice.name}
              onChange={(e) => onChoice({ ...choice, name: e.target.value })}
              maxLength={MAX_CATEGORY_NAME}
              placeholder="Category name"
              aria-invalid={choice.name.trim() === '' || undefined}
              className="h-10 w-44 min-w-0 flex-1 rounded-lg border-2 border-border bg-card text-sm font-bold"
            />
            <button
              type="button"
              aria-expanded={picking}
              onClick={() => setPicking(!picking)}
              aria-label="Choose its color"
              title="Choose its color"
              className="flex h-10 items-center gap-1.5 rounded-lg border-2 border-border bg-card px-2.5 text-sm font-bold outline-none hover:bg-muted focus-visible:ring-4 focus-visible:ring-ring"
            >
              <CategoryDot color={choice.color} className="size-4" />
              Color
            </button>
          </>
        )}
      </div>
      {choice.kind === 'new' && !existing && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <label className="flex items-center gap-2 text-sm font-bold">
            Show as
            <select
              value={choice.display}
              onChange={(e) =>
                onChoice({
                  ...choice,
                  display: e.target.value as CategoryDisplay,
                })
              }
              className="h-9 rounded-lg border-2 border-border bg-card px-2 text-sm font-bold outline-none focus-visible:ring-4 focus-visible:ring-ring"
            >
              {DISPLAY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
      {choice.kind === 'new' && existing && (
        <p className="text-xs text-muted-foreground">
          Goes into your “{existing.name}” category.
        </p>
      )}
      {choice.kind === 'new' && picking && !existing && (
        <ColorPicker
          value={choice.color}
          onChange={(color) => {
            onChoice({ ...choice, color })
            setPicking(false)
          }}
        />
      )}
      {group.kind === 'unlisted' &&
        group.suggestion &&
        suggested &&
        choice.kind === 'none' && (
          <p className="flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
            Looks a little like {group.suggestion.label}.
            <Button
              type="button"
              variant="link"
              onClick={() => onChoice(suggested)}
              className="h-auto px-0 text-sm font-bold"
            >
              Use that
            </Button>
          </p>
        )}
    </li>
  )
}

// ---------- Preview ----------

/** Where a group's events go, for the preview's headings. */
function targetOf(
  choice: ColorChoice,
  categories: Array<EventCategory>,
): { key: string; name: string; color: string | null } {
  switch (choice.kind) {
    case 'category': {
      const c = categories.find((x) => x.id === choice.id)
      return {
        key: `id:${choice.id}`,
        name: c?.name ?? 'Category',
        color: c?.color ?? null,
      }
    }
    case 'new': {
      const have = categoryNamed(categories, choice.name)
      return have
        ? { key: `id:${have.id}`, name: have.name, color: have.color }
        : {
            key: `new:${choice.name.trim().toLocaleLowerCase()}`,
            name: choice.name.trim(),
            color: choice.color,
          }
    }
    case 'break':
      return { key: 'break', name: 'School breaks', color: null }
    default:
      return { key: 'none', name: 'No category', color: null }
  }
}

function PreviewStep({
  parsed,
  digest,
  choices,
  categories,
  eventsLeft,
  importId,
  onBack,
  onImported,
}: {
  parsed: ParsedSheet
  digest: string
  choices: Map<string, ColorChoice>
  categories: Array<EventCategory>
  eventsLeft: number
  importId: string
  onBack: () => void
  onImported: (result: ImportResult, created: Array<string>) => void
}) {
  const online = useOnline()
  const queryClient = useQueryClient()
  const [readTimes, setReadTimes] = useState(true)
  const [items, setItems] = useState<Array<SheetItem> | null>(null)
  const [already, setAlready] = useState<Set<string>>(new Set())
  const [on, setOn] = useState<Set<string> | null>(null)
  const [asBreak, setAsBreak] = useState<Set<string>>(new Set())
  const [problem, setProblem] = useState<string | null>(null)
  const [progress, setProgress] = useState<number | null>(null)

  // The items (again when times are switched), and what the calendar has.
  useEffect(() => {
    const stop = new AbortController()
    void (async () => {
      try {
        const next = await sheetItems(parsed, choices, {
          readTimes,
          fileDigest: digest,
        })
        const last = next.reduce((d, i) => {
          const end = i.asBreak?.last_day ?? i.event.end_date ?? i.event.date
          return end > d ? end : d
        }, next[0]?.event.date ?? '')
        const first = next[0]?.event.date
        const windows = first ? windowsOf(first, last) : []
        const calendars = await Promise.all(
          windows.map((w) =>
            queryClient.fetchQuery(calendarQueryOptions(w.from, w.to)),
          ),
        )
        const there = alreadyThere(next, {
          occurrences: calendars.flatMap((c) => c.occurrences),
          breaks: calendars.flatMap((c) => c.breaks),
        })
        if (stop.signal.aborted) return
        setItems(next)
        setAlready(there)
        // Ticks carry over a switch of times (uids don't change).
        setOn(
          (prev) =>
            prev ??
            new Set(
              next
                .filter((i) => !there.has(i.event.uid))
                .map((i) => i.event.uid),
            ),
        )
        setAsBreak(
          (prev) =>
            new Set([
              ...prev,
              ...next
                .filter((i) => i.asBreak && i.breakFirst)
                .map((i) => i.event.uid),
            ]),
        )
      } catch (error) {
        console.error('Checking the calendar failed:', error)
        if (!stop.signal.aborted)
          setProblem('Couldn’t check your calendar. Go back and try again.')
      }
    })()
    return () => {
      stop.abort()
    }
  }, [parsed, choices, readTimes, digest, queryClient])

  const isBreak = (i: ImportItem) => !!i.asBreak && asBreak.has(i.event.uid)
  const fresh = useMemo(
    () => (items ?? []).filter((i) => !already.has(i.event.uid)),
    [items, already],
  )
  const chosen = fresh.filter((i) => on?.has(i.event.uid))
  const breaks = chosen.filter(isBreak)
  const events = chosen.filter((i) => !isBreak(i))
  const tooMany = events.length > eventsLeft

  // Headings by where events go: categories (biggest first), then the rest.
  const groups = useMemo(() => {
    const byTarget = new Map<
      string,
      {
        name: string
        color: string | null
        isBreak: boolean
        items: Array<SheetItem>
      }
    >()
    for (const i of fresh) {
      const t = targetOf(choices.get(i.group) ?? { kind: 'none' }, categories)
      const g = byTarget.get(t.key) ?? {
        name: t.name,
        color: t.color,
        isBreak: t.key === 'break',
        items: [],
      }
      g.items.push(i)
      byTarget.set(t.key, g)
    }
    return [...byTarget.entries()].sort(([ka, a], [kb, b]) => {
      const rank = (k: string) => (k === 'break' ? 0 : k === 'none' ? 2 : 1)
      return rank(ka) - rank(kb) || b.items.length - a.items.length
    })
  }, [fresh, choices, categories])

  const run = useMutation({
    mutationFn: async () => {
      // Categories first, so events can name them; ones made here are
      // remembered, so Undo can take them back too.
      const ids = new Map<string, string>()
      const made = new Map<string, string>()
      const created: Array<string> = []
      for (const [group, choice] of choices) {
        if (choice.kind === 'category') ids.set(group, choice.id)
        if (choice.kind !== 'new') continue
        if (!events.some((i) => i.group === group)) continue
        // Two colors can share one new category: it's made once.
        const name = choice.name.trim()
        const key = name.toLocaleLowerCase()
        let id = categoryNamed(categories, name)?.id ?? made.get(key)
        if (!id) {
          id = (
            await createCategory({
              name,
              color: choice.color,
              display: choice.display,
            })
          ).id
          made.set(key, id)
          created.push(id)
        }
        ids.set(group, id)
      }
      const result = await importEvents(
        events.map((i) =>
          toWire(i.event, [], timedOnly, ids.get(i.group) ?? null),
        ),
        breaks.flatMap((i) => (i.asBreak ? [i.asBreak] : [])),
        importId,
        setProgress,
      )
      return { result, created }
    },
    onSuccess: ({ result, created }) => {
      refresh()
      onImported(result, created)
    },
    onError: (error) => {
      console.error('Importing a spreadsheet failed:', error)
      refresh()
      setProblem(
        error instanceof ApiError && error.reason === 'too_many_events'
          ? 'Your calendar is full: it holds up to 2,000 upcoming events. Untick some and try again.'
          : error instanceof ApiError && error.reason === 'category_exists'
            ? 'A category with one of those names was just added. Go back and choose it.'
            : (progress ?? 0) > 0
              ? 'The import stopped partway. Import again to add the rest (ones already added are skipped).'
              : 'Couldn’t import. Try again.',
      )
    },
    onSettled: () => setProgress(null),
  })
  const busy = run.isPending

  function refresh() {
    invalidateCalendar(queryClient)
  }

  if (!items || !on) {
    return (
      <div className="flex flex-col gap-3">
        <BackButton onClick={onBack} />
        {problem ? (
          <p role="alert" className="flex items-start gap-2 font-bold">
            <CircleAlert className="mt-0.5 size-5 shrink-0 text-destructive" />
            {problem}
          </p>
        ) : (
          <p
            role="status"
            className="flex items-center gap-2 font-medium text-muted-foreground"
          >
            <Spinner aria-hidden className="size-5" />
            Checking what’s already on your calendar…
          </p>
        )}
      </div>
    )
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
      <dl className="grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
        {(
          [
            ['Events', events.length],
            ['School breaks', breaks.length],
            ['On your calendar already', already.size],
            ['Skipped', parsed.skipped.length],
          ] as const
        ).map(([name, n]) => (
          <div key={name} className="rounded-lg bg-muted px-2 py-3">
            <dd className="text-2xl font-bold tabular-nums">{n}</dd>
            <dt className="text-xs text-muted-foreground">{name}</dt>
          </div>
        ))}
      </dl>

      <label className="flex cursor-pointer items-start gap-3">
        <Switch
          checked={readTimes}
          onCheckedChange={setReadTimes}
          disabled={busy}
          className="mt-0.5"
        />
        <span className="flex flex-col">
          <span className="font-bold">Read times from the text</span>
          <span className="text-sm text-muted-foreground">
            “Board Meeting 5:00 PM” starts at 5:00 and lasts 30 minutes (the
            spreadsheet has no end times). The rest are all day.
          </span>
        </span>
      </label>

      {groups.map(([key, g]) => (
        <ItemGroup
          key={key}
          title={g.name}
          lead={
            g.isBreak ? (
              <CalendarOff aria-hidden className="size-4 shrink-0" />
            ) : g.color ? (
              <CategoryDot color={g.color} className="size-3" />
            ) : (
              <span
                aria-hidden
                className="inline-block size-3 shrink-0 rounded-full border-2 border-muted-foreground/60"
              />
            )
          }
          hint={
            g.isBreak
              ? 'A school break shades its days, and repeating events skip them.'
              : null
          }
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
          folded
        />
      ))}

      {parsed.skipped.length > 0 && <Skipped skipped={parsed.skipped} />}

      <p className="text-sm text-muted-foreground">
        Everyone on staff will see these events. No emails go out: open an event
        later to send reminders to the people it’s for.
      </p>
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
      {problem && (
        <p role="alert" className="text-sm font-bold text-destructive">
          {problem}
        </p>
      )}
      <OfflineNote action="import events" />
      <Button
        onClick={() => {
          setProblem(null)
          run.mutate()
        }}
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

// ---------- Done ----------

function DoneStep({
  result,
  created,
  importId,
  onDone,
}: {
  result: ImportResult
  created: Array<string>
  importId: string
  onDone: () => void
}) {
  const queryClient = useQueryClient()
  const online = useOnline()
  const undo = useMutation({
    mutationFn: async () => {
      await undoImport(importId)
      // The categories this import made, now empty.
      for (const id of created) await deleteCategory(id).catch(() => null)
    },
    onSettled: () => {
      invalidateCalendar(queryClient)
    },
    onError: (error) => console.error('Undoing an import failed:', error),
  })
  const parts = [
    result.breaks > 0 &&
      `${result.breaks} school ${result.breaks === 1 ? 'break' : 'breaks'}`,
    result.already > 0 && `${result.already} were already imported`,
    result.skipped.length > 0 &&
      `${result.skipped.length} skipped (${result.skipped[0].reason})`,
  ].filter(Boolean)

  if (undo.isSuccess) {
    return (
      <div className="flex flex-col gap-4">
        <p className="flex items-center gap-2 text-lg font-bold">
          <Undo2 aria-hidden className="size-5" />
          Import undone
        </p>
        <p className="text-sm text-muted-foreground">
          Its events, breaks and new categories are gone. Your calendar is as it
          was.
        </p>
        <Button
          onClick={onDone}
          className="h-12 rounded-lg text-base font-bold"
        >
          Done
        </Button>
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-4">
      <p className="flex items-center gap-2 text-lg font-bold">
        <CircleCheck aria-hidden className="size-5 text-chart-5" />
        {result.added > 0
          ? `Imported ${result.added} ${result.added === 1 ? 'event' : 'events'}`
          : result.breaks > 0
            ? 'Imported'
            : 'Your calendar is up to date'}
      </p>
      {parts.length > 0 && (
        <p className="text-sm text-muted-foreground">{parts.join(' · ')}</p>
      )}
      <p className="text-sm text-muted-foreground">
        Tap a category above the calendar to highlight its events.
      </p>
      {undo.isError && (
        <p role="alert" className="text-sm font-bold text-destructive">
          Couldn’t undo the import. Try again.
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          onClick={onDone}
          className="h-12 flex-1 rounded-lg text-base font-bold"
        >
          Done
        </Button>
        {(result.added > 0 || result.breaks > 0) && (
          <Button
            variant="outline"
            onClick={() => undo.mutate()}
            disabled={undo.isPending || !online}
            className={cn('h-12 rounded-lg border-2 px-4 text-base font-bold')}
          >
            {undo.isPending ? (
              <Spinner aria-hidden className="size-4" />
            ) : (
              <Undo2 />
            )}
            Undo import
          </Button>
        )}
      </div>
    </div>
  )
}
