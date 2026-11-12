import { useId, useMemo, useState } from 'react'
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  CalendarRange,
  CircleAlert,
  Mail,
  Repeat as RepeatIcon,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { OfflineNote } from '#/components/offline-note'
import { ResponsiveDialog } from '#/components/responsive-dialogue'
import { CategoryPicker } from '#/components/calendar/categories'
import { ReminderChips } from '#/components/calendar/reminder-chips'
import { WhoPicker, invitedCount } from '#/components/calendar/who-picker'
import type { Audience } from '#/components/calendar/who-picker'
import { ApiError } from '#/lib/api'
import { formatDayRange, formatShortDate } from '#/lib/calendar'
import { addDays, formatLongDate } from '#/lib/day'
import { MAX_SPAN_DAYS, daysIn } from '#/lib/event-span'
import { useOnline } from '#/lib/online'
import {
  createEvent,
  describeRepeat,
  editEvent,
  invalidateCalendar,
  previewQueryOptions,
  repeatPresets,
  sameRepeat,
  timedOnly,
  weekdayName,
  weekdayOf,
  WEEKDAYS,
} from '#/lib/school-calendar'
import type {
  EventCategory,
  EventInput,
  Freq,
  MonthlyBy,
  Reminder,
  Repeat,
  SchoolEvent,
  Weekday,
} from '#/lib/school-calendar'
import type { StaffDirectory } from '#/lib/staff'

export type EventFormMode =
  | { kind: 'new'; date: string }
  /** date: the date of the event that was opened. */
  | { kind: 'edit'; event: SchoolEvent; date: string }

/** New event, or edit one (a date of a series, or all future dates). */
export function EventDialog({
  mode,
  onClose,
  directory,
  categories,
  today,
  emailsOn,
}: {
  mode: EventFormMode | null
  onClose: () => void
  directory: StaffDirectory
  categories: Array<EventCategory>
  today: string
  /** Reminder emails go out; off, the form says so. */
  emailsOn: boolean
}) {
  return (
    <ResponsiveDialog
      isOpen={mode !== null}
      setIsOpen={(open: boolean) => !open && onClose()}
      title={mode?.kind === 'edit' ? 'Edit event' : 'New event'}
      description={
        mode?.kind === 'edit'
          ? `${mode.event.title}, ${
              mode.event.end_date
                ? formatDayRange(mode.event.date, mode.event.end_date)
                : formatLongDate(mode.date)
            }`
          : 'Invite staff; they get an email reminder.'
      }
      showDescription
      keyboardAware
      className="sm:max-w-xl"
    >
      {mode && (
        <EventForm
          key={
            mode.kind === 'edit'
              ? `${mode.event.id}:${mode.date}`
              : `new:${mode.date}`
          }
          mode={mode}
          directory={directory}
          categories={categories}
          today={today}
          emailsOn={emailsOn}
          onDone={onClose}
        />
      )}
    </ResponsiveDialog>
  )
}

const field = 'h-11 rounded-lg border-2 border-border bg-card text-base'

function EventForm({
  mode,
  directory,
  categories,
  today,
  emailsOn,
  onDone,
}: {
  mode: EventFormMode
  directory: StaffDirectory
  categories: Array<EventCategory>
  today: string
  emailsOn: boolean
  onDone: () => void
}) {
  const id = useId()
  const online = useOnline()
  const queryClient = useQueryClient()
  const event = mode.kind === 'edit' ? mode.event : null
  const isSeries = !!event?.repeat
  // A date of a series that was changed on its own stays one date.
  const canRepeat = !event?.series_id
  // An event that spans days is edited whole, from its own first day (not
  // the day that was clicked). One already under way keeps its first day.
  const ongoing = !!event?.end_date && event.date < today

  const [title, setTitle] = useState(event?.title ?? '')
  const [date, setDate] = useState(event?.end_date ? event.date : mode.date)
  // The last day of an event that spans days; '' for one day.
  const [lastDay, setLastDay] = useState(event?.end_date ?? '')
  const [allDay, setAllDay] = useState(event?.all_day ?? false)
  const [start, setStart] = useState(event?.start ?? '15:15')
  const [end, setEnd] = useState(event?.end ?? '16:00')
  const [allFuture, setAllFuture] = useState(false)
  // The repeat chosen: a preset (re-worded for whatever date is picked, so
  // "every week on Tuesday" follows the date to Thursday), or custom.
  const [presetKey, setPresetKey] = useState(() => {
    const r = event?.repeat ?? null
    if (!r) return 'none'
    return (
      repeatPresets(mode.date).find((p) => sameRepeat(p.repeat, r, mode.date))
        ?.key ?? 'custom'
    )
  })
  const [customRepeat, setCustomRepeat] = useState<Repeat>(
    event?.repeat ?? {
      freq: 'weekly',
      interval: 1,
      weekdays: [weekdayOf(mode.date)],
      monthly_by: '',
    },
  )
  const [until, setUntil] = useState<string>(event?.until ?? '')
  const [skipBreaks, setSkipBreaks] = useState(event?.skip_breaks ?? true)
  const [audience, setAudience] = useState<Audience>({
    everyone: event?.everyone ?? false,
    staffIds: new Set(event?.staff_ids ?? []),
    groupIds: new Set(event?.group_ids ?? []),
  })
  const [reminders, setReminders] = useState<Set<Reminder>>(
    new Set(event?.reminders ?? ['day']),
  )
  // What's sent: an all-day event has no start, so no "before" reminders.
  const sending = [...reminders].filter((r) => !(allDay && timedOnly(r)))
  const [categoryId, setCategoryId] = useState<string | null>(
    event?.category_id ?? null,
  )
  const [location, setLocation] = useState(event?.location ?? '')
  const [notes, setNotes] = useState(event?.notes ?? '')

  const spanning = lastDay !== ''
  // Repeat settings show for a new event, a one-time event, or a series
  // when changing all future dates; never for one that spans days.
  const showRepeat = canRepeat && (!isSeries || allFuture) && !spanning
  const presets = useMemo(() => repeatPresets(date), [date])
  // "Last Tuesday" isn't offered for a date that isn't one: the 10th instead.
  const shownKey =
    presetKey === 'custom' || presets.some((p) => p.key === presetKey)
      ? presetKey
      : 'monthly-day'
  const repeat: Repeat | null =
    shownKey === 'custom'
      ? customRepeat
      : (presets.find((p) => p.key === shownKey)?.repeat ?? null)

  // Days can be added to a new or one-time event that doesn't repeat.
  const canSpan = canRepeat && !isSeries && !(showRepeat && repeat)
  const backwards = !allDay && start !== '' && end !== '' && end <= start
  const untilBad = showRepeat && !!repeat && until !== '' && until < date
  const dateOk = date >= today || (ongoing && date === event.date)
  const lastBad =
    spanning &&
    (lastDay <= date ||
      lastDay < today ||
      daysIn(date, lastDay) > MAX_SPAN_DAYS)
  const valid =
    title.trim() !== '' &&
    dateOk &&
    !lastBad &&
    !backwards &&
    !untilBad &&
    (allDay || (start !== '' && end !== ''))

  const input: EventInput = {
    title,
    location,
    notes,
    all_day: allDay,
    date,
    end_date: spanning ? lastDay : null,
    start: allDay ? null : start,
    end: allDay ? null : end,
    repeat: showRepeat ? repeat : null,
    until: showRepeat && repeat && until ? until : null,
    skip_breaks: skipBreaks,
    everyone: audience.everyone,
    staff_ids: audience.everyone ? [] : [...audience.staffIds],
    group_ids: audience.everyone ? [] : [...audience.groupIds],
    reminders: sending,
    category_id: categoryId,
  }

  const preview = useQuery({
    ...previewQueryOptions({
      date,
      repeat: input.repeat,
      until: input.until,
      skip_breaks: skipBreaks,
    }),
    enabled: showRepeat && !!repeat && date >= today && !untilBad,
    placeholderData: keepPreviousData,
  })

  const save = useMutation({
    mutationFn: () =>
      event
        ? editEvent(
            event.id,
            event.end_date ? event.date : mode.date,
            isSeries && allFuture ? 'future' : 'one',
            input,
          )
        : createEvent(input),
    onSuccess: () => {
      invalidateCalendar(queryClient)
      onDone()
      toast.success(event ? 'Event saved' : 'Event added', {
        description:
          isSeries && !allFuture
            ? `Only ${formatLongDate(date)} changed.`
            : input.repeat
              ? describeRepeat(input.repeat, date)
              : spanning
                ? formatDayRange(date, lastDay)
                : formatLongDate(date),
      })
    },
    onError: (error) => {
      console.error('Saving the event failed:', error)
      toast.error(
        error instanceof ApiError && error.reason === 'past'
          ? 'That date has passed.'
          : error instanceof ApiError && error.reason === 'too_many_events'
            ? 'Your calendar has the most events allowed.'
            : error instanceof ApiError && error.status === 400
              ? 'Something in the form isn’t right. Check the dates and times.'
              : 'Couldn’t save the event. Try again.',
      )
    },
  })
  const busy = save.isPending

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        if (valid && !busy) save.mutate()
      }}
      className="flex flex-col gap-5"
    >
      {isSeries && (
        <label className="flex cursor-pointer items-start gap-3 rounded-lg border-2 border-border bg-muted/50 p-3 has-checked:border-primary has-checked:bg-primary/10">
          <input
            type="checkbox"
            checked={allFuture}
            onChange={(e) => setAllFuture(e.target.checked)}
            className="mt-0.5 size-5 shrink-0 accent-primary"
          />
          <span className="flex flex-col">
            <span className="font-bold">Update all future events</span>
            <span className="text-sm text-muted-foreground">
              {allFuture
                ? `Changes apply to ${formatShortDate(mode.date)} and every date after. Earlier dates keep their details.`
                : `Only ${formatShortDate(mode.date)} changes.`}
            </span>
          </span>
        </label>
      )}

      <div className="flex flex-col gap-2">
        <label htmlFor={`${id}-title`} className="text-base font-bold">
          Title
        </label>
        <Input
          id={`${id}-title`}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={200}
          placeholder="Staff meeting"
          disabled={busy}
          className={field}
        />
      </div>

      <fieldset disabled={busy} className="flex flex-col gap-2">
        <legend className="mb-2 text-base font-bold">Category</legend>
        <CategoryPicker
          categories={categories}
          value={categoryId}
          onChange={setCategoryId}
          disabled={busy}
        />
      </fieldset>

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-2">
            <label htmlFor={`${id}-date`} className="text-base font-bold">
              {spanning
                ? 'First day'
                : showRepeat && repeat
                  ? 'Starts'
                  : 'Date'}
            </label>
            <Input
              id={`${id}-date`}
              type="date"
              min={today}
              value={date}
              onChange={(e) => {
                const next = e.target.value
                if (!next) return
                setDate(next)
                // The last day stays after the first.
                if (spanning && lastDay <= next) setLastDay(addDays(next, 1))
              }}
              // Under way: its first day has passed and stays.
              disabled={busy || ongoing}
              className={cn(field, 'w-auto px-3')}
            />
          </div>
          {spanning ? (
            <div className="flex flex-col gap-2">
              <label htmlFor={`${id}-last`} className="text-base font-bold">
                Last day
              </label>
              <div className="flex items-center gap-1">
                <Input
                  id={`${id}-last`}
                  type="date"
                  min={addDays(
                    date < today ? today : date,
                    date < today ? 0 : 1,
                  )}
                  max={addDays(date, MAX_SPAN_DAYS - 1)}
                  value={lastDay}
                  onChange={(e) => e.target.value && setLastDay(e.target.value)}
                  disabled={busy}
                  aria-invalid={lastBad || undefined}
                  className={cn(field, 'w-auto px-3')}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setLastDay('')}
                  disabled={busy || ongoing}
                  aria-label="Make it one day"
                  className="size-11 rounded-lg"
                >
                  <X className="size-5" />
                </Button>
              </div>
            </div>
          ) : (
            canSpan && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => setLastDay(addDays(date, 1))}
                disabled={busy}
                className="h-11 rounded-lg px-3 font-bold"
              >
                <CalendarRange />
                Add days
              </Button>
            )
          )}
          <label className="flex h-11 cursor-pointer items-center gap-2 font-bold">
            <Switch
              checked={allDay}
              onCheckedChange={setAllDay}
              disabled={busy}
            />
            All day
          </label>
        </div>
        {!allDay && (
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <label htmlFor={`${id}-start`} className="text-sm font-bold">
                Start
              </label>
              <Input
                id={`${id}-start`}
                type="time"
                step={300}
                value={start}
                onChange={(e) => setStart(e.target.value)}
                disabled={busy}
                className={cn(field, 'px-3')}
              />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor={`${id}-end`} className="text-sm font-bold">
                End
              </label>
              <Input
                id={`${id}-end`}
                type="time"
                step={300}
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                disabled={busy}
                aria-invalid={backwards || undefined}
                className={cn(field, 'px-3')}
              />
            </div>
          </div>
        )}
        {backwards && (
          <p
            role="alert"
            className="flex items-center gap-2 text-sm font-bold text-destructive"
          >
            <CircleAlert className="size-4" />
            The end has to be after the start.
          </p>
        )}
        {spanning && !allDay && !backwards && (
          <p className="text-sm text-muted-foreground">
            The same times each day.
          </p>
        )}
        {ongoing && (
          <p className="text-sm text-muted-foreground">
            Started {formatShortDate(event.date)}. You can still change the last
            day and the details.
          </p>
        )}
        {!dateOk && (
          <p role="alert" className="text-sm font-bold text-destructive">
            Pick today or a later date.
          </p>
        )}
        {lastBad && (
          <p role="alert" className="text-sm font-bold text-destructive">
            {daysIn(date, lastDay) > MAX_SPAN_DAYS
              ? `An event can span up to ${MAX_SPAN_DAYS} days.`
              : lastDay < today
                ? 'Pick today or a later last day.'
                : 'The last day has to be after the first.'}
          </p>
        )}
        {spanning && canRepeat && !isSeries && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <RepeatIcon className="size-4 shrink-0" />
            Events that span days don’t repeat.
          </p>
        )}
      </div>

      {showRepeat && (
        <section className="flex flex-col gap-3">
          <div className="flex flex-col gap-2">
            <label
              htmlFor={`${id}-repeat`}
              className="flex items-center gap-2 text-base font-bold"
            >
              <RepeatIcon className="size-4" />
              Repeat
            </label>
            <select
              id={`${id}-repeat`}
              value={shownKey}
              disabled={busy}
              onChange={(e) => {
                const key = e.target.value
                // Custom starts from what was chosen.
                if (key === 'custom' && repeat) setCustomRepeat(repeat)
                setPresetKey(key)
              }}
              className={cn(field, 'w-full appearance-auto px-3 font-medium')}
            >
              {presets.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.label}
                </option>
              ))}
              <option value="custom">Custom…</option>
            </select>
          </div>
          {shownKey === 'custom' && (
            <CustomRepeat
              value={customRepeat}
              date={date}
              onChange={setCustomRepeat}
              disabled={busy}
            />
          )}
          {repeat && (
            <>
              <fieldset disabled={busy} className="flex flex-col gap-2">
                <legend className="mb-1 text-sm font-bold">Ends</legend>
                <div className="flex flex-wrap items-center gap-3">
                  <label className="flex min-h-10 cursor-pointer items-center gap-2 font-medium">
                    <input
                      type="radio"
                      name={`${id}-ends`}
                      checked={until === ''}
                      onChange={() => setUntil('')}
                      className="size-4 accent-primary"
                    />
                    Never
                  </label>
                  <label className="flex min-h-10 cursor-pointer items-center gap-2 font-medium">
                    <input
                      type="radio"
                      name={`${id}-ends`}
                      checked={until !== ''}
                      onChange={() =>
                        setUntil(until || addMonthsToDate(date, 6))
                      }
                      className="size-4 accent-primary"
                    />
                    On
                  </label>
                  {until !== '' && (
                    <Input
                      type="date"
                      aria-label="Last date"
                      min={date}
                      value={until}
                      onChange={(e) =>
                        e.target.value && setUntil(e.target.value)
                      }
                      aria-invalid={untilBad || undefined}
                      className={cn(field, 'w-auto px-3')}
                    />
                  )}
                </div>
              </fieldset>
              <label className="flex cursor-pointer items-center gap-2 font-medium">
                <Switch
                  checked={skipBreaks}
                  onCheckedChange={setSkipBreaks}
                  disabled={busy}
                />
                Skip school breaks
              </label>
              <p
                role="status"
                className="rounded-lg bg-muted px-3 py-2 text-sm"
              >
                <span className="font-bold">
                  {describeRepeat(repeat, date)}
                </span>
                {preview.data && (
                  <>
                    {preview.data.count !== null
                      ? ` · ${preview.data.count} ${preview.data.count === 1 ? 'date' : 'dates'}`
                      : ' · no end'}
                    {preview.data.next.length > 0 &&
                      ` · next: ${preview.data.next.slice(0, 3).map(formatShortDate).join(', ')}`}
                  </>
                )}
              </p>
            </>
          )}
        </section>
      )}

      <WhoPicker
        directory={directory}
        value={audience}
        onChange={setAudience}
        disabled={busy}
      />

      <fieldset disabled={busy} className="flex flex-col gap-2">
        <legend className="mb-1 text-base font-bold">Email reminder</legend>
        <ReminderChips
          value={reminders}
          onChange={setReminders}
          allDay={allDay}
        />
        <p className="text-sm text-muted-foreground">
          {sending.length === 0
            ? 'No reminder emails.'
            : emailsOn
              ? 'Everyone invited gets an email, with a link to add it to their calendar.'
              : 'Reminder emails aren’t turned on yet, so none go out for now. Your choice is saved for when they are.'}
        </p>
      </fieldset>

      <div className="flex flex-col gap-2">
        <label htmlFor={`${id}-where`} className="text-sm font-bold">
          Location{' '}
          <span className="font-normal text-muted-foreground">(optional)</span>
        </label>
        <Input
          id={`${id}-where`}
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          maxLength={200}
          placeholder="Library"
          disabled={busy}
          className={field}
        />
      </div>
      <div className="flex flex-col gap-2">
        <label htmlFor={`${id}-notes`} className="text-sm font-bold">
          Notes{' '}
          <span className="font-normal text-muted-foreground">(optional)</span>
        </label>
        <Textarea
          id={`${id}-notes`}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          maxLength={2000}
          rows={3}
          disabled={busy}
          className="rounded-lg border-2 border-border bg-card text-base"
        />
      </div>

      {emailsOn && (event || invitedCount(audience, directory) > 0) && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Mail className="size-4 shrink-0" />
          {event
            ? 'Everyone invited gets an email about what changed.'
            : 'Everyone invited gets an email invite.'}
        </p>
      )}
      <OfflineNote action="save events" />
      <Button
        type="submit"
        disabled={!online || busy || !valid}
        aria-busy={busy}
        className="h-12 rounded-lg text-base font-bold"
      >
        {busy && <Spinner aria-hidden className="size-4" />}
        {event ? 'Save' : 'Add event'}
      </Button>
    </form>
  )
}

/** "2026-11-10", 6 → "2027-05-10" (the end of that month if shorter). */
function addMonthsToDate(date: string, months: number) {
  const [y, m, d] = date.split('-').map(Number)
  const last = new Date(y, m - 1 + months + 1, 0).getDate()
  const out = new Date(y, m - 1 + months, Math.min(d, last))
  return out.toLocaleDateString('en-CA')
}

/** Every N days/weeks/months/years; weekdays; the day of the month. */
function CustomRepeat({
  value,
  date,
  onChange,
  disabled,
}: {
  value: Repeat
  date: string
  onChange: (r: Repeat) => void
  disabled: boolean
}) {
  const id = useId()
  const units: Array<{ freq: Freq; one: string; many: string }> = [
    { freq: 'daily', one: 'day', many: 'days' },
    { freq: 'weekly', one: 'week', many: 'weeks' },
    { freq: 'monthly', one: 'month', many: 'months' },
    { freq: 'yearly', one: 'year', many: 'years' },
  ]
  const days = value.weekdays.length > 0 ? value.weekdays : [weekdayOf(date)]
  const monthChoices: Array<{ by: MonthlyBy; label: string }> = [
    {
      by: 'day',
      label: describeRepeat(
        { ...value, freq: 'monthly', interval: 1, monthly_by: 'day' },
        date,
      ).replace('Every month on ', 'On '),
    },
    {
      by: 'nth',
      label: describeRepeat(
        { ...value, freq: 'monthly', interval: 1, monthly_by: 'nth' },
        date,
      ).replace('Every month on ', 'On '),
    },
    {
      by: 'last',
      label: describeRepeat(
        { ...value, freq: 'monthly', interval: 1, monthly_by: 'last' },
        date,
      ).replace('Every month on ', 'On '),
    },
  ]
  return (
    <fieldset
      disabled={disabled}
      className="flex flex-col gap-3 rounded-lg border-2 border-border p-3"
    >
      <legend className="px-1 text-sm font-bold">Custom repeat</legend>
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor={`${id}-n`} className="font-medium">
          Every
        </label>
        <Input
          id={`${id}-n`}
          type="number"
          inputMode="numeric"
          min={1}
          max={99}
          value={value.interval}
          onChange={(e) => {
            const n = Math.max(1, Math.min(99, Number(e.target.value) || 1))
            onChange({ ...value, interval: n })
          }}
          className={cn(field, 'w-20 px-3')}
        />
        <select
          aria-label="Unit"
          value={value.freq}
          onChange={(e) => {
            const freq = e.target.value as Freq
            onChange({
              ...value,
              freq,
              weekdays: freq === 'weekly' ? days : [],
              monthly_by: freq === 'monthly' ? 'day' : '',
            })
          }}
          className={cn(field, 'appearance-auto px-3 font-medium')}
        >
          {units.map((u) => (
            <option key={u.freq} value={u.freq}>
              {value.interval === 1 ? u.one : u.many}
            </option>
          ))}
        </select>
      </div>
      {value.freq === 'weekly' && (
        <div role="group" aria-label="On" className="flex flex-wrap gap-1.5">
          {WEEKDAYS.map((d: Weekday) => {
            const on = days.includes(d)
            return (
              <button
                key={d}
                type="button"
                aria-pressed={on}
                aria-label={weekdayName(d)}
                onClick={() => {
                  const next = on ? days.filter((x) => x !== d) : [...days, d]
                  if (next.length > 0) onChange({ ...value, weekdays: next })
                }}
                className={cn(
                  'size-10 rounded-full border-2 text-sm font-bold transition-colors outline-none focus-visible:ring-4 focus-visible:ring-ring motion-reduce:transition-none',
                  on
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-card hover:bg-muted',
                )}
              >
                {weekdayName(d, 'short').slice(0, 2)}
              </button>
            )
          })}
        </div>
      )}
      {value.freq === 'monthly' && (
        <div className="flex flex-col gap-1.5">
          {monthChoices.map((c) => (
            <label
              key={c.by}
              className="flex min-h-10 cursor-pointer items-center gap-2 font-medium"
            >
              <input
                type="radio"
                name={`${id}-monthly`}
                checked={value.monthly_by === c.by}
                onChange={() => onChange({ ...value, monthly_by: c.by })}
                className="size-4 accent-primary"
              />
              {c.label}
            </label>
          ))}
        </div>
      )}
    </fieldset>
  )
}
