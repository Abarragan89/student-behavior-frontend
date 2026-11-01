import type { ReactNode } from 'react'
import { Check } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { Student } from '#/lib/auth'

/** A student's marks for a day; null while they load (or if they can't). */
export type Today = { positive: number; negative: number } | null

// The ring's colors, pulled a little toward the text color (darker on a light
// card, lighter on a dark one) so the small numbers are easy to read. Mixed
// in oklab: in oklch the green drifts toward olive on the way to black.
const positiveText =
  'text-[color-mix(in_oklab,var(--color-chart-5)_70%,var(--color-foreground))]'
const negativeText =
  'text-[color-mix(in_oklab,var(--color-destructive)_75%,var(--color-foreground))]'

/**
 * One student in the class grid: their initials inside a ring that shows
 * today's positive (green) and negative (red) marks, their name, and the two
 * counts. The whole card is one button: it opens the marks to give, or while
 * picking students, picks this one.
 */
export function StudentCard({
  student,
  label,
  today,
  selecting,
  selected,
  onPress,
}: {
  student: Student
  /** The name shown: first name, or "Sam L." when two share it. */
  label: string
  today: Today
  selecting: boolean
  selected: boolean
  onPress: () => void
}) {
  const fullName = `${student.first_name} ${student.last_name}`.trim()
  const total = today ? today.positive + today.negative : 0
  const summary = !today
    ? fullName
    : total === 0
      ? `${fullName}, no marks yet today`
      : `${fullName}, ${today.positive} positive, ${today.negative} negative today`

  return (
    <Card
      size="sm"
      // Hover, press and focus styles follow the button laid over the card.
      // Picked cards get a primary border and tint.
      className={cn(
        'relative items-center gap-2 rounded-xl border-2 px-1 py-3 text-center shadow-md ring-0 transition-[background-color,border-color,scale] has-[>button:focus-visible]:ring-4 has-[>button:focus-visible]:ring-ring has-[>button:active]:scale-95 motion-reduce:transition-none sm:py-4',
        selected
          ? 'border-primary bg-primary/10 has-[>button:hover]:bg-primary/15'
          : 'border-border has-[>button:hover]:bg-muted',
      )}
    >
      {/* What's on the card is read out by the button instead. */}
      {selecting && (
        // A tick box in the corner while picking. Smaller on phones, where
        // the cards are narrow, so it stays clear of the ring.
        <span
          aria-hidden
          className={cn(
            'absolute top-1 right-1 flex size-4 items-center justify-center rounded-full border-2 sm:top-1.5 sm:right-1.5 sm:size-5',
            selected
              ? 'border-primary bg-primary text-primary-foreground'
              : 'border-border bg-card',
          )}
        >
          {selected && <Check className="size-3 sm:size-3.5" strokeWidth={4} />}
        </span>
      )}

      <MarkRing today={today}>
        <Avatar aria-hidden className="size-full after:hidden">
          <AvatarFallback className="bg-muted text-sm font-bold text-foreground sm:text-base">
            {initials(student.first_name, student.last_name)}
          </AvatarFallback>
        </Avatar>
      </MarkRing>

      <span aria-hidden className="w-full truncate px-1 text-sm font-bold">
        {label}
      </span>

      {/* Height held while counts load, so cards don't jump. */}
      <span
        aria-hidden
        className="flex h-4 items-center justify-center gap-2 text-sm font-bold tabular-nums"
      >
        {today &&
          (total === 0 ? (
            <span className="text-[0.625rem] font-medium whitespace-nowrap text-muted-foreground sm:text-xs">
              No marks yet
            </span>
          ) : (
            <>
              <span className={positiveText}>
                <Sign>+</Sign>
                {today.positive}
              </span>
              <span className={negativeText}>
                <Sign>−</Sign>
                {today.negative}
              </span>
            </>
          ))}
      </span>

      <button
        type="button"
        onClick={onPress}
        title={fullName}
        aria-pressed={selecting ? selected : undefined}
        aria-label={selecting ? summary : `${summary}. Give a mark`}
        className="absolute inset-0 rounded-xl outline-none"
      />
    </Card>
  )
}

/** The + or − in front of a count, a little smaller than the number. */
function Sign({ children }: { children: ReactNode }) {
  return <span className="mr-px text-[0.8em]">{children}</span>
}

// Ring drawn in a 100 × 100 box, scaled to the card.
const RADIUS = 45
const STROKE = 8
// The white gap at each place the green and red parts meet, as a share of the
// ring (out of 100).
const GAP = 2.5

/**
 * A donut around the initials: the green part is the share of today's marks
 * that were positive, the red part the negative ones, going clockwise from
 * the top. Grey with no marks yet. The parts slide when the counts change.
 */
export function MarkRing({
  today,
  className,
  children,
}: {
  today: Today
  /** Sizes it; the card's size by default. */
  className?: string
  children: ReactNode
}) {
  const positive = today?.positive ?? 0
  const negative = today?.negative ?? 0
  const total = positive + negative
  const gap = positive > 0 && negative > 0 ? GAP : 0
  const usable = 100 - 2 * gap
  const positiveLength = total ? (positive / total) * usable : 0
  const negativeLength = total ? (negative / total) * usable : 0

  // Both parts are always drawn (at length 0 when empty), so they can grow
  // and shrink smoothly.
  const parts = [
    {
      key: 'positive',
      className: 'stroke-chart-5',
      start: gap / 2,
      length: positiveLength,
    },
    {
      key: 'negative',
      className: 'stroke-destructive',
      start: gap / 2 + positiveLength + gap,
      length: negativeLength,
    },
  ]

  return (
    <div className={cn('relative size-14 shrink-0 sm:size-16', className)}>
      {/* Turned a quarter, so the ring starts at the top. */}
      <svg
        viewBox="0 0 100 100"
        aria-hidden
        className="absolute inset-0 size-full -rotate-90"
      >
        {total === 0 && (
          <circle
            cx="50"
            cy="50"
            r={RADIUS}
            fill="none"
            strokeWidth={STROKE}
            className="stroke-foreground/15"
          />
        )}
        {parts.map((part) => (
          <circle
            key={part.key}
            cx="50"
            cy="50"
            r={RADIUS}
            fill="none"
            strokeWidth={STROKE}
            // Lengths below are shares of the ring, out of 100.
            pathLength={100}
            className={cn(
              part.className,
              'transition-[stroke-dasharray,stroke-dashoffset] duration-300 ease-out motion-reduce:transition-none',
            )}
            style={{
              strokeDasharray: `${part.length} ${100 - part.length}`,
              strokeDashoffset: -part.start,
            }}
          />
        ))}
      </svg>
      {/* The initials, with a little space between them and the ring. */}
      <div className="absolute inset-[13%]">{children}</div>
    </div>
  )
}

/** "Ava", "Johnson" → "AJ"; "Ava", "" → "A" */
export function initials(first: string, last: string) {
  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase()
}
