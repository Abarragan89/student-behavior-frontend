import type { AnyRouter } from '@tanstack/react-router'
import { isStandalone } from '#/lib/pwa-install'

/**
 * Fades out the installed app's launch screen (#splash in index.html) once the
 * first page has rendered, including any sign-in redirect. Gives up after
 * `maxWaitMs` so a slow or offline start never hides the app.
 */
export function hideSplashAfterFirstRender(
  router: AnyRouter,
  maxWaitMs = 6000,
) {
  const splash = document.getElementById('splash')
  if (!splash) return

  // On the website it's never shown (CSS), so just drop it.
  if (!isStandalone()) {
    splash.remove()
    return
  }

  let done = false
  const hide = () => {
    if (done) return
    done = true
    unsubscribe()
    clearTimeout(timer)
    splash.classList.add('is-hidden')
    // Matches the 0.2s fade in index.html.
    setTimeout(() => splash.remove(), 250)
  }

  const unsubscribe = router.subscribe('onRendered', hide)
  const timer = setTimeout(hide, maxWaitMs)
}
