import { useSyncExternalStore } from 'react'
import { toast } from 'sonner'

// Everything the "Download the app" button needs to know: can the browser
// install us in one tap, are we already running as the installed app, and
// which browser's steps to show otherwise.
//
// Imported first thing in main.tsx so the browser's install offer is caught
// even if it arrives before React has rendered anything.

/** Chrome/Edge/Samsung's install offer. Not in TypeScript's DOM types. */
export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed'
    platform: string
  }>
}

declare global {
  interface Window {
    /** Set by the inline script in index.html if the offer came early. */
    __tffInstallPrompt?: BeforeInstallPromptEvent | null
  }
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent
  }
  interface Navigator {
    /** iOS Safari: true inside a Home Screen app. */
    standalone?: boolean
  }
}

const STANDALONE_QUERY = '(display-mode: standalone)'

/** True when running as the installed app (opened from the home screen). */
export function isStandalone(): boolean {
  return (
    window.matchMedia(STANDALONE_QUERY).matches ||
    window.navigator.standalone === true
  )
}

// ---------- Store ----------

interface InstallState {
  /** The browser can show its own install popup right now. */
  canPrompt: boolean
  /** Installed during this visit (the tab stays open afterwards). */
  installed: boolean
  /** Running as the installed app. */
  standalone: boolean
}

let deferredPrompt: BeforeInstallPromptEvent | null =
  window.__tffInstallPrompt ?? null

let state: InstallState = {
  canPrompt: deferredPrompt !== null,
  installed: false,
  standalone: isStandalone(),
}

const listeners = new Set<() => void>()

function update(patch: Partial<InstallState>) {
  state = { ...state, ...patch }
  listeners.forEach((listener) => listener())
}

window.addEventListener('beforeinstallprompt', (event) => {
  // Stop Chrome's own mini-bar; our button shows the popup instead.
  event.preventDefault()
  deferredPrompt = event
  update({ canPrompt: true })
})

window.addEventListener('appinstalled', () => {
  deferredPrompt = null
  window.__tffInstallPrompt = null
  update({ canPrompt: false, installed: true })
  toast.success('TeachForFree is installed', {
    description: 'Open it from your home screen or app list.',
  })
})

// Desktop Chrome moves the page into the new app window after installing.
window
  .matchMedia(STANDALONE_QUERY)
  .addEventListener('change', () => update({ standalone: isStandalone() }))

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function usePwaInstall(): InstallState {
  return useSyncExternalStore(subscribe, () => state)
}

/**
 * Shows the browser's install popup. Call it straight from a click: browsers
 * only allow it in response to one. Each offer can be used once.
 */
export async function promptInstall(): Promise<
  'accepted' | 'dismissed' | 'unavailable'
> {
  const event = deferredPrompt
  if (!event) return 'unavailable'
  deferredPrompt = null
  window.__tffInstallPrompt = null
  update({ canPrompt: false })
  try {
    await event.prompt()
    const { outcome } = await event.userChoice
    return outcome
  } catch {
    return 'unavailable'
  }
}

// ---------- Which browser are we in? ----------

export type Platform =
  | 'ios-safari'
  | 'ios-chrome'
  /** Edge, Firefox and other iOS browsers. */
  | 'ios-other'
  /** Instagram, Facebook, TikTok… Their built-in browsers can't install. */
  | 'ios-in-app'
  | 'android-chrome'
  | 'android-samsung'
  | 'android-firefox'
  | 'android-other'
  | 'android-in-app'
  | 'desktop-chrome'
  | 'desktop-edge'
  | 'desktop-safari'
  /** Firefox and anything else that can't install web apps. */
  | 'desktop-other'

export const PLATFORMS: Platform[] = [
  'ios-safari',
  'ios-chrome',
  'ios-other',
  'ios-in-app',
  'android-chrome',
  'android-samsung',
  'android-firefox',
  'android-other',
  'android-in-app',
  'desktop-chrome',
  'desktop-edge',
  'desktop-safari',
  'desktop-other',
]

export interface PlatformInfo {
  platform: Platform
  /** For in-app browsers, e.g. "Instagram". */
  appName?: string
}

const IN_APP_BROWSERS: [RegExp, string][] = [
  [/Instagram/, 'Instagram'],
  [/FBAN|FBAV|FB_IAB|FBIOS|FB4A/, 'Facebook'],
  [/LinkedInApp/, 'LinkedIn'],
  [/musical_ly|BytedanceWebview|TikTok/, 'TikTok'],
  [/Snapchat/, 'Snapchat'],
  [/\bLine\//, 'LINE'],
  [/MicroMessenger/, 'WeChat'],
  [/Pinterest/, 'Pinterest'],
  [/GSA\//, 'the Google app'],
]

export function detectPlatform(
  ua: string,
  maxTouchPoints: number,
): PlatformInfo {
  // iPads ask for the desktop site, so they look like a Mac with a touchscreen.
  const ios =
    /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && maxTouchPoints > 1)
  const android = /Android/.test(ua)

  const inApp = IN_APP_BROWSERS.find(([pattern]) => pattern.test(ua))
  if (inApp && (ios || android)) {
    return {
      platform: ios ? 'ios-in-app' : 'android-in-app',
      appName: inApp[1],
    }
  }

  if (ios) {
    if (/CriOS/.test(ua)) return { platform: 'ios-chrome' }
    if (/EdgiOS|FxiOS|OPiOS/.test(ua)) return { platform: 'ios-other' }
    // Every real iOS browser says "Safari/"; app web views usually don't.
    if (!/Safari\//.test(ua)) return { platform: 'ios-in-app' }
    return { platform: 'ios-safari' }
  }

  if (android) {
    if (/; wv\)/.test(ua)) return { platform: 'android-in-app' }
    if (/SamsungBrowser/.test(ua)) return { platform: 'android-samsung' }
    if (/Firefox/.test(ua)) return { platform: 'android-firefox' }
    if (/EdgA|OPR|YaBrowser|UCBrowser/.test(ua))
      return { platform: 'android-other' }
    return { platform: 'android-chrome' }
  }

  if (/Edg\//.test(ua)) return { platform: 'desktop-edge' }
  if (/Firefox\//.test(ua)) return { platform: 'desktop-other' }
  if (/Chrome\//.test(ua)) return { platform: 'desktop-chrome' }
  if (/Safari\//.test(ua)) return { platform: 'desktop-safari' }
  return { platform: 'desktop-other' }
}

/**
 * The current browser's platform. In development, `?pwa-platform=ios-safari`
 * (any Platform value) previews another browser's steps.
 */
export function getPlatform(): PlatformInfo {
  if (import.meta.env.DEV) {
    const override = new URLSearchParams(window.location.search).get(
      'pwa-platform',
    )
    if (PLATFORMS.includes(override as Platform)) {
      return { platform: override as Platform, appName: 'Instagram' }
    }
  }
  return detectPlatform(navigator.userAgent, navigator.maxTouchPoints)
}

export function isDesktopPlatform(platform: Platform): boolean {
  return platform.startsWith('desktop')
}
