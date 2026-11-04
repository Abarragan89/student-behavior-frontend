// Browsers for the captures: a phone (393×793 CSS px, drawn at 2×), a
// paper-width desktop for print layouts, and a laptop for the user guide.
import { chromium } from 'playwright'
import type { Browser, BrowserContext, CDPSession, Page } from 'playwright'
import { API_URL } from './env.ts'
import type { DemoClock } from './env.ts'
import { zonedInstant } from './env.ts'

export const PHONE = { width: 393, height: 793 }
/** The status bar the site's phone frame draws above the recording. */
export const STATUS_BAR = 59
/** iPhone home indicator area; the app pads its bottom bar by this. */
export const SAFE_BOTTOM = 34

export async function launchPhoneBrowser(headed = false) {
  // Headless Chrome records at CSS-pixel size unless the whole browser is
  // forced to 2×. (A 2× device emulation alone doesn't change the recording.)
  return chromium.launch({
    headless: !headed,
    args: ['--force-device-scale-factor=2'],
  })
}

export async function launchPaperBrowser() {
  return chromium.launch({ headless: true })
}

export type Phone = { context: BrowserContext; page: Page; cdp: CDPSession }

export async function phone(
  browser: Browser,
  clock: DemoClock,
  opts: { token?: string; demoTime?: boolean } = {},
): Promise<Phone> {
  const context = await browser.newContext({
    viewport: PHONE,
    screen: { width: PHONE.width, height: PHONE.height + STATUS_BAR },
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
    locale: 'en-US',
    timezoneId: clock.timeZone,
    colorScheme: 'light',
    reducedMotion: 'no-preference',
    serviceWorkers: 'block',
  })
  if (opts.token) {
    await context.addCookies([
      {
        name: 'access_token',
        value: opts.token,
        url: API_URL,
        httpOnly: true,
        sameSite: 'Lax',
        secure: false,
      },
    ])
  }
  const demoStart =
    opts.demoTime === false
      ? null
      : zonedInstant(clock.timeZone, clock.today, clock.demoMinutes).getTime()
  await context.addInitScript(pageSetup, { demoStart })
  const page = await context.newPage()
  const cdp = await context.newCDPSession(page)
  await cdp.send('Emulation.setSafeAreaInsetsOverride', {
    insets: {
      top: 0,
      topMax: 0,
      left: 0,
      leftMax: 0,
      right: 0,
      rightMax: 0,
      bottom: SAFE_BOTTOM,
      bottomMax: SAFE_BOTTOM,
    },
  })
  page.on('pageerror', (e) => console.warn('  page error:', e.message))
  return { context, page, cdp }
}

/**
 * Runs in the page before its own scripts:
 * - hides the install banner and the presenter's Full screen button
 * - makes Print a no-op, so print-only content stays on the page
 * - shifts the clock to 10:15 (Date only: timers and animations stay real)
 * - adds the finger dot that the capture moves around
 */
function pageSetup({ demoStart }: { demoStart: number | null }) {
  try {
    localStorage.setItem('tff:install-banner-dismissed', '1')
  } catch {
    // storage blocked: the banner just shows
  }
  Object.defineProperty(Document.prototype, 'fullscreenEnabled', {
    get: () => false,
  })
  window.print = () => {}

  if (demoStart !== null) {
    // The offset is fixed when a take starts (see resetDemoClock), and kept
    // in sessionStorage so it survives navigations within the tab.
    const KEY = 'tff-capture:clock-offset'
    const RealDate = Date
    let offset = demoStart - RealDate.now()
    try {
      const saved = sessionStorage.getItem(KEY)
      if (saved) offset = Number(saved)
      else sessionStorage.setItem(KEY, String(offset))
    } catch {
      // about:blank has no storage
    }
    const now = () => RealDate.now() + offset
    globalThis.Date = new Proxy(RealDate, {
      construct: (target, args, newTarget) =>
        Reflect.construct(target, args.length ? args : [now()], newTarget),
      apply: () => new RealDate(now()).toString(),
      get: (target, key) => (key === 'now' ? now : Reflect.get(target, key)),
    })
  }

  const install = () => {
    if (document.getElementById('tff-finger')) return
    const dot = document.createElement('div')
    dot.id = 'tff-finger'
    dot.style.cssText = [
      'position:fixed',
      'left:0',
      'top:0',
      'width:46px',
      'height:46px',
      'margin:-23px 0 0 -23px',
      'border-radius:50%',
      'background:rgba(24,24,27,.34)',
      'border:2px solid rgba(255,255,255,.95)',
      'box-shadow:0 0 0 1px rgba(0,0,0,.25),0 4px 14px rgba(0,0,0,.18)',
      'pointer-events:none',
      'z-index:2147483647',
      'opacity:0',
      'transform:translate(-100px,-100px)',
    ].join(';')
    document.documentElement.append(dot)
    let x = -100
    let y = -100
    const place = (scale: number) =>
      (dot.style.transform = `translate(${x}px,${y}px) scale(${scale})`)
    ;(window as any).__finger = {
      down(nx: number, ny: number) {
        x = nx
        y = ny
        dot.getAnimations().forEach((a) => a.cancel())
        place(1)
        dot.animate(
          [
            { opacity: 0, transform: `translate(${x}px,${y}px) scale(1.35)` },
            { opacity: 1, transform: `translate(${x}px,${y}px) scale(1)` },
          ],
          { duration: 140, easing: 'ease-out', fill: 'forwards' },
        )
      },
      move(nx: number, ny: number) {
        x = nx
        y = ny
        dot.getAnimations().forEach((a) => a.finish())
        dot.style.opacity = '1'
        place(1)
      },
      up() {
        dot.animate(
          [
            { opacity: 1, transform: `translate(${x}px,${y}px) scale(1)` },
            { opacity: 0, transform: `translate(${x}px,${y}px) scale(1.25)` },
          ],
          { duration: 260, easing: 'ease-in', fill: 'forwards' },
        )
      },
    }
  }
  if (document.documentElement) install()
  else document.addEventListener('DOMContentLoaded', install)
}

/** Restarts the page's clock at 10:15 for the next navigation. */
export async function resetDemoClock(p: Phone) {
  await p.page.evaluate(() =>
    sessionStorage.removeItem('tff-capture:clock-offset'),
  )
}

/** A Letter-width desktop page for print layouts. */
export async function paper(
  browser: Browser,
  clock: DemoClock,
  token?: string,
) {
  return mousePage(browser, clock, {
    viewport: { width: 725, height: 1000 },
    token,
  })
}

/** A laptop screen, wide enough for the app's top bar (md, 768px+). */
export const DESKTOP = { width: 1120, height: 760 }

/** A laptop-sized page at 2×, for the user guide's screenshots. */
export async function desktop(
  browser: Browser,
  clock: DemoClock,
  opts: { token?: string; demoTime?: boolean } = {},
) {
  return mousePage(browser, clock, { viewport: DESKTOP, ...opts })
}

/** A non-touch page at 2×, signed in when given a token. */
async function mousePage(
  browser: Browser,
  clock: DemoClock,
  opts: {
    viewport: { width: number; height: number }
    token?: string
    demoTime?: boolean
  },
) {
  const context = await browser.newContext({
    viewport: opts.viewport,
    deviceScaleFactor: 2,
    locale: 'en-US',
    timezoneId: clock.timeZone,
    colorScheme: 'light',
    serviceWorkers: 'block',
  })
  if (opts.token) {
    await context.addCookies([
      {
        name: 'access_token',
        value: opts.token,
        url: API_URL,
        httpOnly: true,
        sameSite: 'Lax',
        secure: false,
      },
    ])
  }
  const demoStart =
    opts.demoTime === false
      ? null
      : zonedInstant(clock.timeZone, clock.today, clock.demoMinutes).getTime()
  await context.addInitScript(pageSetup, { demoStart })
  const page = await context.newPage()
  page.on('pageerror', (e) => console.warn('  page error:', e.message))
  return { context, page }
}

/** Fails fast if a scene ended up signed out. */
export function assertSignedIn(page: Page) {
  if (new URL(page.url()).pathname.startsWith('/login')) {
    throw new Error('The demo session was rejected (landed on /login)')
  }
}
