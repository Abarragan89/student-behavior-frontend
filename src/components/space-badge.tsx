import { useState } from 'react'
import { ArrowLeft, UsersRound } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'
import type { Me } from '#/lib/auth'
import { FEATURES, levelOf } from '#/lib/coteachers'
import { useSwitchSpace } from '#/lib/workspace'

/**
 * "Co-teacher · Ms. Rivera's classroom", shown while you're working in
 * another teacher's space. Tapping it says what you can do there and takes
 * you back to your own classes. Nothing in your own space.
 *
 * placement="header": next to the wordmark on wide screens.
 * placement="strip": a full-width line at the top of phone screens.
 */
export function SpaceBadge({
  me,
  placement,
  className,
}: {
  me: Me
  placement: 'header' | 'strip'
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const { switchTo, switching } = useSwitchSpace()
  const owner = me.acting_for
  if (!owner) return null
  const inStrip = placement === 'strip'

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <button
            type="button"
            className={cn(
              'flex min-w-0 items-center gap-2 rounded-lg font-bold focus-visible:ring-4 focus-visible:ring-ring focus-visible:outline-none',
              inStrip
                ? 'w-full border-b-2 border-border bg-primary/10 px-4 py-2 text-left text-sm'
                : 'border-2 border-border bg-card px-2 py-1 text-sm hover:bg-muted',
              className,
            )}
          />
        }
      >
        <Badge className="h-6 shrink-0 gap-1 rounded-md px-2 text-xs font-bold">
          <UsersRound aria-hidden />
          Co-teacher
        </Badge>
        <span className="min-w-0 truncate">{owner.name}’s classroom</span>
      </PopoverTrigger>

      <PopoverContent
        side="bottom"
        align={inStrip ? 'center' : 'start'}
        sideOffset={6}
        className="w-72 gap-3 rounded-lg border-2 border-border p-4 shadow-md ring-0"
      >
        <PopoverHeader className="gap-1">
          <PopoverTitle className="font-bold">
            You’re a co-teacher here
          </PopoverTitle>
          <PopoverDescription>
            You’re seeing {owner.name}’s classroom. They chose what you can do:
          </PopoverDescription>
        </PopoverHeader>
        <ul className="flex flex-col gap-1 text-sm">
          {FEATURES.map((f) => {
            const level = levelOf(owner.permissions, f.key)
            return (
              <li key={f.key} className="flex justify-between gap-3">
                <span>{f.label}</span>
                <span className="font-bold">
                  {level === 'edit'
                    ? 'Edit'
                    : level === 'view'
                      ? 'View only'
                      : 'No access'}
                </span>
              </li>
            )
          })}
        </ul>
        <Button
          variant="outline"
          onClick={() => {
            setOpen(false)
            void switchTo(null)
          }}
          disabled={switching !== undefined}
          className="h-10 rounded-lg border-2 font-bold"
        >
          {switching !== undefined ? (
            <Spinner aria-hidden className="size-4" />
          ) : (
            <ArrowLeft />
          )}
          Back to my classes
        </Button>
      </PopoverContent>
    </Popover>
  )
}
