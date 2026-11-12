import { ArrowLeft, Eye } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'
import type { Me } from '#/lib/auth'
import { useSwitchSpace } from '#/lib/workspace'

/**
 * A school administrator viewing a teacher's classes: whose, that it's view
 * only, and the way back to the dashboard. Always on screen while viewing, so
 * it's never mistaken for their own (they have no classes).
 *
 * placement="header": next to the wordmark on wide screens.
 * placement="strip": a full-width line at the top of phone screens.
 */
export function AdminViewBar({
  me,
  placement,
  className,
}: {
  me: Me
  placement: 'header' | 'strip'
  className?: string
}) {
  const { switchTo, switching } = useSwitchSpace()
  const teacher = me.acting_for
  if (!teacher) return null
  const inStrip = placement === 'strip'
  const busy = switching !== undefined

  return (
    <div
      role="status"
      className={cn(
        'flex min-w-0 items-center gap-2 font-bold',
        inStrip
          ? 'w-full border-b-2 border-border bg-primary/10 py-1.5 pr-2 pl-4 text-sm'
          : 'rounded-lg border-2 border-border bg-card py-1 pr-1 pl-2 text-sm',
        className,
      )}
    >
      <Badge className="h-6 shrink-0 gap-1 rounded-md px-2 text-xs font-bold">
        <Eye aria-hidden />
        View only
      </Badge>
      <span className="min-w-0 flex-1 truncate">
        Viewing {teacher.name}’s classes
      </span>
      <Button
        variant={inStrip ? 'ghost' : 'outline'}
        onClick={() => void switchTo(null, { to: '/dashboard' })}
        disabled={busy}
        className="h-8 shrink-0 rounded-lg px-2 font-bold"
      >
        {busy ? <Spinner aria-hidden className="size-4" /> : <ArrowLeft />}
        Dashboard
      </Button>
    </div>
  )
}
