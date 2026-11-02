import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { RefreshCw, WifiOff } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useOnline } from '#/lib/online'
import { describeUnsent, useUnsentChanges } from '#/hooks/useUnsentChanges'

/**
 * In the top bar on wide screens, and on the top edge of the bottom bar on
 * phones (which have no top bar): "Offline" while there's no connection, with
 * how many marks and lesson plan checkmarks are waiting to be sent, and "Syncing" while a backlog goes out. The page
 * keeps showing what's saved; things that need the server say so where they
 * are.
 */
export function ConnectionStatus() {
  const online = useOnline()
  const changes = useUnsentChanges()
  const unsent = changes.total
  // A tap online is sent in a moment; only show "Syncing" for a backlog.
  const syncing = useAfter(online && unsent > 0, 1500)

  const what = describeUnsent(changes)
  let content = null
  if (!online) {
    content = (
      <Pill className="bg-accent text-accent-foreground">
        <WifiOff className="size-3.5" strokeWidth={2.5} />
        {/* Short on screen; the full sentence for screen readers. */}
        {unsent > 0 ? (
          <>
            <span aria-hidden>{unsent} to sync</span>
            <span className="sr-only">Offline. {what} waiting to be sent.</span>
          </>
        ) : (
          'Offline'
        )}
      </Pill>
    )
  } else if (syncing) {
    content = (
      <Pill className="bg-card text-card-foreground">
        <RefreshCw
          className="size-3.5 animate-spin motion-reduce:animate-none"
          strokeWidth={2.5}
        />
        <span aria-hidden>Syncing {unsent}</span>
        <span className="sr-only">Sending {what}.</span>
      </Pill>
    )
  }

  // Always in the page, so screen readers announce the change.
  return <span role="status">{content}</span>
}

function Pill({
  className,
  children,
}: {
  className: string
  children: ReactNode
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border-2 border-border px-2.5 py-1 text-xs font-bold whitespace-nowrap',
        className,
      )}
    >
      {children}
    </span>
  )
}

/** True once `value` has been true for `ms` in a row. */
function useAfter(value: boolean, ms: number) {
  const [settled, setSettled] = useState(false)
  useEffect(() => {
    if (!value) return
    const timer = setTimeout(() => setSettled(true), ms)
    return () => {
      clearTimeout(timer)
      setSettled(false)
    }
  }, [value, ms])
  return value && settled
}
