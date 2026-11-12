// Moving to a newer version of the app. The service worker opens the version
// this device saved, even online (for offline use), and a newer one waits
// until it's safe to switch: see src/components/pwa-updater.tsx, and the
// self-repair script in app.html.

/**
 * Nothing would be lost by reloading now: online, and no marks or saves on
 * their way (on the website, unsent marks live only in the page).
 */
export function safeToReload(pendingSaves: number) {
  return navigator.onLine && pendingSaves === 0
}

/**
 * For a page this version may not have yet ("Page not found"): if the server
 * has a newer version, installs it, puts it in charge and reloads the page.
 * onFound runs once a newer version turns up. Resolves false, having done
 * nothing, offline, on a page straight from the server (no saved copy), when
 * this is the newest version, or when canReload says no.
 */
export async function switchToNewerVersion({
  onFound,
  canReload,
}: {
  onFound: () => void
  canReload: () => boolean
}) {
  const sw = 'serviceWorker' in navigator ? navigator.serviceWorker : null
  if (!sw?.controller || !navigator.onLine) return false
  const reg = await sw.getRegistration()
  if (!reg) return false
  try {
    await reg.update()
  } catch {
    return false
  }
  const next = reg.installing ?? reg.waiting
  if (!next || !canReload()) return false
  onFound()
  await installed(next)
  if (next.state !== 'installed' || !canReload()) return false
  sw.addEventListener('controllerchange', () => window.location.reload(), {
    once: true,
  })
  // vite-plugin-pwa's worker takes over on this message.
  next.postMessage({ type: 'SKIP_WAITING' })
  return true
}

/** Resolves once the worker is done installing: ready, or failed. */
function installed(worker: ServiceWorker) {
  return new Promise<void>((done) => {
    const check = () => {
      if (worker.state !== 'installing') done()
    }
    worker.addEventListener('statechange', check)
    check()
  })
}
