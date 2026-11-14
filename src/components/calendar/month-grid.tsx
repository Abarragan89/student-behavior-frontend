import type { CSSProperties, ReactNode } from 'react'
import { Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  formatClock,
  formatDayRange,
  monthWeeks,
  monthOf,
  weekdayLabels,
} from '#/lib/calendar'
import {
  NO_CATEGORY_COLOR,
  categoryStyle,
  printChip,
} from '#/lib/category-colors'
import { isSpan } from '#/lib/event-span'
import { formatLongDate, isWeekend, parseDate } from '#/lib/day'
import {
  combinedText,
  isBirthdays,
  layoutMonth,
  shortTitle,
} from '#/lib/month-layout'
import type { DayLine, Span, WeekLayout } from '#/lib/month-layout'
import type {
  EventCategory,
  Occurrence,
  SchoolBreak,
} from '#/lib/school-calendar'

/**
 * How many lines a day shows before "+N more": min-h-32 fits the date and
 * six 17px lines. Bars count on the days they cross.
 */
const PER_DAY = 6

/** An event's line: small type, so a day fits six. */
const LINE =
  'flex w-full min-w-0 items-center gap-1 rounded-sm px-1 text-left text-[0.6875rem] leading-4 font-semibold'

export function breakOn(date: string, breaks: Array<SchoolBreak>) {
  return breaks.find((b) => date >= b.first_day && date <= b.last_day)
}

/** "3:15 PM", or "All day". */
export function startLabel(o: Pick<Occurrence, 'all_day' | 'start'>) {
  return o.all_day || !o.start ? 'All day' : formatClock(o.start)
}

/** "3:15pm", "3pm"; nothing for all day. */
function shortTime(o: Occurrence) {
  return o.all_day
    ? ''
    : startLabel(o)
        .replace(/:00|\s/g, '')
        .toLowerCase()
}

type Variant = 'screen' | 'print'

/**
 * A month of the school calendar: the weeks with days of the month (four
 * to six), Sunday first, read like a school's printed calendar. Events are lines in their category's color;
 * the same event on days in a row is one bar; a duty rota sits beside the
 * date; absences gather into one line a day (see month-layout.ts). Break
 * days are shaded with their name. Small type fits six lines a day. With
 * `highlight`, events it picks stand out and the rest fade.
 *
 * On screen: the + adds an event on that day, an event opens it, "+2 more"
 * and a gathered line open the day. On paper (variant "print"): no
 * buttons, light colors, and "+2 more, see list" (the printed list of
 * every event follows the grid, see print-calendar.tsx).
 */
export function MonthGrid({
  month,
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
  month: string
  today: string
  occurrences: Array<Occurrence>
  breaks: Array<SchoolBreak>
  categories: Array<EventCategory>
  loading?: boolean
  variant?: Variant
  /** Which events stand out (the rest fade); null: everything as is. */
  highlight?: ((o: Occurrence) => boolean) | null
  onAdd?: (date: string) => void
  onOpen?: (o: Occurrence) => void
  onDay?: (date: string) => void
}) {
  const weeks = layoutMonth(monthWeeks(month), occurrences, categories, PER_DAY)
  const print = variant === 'print'
  const ctx: Ctx = {
    month,
    today,
    breaks,
    print,
    colorOf: new Map(categories.map((c) => [c.id, c.color])),
    categoryOf: new Map(categories.map((c) => [c.id, c])),
    highlight,
    onAdd,
    onOpen,
    onDay,
  }
  return (
    <div
      className={cn(
        'overflow-hidden rounded-lg border-2',
        print
          ? 'border-neutral-400 bg-white text-black'
          : 'border-border bg-card shadow-md transition-opacity motion-reduce:transition-none',
        loading && 'opacity-60',
      )}
      aria-busy={loading || undefined}
    >
      <div
        aria-hidden
        className={cn(
          'grid grid-cols-7 border-b-2',
          print ? 'border-neutral-400' : 'border-border',
        )}
      >
        {weekdayLabels('short').map((label, day) => (
          <div
            key={day}
            className={cn(
              'text-center text-xs font-bold uppercase',
              print ? 'py-0.5 text-neutral-600' : 'py-1 text-muted-foreground',
            )}
          >
            {label}
          </div>
        ))}
      </div>
      {weeks.map((week, i) => (
        <Week
          key={week.days[0]}
          week={week}
          last={i === weeks.length - 1}
          ctx={ctx}
        />
      ))}
    </div>
  )
}

type Ctx = {
  month: string
  today: string
  breaks: Array<SchoolBreak>
  print: boolean
  colorOf: Map<string, string>
  categoryOf: Map<string, EventCategory>
  highlight: ((o: Occurrence) => boolean) | null
  onAdd?: (date: string) => void
  onOpen?: (o: Occurrence) => void
  onDay?: (date: string) => void
}

/**
 * One week: a grid whose first row is the dates, then a row per line. Bars
 * keep their rows; each day's own lines fill the rows its bars leave free
 * (see month-layout.ts). The last row takes what's left of the day boxes'
 * height. The day boxes (borders, shading) sit behind it all.
 */
function Week({
  week,
  last,
  ctx,
}: {
  week: WeekLayout
  last: boolean
  ctx: Ctx
}) {
  const { print } = ctx
  // repeat(0, …) isn't valid CSS: an empty week would lose its rows. The
  // last row's minimum is the gap under a full day's lines.
  const style: CSSProperties = {
    gridTemplateRows:
      week.rows > 0
        ? `auto repeat(${week.rows}, auto) minmax(0.25rem, 1fr)`
        : 'auto minmax(0.25rem, 1fr)',
  }
  return (
    <div
      className={cn(
        'relative grid grid-cols-7 break-inside-avoid',
        !last &&
          (print ? 'border-b border-neutral-400' : 'border-b border-border'),
      )}
      style={style}
    >
      {week.days.map((date, col) => {
        const off = breakOn(date, ctx.breaks)
        return (
          <div
            key={`box:${date}`}
            aria-hidden
            style={{ gridColumn: col + 1, gridRow: '1 / -1' }}
            className={cn(
              print ? 'min-h-24' : 'min-h-32',
              col < 6 &&
                (print
                  ? 'border-r border-neutral-400'
                  : 'border-r border-border'),
              isWeekend(date) && (print ? 'bg-neutral-100' : 'bg-muted/50'),
              off && (print ? 'bg-amber-100' : 'bg-chart-3/15'),
            )}
          />
        )
      })}
      {week.days.map((date, col) => (
        <DayTop
          key={`top:${date}`}
          date={date}
          header={week.header[col]}
          ctx={ctx}
          style={{ gridColumn: col + 1, gridRow: 1 }}
        />
      ))}
      {week.spans.map((s) => (
        <Bar
          key={`bar:${s.items[0].event_id}:${s.items[0].date}`}
          span={s}
          ctx={ctx}
          style={{
            gridColumn: `${s.first + 1} / ${s.last + 2}`,
            gridRow: s.lane + 2,
          }}
        />
      ))}
      {week.days.map((date, col) =>
        week.lines[col].map((line) => (
          <div
            key={lineKey(line, date)}
            style={{ gridColumn: col + 1, gridRow: line.row + 2 }}
            className="relative min-w-0 px-0.5 pt-px"
          >
            <DayLineView line={line} date={date} ctx={ctx} />
          </div>
        )),
      )}
    </div>
  )
}

/** The date row: the day's number, a break's name, a duty, the +. */
function DayTop({
  date,
  header,
  ctx,
  style,
}: {
  date: string
  header: Array<Occurrence>
  ctx: Ctx
  style: CSSProperties
}) {
  const { print } = ctx
  const inMonth = monthOf(date) === ctx.month
  const isToday = date === ctx.today && !print
  const past = date < ctx.today
  const off = breakOn(date, ctx.breaks)
  return (
    <div
      style={style}
      className={cn(
        'relative flex min-w-0 items-center gap-1 px-0.5 pt-0.5',
        !inMonth && (print ? 'text-neutral-400' : 'text-muted-foreground/60'),
      )}
    >
      <span
        className={cn(
          'flex size-5 shrink-0 items-center justify-center rounded-full text-xs',
          inMonth ? 'font-bold' : 'font-medium',
          isToday && 'bg-primary text-primary-foreground',
          past && !isToday && !print && 'text-muted-foreground',
        )}
      >
        {parseDate(date).getDate()}
      </span>
      {off && (
        <span
          className={cn(
            'min-w-0 shrink truncate text-[0.6875rem] font-bold',
            print ? 'text-neutral-700' : 'text-muted-foreground',
          )}
          title={off.name}
        >
          {off.name}
        </span>
      )}
      {header.length > 0 && (
        <span className="flex min-w-0 items-center gap-0.5">
          <Line
            o={header[0]}
            ctx={ctx}
            className="flex min-w-0 items-center rounded-sm px-1 text-left text-[0.6875rem] leading-4 font-semibold"
          >
            <span className="truncate">{labelOf(header[0], ctx)}</span>
          </Line>
          {header.length > 1 && (
            <span className="shrink-0 text-[0.6875rem] font-bold text-muted-foreground">
              +{header.length - 1}
            </span>
          )}
        </span>
      )}
      {!print && ctx.onAdd && !past && (
        <button
          type="button"
          onClick={() => ctx.onAdd?.(date)}
          aria-label={`Add an event on ${formatLongDate(date)}`}
          className="ml-auto flex size-5 shrink-0 items-center justify-center rounded-md text-muted-foreground opacity-60 outline-none hover:bg-muted hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-4 focus-visible:ring-ring"
        >
          <Plus className="size-3.5" />
        </button>
      )}
    </div>
  )
}

/** One event on days in a row, drawn across them. */
function Bar({
  span,
  ctx,
  style,
}: {
  span: Span
  ctx: Ctx
  style: CSSProperties
}) {
  const o = span.items[0]
  // An event that spans days: its own first and last day, which may be in
  // other weeks; the bar's edge is square where it carries on.
  const real = isSpan(o)
  const range = real
    ? formatDayRange(o.first_day, o.last_day)
    : formatDayRange(o.date, span.items[span.items.length - 1].date)
  return (
    <div
      style={style}
      className={cn(
        'relative min-w-0 px-0.5 pt-px',
        span.before && 'pl-0',
        span.after && 'pr-0',
      )}
    >
      <Line
        o={o}
        items={span.items}
        ctx={ctx}
        title={`${labelOf(o, ctx)} · ${range}`}
        className={cn(
          LINE,
          span.before && 'rounded-l-none',
          span.after && 'rounded-r-none',
        )}
      >
        {!o.all_day && (
          <span className="shrink-0 font-medium tabular-nums">
            {shortTime(o)}
          </span>
        )}
        <span className="min-w-0 truncate">{labelOf(o, ctx)}</span>
        <span className="ml-auto shrink-0 pl-1 text-[0.625rem] font-medium opacity-70 tabular-nums">
          {span.days} days
        </span>
      </Line>
    </div>
  )
}

function lineKey(line: DayLine, date: string) {
  if (line.kind === 'more') return `more:${date}`
  const { item } = line
  return item.kind === 'event'
    ? `${item.o.event_id}:${item.o.date}`
    : `all:${item.category.id}:${date}`
}

/** One of a day's own lines: an event, a gathered line, or "+N more". */
function DayLineView({
  line,
  date,
  ctx,
}: {
  line: DayLine
  date: string
  ctx: Ctx
}) {
  if (line.kind === 'more') {
    return ctx.print ? (
      <p className="px-1 text-[0.625rem] leading-4 font-bold text-neutral-700">
        +{line.hidden} more, see list
      </p>
    ) : (
      <button
        type="button"
        onClick={() => ctx.onDay?.(date)}
        className="rounded-md px-1 text-left text-[0.6875rem] leading-4 font-bold text-muted-foreground outline-none hover:text-foreground focus-visible:ring-4 focus-visible:ring-ring"
      >
        +{line.hidden} more
      </button>
    )
  }
  const { item } = line
  return item.kind === 'event' ? (
    <Line
      o={item.o}
      ctx={ctx}
      title={`${item.o.all_day ? '' : `${startLabel(item.o)} `}${item.o.title}`}
      className={LINE}
    >
      {!item.o.all_day && (
        <span className="shrink-0 font-medium tabular-nums">
          {shortTime(item.o)}
        </span>
      )}
      <span className="min-w-0 truncate">{labelOf(item.o, ctx)}</span>
    </Line>
  ) : (
    <Line
      o={item.items[0]}
      items={item.items}
      ctx={ctx}
      onClick={ctx.onDay ? () => ctx.onDay?.(date) : undefined}
      title={item.items.map((o) => o.title).join('\n')}
      className={LINE}
    >
      <span className="min-w-0 truncate">
        {combinedText(item.category, item.items)}
      </span>
    </Line>
  )
}

/** What a line says: its title, or a birthday's name with a cake. */
function labelOf(o: Occurrence, ctx: Ctx) {
  const c = o.category_id ? ctx.categoryOf.get(o.category_id) : undefined
  return isBirthdays(c) ? `🎂 ${shortTitle(o.title)}` : o.title
}

/**
 * An event's line in its category's color: a button on screen (opening
 * it, or the day for a gathered line), plain on paper. While legend chips
 * are picked, the lines they cover stay as they are and the rest fade (a
 * bar or gathered line stays if any of its events is covered).
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
  /** All the events the line stands for (a bar, a gathered line). */
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
