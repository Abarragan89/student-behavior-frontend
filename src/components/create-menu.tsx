import { useState } from 'react'
import { Plus, School, UserPlus } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { useCreateDialogs } from '#/components/create-dialogs'

/**
 * The + button: a menu of things to add. In the top bar on wide screens, and
 * in the middle of the bottom bar on phones (side="top", so it opens upward).
 */
export function CreateMenu({
  side = 'bottom',
  className,
}: {
  side?: 'top' | 'bottom'
  /** For the + button, e.g. to hide it at some screen sizes. */
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const { openAddStudents, openCreateClass } = useCreateDialogs()

  const items: Array<{
    label: string
    icon: LucideIcon
    onSelect: () => void
  }> = [
    {
      label: 'Add students',
      icon: UserPlus,
      onSelect: () => openAddStudents(),
    },
    { label: 'Create class', icon: School, onSelect: openCreateClass },
  ]

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            size="icon"
            aria-label="Create"
            className={cn(
              'size-10 rounded-full border-2 border-border shadow-md focus-visible:ring-4 focus-visible:ring-ring',
              className,
            )}
          />
        }
      >
        <Plus className="size-5" strokeWidth={3} />
      </PopoverTrigger>

      <PopoverContent
        side={side}
        align={side === 'top' ? 'center' : 'end'}
        sideOffset={8}
        className="w-56 gap-1 rounded-lg border-2 border-border p-2 shadow-md ring-0"
      >
        <PopoverTitle className="sr-only">Create</PopoverTitle>
        {items.map(({ label, icon: Icon, onSelect }) => (
          <Button
            key={label}
            variant="ghost"
            onClick={() => {
              setOpen(false)
              onSelect()
            }}
            className="h-10 justify-start rounded-lg font-bold"
          >
            <Icon />
            {label}
          </Button>
        ))}
      </PopoverContent>
    </Popover>
  )
}
