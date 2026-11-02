import { ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatSlotMoment, fullName } from '#/lib/conferences'
import type { Conference } from '#/lib/conferences'

/**
 * Families' moves, newest first: who, from when, to when. Rows that came in
 * with the last Refresh are highlighted.
 */
export function FamilyChanges({
  conference,
  fresh,
}: {
  conference: Conference
  /** Change IDs that are new since the Refresh before last. */
  fresh: ReadonlySet<string>
}) {
  const tz = conference.timezone
  const names = new Map(conference.students.map((s) => [s.id, fullName(s)]))

  return (
    <section
      aria-labelledby="family-changes"
      className="flex flex-col gap-3 rounded-xl border-2 border-border bg-card p-4 shadow-md"
    >
      <h2 id="family-changes" className="text-lg font-bold">
        Changes by families
      </h2>
      {conference.changes.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          When a family picks another time with their QR code, it shows up here.
          Tap Refresh to check.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {conference.changes.map((c) => (
            <li
              key={c.id}
              className={cn(
                'flex flex-col gap-0.5 rounded-lg border-2 px-3 py-2',
                fresh.has(c.id)
                  ? 'border-primary bg-primary/10'
                  : 'border-transparent',
              )}
            >
              <span className="flex items-center gap-2 font-bold">
                {names.get(c.student_id) ?? 'A student'}
                {fresh.has(c.id) && (
                  <span className="text-xs font-bold text-primary uppercase">
                    New
                  </span>
                )}
              </span>
              <span className="flex flex-wrap items-center gap-1 text-sm">
                {c.from_starts_at ? (
                  <span className="text-muted-foreground line-through">
                    {formatSlotMoment(c.from_starts_at, tz)}
                  </span>
                ) : (
                  <span className="text-muted-foreground">No time</span>
                )}
                <ArrowRight aria-label="to" className="size-4 shrink-0" />
                <span className="font-medium">
                  {formatSlotMoment(c.to_starts_at, tz)}
                </span>
              </span>
              <span className="text-xs text-muted-foreground">
                {timeAgo(c.created_at)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/** "5 minutes ago", "yesterday". */
function timeAgo(when: string) {
  const seconds = (Date.parse(when) - Date.now()) / 1000
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })
  const steps: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ['second', 60],
    ['minute', 60],
    ['hour', 24],
    ['day', 7],
    ['week', 4.35],
    ['month', 12],
  ]
  let value = seconds
  for (const [unit, size] of steps) {
    if (Math.abs(value) < size) {
      return unit === 'second'
        ? rtf.format(0, 'second')
        : rtf.format(Math.round(value), unit)
    }
    value /= size
  }
  return rtf.format(Math.round(value), 'year')
}
