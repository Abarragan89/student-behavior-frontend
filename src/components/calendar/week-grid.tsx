import type { ReactNode } from 'react'
import { MapPin, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { breakOn } from '#/components/calendar/month-grid'
import { formatClockRange, formatDayRange, weekDays } from '#/lib/calendar'
import {
  NO_CATEGORY_COLOR,
  categoryStyle,
  printChip,
} from '#/lib/category-colors'
import { formatLongDate, parseDate } from '#/lib/day'
import { isSpan } from '#/lib/event-span'
import {
  combinedText,
  gatherDay,
  isBirthdays,
  shortTitle,
} from '#/lib/month-layout'
import type {
  EventCategory,
  Occurrence,
  SchoolBreak,
} from '#/lib/school-calendar'

/** An event's block: its category's color, with room to wrap. */
const BLOCK =
  'flex w-full min-w-0 flex-col rounded-md px-1.5 py-1 text-left text-xs'

/**
 * One school week, Monday to Sunday, as six boxes in two rows: Monday,
 * Tuesday and Wednesday, then Thursday, Friday and the weekend (Saturday
 * and Sunday share a box). Every event in full: its times, title and
 * place; an event that spans days shows in each day it covers, with its
 * dates. Duties shown beside the date sit under the day's number, all of
 * them. Each box is as tall as its row's busiest day needs. One column on
 * phones, two on small tablets. On paper (variant "print"): always three
 * columns, light colors, and a page breaks only between the two rows.
 */
export function WeekGrid({
  week,
  today,
  occurrences,
  breaks,
  categories,
  loading = false,
  variant = 'screen',
  highlight = null,
  onAdd,
  onOpen,
  onDay,
}: {
  /** The week's Monday. */
  week: string
  today: string
  occurrences: Array<Occurrence>
  breaks: Array<SchoolBreak>
  categories: Array<EventCategory>
  loading?: boolean
  variant?: 'screen' | 'print'
  /** Which events stand out (the rest fade); null: everything as is. */
  highlight?: ((o: Occurrence) => boolean) | null
  onAdd?: (date: string) => void
  onOpen?: (o: Occurrence) => void
  onDay?: (date: string) => void
}) {
  const print = variant === 'print'
  const days = weekDays(week)
  const byDate = new Map<string, Array<Occurrence>>()
  for (const o of occurrences)
    byDate.set(o.date, [...(byDate.get(o.date) ?? []), o])
  const ctx: Ctx = {
    today,
    print,
    breaks,
    colorOf: new Map(categories.map((c) => [c.id, c.color])),
    categoryOf: new Map(categories.map((c) => [c.id, c])),
    highlight,
    onAdd,
    onOpen,
    onDay,
  }
  // Monday to Friday, then the weekend together.
  const boxes = [...days.slice(0, 5).map((d) => [d]), days.slice(5)]
  const box = (dates: Array<string>) => {
    const weekend = dates.length > 1
    const now = !print && dates.includes(today)
    return (
      <section
        key={dates[0]}
        aria-label={weekend ? 'The weekend' : undefined}
        className={cn(
          'flex min-w-0 flex-col overflow-hidden',
          print
            ? 'rounded-md border border-neutral-400 bg-white'
            : 'rounded-lg border-2 bg-card shadow-sm',
          !print && (now ? 'border-primary' : 'border-border'),
          // On paper the weekend stays white: its events' plain gray
          // blocks would vanish on gray.
          weekend && !print && 'bg-muted/50',
        )}
      >
        {dates.map((date, i) => (
          <Day
            key={date}
            date={date}
            events={byDate.get(date) ?? []}
            // A weekday says "No events"; the weekend's days just stay
            // short.
            sayEmpty={!weekend}
            divided={i > 0}
            ctx={ctx}
          />
        ))}
      </section>
    )
  }
  if (print) {
    // Each row of three on its own, kept whole: a page can break only
    // between the rows (plain blocks, so every browser breaks there).
    return (
      <div className="space-y-2 text-black">
        {[boxes.slice(0, 3), boxes.slice(3)].map((row) => (
          <div
            key={row[0][0]}
            className="grid grid-cols-3 gap-2 break-inside-avoid"
          >
            {row.map(box)}
          </div>
        ))}
      </div>
    )
  }
  return (
    <div
      className={cn(
        'grid grid-cols-1 gap-2 transition-opacity motion-reduce:transition-none sm:grid-cols-2 md:grid-cols-3',
        loading && 'opacity-60',
      )}
      aria-busy={loading || undefined}
    >
      {boxes.map(box)}
    </div>
  )
}

type Ctx = {
  today: string
  print: boolean
  breaks: Array<SchoolBreak>
  colorOf: Map<string, string>
  categoryOf: Map<string, EventCategory>
  highlight: ((o: Occurrence) => boolean) | null
  onAdd?: (date: string) => void
  onOpen?: (o: Occurrence) => void
  onDay?: (date: string) => void
}

/** A day: its name and number, a break, its duties, then its events. */
function Day({
  date,
  events,
  sayEmpty,
  divided,
  ctx,
}: {
  date: string
  events: Array<Occurrence>
  sayEmpty: boolean
  divided: boolean
  ctx: Ctx
}) {
  const { print } = ctx
  const d = parseDate(date)
  const isToday = date === ctx.today && !print
  const past = date < ctx.today
  const off = breakOn(date, ctx.breaks)
  const beside = (o: Occurrence) =>
    !!o.category_id && ctx.categoryOf.get(o.category_id)?.display === 'header'
  const labels = events.filter(beside)
  const items = gatherDay(
    events.filter((o) => !beside(o)),
    ctx.categoryOf,
  )
  return (
    <div
      className={cn(
        // Fills its box (the weekend's two days share theirs), so a break's
        // shading covers the whole day.
        'flex flex-1 flex-col gap-1.5 p-2',
        divided && (print ? 'border-t border-neutral-400' : 'border-t-2'),
        off && (print ? 'bg-amber-100' : 'bg-chart-3/15'),
      )}
    >
      <div className="flex min-w-0 items-center gap-1.5">
        {/* Bigger on paper: the day is what a printed week is read by. */}
        <h3
          className={cn(
            'flex shrink-0 items-center',
            print ? 'gap-2' : 'gap-1.5',
          )}
        >
          <span
            aria-hidden
            className={cn(
              'font-bold uppercase',
              print
                ? 'text-base text-neutral-700'
                : 'text-xs text-muted-foreground',
            )}
          >
            {d.toLocaleDateString(undefined, { weekday: 'short' })}
          </span>
          <span
            aria-hidden
            className={cn(
              'flex items-center justify-center rounded-full font-bold',
              print ? 'text-2xl leading-8' : 'h-7 min-w-7 px-1 text-base',
              isToday && 'bg-primary text-primary-foreground',
              past && !isToday && !print && 'text-muted-foreground',
            )}
          >
            {/* The 1st says its month, for a week across two. */}
            {d.getDate() === 1
              ? d.toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                })
              : d.getDate()}
          </span>
          <span className="sr-only">{formatLongDate(date)}</span>
        </h3>
        {off && (
          <span
            className={cn(
              'min-w-0 truncate text-xs font-bold',
              print ? 'text-neutral-700' : 'text-muted-foreground',
            )}
            title={off.name}
          >
            {off.name}
          </span>
        )}
        {!print && ctx.onAdd && !past && (
          <button
            type="button"
            onClick={() => ctx.onAdd?.(date)}
            aria-label={`Add an event on ${formatLongDate(date)}`}
            className="ml-auto flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground opacity-60 outline-none hover:bg-muted hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-4 focus-visible:ring-ring"
          >
            <Plus className="size-4" />
          </button>
        )}
      </div>
      {labels.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {labels.map((o) => (
            <Line
              key={`${o.event_id}:${o.date}`}
              o={o}
              ctx={ctx}
              className="min-w-0 rounded-sm px-1 text-left text-[0.6875rem] leading-4 font-semibold wrap-break-word"
            >
              {labelOf(o, ctx)}
            </Line>
          ))}
        </div>
      )}
      {items.map((item) =>
        item.kind === 'event' ? (
          <Line
            key={`${item.o.event_id}:${item.o.date}`}
            o={item.o}
            ctx={ctx}
            className={BLOCK}
          >
            {!item.o.all_day && (
              <span className="font-bold tabular-nums">
                {formatClockRange(item.o.start, item.o.end)}
              </span>
            )}
            <span className="font-semibold wrap-break-word">
              {labelOf(item.o, ctx)}
            </span>
            {isSpan(item.o) && (
              <span className="text-[0.6875rem] opacity-80">
                {formatDayRange(item.o.first_day, item.o.last_day)}
              </span>
            )}
            {item.o.location && (
              <span className="flex items-start gap-1 text-[0.6875rem] opacity-80">
                <MapPin className="mt-0.5 size-3 shrink-0" />
                <span className="min-w-0 wrap-break-word">
                  {item.o.location}
                </span>
              </span>
            )}
          </Line>
        ) : (
          <Line
            key={`all:${item.category.id}:${date}`}
            o={item.items[0]}
            items={item.items}
            ctx={ctx}
            onClick={ctx.onDay ? () => ctx.onDay?.(date) : undefined}
            title={item.items.map((o) => o.title).join('\n')}
            className={BLOCK}
          >
            <span className="font-semibold wrap-break-word">
              {combinedText(item.category, item.items)}
            </span>
          </Line>
        ),
      )}
      {sayEmpty && !print && labels.length === 0 && items.length === 0 && (
        <p className="text-xs text-muted-foreground">No events</p>
      )}
    </div>
  )
}

/** What a block says: its title, or a birthday's name with a cake. */
function labelOf(o: Occurrence, ctx: Ctx) {
  const c = o.category_id ? ctx.categoryOf.get(o.category_id) : undefined
  return isBirthdays(c) ? `🎂 ${shortTitle(o.title)}` : o.title
}

/**
 * An event's block in its category's color: a button on screen (opening
 * it, or the day for a gathered line), plain on paper. While legend chips
 * are picked, the blocks they cover stay as they are and the rest fade.
 */
function Line({
  o,
  items,
  ctx,
  onClick,
  title,
  className,
  children,
}: {
  o: Occurrence
  items?: Array<Occurrence>
  ctx: Ctx
  onClick?: () => void
  title?: string
  className: string
  children: ReactNode
}) {
  const color =
    (o.category_id ? ctx.colorOf.get(o.category_id) : undefined) ??
    NO_CATEGORY_COLOR
  if (ctx.print) {
    return <div className={cn(className, printChip(color))}>{children}</div>
  }
  const lens = ctx.highlight
  const lit = lens ? (items ?? [o]).some(lens) : true
  return (
    <button
      type="button"
      onClick={onClick ?? (() => ctx.onOpen?.(o))}
      title={title ?? o.title}
      className={cn(
        className,
        'outline-none focus-visible:ring-4 focus-visible:ring-ring',
        categoryStyle(color).chip,
        o.past && 'opacity-60',
        !lit && 'opacity-25',
      )}
    >
      {children}
    </button>
  )
}
