import { useState } from 'react'
import { CirclePlus, Plus, School, UserPlus } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
} from '@/components/ui/popover'
import { bottomTabClass } from '#/components/bottom-tab'
import { useCreateDialogs } from '#/components/create-dialogs'

/**
 * The Add menu: things to add. A round + in the top bar on wide screens, and
 * a tab like the others in the phone bottom bar (placement="bottom-bar",
 * opens upward).
 */
export function CreateMenu({
  placement = 'header',
}: {
  placement?: 'header' | 'bottom-bar'
}) {
  const [open, setOpen] = useState(false)
  const { openAddStudents, openCreateClass } = useCreateDialogs()
  const inBar = placement === 'bottom-bar'

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
      {inBar ? (
        // Its label names it; no aria-label needed. Lit up while open, since
        // it has no page of its own to light up on.
        <PopoverTrigger
          render={
            <button
              type="button"
              className={`${bottomTabClass} data-popup-open:text-primary`}
            />
          }
        >
          <CirclePlus className="size-6" />
          Add
        </PopoverTrigger>
      ) : (
        <PopoverTrigger
          render={
            <Button
              size="icon"
              aria-label="Add"
              className="size-10 rounded-full border-2 border-border shadow-md focus-visible:ring-4 focus-visible:ring-ring"
            />
          }
        >
          <Plus className="size-5" strokeWidth={3} />
        </PopoverTrigger>
      )}

      <PopoverContent
        side={inBar ? 'top' : 'bottom'}
        align={inBar ? 'center' : 'end'}
        sideOffset={8}
        className="w-56 gap-1 rounded-lg border-2 border-border p-2 shadow-md ring-0"
      >
        <PopoverTitle className="sr-only">Add</PopoverTitle>
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
