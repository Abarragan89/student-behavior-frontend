import { WifiOff } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useOnline } from '#/lib/online'

/**
 * "You're offline. Connect to the internet to {action}." Shown next to
 * buttons that need the server, only while there's no connection.
 */
export function OfflineNote({
  action,
  className,
}: {
  /** e.g. "add students" */
  action: string
  className?: string
}) {
  const online = useOnline()
  if (online) return null

  return (
    <p
      role="status"
      className={cn(
        'flex items-center gap-2 text-sm font-medium text-muted-foreground',
        className,
      )}
    >
      <WifiOff className="size-4 shrink-0" />
      You’re offline. Connect to the internet to {action}.
    </p>
  )
}
