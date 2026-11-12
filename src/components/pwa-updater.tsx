import { useEffect } from 'react'
import { useRouter } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { safeToReload } from '#/lib/app-update'

const HOUR = 60 * 60 * 1000

/**
 * Registers the service worker, and when a new version of the app has been
 * deployed, moves to it at a safe moment instead of reloading mid-note: the
 * next time the teacher opens another page (the one they left is closed by
 * then, so nothing typed is lost), unless marks or saves are still on their
 * way. Until then a Refresh button offers it, for a teacher who stays on one
 * page. A page this version doesn't have switches right away (NotFound in
 * __root.tsx).
 */
export function PwaUpdater() {
  const router = useRouter()
  const queryClient = useQueryClient()
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
    // The new version takes over, then the page reloads.
    return router.subscribe('onRendered', (event) => {
      if (event.pathChanged && safeToReload(queryClient.isMutating()))
        void updateServiceWorker()
    })
  }, [needRefresh, updateServiceWorker, router, queryClient])

  return null
}
