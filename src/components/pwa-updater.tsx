import { useEffect } from 'react'
import { toast } from 'sonner'
import { useRegisterSW } from 'virtual:pwa-register/react'

const HOUR = 60 * 60 * 1000

/**
 * Registers the service worker, and when a new version of the app has been
 * deployed, offers a Refresh button instead of reloading on its own, so a
 * teacher in the middle of a note doesn't lose it.
 */
export function PwaUpdater() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (!registration) return
      const check = () => {
        if (navigator.onLine) void registration.update()
      }
      // Installed apps can stay open for days, so look for updates when the
      // app comes back to the front, and hourly while it's open.
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') check()
      })
      setInterval(check, HOUR)
    },
  })

  useEffect(() => {
    if (!needRefresh) return
    toast('A new version of TeachForFree is ready', {
      id: 'pwa-update',
      duration: Infinity,
      action: { label: 'Refresh', onClick: () => void updateServiceWorker() },
    })
  }, [needRefresh, updateServiceWorker])

  return null
}
