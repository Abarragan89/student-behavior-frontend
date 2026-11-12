import { useState } from 'react'
import {
  CalendarClock,
  CirclePlus,
  Plus,
  School,
  UserPlus,
  UsersRound,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
} from '@/components/ui/popover'
import { bottomTabClass } from '#/components/bottom-tab'
import { useCreateDialogs } from '#/components/create-dialogs'
import { meQueryOptions } from '#/lib/auth'
import type { Me } from '#/lib/auth'
import { canEdit, isSchoolAdmin } from '#/lib/workspace'

type Item = { label: string; icon: LucideIcon; onSelect: () => void }

/**
 * What the Add menu offers in this space. In a co-teacher's space, only what
 * their permissions allow, and never Add co-teacher (only the owner invites).
 * A school's administrator has nothing to add here: no classes of their own.
 */
export function useCreateItems(me: Me | null | undefined): Array<Item> {
  const { openAddStudents, openCreateClass, openAddCoteacher } =
    useCreateDialogs()
  const navigate = useNavigate()
  if (!me || isSchoolAdmin(me)) return []
  const items: Array<Item> = []
  if (canEdit(me, 'classes')) {
    if (me.classroom) {
      items.push({
        label: 'Add students',
        icon: UserPlus,
        onSelect: () => openAddStudents(),
      })
    }
    items.push({
      label: 'Create class',
      icon: School,
      onSelect: openCreateClass,
    })
  }
  if (canEdit(me, 'conferences')) {
    items.push({
      label: 'Conference sign-ups',
      icon: CalendarClock,
      onSelect: () =>
        void navigate({ to: '/conferences', search: { new: true } }),
    })
  }
  if (!me.acting_for) {
    items.push({
      label: 'Add co-teacher',
      icon: UsersRound,
      onSelect: openAddCoteacher,
    })
  }
  return items
}

/**
 * The Add menu: things to add. A round + in the top bar on wide screens, and
 * the first tab of the phone bottom bar (placement="bottom-bar", opens upward
 * from the left edge).
 */
export function CreateMenu({
  placement = 'header',
}: {
  placement?: 'header' | 'bottom-bar'
}) {
  const [open, setOpen] = useState(false)
  const { data: me } = useQuery(meQueryOptions)
  const items = useCreateItems(me)
  const inBar = placement === 'bottom-bar'
  // A co-teacher who can only look: nothing to add.
  if (items.length === 0) return null

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
        align={inBar ? 'start' : 'end'}
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
