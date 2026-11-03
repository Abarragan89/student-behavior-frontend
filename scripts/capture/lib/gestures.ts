// A finger on the phone: real touch events (via CDP) plus a dot drawn where
// the finger is, so viewers can follow along.
import type { Locator } from 'playwright'
import type { Phone } from './browser.ts'
import { PHONE, SAFE_BOTTOM } from './browser.ts'

export const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

const finger = (p: Phone, method: 'down' | 'move' | 'up', x = 0, y = 0) =>
  p.page.evaluate(([m, fx, fy]) => (window as any).__finger?.[m](fx, fy), [
    method,
    x,
    y,
  ] as const)

/** Where to touch a target: its middle, nudged a little so it looks human. */
async function point(target: Locator, nudge = true) {
  await target.waitFor({ state: 'visible' })
  // Wait for it to stop moving (drawers slide in).
  let box = await target.boundingBox()
  for (let i = 0; i < 20; i++) {
    await wait(50)
    const next = await target.boundingBox()
    if (
      box &&
      next &&
      Math.abs(next.x - box.x) < 0.5 &&
      Math.abs(next.y - box.y) < 0.5
    )
      break
    box = next
  }
  if (!box) throw new Error(`No box for ${target}`)
  const x = box.x + box.width / 2 + (nudge ? Math.min(6, box.width / 8) : 0)
  const y = box.y + box.height / 2 + (nudge ? Math.min(3, box.height / 8) : 0)
  if (y < 0 || y > PHONE.height - 4 || x < 0 || x > PHONE.width) {
    throw new Error(`${target} is off screen (scroll to it first)`)
  }
  return { x, y }
}

/** Taps like a finger: the dot appears, a short press, then it lifts. */
export async function tap(
  p: Phone,
  target: Locator,
  opts: { before?: number; after?: number } = {},
) {
  await wait(opts.before ?? 450)
  const { x, y } = await point(target)
  await finger(p, 'down', x, y)
  await wait(110)
  await p.cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x, y, radiusX: 8, radiusY: 8 }],
  })
  await wait(95)
  await p.cdp.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  })
  await finger(p, 'up')
  await wait(opts.after ?? 350)
}

const ease = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2

/**
 * Drags a finger from y0 to y1 (CSS px) at x, easing in and out, then holds
 * for a moment before lifting, so the page doesn't fling.
 */
export async function swipe(
  p: Phone,
  opts: { x?: number; from: number; to: number; ms?: number },
) {
  const x = opts.x ?? Math.round(PHONE.width * 0.62)
  const ms = opts.ms ?? 650
  const steps = Math.max(4, Math.round(ms / 16))
  await finger(p, 'down', x, opts.from)
  await wait(90)
  await p.cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x, y: opts.from }],
  })
  for (let i = 1; i <= steps; i++) {
    const y = opts.from + (opts.to - opts.from) * ease(i / steps)
    await Promise.all([
      p.cdp.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ x, y }],
      }),
      finger(p, 'move', x, y),
    ])
    await wait(14)
  }
  await wait(80)
  await p.cdp.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  })
  await finger(p, 'up')
}

/**
 * A quick flick: speeds up and lets go while still moving, so the page
 * coasts on with momentum like a real phone (about 2× the drag distance).
 */
export async function flick(
  p: Phone,
  opts: { x?: number; from: number; to: number; ms?: number },
) {
  const x = opts.x ?? Math.round(PHONE.width * 0.62)
  const steps = Math.max(4, Math.round((opts.ms ?? 210) / 16))
  await finger(p, 'down', x, opts.from)
  await wait(70)
  await p.cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x, y: opts.from }],
  })
  for (let i = 1; i <= steps; i++) {
    const k = i / steps
    const y = opts.from + (opts.to - opts.from) * k * k
    await Promise.all([
      p.cdp.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ x, y }],
      }),
      finger(p, 'move', x, y),
    ])
    await wait(14)
  }
  await p.cdp.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  })
  await finger(p, 'up')
}

/** Flicks until the page is at its bottom (dir 1) or top (dir -1). */
export async function flickToEnd(
  p: Phone,
  dir: 1 | -1,
  opts: { pause?: number; max?: number } = {},
) {
  const atEnd = () =>
    p.page.evaluate(
      (d) =>
        d > 0
          ? scrollY + innerHeight >= document.documentElement.scrollHeight - 4
          : scrollY <= 0,
      dir,
    )
  for (let i = 0; i < (opts.max ?? 10) && !(await atEnd()); i++) {
    if (dir > 0) await flick(p, { from: 600, to: 290 })
    else await flick(p, { from: 250, to: 620, ms: 190 })
    await wait(opts.pause ?? 520)
  }
}

/** Scrolls the page by about `distance` px with one or more swipes. */
export async function scrollBy(
  p: Phone,
  distance: number,
  opts: { ms?: number; pause?: number } = {},
) {
  const top = 170
  const bottom = PHONE.height - SAFE_BOTTOM - 110
  const span = bottom - top
  let left = Math.abs(distance)
  const dir = Math.sign(distance)
  // A drag shorter than this reads as a tap on whatever is under the finger.
  while (left >= 48) {
    const d = Math.min(left, span)
    if (dir > 0) await swipe(p, { from: top + d, to: top, ms: opts.ms })
    else await swipe(p, { from: top, to: top + d, ms: opts.ms })
    left -= d
    await wait(opts.pause ?? 380)
  }
}

/** Scrolls until a target is comfortably on screen. */
export async function scrollIntoView(p: Phone, target: Locator, margin = 160) {
  for (let i = 0; i < 8; i++) {
    const box = await target.boundingBox()
    if (!box) throw new Error(`No box for ${target}`)
    const bottomLimit = PHONE.height - SAFE_BOTTOM - margin
    if (box.y >= 90 && box.y + box.height <= bottomLimit) return
    const delta =
      box.y + box.height > bottomLimit
        ? box.y + box.height - bottomLimit
        : box.y - 120
    await scrollBy(p, delta)
  }
}

/** Types with small, uneven gaps between keys. */
export async function type(p: Phone, text: string) {
  for (const ch of text) {
    await p.page.keyboard.type(ch)
    await wait(35 + Math.round(Math.random() * 55) + (ch === ' ' ? 40 : 0))
  }
}
