import { useState } from 'react'
import { Minus, Plus, Shuffle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ResponsiveDialog } from '#/components/responsive-dialogue'
import { MAX_GROUPS, describeSplit, groupCountFor } from '#/lib/groups'
import type { ShufflePlan } from '#/lib/groups'

const segmentClass = (on: boolean) =>
  cn(
    'h-10 flex-1 rounded-md px-3 text-base font-bold transition-colors outline-none focus-visible:ring-4 focus-visible:ring-ring motion-reduce:transition-none',
    on
      ? 'bg-primary text-primary-foreground'
      : 'text-foreground hover:bg-muted',
  )
const stepClass =
  'size-11 shrink-0 rounded-lg border-2 border-border bg-card shadow-md active:scale-95 motion-reduce:transition-none'

/**
 * Random groups: "Make 4 groups" or "Groups of 4", with a preview of the
 * sizes. Shuffling deals the whole class into the editor's draft (nothing is
 * saved until Save), so the teacher can shuffle again or move a few by hand.
 */
export function ShuffleSheet({
  open,
  onOpenChange,
  studentCount,
  groupCount,
  hasPoints,
  onShuffle,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  studentCount: number
  /** How many groups the draft has now: the starting number to make. */
  groupCount: number
  /** Some group has team points (offer to start them at 0). */
  hasPoints: boolean
  onShuffle: (plan: ShufflePlan, resetPoints: boolean) => void
}) {
  const [by, setBy] = useState<ShufflePlan['by']>('count')
  // About 4 to a group to start with, or as many groups as there are now.
  const [n, setN] = useState(() =>
    groupCount >= 2 ? groupCount : Math.max(2, Math.round(studentCount / 4)),
  )
  // On by default: shuffled teams are new teams, so last week's points
  // shouldn't come with the names.
  const [resetPoints, setResetPoints] = useState(true)

  const max = by === 'count' ? Math.min(MAX_GROUPS, studentCount) : studentCount
  const value = Math.max(1, Math.min(n, Math.max(1, max)))
  const groups = groupCountFor(studentCount, { by, n: value })

  function switchTo(next: ShufflePlan['by']) {
    if (next === by) return
    // Keep about the same split: 26 students in 7 groups ↔ groups of 4.
    if (studentCount > 0) setN(Math.max(1, Math.round(studentCount / value)))
    setBy(next)
  }

  return (
    <ResponsiveDialog
      isOpen={open}
      setIsOpen={onOpenChange}
      title="Random groups"
      description="Deal the whole class into groups at random. You can shuffle again or move students before you save."
      showDescription
    >
      <div className="flex flex-col gap-5 pb-2">
        <div
          role="radiogroup"
          aria-label="Split the class by"
          className="flex gap-0.5 rounded-lg border-2 border-border bg-card p-0.5"
        >
          <button
            type="button"
            role="radio"
            aria-checked={by === 'count'}
            onClick={() => switchTo('count')}
            className={segmentClass(by === 'count')}
          >
            Number of groups
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={by === 'size'}
            onClick={() => switchTo('size')}
            className={segmentClass(by === 'size')}
          >
            Group size
          </button>
        </div>

        <div className="flex items-center justify-center gap-4">
          <Button
            variant="outline"
            onClick={() => setN(value - 1)}
            disabled={value <= 1}
            aria-label={by === 'count' ? 'Fewer groups' : 'Smaller groups'}
            className={stepClass}
          >
            <Minus className="size-5" aria-hidden />
          </Button>
          <p className="min-w-32 text-center">
            <span className="block text-4xl font-bold tabular-nums">
              {value}
            </span>
            <span className="text-sm font-medium text-muted-foreground">
              {by === 'count'
                ? value === 1
                  ? 'group'
                  : 'groups'
                : 'students each'}
            </span>
          </p>
          <Button
            variant="outline"
            onClick={() => setN(value + 1)}
            disabled={value >= max}
            aria-label={by === 'count' ? 'More groups' : 'Bigger groups'}
            className={stepClass}
          >
            <Plus className="size-5" aria-hidden />
          </Button>
        </div>

        <p
          aria-live="polite"
          className="text-center text-base font-medium text-muted-foreground"
        >
          {describeSplit(studentCount, groups)}
        </p>

        {hasPoints && (
          <label className="flex items-center gap-3 text-base font-medium">
            <input
              type="checkbox"
              checked={resetPoints}
              onChange={(e) => setResetPoints(e.target.checked)}
              className="size-5 shrink-0 accent-primary"
            />
            Start team points at 0
          </label>
        )}

        <Button
          onClick={() => {
            onShuffle({ by, n: value }, hasPoints && resetPoints)
            onOpenChange(false)
          }}
          disabled={studentCount === 0}
          className="h-12 rounded-lg border-2 border-border text-base font-bold shadow-md active:scale-95 motion-reduce:transition-none"
        >
          <Shuffle aria-hidden />
          Shuffle
        </Button>
      </div>
    </ResponsiveDialog>
  )
}
