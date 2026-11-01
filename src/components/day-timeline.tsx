import { useLayoutEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import type { Mark } from '#/lib/marks'
import { formatHour, formatTime, minutesIntoDay } from '#/lib/day'

// The school day shown, unless marks fall outside it: 6 AM to 5 PM.
const FIRST_HOUR = 6
const LAST_HOUR = 17
const HOUR_PX = 44
const DOT = 12
// Dots in a cluster sit side by side, a 2px surface gap apart.
const STEP = DOT + 2
// Space between the center line and the first dot.
const SPINE_GAP = 4

type Placed = {
  mark: Mark
  minute: number // into the day, on the wall clock
  y: number
  slot: number // 0 next to the center line, then outward
}

/**
 * One day of a student's marks as a vertical timeline: time runs down the
 * page like a planner, 6 AM to 5 PM. Each mark is a dot at the minute it was
 * given, positive (green) left of the center line, negative (red) right.
 * Marks close together in time sit side by side, so a busy stretch shows as a
 * wide row: clusters, and which side they're on, stand out at a glance.
 *
 * Hover, focus or tap a dot for its time and name. Every mark is also listed
 * in words below the chart, for anyone who can't tell the colors apart.
 */
export function DayTimeline({
  marks,
  timeZone,
  now,
  classroomName,
  emptyText,
  faded = false,
}: {
  marks: Array<Mark>
  /** Whose wall clock to use: the same zone the day was fetched in. */
  timeZone: string
  /** Minutes into the day right now when showing today, else null. */
  now: number | null
  /** The class a mark was given in, only when there's more than one. */
  classroomName?: (classroomId: string) => string | undefined
  emptyText: string
  /** A different day is loading: this one stays on screen, dimmed. */
  faded?: boolean
}) {
  const items = marks
    .map((mark) => ({
      mark,
      minute: minutesIntoDay(mark.created_at, timeZone),
    }))
    .sort((a, b) => a.minute - b.minute)

  // 6 AM to 5 PM, stretched to the hour to fit any mark outside it.
  const startHour = Math.min(
    FIRST_HOUR,
    ...items.map((i) => Math.floor(i.minute / 60)),
  )
  const endHour = Math.max(
    LAST_HOUR,
    ...items.map((i) => Math.ceil(i.minute / 60)),
  )
  const yOf = (minute: number) => ((minute - startHour * 60) / 60) * HOUR_PX
  const height = (endHour - startHour) * HOUR_PX
  const hours = Array.from(
    { length: endHour - startHour + 1 },
    (_, i) => startHour + i,
  )

  const positive = place(
    items.filter((i) => i.mark.is_positive),
    yOf,
  )
  const negative = place(
    items.filter((i) => !i.mark.is_positive),
    yOf,
  )

  // Each side is half the plot. A cluster wider than its side squeezes its
  // dots closer together rather than spilling out.
  const plotRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  useLayoutEffect(() => {
    const plot = plotRef.current
    if (!plot) return
    setWidth(plot.getBoundingClientRect().width)
    const observer = new ResizeObserver(([entry]) =>
      setWidth(entry.contentRect.width),
    )
    observer.observe(plot)
    return () => observer.disconnect()
  }, [])
  const half = width / 2
  const stepFor = (placed: Array<Placed>) => {
    const widest = Math.max(0, ...placed.map((p) => p.slot))
    const room = half - SPINE_GAP - DOT
    return widest > 0 && width > 0 ? Math.min(STEP, room / widest) : STEP
  }
  const positiveStep = stepFor(positive)
  const negativeStep = stepFor(negative)
  const xOf = (p: Placed) => {
    const step = p.mark.is_positive ? positiveStep : negativeStep
    const out = SPINE_GAP + DOT / 2 + p.slot * step
    return p.mark.is_positive ? half - out : half + out
  }

  // In time order, so the keyboard moves through the day.
  const dots = [...positive, ...negative].sort((a, b) => a.minute - b.minute)

  const [activeId, setActiveId] = useState<string | null>(null)
  const active = dots.find((d) => d.mark.id === activeId)

  return (
    <figure
      className={cn(
        'flex flex-col gap-2 transition-opacity motion-reduce:transition-none',
        faded && 'opacity-50',
      )}
    >
      {/* The legend, and the two sides' names, in one. */}
      <div className="grid grid-cols-[3.5rem_1fr_1fr] text-sm font-bold">
        <span />
        <span className="flex items-center justify-end gap-1.5 pr-3">
          <span aria-hidden className="size-2.5 rounded-full bg-chart-5" />
          Positive
        </span>
        <span className="flex items-center gap-1.5 pl-3">
          <span aria-hidden className="size-2.5 rounded-full bg-destructive" />
          Negative
        </span>
      </div>

      {/* Padding so the first and last hour labels aren't cut off. */}
      <div className="grid grid-cols-[3.5rem_1fr] py-2">
        {/* Hour labels, centered on their lines. */}
        <div aria-hidden className="relative" style={{ height }}>
          {hours.map((hour) => (
            <span
              key={hour}
              className="absolute right-2 -translate-y-1/2 text-xs whitespace-nowrap text-muted-foreground tabular-nums"
              style={{ top: (hour - startHour) * HOUR_PX }}
            >
              {formatHour(hour)}
            </span>
          ))}
        </div>

        <div ref={plotRef} className="relative" style={{ height }}>
          {/* Hour lines, then the center line between the two sides. */}
          {hours.map((hour) => (
            <div
              key={hour}
              aria-hidden
              className="absolute inset-x-0 h-px bg-foreground/10"
              style={{ top: (hour - startHour) * HOUR_PX }}
            />
          ))}
          <div
            aria-hidden
            className="absolute inset-y-0 left-1/2 w-px bg-foreground/30"
          />

          {now !== null && now >= startHour * 60 && now <= endHour * 60 && (
            <div
              aria-hidden
              className="absolute inset-x-0 h-0.5 bg-primary"
              style={{ top: yOf(now) }}
            >
              <span className="absolute right-0 -translate-y-1/2 rounded-sm bg-primary px-1 text-[0.625rem] font-bold text-primary-foreground uppercase">
                Now
              </span>
            </div>
          )}

          {width > 0 &&
            dots.map((dot) => {
              const time = formatTime(dot.mark.created_at, timeZone)
              const kind = dot.mark.is_positive ? 'positive' : 'negative'
              return (
                // A 24px target around a 12px dot: easy to hit.
                <button
                  key={dot.mark.id}
                  type="button"
                  aria-label={`${time}, ${dot.mark.name}, ${kind}`}
                  onPointerEnter={() => setActiveId(dot.mark.id)}
                  onPointerLeave={() =>
                    setActiveId((id) => (id === dot.mark.id ? null : id))
                  }
                  onFocus={() => setActiveId(dot.mark.id)}
                  onBlur={() =>
                    setActiveId((id) => (id === dot.mark.id ? null : id))
                  }
                  className="group absolute flex size-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full outline-none"
                  style={{ left: xOf(dot), top: dot.y }}
                >
                  {/* The 2px ring in the card color keeps touching dots
                      apart. */}
                  <span
                    className={cn(
                      'size-3 rounded-full ring-2 ring-card transition-transform group-hover:scale-125 group-focus-visible:scale-125 group-focus-visible:ring-ring motion-reduce:transition-none',
                      dot.mark.is_positive ? 'bg-chart-5' : 'bg-destructive',
                    )}
                  />
                </button>
              )
            })}

          {active && (
            <Tooltip
              dot={active}
              x={Math.min(Math.max(xOf(active), 72), width - 72)}
              time={formatTime(active.mark.created_at, timeZone)}
              classroom={classroomName?.(active.mark.classroom_id)}
            />
          )}

          {items.length === 0 && (
            <p className="absolute inset-0 flex items-center justify-center">
              <span className="rounded-md bg-card px-3 py-1 text-sm font-medium text-muted-foreground">
                {emptyText}
              </span>
            </p>
          )}
        </div>
      </div>
    </figure>
  )
}

/** The time leads; the mark's name (and class) follow. */
function Tooltip({
  dot,
  x,
  time,
  classroom,
}: {
  dot: Placed
  x: number
  time: string
  classroom?: string
}) {
  // Above the dot, or below it near the top where there's no room.
  const below = dot.y < 64
  return (
    <div
      role="tooltip"
      className={cn(
        'pointer-events-none absolute z-20 -translate-x-1/2 rounded-md border-2 border-border bg-card px-2.5 py-1.5 whitespace-nowrap shadow-md',
        below ? 'translate-y-3' : '-translate-y-[calc(100%+0.75rem)]',
      )}
      style={{ left: x, top: dot.y }}
    >
      <p className="text-sm font-bold tabular-nums">{time}</p>
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <span
          aria-hidden
          className={cn(
            'h-0.5 w-3 rounded-full',
            dot.mark.is_positive ? 'bg-chart-5' : 'bg-destructive',
          )}
        />
        {dot.mark.name}
      </p>
      {classroom && (
        <p className="text-xs text-muted-foreground">{classroom}</p>
      )}
    </div>
  )
}

/**
 * Lays out one side's dots: each at its time, in the first spot outward from
 * the center line that doesn't touch a dot already there.
 */
function place(
  items: Array<{ mark: Mark; minute: number }>,
  yOf: (minute: number) => number,
): Array<Placed> {
  const placed: Array<Placed> = []
  for (const item of items) {
    const y = yOf(item.minute)
    let slot = 0
    while (placed.some((p) => p.slot === slot && Math.abs(p.y - y) < STEP)) {
      slot++
    }
    placed.push({ ...item, y, slot })
  }
  return placed
}
