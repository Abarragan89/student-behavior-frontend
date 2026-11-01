import { Suspense, lazy, useState } from 'react'
import type { ComponentProps } from 'react'
import { Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  getPlatform,
  isDesktopPlatform,
  promptInstall,
  usePwaInstall,
} from '#/lib/pwa-install'
import type { InstallAppDialogProps } from './install-app-dialog'

const LazyInstallAppDialog = lazy(() => import('./install-app-dialog'))

/**
 * State for a "Download the app" button and its instructions dialog.
 *
 * - Phones whose browser can install in one tap (Chrome, Edge, Samsung) get
 *   the browser's own popup.
 * - Everyone else gets step-by-step instructions for their browser.
 * - Computers always get the dialog, since its QR code (to install on a
 *   phone) is the main point there.
 */
export function useInstallApp() {
  const { canPrompt, installed, standalone } = usePwaInstall()
  const [open, setOpen] = useState(false)
  const [info] = useState(getPlatform)

  const start = async () => {
    if (canPrompt && !isDesktopPlatform(info.platform)) {
      const outcome = await promptInstall()
      if (outcome !== 'unavailable') return
    }
    setOpen(true)
  }

  return {
    /** False inside the installed app, or right after installing. */
    visible: !standalone && !installed,
    start,
    dialogProps: { open, onOpenChange: setOpen, info },
  }
}

/** Loads the dialog's code the first time it opens, then keeps it mounted. */
export function InstallAppDialog(props: InstallAppDialogProps) {
  const [loaded, setLoaded] = useState(props.open)
  if (props.open && !loaded) setLoaded(true)
  if (!loaded) return null

  return (
    <Suspense fallback={null}>
      <LazyInstallAppDialog {...props} />
    </Suspense>
  )
}

/**
 * "Download the app" button with its own dialog. Renders nothing inside the
 * installed app.
 *
 * `compact` shortens the label on narrow phones ("Get app", then icon only),
 * for tight spots like the landing page's top bar.
 */
export function InstallAppButton({
  compact = false,
  className,
  ...props
}: Omit<ComponentProps<typeof Button>, 'onClick' | 'children'> & {
  compact?: boolean
}) {
  const { visible, start, dialogProps } = useInstallApp()
  if (!visible) return null

  return (
    <>
      <Button
        onClick={start}
        aria-label={compact ? 'Download the app' : undefined}
        className={cn('font-bold', className)}
        {...props}
      >
        <Download />
        {compact ? (
          <>
            <span className="hidden sm:inline">Download the app</span>
            <span className="hidden min-[400px]:inline sm:hidden">Get app</span>
          </>
        ) : (
          'Download the app'
        )}
      </Button>
      <InstallAppDialog {...dialogProps} />
    </>
  )
}
