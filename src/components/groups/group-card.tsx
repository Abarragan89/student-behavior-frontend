import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { MarkRing } from '#/components/student-card'
import { formatNet, groupColorClass } from '#/lib/groups'
import type { StudentGroup } from '#/lib/groups'

// The count colors of the student cards (student-card.tsx).
const positiveText =
  'text-[color-mix(in_oklab,var(--color-chart-5)_70%,var(--color-foreground))]'
const negativeText =
  'text-[color-mix(in_oklab,var(--color-destructive)_75%,var(--color-foreground))]'

/**
 * One group in the Groups tab, built like a student card: a ring of the
 * team's up and down points around a circle in the group's color with the
 * net score, the group's name, the two counts, and who's in it.
 *
 * The whole card is one button that opens the marks to give the group.
 * Without onPress (read-only, or nobody in the group yet) it's just a card.
 */
export function GroupCard({
  group,
  memberLabels,
  onPress,
}: {
  group: StudentGroup
  /** The members' card labels ("Ava", "Sam L."), in roster order. */
  memberLabels: Array<string>
  onPress?: () => void
}) {
  const { positive, negative } = group.score
  const total = positive + negative
  const count = memberLabels.length
  const people =
    count === 0 ? 'no one yet' : count === 1 ? '1 student' : `${count} students`
  const points =
    total === 0
      ? 'no team points yet'
      : `${positive} ${positive === 1 ? 'point' : 'points'} up, ${negative} down`
  const summary = `${group.name}, ${people}, ${points}`

  return (
    <Card
      size="sm"
      className={cn(
        'relative h-full items-center gap-1.5 rounded-xl border-2 border-border px-2 py-3 text-center shadow-md ring-0 transition-[background-color,scale] motion-reduce:transition-none sm:py-4',
        onPress &&
          'has-[>button:hover]:bg-muted has-[>button:focus-visible]:ring-4 has-[>button:focus-visible]:ring-ring has-[>button:active]:scale-95',
      )}
    >
      <MarkRing today={group.score} className="size-16 sm:size-20">
        <span
          aria-hidden
          className={cn(
            'flex size-full items-center justify-center rounded-full text-lg font-bold tabular-nums sm:text-xl',
            groupColorClass(group.color),
          )}
        >
          {formatNet(group.score)}
        </span>
      </MarkRing>

      <span aria-hidden className="w-full truncate px-1 text-base font-bold">
        {group.name}
      </span>

      <span
        aria-hidden
        className="flex h-4 items-center justify-center gap-2 text-sm font-bold tabular-nums"
      >
        {total === 0 ? (
          <span className="text-xs font-medium whitespace-nowrap text-muted-foreground">
            No points yet
          </span>
        ) : (
          <>
            <span className={positiveText}>
              <span className="mr-px text-[0.8em]">+</span>
              {positive}
            </span>
            <span className={negativeText}>
              <span className="mr-px text-[0.8em]">−</span>
              {negative}
            </span>
          </>
        )}
      </span>

      <span
        aria-hidden
        className="line-clamp-2 w-full px-1 text-xs font-medium text-muted-foreground"
      >
        {count === 0 ? 'No one yet' : memberLabels.join(', ')}
      </span>

      {onPress ? (
        <button
          type="button"
          onClick={onPress}
          title={group.name}
          aria-label={`${summary}. Give a mark`}
          className="absolute inset-0 rounded-xl outline-none"
        />
      ) : (
        <span className="sr-only">{summary}</span>
      )}
    </Card>
  )
}
