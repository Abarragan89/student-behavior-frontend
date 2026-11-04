// Push reminders, inside the app's service worker. vite.config.ts adds this
// file to the generated worker (workbox importScripts), so it runs as plain
// JavaScript: no imports, no build step.
//
// The server (internal/push in the Go backend) sends each reminder as
// Declarative Web Push JSON: { web_push: 8030, notification: { title, body,
// navigate, tag, lang } }. Newer Safari shows that by itself; everywhere else
// it lands here.

/* global self, clients */

// Teacher pages: a tap is shown in one of these windows if one is open.
// The link pages (/sub, /conference, /invite) and the marketing site never
// are. Keep in step with shared/app-routes.ts.
const APP_PAGES = [
  'classes',
  'marks',
  'account',
  'lesson-plans',
  'students',
  'conferences',
  'login',
]

self.addEventListener('push', (event) => {
  let notification = {}
  try {
    notification = event.data?.json()?.notification ?? {}
  } catch {
    // Not JSON: still show something. A push that shows nothing makes
    // Safari stop delivering them.
  }
  const title =
    typeof notification.title === 'string' && notification.title
      ? notification.title
      : 'TeachForFree'
  event.waitUntil(
    self.registration.showNotification(title, {
      body: typeof notification.body === 'string' ? notification.body : '',
      lang: notification.lang || 'en',
      // One per subject: a newer reminder for it replaces the old one, and
      // still buzzes (renotify).
      tag: notification.tag || 'reminder',
      renotify: Boolean(notification.tag),
      icon: '/branding/pwa-192x192.png',
      // Android's status bar wants a one-colour shape.
      badge: '/branding/badge-96x96.png',
      data: { url: notification.navigate || '/lesson-plans' },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  // Android leaves it in the shade otherwise.
  event.notification.close()
  const target = new URL(
    event.notification.data?.url || '/lesson-plans',
    self.location.origin,
  )
  // Only ever open this app's own pages.
  const url =
    target.origin === self.location.origin
      ? target.href
      : new URL('/lesson-plans', self.location.origin).href

  event.waitUntil(
    (async () => {
      const windows = await clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      })
      const appWindows = windows.filter((w) => isAppPage(w.url))
      const open =
        appWindows.find((w) => w.focused) ??
        appWindows.find((w) => w.visibilityState === 'visible') ??
        appWindows[0]
      if (open) {
        // The app switches to the teacher's own classroom and opens the
        // page itself (src/lib/notifications.ts), without a reload, which
        // would lose marks not sent yet and anything being typed.
        await open.focus()
        open.postMessage({ type: 'tff:open-reminder', url })
        return
      }
      await clients.openWindow(url)
    })(),
  )
})

function isAppPage(href) {
  const url = new URL(href)
  if (url.origin !== self.location.origin) return false
  const first = url.pathname.split('/')[1] ?? ''
  return APP_PAGES.includes(first)
}
