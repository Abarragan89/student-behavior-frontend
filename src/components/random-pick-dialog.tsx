import { useLayoutEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Dices } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ResponsiveDialog } from '#/components/responsive-dialogue'
import { MarkRing } from '#/components/student-card'
import type { Today } from '#/components/student-card'
import { useMediaQuery } from '#/hooks/useMediaQuery'
import type { RandomPick } from '#/hooks/useRandomPick'

// The waits between names while shuffling, slowing to a stop: about 1.3 s.
const STEPS = [55, 60, 65, 75, 85, 100, 115, 135, 160, 190, 225]

/**
 * The student (or group) picked at random, big enough to read on a
 * projector: their ring of marks and their name. Each pick shuffles through
 * other names first, then lands (straight away with reduced motion). Under
 * it, how many are still to pick this round (see useRandomPick), Pick again,
 * and Give a mark (left out when the teacher can't give marks).
 */
export function RandomPickDialog<TItem extends { id: string }>({
  open,
  onOpenChange,
  title,
  description,
  pick,
  items,
  labelFor,
  fullNameFor,
  avatarFor,
  todayFor,
  left,
  total,
  onPickAgain,
  onStartOver,
  onGiveMark,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** "Random student", "Random group". */
  title: string
  description: string
  /** The latest pick. A new seq plays the shuffle again. */
  pick: (RandomPick<TItem> & { seq: number }) | null
  /** Everything in the hat, for the names shown while shuffling. */
  items: Array<TItem>
  /**
   * The big name: the one on a student's card ("Sam L." when two share it),
   * so last names stay off a projector; or the group's name.
   */
  labelFor: (item: TItem) => string
  /** Read out once it lands: a student's full name, or the group's. */
  fullNameFor: (item: TItem) => string
  /** What sits inside the ring: initials, or the group's badge. */
  avatarFor: (item: TItem) => ReactNode
  /** The ring's marks, or null while they load. */
  todayFor: (item: TItem) => Today
  /** Not yet picked this round, out of total. */
  left: number
  total: number
  onPickAgain: () => void
  onStartOver: () => void
  onGiveMark?: (item: TItem) => void
}) {
  const reduceMotion = useMediaQuery('(prefers-reduced-motion: reduce)')
  const pickAgainRef = useRef<HTMLButtonElement>(null)
  // The name on screen while shuffling; null once it has landed.
  const [passing, setPassing] = useState<TItem | null>(null)
  // Read by the shuffle, not a reason to start it again: the list changes
  // when a refetch brings new counts or points, while the pick stays.
  const itemsRef = useRef(items)
  useLayoutEffect(() => {
    itemsRef.current = items
  })

  // Before paint, so the picked name never flashes up first.
  useLayoutEffect(() => {
    const list = itemsRef.current
    if (!open || !pick || reduceMotion || list.length < 2) {
      setPassing(null)
      return
    }
    const target = pick.item
    let step = 0
    let current = target
    let timer = 0
    function next() {
      if (step === STEPS.length) {
        setPassing(null)
        // Ready for the next pick from the keyboard (or a clicker).
        pickAgainRef.current?.focus()
        return
      }
      current = otherThan(itemsRef.current, current, target)
      setPassing(current)
      timer = window.setTimeout(next, STEPS[step++])
    }
    next()
    return () => window.clearTimeout(timer)
  }, [open, pick, reduceMotion])

  const shuffling = passing !== null
  const shown = passing ?? pick?.item

  return (
    <ResponsiveDialog
      isOpen={open}
      setIsOpen={onOpenChange}
      title={title}
      description={description}
    >
      {pick && shown && (
        <div className="flex flex-col items-center gap-4 pt-2 pb-1 text-center">
          <MarkRing
            // Grey while shuffling; the picked one's marks once landed.
            today={shuffling ? null : todayFor(shown)}
            className="size-24 sm:size-28"
          >
            {avatarFor(shown)}
          </MarkRing>

          <p
            // The passing names aren't read out; the status below says who
            // was picked.
            aria-hidden={shuffling || undefined}
            className={cn(
              'max-w-full text-4xl font-bold sm:text-5xl',
              // One line while shuffling, so the dialog doesn't jump.
              shuffling ? 'truncate' : 'wrap-break-word',
            )}
          >
            {labelFor(shown)}
          </p>
          <span role="status" className="sr-only">
            {shuffling ? '' : `Picked ${fullNameFor(shown)}`}
          </span>

          <p className="text-sm text-muted-foreground">
            {roundNote(pick.restarted, left, total)}
            {left < total && (
              <>
                {' · '}
                <Button
                  variant="link"
                  onClick={onStartOver}
                  className="h-auto px-0 text-sm font-bold"
                >
                  Start over
                </Button>
              </>
            )}
          </p>

          <div className={cn('grid w-full gap-3', onGiveMark && 'grid-cols-2')}>
            {onGiveMark && (
              <Button
                variant="outline"
                disabled={shuffling}
                onClick={() => onGiveMark(pick.item)}
                className="h-12 rounded-lg border-2 border-border bg-card text-base font-bold"
              >
                Give a mark
              </Button>
            )}
            <Button
              ref={pickAgainRef}
              // Keeps focus while it shuffles, so Enter can pick again. That
              // leaves out the disabled attribute, so it's dimmed by hand.
              focusableWhenDisabled
              disabled={shuffling}
              onClick={onPickAgain}
              className="h-12 rounded-lg border-2 border-border text-base font-bold shadow-md active:scale-95 data-disabled:opacity-50 motion-reduce:transition-none"
            >
              <Dices className="size-5" aria-hidden />
              Pick again
            </Button>
          </div>
        </div>
      )}
    </ResponsiveDialog>
  )
}

/** Where the teacher is in the round, under the name. */
function roundNote(restarted: boolean, left: number, total: number) {
  if (left === total) return `All ${total} left to pick`
  if (restarted) return 'Everyone’s had a turn, so a new round started'
  if (left === 0) return 'Everyone’s had a turn'
  return `${left} of ${total} left to pick`
}

/**
 * A random one to pass on the way: not the one on screen, and not the one it
 * will land on, unless the list is too small to avoid them.
 */
function otherThan<TItem extends { id: string }>(
  items: Array<TItem>,
  current: TItem,
  target: TItem,
) {
  const notCurrent = items.filter((s) => s.id !== current.id)
  const neither = notCurrent.filter((s) => s.id !== target.id)
  const pool = neither.length > 0 ? neither : notCurrent
  return pool[Math.floor(Math.random() * pool.length)] ?? current
}
