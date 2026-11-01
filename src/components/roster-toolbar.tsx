import { useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { formatStudentCount } from '#/lib/classroom'

const linkClass = 'h-9 px-2 text-base font-bold'

/**
 * Beside the roster's heading, at the right. Normally "Select" and "Select
 * all". While picking students, the button that gives them a mark, plus
 * Cancel.
 */
export function RosterToolbar({
  selecting,
  selectedCount,
  onSelect,
  onSelectAll,
  onGive,
  onCancel,
}: {
  selecting: boolean
  selectedCount: number
  onSelect: () => void
  onSelectAll: () => void
  onGive: () => void
  onCancel: () => void
}) {
  // The pressed button disappears when the bar switches, so move focus to
  // the first button of the new set. Only on a switch, not on the first
  // render.
  const firstRef = useRef<HTMLButtonElement>(null)
  const shown = useRef(selecting)
  useEffect(() => {
    if (shown.current === selecting) return
    shown.current = selecting
    firstRef.current?.focus()
  }, [selecting])

  return (
    // With links at the end, their padding is pulled out, so the text lines
    // up with the card's edge.
    <div
      className={cn(
        'ml-auto flex min-h-9 mb-1 items-center justify-end gap-2',
        !selecting && '-mr-2',
      )}
    >
      {selecting ? (
        <>
          <Button
            ref={firstRef}
            variant="link"
            onClick={onCancel}
            className={linkClass}
          >
            Cancel
          </Button>
          <Button
            onClick={onGive}
            disabled={selectedCount === 0}
            className="h-9 rounded-lg border-2 border-border px-4 text-base font-bold shadow-md active:scale-95 motion-reduce:transition-none"
          >
            {selectedCount === 0
              ? 'Select students'
              : `Give mark to ${formatStudentCount(selectedCount)}`}
          </Button>
        </>
      ) : (
        <>
          <Button
            ref={firstRef}
            variant="link"
            onClick={onSelect}
            className={linkClass}
          >
            Select
          </Button>
          <Button variant="link" onClick={onSelectAll} className={linkClass}>
            Select all
          </Button>
        </>
      )}
      {/* Tells screen readers how many are picked as it changes. */}
      <span role="status" className="sr-only">
        {selecting ? `${selectedCount} selected` : ''}
      </span>
    </div>
  )
}
