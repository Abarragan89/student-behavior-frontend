import { useState } from 'react'
import { Download, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { InstallAppDialog, useInstallApp } from './install-app'

const DISMISSED_KEY = 'tff:install-banner-dismissed'

function wasDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISSED_KEY) === '1'
  } catch {
    return false
  }
}

/**
 * A slim "get the app" strip for signed-in teachers on their phone's browser.
 * Hidden inside the installed app, and for good once they close it (the
 * avatar menu still has "Download the app").
 */
export function InstallBanner({ className }: { className?: string }) {
  const { visible, start, dialogProps } = useInstallApp()
  const [dismissed, setDismissed] = useState(wasDismissed)

  if (!visible || dismissed) return null

  const dismiss = () => {
    setDismissed(true)
    try {
      localStorage.setItem(DISMISSED_KEY, '1')
    } catch {
      // Private browsing: it will just show again next visit.
    }
  }

  return (
    <aside
      aria-label="Get the app"
      className={cn(
        'flex items-center gap-3 border-b-2 border-border bg-secondary/40 px-4 py-2',
        className,
      )}
    >
      <span
        aria-hidden
        className="grid size-8 shrink-0 place-items-center rounded-md border-2 border-border bg-primary text-primary-foreground"
      >
        <Download className="size-4" strokeWidth={3} />
      </span>
      <p className="min-w-0 flex-1 text-sm leading-tight font-bold">
        Get the app for one-tap access
      </p>
      <Button
        onClick={start}
        className="h-9 shrink-0 rounded-lg border-2 border-border px-3 font-bold"
      >
        Install
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={dismiss}
        aria-label="Hide this"
        className="size-9 shrink-0 rounded-lg"
      >
        <X />
      </Button>
      <InstallAppDialog {...dialogProps} />
    </aside>
  )
}
