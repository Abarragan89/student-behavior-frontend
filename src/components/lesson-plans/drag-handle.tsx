import type { ComponentProps } from 'react'
import { GripVertical } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * What to press and drag to move a section or line. Dragging starts only
 * here, so swiping anywhere else on the page still scrolls.
 */
export function DragHandle({
  label,
  className,
  ...props
}: ComponentProps<'button'> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      className={cn(
        // touch-none: the browser leaves the gesture to the drag, instead of
        // scrolling. No long-press menu or text selection either.
        'flex size-10 shrink-0 cursor-grab touch-none items-center justify-center rounded-lg text-muted-foreground outline-none select-none [-webkit-touch-callout:none] hover:bg-muted hover:text-foreground focus-visible:ring-4 focus-visible:ring-ring active:cursor-grabbing',
        className,
      )}
      {...props}
    >
      <GripVertical className="size-5" />
    </button>
  )
}
