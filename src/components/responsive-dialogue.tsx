import * as React from 'react'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { useMediaQuery } from '#/hooks/useMediaQuery'

// Tailwind's `md` breakpoint. Below it (phones, iPad mini in portrait at 744px)
// a bottom drawer is easier to reach with a thumb; at 768px and up (regular
// iPads, laptops) a centered dialog fits better.
const DESKTOP_QUERY = '(min-width: 768px)'

// The dialog/drawer is rendered in a portal, but React still bubbles its events
// up to whatever component it's written inside (e.g. a clickable student card).
// Stopping them here keeps clicks and keys inside the dialog from reaching it.
const stopPropagation = {
  onClick: (e: React.SyntheticEvent) => e.stopPropagation(),
  onKeyDown: (e: React.SyntheticEvent) => e.stopPropagation(),
  onPointerMove: (e: React.SyntheticEvent) => e.stopPropagation(),
}

// The body below the title takes the space left over and scrolls when the
// content is taller. The scroll area's viewport is `h-full`, which only works
// inside a parent with a set height; a one-row grid gives it one, even though
// the dialog and drawer are only as tall as their content (up to a max).
const scrollBodyClass = 'grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)]'

/**
 * A centered dialog on wide screens and a bottom drawer on phones and small
 * tablets, showing the same content.
 */
export function ResponsiveDialog({
  children,
  isOpen,
  setIsOpen,
  title,
  description,
  showDescription = false,
  className,
}: {
  children: React.ReactNode
  isOpen: boolean
  setIsOpen:
    React.Dispatch<React.SetStateAction<boolean>> | ((open: boolean) => void)
  title: string
  description?: string
  showDescription?: boolean
  /** Added to the dialog's own classes, e.g. a wider max width. Not used by the drawer. */
  className?: string
}) {
  const isDesktop = useMediaQuery(DESKTOP_QUERY)
  const drawerRef = React.useRef<HTMLDivElement>(null)

  // Hidden descriptions are still read by screen readers.
  const descriptionClass = showDescription ? '' : 'sr-only'

  if (isDesktop) {
    return (
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent
          {...stopPropagation}
          // Never taller than the screen. The title and close button stay put
          // while the body scrolls.
          className={cn(
            'flex max-h-[calc(100dvh-2rem)] flex-col overflow-hidden rounded-md',
            className,
          )}
        >
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {description && (
              <DialogDescription className={descriptionClass}>
                {description}
              </DialogDescription>
            )}
          </DialogHeader>
          {/* Pulled out over the dialog's padding and padded back in, so the
              content sits where it did, the scrollbar sits in the side
              padding, and focus rings at the edges aren't cut off. */}
          <ScrollArea className={cn(scrollBodyClass, '-mx-6 -my-1')}>
            <div className="px-6 py-1">{children}</div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Drawer open={isOpen} onOpenChange={setIsOpen} showSwipeHandle>
      <DrawerContent
        {...stopPropagation}
        ref={drawerRef}
        // Focus the drawer itself, not its first field: on phones a focused
        // field pops the keyboard up over the drawer. Screen readers still
        // announce the drawer.
        initialFocus={drawerRef}
      >
        <DrawerHeader>
          <DrawerTitle>{title}</DrawerTitle>
          {description && (
            <DrawerDescription className={descriptionClass}>
              {description}
            </DrawerDescription>
          )}
        </DrawerHeader>
        {/* Swiping inside it scrolls; the drawer only follows the swipe
            down once it's scrolled to the top. */}
        <ScrollArea className={scrollBodyClass}>
          <div className="p-4">{children}</div>
        </ScrollArea>
      </DrawerContent>
    </Drawer>
  )
}
