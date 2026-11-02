import { useId } from 'react'
import { cn } from '@/lib/utils'
import { formatHour, formatShortDay, minutesIntoDay } from '#/lib/day'
import { markTime } from '#/lib/marks'
import type { Mark } from '#/lib/marks'
import { hourRange, stackMarks } from '#/components/day-timeline'

// The printed report's charts (src/components/student-report.tsx). Plain SVG
// with fixed drawing sizes, scaled to the paper's width, so they print the
// same from a phone or a computer. No hover: paper can't have any.
//
// Made to read in black and white as well as in color. Positive and
// needs-work marks always differ in more than color:
// - shape: ▲ positive, ▼ needs work
// - position: above the center line, or below it
// - fill: solid green, or orange-red stripes (bars)
// - and a word or a number beside each one.

const INK = 'fill-neutral-900'
const MUTED_INK = 'fill-neutral-600'
const GRID = 'stroke-neutral-300'
const BASELINE = 'stroke-neutral-700'

/** Orange-red stripes on white, at 45°: the needs-work fill for bars. */
function Stripes({ id }: { id: string }) {
  return (
    <pattern
      id={id}
      width="6"
      height="6"
      patternUnits="userSpaceOnUse"
      patternTransform="rotate(45)"
    >
      <rect width="6" height="6" fill="white" />
      <rect width="3.5" height="6" className="fill-report-negative" />
    </pattern>
  )
}

/** Solid for positive; stripes, outlined, for needs work. */
function barProps(positive: boolean, stripesId: string) {
  return positive
    ? { className: 'fill-report-positive' }
    : {
        fill: `url(#${stripesId})`,
        className: 'stroke-report-negative',
        strokeWidth: 1,
      }
}

/** ▲ or ▼, sized to the text beside it. */
export function MarkSymbol({
  positive,
  className,
}: {
  positive: boolean
  className?: string
}) {
  return (
    <svg
      viewBox="0 0 10 10"
      aria-hidden
      className={cn('inline-block size-[0.85em] shrink-0', className)}
    >
      <polygon
        points={positive ? '5,0.5 9.8,9 0.2,9' : '0.2,1 9.8,1 5,9.5'}
        className={positive ? 'fill-report-positive' : 'fill-report-negative'}
      />
    </svg>
  )
}

/** A small square of a bar's fill, for a legend. */
export function FillSwatch({ positive }: { positive: boolean }) {
  const stripes = useId()
  return (
    <svg
      viewBox="0 0 12 12"
      aria-hidden
      className="inline-block size-[0.85em] shrink-0"
    >
      <defs>
        <Stripes id={stripes} />
      </defs>
      <rect
        x="0.5"
        y="0.5"
        width="11"
        height="11"
        rx="2"
        {...barProps(positive, stripes)}
      />
    </svg>
  )
}

// ---------- The day, left to right ----------

const TL_WIDTH = 1000
// Room on the left for "Positive" and "Needs work", and on the right so the
// last hour's label fits.
const TL_LEFT = 132
const TL_RIGHT = 24
const TL_TOP = 6
// Each side of the center line.
const TL_SIDE = 68
const TL_LABELS = 26
const TRI_W = 18
const TRI_H = 15
// Marks closer than this along the time axis stack instead of overlapping.
const TL_STEP = TRI_W + 2
// Each stack row, outward from the center line.
const TL_ROW = TRI_H + 2
const TL_SPINE_GAP = 4

/**
 * One day of marks with time running left to right, 6 AM to 5 PM (wider if
 * a mark falls outside it): ▲ positive above the line, ▼ needs work below.
 * Marks close together stack outward, so busy stretches stand tall.
 */
export function ReportTimeline({
  marks,
  timeZone,
}: {
  marks: Array<Mark>
  timeZone: string
}) {
  const items = marks
    .map((mark) => ({
      mark,
      minute: minutesIntoDay(markTime(mark), timeZone),
    }))
    .sort((a, b) => a.minute - b.minute)
  const { startHour, endHour } = hourRange(items.map((i) => i.minute))
  const plotWidth = TL_WIDTH - TL_LEFT - TL_RIGHT
  const xOf = (minute: number) =>
    TL_LEFT +
    ((minute - startHour * 60) / ((endHour - startHour) * 60)) * plotWidth

  const spine = TL_TOP + TL_SIDE
  const height = TL_TOP + 2 * TL_SIDE + TL_LABELS
  const hours = Array.from(
    { length: endHour - startHour + 1 },
    (_, i) => startHour + i,
  )
  // Every hour labeled on a school day; every other one on a long day.
  const labelEvery = hours.length > 14 ? 2 : 1

  const positive = stackMarks(
    items.filter((i) => i.mark.is_positive),
    xOf,
    TL_STEP,
  )
  const negative = stackMarks(
    items.filter((i) => !i.mark.is_positive),
    xOf,
    TL_STEP,
  )
  // A stack too tall for its side packs its rows closer instead of spilling.
  const rowFor = (placed: typeof positive) => {
    const tallest = Math.max(0, ...placed.map((p) => p.slot))
    const room = TL_SIDE - TL_SPINE_GAP - TRI_H - 2
    return tallest > 0 ? Math.min(TL_ROW, room / tallest) : TL_ROW
  }
  const positiveRow = rowFor(positive)
  const negativeRow = rowFor(negative)

  return (
    <svg
      viewBox={`0 0 ${TL_WIDTH} ${height}`}
      aria-hidden
      className="block h-auto w-full"
    >
      {/* Which side is which: a word, and the side's shape pointing at it. */}
      <text
        x={TL_LEFT - 30}
        y={spine - 9}
        textAnchor="end"
        fontSize="15"
        fontWeight="700"
        className={INK}
      >
        Positive
      </text>
      <polygon
        points={`${TL_LEFT - 24},${spine - 9} ${TL_LEFT - 12},${spine - 9} ${TL_LEFT - 18},${spine - 20}`}
        className="fill-report-positive"
      />
      <text
        x={TL_LEFT - 30}
        y={spine + 20}
        textAnchor="end"
        fontSize="15"
        fontWeight="700"
        className={INK}
      >
        Needs work
      </text>
      <polygon
        points={`${TL_LEFT - 24},${spine + 9} ${TL_LEFT - 12},${spine + 9} ${TL_LEFT - 18},${spine + 20}`}
        className="fill-report-negative"
      />

      {hours.map((hour, i) => (
        <g key={hour}>
          <line
            x1={xOf(hour * 60)}
            x2={xOf(hour * 60)}
            y1={TL_TOP}
            y2={TL_TOP + 2 * TL_SIDE}
            strokeWidth="1"
            className={GRID}
          />
          {i % labelEvery === 0 && (
            <text
              x={xOf(hour * 60)}
              y={height - 6}
              textAnchor="middle"
              fontSize="14"
              className={MUTED_INK}
            >
              {formatHour(hour)}
            </text>
          )}
        </g>
      ))}
      <line
        x1={TL_LEFT}
        x2={TL_WIDTH - TL_RIGHT}
        y1={spine}
        y2={spine}
        strokeWidth="1.5"
        className={BASELINE}
      />

      {positive.map((p) => {
        const base = spine - TL_SPINE_GAP - p.slot * positiveRow
        return (
          <polygon
            key={p.mark.id}
            points={`${p.position - TRI_W / 2},${base} ${p.position + TRI_W / 2},${base} ${p.position},${base - TRI_H}`}
            // A white ring keeps touching marks apart.
            stroke="white"
            strokeWidth="2"
            strokeLinejoin="round"
            className="fill-report-positive"
          />
        )
      })}
      {negative.map((p) => {
        const top = spine + TL_SPINE_GAP + p.slot * negativeRow
        return (
          <polygon
            key={p.mark.id}
            points={`${p.position - TRI_W / 2},${top} ${p.position + TRI_W / 2},${top} ${p.position},${top + TRI_H}`}
            stroke="white"
            strokeWidth="2"
            strokeLinejoin="round"
            className="fill-report-negative"
          />
        )
      })}

      {items.length === 0 && (
        <text
          x={TL_LEFT + plotWidth / 2}
          y={spine - 12}
          textAnchor="middle"
          fontSize="16"
          // A white halo, so the hour lines don't run through the words.
          stroke="white"
          strokeWidth="8"
          strokeLinejoin="round"
          paintOrder="stroke"
          className={MUTED_INK}
        >
          No marks this day
        </text>
      )}
    </svg>
  )
}

// ---------- Bars ----------

/**
 * A bar from a baseline with its far end rounded and its base square, so it
 * reads as growing out of the baseline. `length` runs up (negative y) when
 * `up`, else down.
 */
function barPath(
  x: number,
  base: number,
  width: number,
  length: number,
  up: boolean,
) {
  const r = Math.min(3, width / 2, length)
  const end = up ? base - length : base + length
  const inward = up ? r : -r
  return [
    `M ${x} ${base}`,
    `L ${x} ${end + inward}`,
    `Q ${x} ${end} ${x + r} ${end}`,
    `L ${x + width - r} ${end}`,
    `Q ${x + width} ${end} ${x + width} ${end + inward}`,
    `L ${x + width} ${base}`,
    'Z',
  ].join(' ')
}

/** The day's split, as one bar: solid positive, then striped needs work. */
export function ShareBar({
  positive,
  negative,
}: {
  positive: number
  negative: number
}) {
  const stripes = useId()
  const total = positive + negative
  if (total === 0) return null
  const width = 1000
  const gap = positive > 0 && negative > 0 ? 4 : 0
  const positiveWidth = ((width - gap) * positive) / total
  return (
    <svg
      viewBox={`0 0 ${width} 26`}
      aria-hidden
      className="block h-auto w-full"
    >
      <defs>
        <Stripes id={stripes} />
      </defs>
      {positive > 0 && (
        <rect
          x="0.5"
          y="0.5"
          width={Math.max(positiveWidth - 1, 1)}
          height="25"
          rx="4"
          {...barProps(true, stripes)}
        />
      )}
      {negative > 0 && (
        <rect
          x={positiveWidth + gap + 0.5}
          y="0.5"
          width={Math.max(width - positiveWidth - gap - 1, 1)}
          height="25"
          rx="4"
          {...barProps(false, stripes)}
        />
      )}
    </svg>
  )
}

/** One mark type's count, as a bar on a scale shared with its neighbors. */
export function CountBar({
  count,
  max,
  positive,
}: {
  count: number
  max: number
  positive: boolean
}) {
  const stripes = useId()
  // About the same drawing scale as the other charts, so stripes match.
  const width = 100
  return (
    <svg
      viewBox={`0 0 ${width} 12`}
      aria-hidden
      className="block h-auto w-full"
    >
      <defs>
        <Stripes id={stripes} />
      </defs>
      <rect
        x="0.5"
        y="0.5"
        width={Math.max((count / max) * width - 1, 4)}
        height="11"
        rx="3"
        {...barProps(positive, stripes)}
      />
    </svg>
  )
}

// ---------- Recent days ----------

const TS_WIDTH = 500
const TS_TOP = 16 // room for a count over the tallest bar
const TS_ARM = 40 // the tallest bar, up or down
const TS_BELOW = 16 // room for a count under the deepest bar
const TS_LABELS = 34 // two lines: weekday, date
const TS_BAR = 20

/**
 * The student's recent days side by side: positive bars up from the line,
 * needs-work bars down from it, both on one scale so they compare honestly.
 * The report's own day is shaded.
 */
export function TrendStrip({
  days,
  reportDate,
}: {
  days: Array<{ date: string; positive: number; negative: number }>
  reportDate: string
}) {
  const stripes = useId()
  const column = TS_WIDTH / days.length
  const max = Math.max(1, ...days.flatMap((d) => [d.positive, d.negative]))
  const baseline = TS_TOP + TS_ARM
  const height = TS_TOP + 2 * TS_ARM + TS_BELOW + TS_LABELS
  const lengthOf = (count: number) => (count / max) * TS_ARM

  return (
    <svg
      viewBox={`0 0 ${TS_WIDTH} ${height}`}
      aria-hidden
      className="block h-auto w-full"
    >
      <defs>
        <Stripes id={stripes} />
      </defs>
      {days.map((day, i) => {
        const left = i * column
        const center = left + column / 2
        const isReportDay = day.date === reportDate
        const label = formatShortDay(day.date)
        const up = lengthOf(day.positive)
        const down = lengthOf(day.negative)
        const empty = day.positive + day.negative === 0
        return (
          <g key={day.date}>
            {isReportDay && (
              <rect
                x={left + 2}
                y="0"
                width={column - 4}
                height={height}
                rx="5"
                className="fill-neutral-200"
              />
            )}
            {day.positive > 0 && (
              <>
                <path
                  d={barPath(center - TS_BAR / 2, baseline, TS_BAR, up, true)}
                  {...barProps(true, stripes)}
                />
                <text
                  x={center}
                  y={baseline - up - 5}
                  textAnchor="middle"
                  fontSize="14"
                  fontWeight="700"
                  className={INK}
                >
                  {day.positive}
                </text>
              </>
            )}
            {day.negative > 0 && (
              <>
                <path
                  d={barPath(
                    center - TS_BAR / 2,
                    baseline,
                    TS_BAR,
                    down,
                    false,
                  )}
                  {...barProps(false, stripes)}
                />
                <text
                  x={center}
                  y={baseline + down + 15}
                  textAnchor="middle"
                  fontSize="14"
                  fontWeight="700"
                  className={INK}
                >
                  {day.negative}
                </text>
              </>
            )}
            {empty && (
              <text
                x={center}
                y={baseline - 6}
                textAnchor="middle"
                fontSize="14"
                className={MUTED_INK}
              >
                –
              </text>
            )}
            <text
              x={center}
              y={height - 20}
              textAnchor="middle"
              fontSize="14"
              fontWeight={isReportDay ? '700' : '400'}
              className={isReportDay ? INK : MUTED_INK}
            >
              {label.weekday}
            </text>
            <text
              x={center}
              y={height - 4}
              textAnchor="middle"
              fontSize="14"
              fontWeight={isReportDay ? '700' : '400'}
              className={isReportDay ? INK : MUTED_INK}
            >
              {label.monthDay}
            </text>
          </g>
        )
      })}
      <line
        x1="0"
        x2={TS_WIDTH}
        y1={baseline}
        y2={baseline}
        strokeWidth="1.5"
        className={BASELINE}
      />
    </svg>
  )
}
