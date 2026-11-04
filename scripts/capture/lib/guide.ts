// The teacher guide (scenes/guide.ts): screenshots of the real app with
// numbered arrows, laid out as Letter pages and printed to a PDF.
//
// shoot() takes a screenshot and remembers where each callout's target was.
// The arrows are drawn afterwards as SVG over the image, so they stay sharp
// in the PDF and always point at the real button.
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import type { Browser, Locator, Page } from 'playwright'
import { CAPTURE_DIR, OUT, REPO } from './env.ts'
import { wait } from './gestures.ts'

export const GUIDE_DIR = OUT + 'guide/'
const IMG_DIR = GUIDE_DIR + 'img/'

/** Clears the last run's pictures. */
export function resetGuideDir() {
  rmSync(GUIDE_DIR, { recursive: true, force: true })
  mkdirSync(IMG_DIR, { recursive: true })
}

// ---------- Taking the screenshots ----------

/** Where a callout's number sits, relative to its target. */
export type Side =
  | 'left'
  | 'right'
  | 'top'
  | 'bottom'
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right'

export type Callout = {
  target: Locator
  /** Which side of the target the number sits on. Default: right. */
  from?: Side
  /** How far out the number sits, in px on the printed page. */
  reach?: number
  /** Space around the target inside its outline, in px on the page. */
  pad?: number
}

type Rect = { x: number; y: number; width: number; height: number }

export type Mark = Rect & {
  n: number
  from: Side
  reach: number
  pad: number
}

export type Shot = {
  /** The image, relative to the guide's HTML. */
  src: string
  /** Size in CSS px (the image itself is 2×). */
  width: number
  height: number
  /** The page's path, for the browser frame's address bar. */
  path: string
  marks: Array<Mark>
}

/** A target's box once it stops moving (dialogs and menus animate in). */
async function stableBox(target: Locator) {
  await target.waitFor({ state: 'visible', timeout: 15_000 })
  let box = await target.boundingBox()
  for (let i = 0; i < 30; i++) {
    await wait(50)
    const next = await target.boundingBox()
    if (
      box &&
      next &&
      Math.abs(next.x - box.x) < 0.5 &&
      Math.abs(next.y - box.y) < 0.5 &&
      Math.abs(next.width - box.width) < 0.5 &&
      Math.abs(next.height - box.height) < 0.5
    )
      return next
    box = next
  }
  if (!box) throw new Error(`No box for ${target}`)
  return box
}

/**
 * Screenshots the screen (or one element of it) and records where each
 * callout's target is. Fails if a target isn't inside the picture, so an
 * arrow never points at nothing.
 */
export async function shoot(
  page: Page,
  name: string,
  callouts: Array<Callout>,
  opts: {
    /** Crop to this element, plus `margin` px around it. */
    clip?: Locator
    /** Crop to the smallest area holding all of these, plus `margin`. */
    around?: Array<Locator>
    /** Space kept around the crop: all sides, or [top, right, bottom, left]. */
    margin?: number | [number, number, number, number]
    /** Crop to this area of the screen instead (CSS px). */
    area?: Rect
    /** Cut the picture off at this height (long printouts). */
    maxHeight?: number
    /** The first callout's number, to carry on a page's steps. */
    first?: number
    /** Show the page as printed (print-only layouts). */
    print?: boolean
    /** Address bar text; defaults to the page's path. */
    path?: string
  } = {},
): Promise<Shot> {
  if (opts.print) await page.emulateMedia({ media: 'print' })
  await page.evaluate(() => document.fonts.ready)
  await wait(500)
  const view = page.viewportSize()!
  let area: Rect = opts.area ?? { x: 0, y: 0, ...view }
  const crop = opts.clip ? [opts.clip] : opts.around
  if (crop) {
    // Off screen (like a printout's later pages)? Bring it to the top.
    const first = await stableBox(crop[0])
    if (first.y < 0 || first.y + first.height > view.height) {
      await crop[0].evaluate((el) => el.scrollIntoView({ block: 'start' }))
      await wait(300)
    }
    const m = opts.margin ?? 12
    const [mt, mr, mb, ml] = typeof m === 'number' ? [m, m, m, m] : m
    const boxes = []
    for (const l of crop) boxes.push(await stableBox(l))
    const left = Math.min(...boxes.map((b) => b.x))
    const top = Math.min(...boxes.map((b) => b.y))
    const b = {
      x: left,
      y: top,
      width: Math.max(...boxes.map((b) => b.x + b.width)) - left,
      height: Math.max(...boxes.map((b) => b.y + b.height)) - top,
    }
    const x = Math.max(0, Math.floor(b.x - ml))
    const y = Math.max(0, Math.floor(b.y - mt))
    area = {
      x,
      y,
      width: Math.min(view.width, Math.ceil(b.x + b.width + mr)) - x,
      height: Math.min(view.height, Math.ceil(b.y + b.height + mb)) - y,
    }
  }
  if (opts.maxHeight) area.height = Math.min(area.height, opts.maxHeight)

  const marks: Array<Mark> = []
  for (const [i, c] of callouts.entries()) {
    const n = (opts.first ?? 1) + i
    const b = await stableBox(c.target)
    const rel = {
      x: b.x - area.x,
      y: b.y - area.y,
      width: b.width,
      height: b.height,
    }
    const slack = 2
    if (
      rel.x < -slack ||
      rel.y < -slack ||
      rel.x + rel.width > area.width + slack ||
      rel.y + rel.height > area.height + slack
    ) {
      const r = (o: Rect) =>
        `${Math.round(o.x)},${Math.round(o.y)} ${Math.round(o.width)}×${Math.round(o.height)}`
      throw new Error(
        `${name}: callout ${n} (${c.target}) is at ${r(b)}, outside the picture (${r(area)})`,
      )
    }
    marks.push({
      ...rel,
      n,
      from: c.from ?? 'right',
      reach: c.reach ?? 34,
      pad: c.pad ?? 4,
    })
  }
  await page.screenshot({
    path: `${IMG_DIR}${name}.png`,
    clip: area,
    animations: 'disabled',
    caret: 'hide',
  })
  if (opts.print) await page.emulateMedia({ media: 'screen' })
  return {
    src: `img/${name}.png`,
    width: area.width,
    height: area.height,
    path: opts.path ?? new URL(page.url()).pathname,
    marks,
  }
}

// ---------- Drawing the callouts ----------

type Pt = { x: number; y: number }

/** Where a ray from `from` toward the rect's middle crosses its edge. */
function edgePoint(r: Rect, from: Pt): Pt {
  const c = { x: r.x + r.width / 2, y: r.y + r.height / 2 }
  const dx = c.x - from.x
  const dy = c.y - from.y
  // Distance along the ray (0 = from, 1 = middle) to each side it crosses.
  const ts: Array<number> = []
  if (dx) ts.push((r.x - from.x) / dx, (r.x + r.width - from.x) / dx)
  if (dy) ts.push((r.y - from.y) / dy, (r.y + r.height - from.y) / dy)
  const inside = (p: Pt) =>
    p.x >= r.x - 0.01 &&
    p.x <= r.x + r.width + 0.01 &&
    p.y >= r.y - 0.01 &&
    p.y <= r.y + r.height + 0.01
  let best = 1
  for (const t of ts) {
    if (t < 0 || t > 1) continue
    if (inside({ x: from.x + dx * t, y: from.y + dy * t }))
      best = Math.min(best, t)
  }
  return { x: from.x + dx * best, y: from.y + dy * best }
}

const DIAG = Math.SQRT1_2
const SIDES: Array<Side> = [
  'right',
  'left',
  'bottom',
  'top',
  'bottom-right',
  'bottom-left',
  'top-right',
  'top-left',
]
const OPPOSITE: Record<Side, Side> = {
  left: 'right',
  right: 'left',
  top: 'bottom',
  bottom: 'top',
  'top-left': 'bottom-right',
  'top-right': 'bottom-left',
  'bottom-left': 'top-right',
  'bottom-right': 'top-left',
}

/**
 * The SVG drawn over a screenshot shown `shownWidth` px wide. Numbers may
 * sit up to `gutter` px outside the picture, in the page's margin.
 */
function overlay(shot: Shot, shownWidth: number, dim: boolean, gutter: number) {
  // Sizes below are in px on the printed page; k turns them into image px.
  const k = shot.width / shownWidth
  const out = gutter * k
  const R = 11.5 * k
  const W = shot.width
  const H = shot.height
  const back: Array<string> = []
  const front: Array<string> = []
  const holes: Array<string> = []

  for (const m of shot.marks) {
    const p = m.pad * k
    const box = {
      x: m.x - p,
      y: m.y - p,
      width: m.width + 2 * p,
      height: m.height + 2 * p,
    }
    const rx = Math.min(7 * k, box.height / 2, box.width / 2)
    const rect = `x="${f(box.x)}" y="${f(box.y)}" width="${f(box.width)}" height="${f(box.height)}" rx="${f(rx)}"`
    holes.push(`<rect ${rect} fill="#000"/>`)
    back.push(`<rect ${rect} class="co-halo" stroke-width="${f(6.5 * k)}"/>`)
    front.push(`<rect ${rect} class="co-line" stroke-width="${f(2.6 * k)}"/>`)

    // The number's spot, pushed back inside the picture if needed.
    const reach = m.reach * k
    const cx = box.x + box.width / 2
    const cy = box.y + box.height / 2
    const left = box.x - reach
    const right = box.x + box.width + reach
    const top = box.y - reach
    const bottom = box.y + box.height + reach
    const spot: Record<Side, Pt> = {
      left: { x: left, y: cy },
      right: { x: right, y: cy },
      top: { x: cx, y: top },
      bottom: { x: cx, y: bottom },
      'top-left': { x: box.x - reach * DIAG, y: box.y - reach * DIAG },
      'top-right': {
        x: box.x + box.width + reach * DIAG,
        y: box.y - reach * DIAG,
      },
      'bottom-left': {
        x: box.x - reach * DIAG,
        y: box.y + box.height + reach * DIAG,
      },
      'bottom-right': {
        x: box.x + box.width + reach * DIAG,
        y: box.y + box.height + reach * DIAG,
      },
    }
    // Near the edge the number gets pushed back in. If that puts it on its
    // own target, try the other sides.
    const edge = R + 3 * k - out
    const place = (side: Side) => ({
      x: clamp(spot[side].x, edge, W - edge),
      y: clamp(spot[side].y, edge, H - edge),
    })
    const clear = (p: Pt) => {
      const dx = Math.max(box.x - p.x, 0, p.x - (box.x + box.width))
      const dy = Math.max(box.y - p.y, 0, p.y - (box.y + box.height))
      return Math.hypot(dx, dy) >= R + 6 * k
    }
    const side =
      [m.from, OPPOSITE[m.from], ...SIDES].find((s) => clear(place(s))) ??
      m.from
    const b = place(side)

    // The arrow: a gentle curve from the number to the outline.
    const end = edgePoint(box, b)
    const dx = end.x - b.x
    const dy = end.y - b.y
    const len = Math.hypot(dx, dy)
    if (len > R + 14 * k) {
      const ux = dx / len
      const uy = dy / len
      const start = { x: b.x + ux * (R + 2 * k), y: b.y + uy * (R + 2 * k) }
      const bend = Math.min(0.16 * len, 18 * k)
      const ctrl = {
        x: (start.x + end.x) / 2 - uy * bend,
        y: (start.y + end.y) / 2 + ux * bend,
      }
      // Arrowhead along the curve's last stretch.
      const tx = end.x - ctrl.x
      const ty = end.y - ctrl.y
      const tl = Math.hypot(tx, ty) || 1
      const t = { x: tx / tl, y: ty / tl }
      const n = { x: -t.y, y: t.x }
      const hl = 9.5 * k
      const hw = 5.5 * k
      const base = { x: end.x - t.x * hl, y: end.y - t.y * hl }
      const lineEnd = { x: end.x - t.x * hl * 0.7, y: end.y - t.y * hl * 0.7 }
      const d = `M${f(start.x)} ${f(start.y)} Q${f(ctrl.x)} ${f(ctrl.y)} ${f(lineEnd.x)} ${f(lineEnd.y)}`
      const head = `${f(end.x)},${f(end.y)} ${f(base.x + n.x * hw)},${f(base.y + n.y * hw)} ${f(base.x - n.x * hw)},${f(base.y - n.y * hw)}`
      back.push(`<path d="${d}" class="co-halo" stroke-width="${f(7 * k)}"/>`)
      back.push(
        `<polygon points="${head}" class="co-halo" stroke-width="${f(4 * k)}" stroke-linejoin="round"/>`,
      )
      front.push(
        `<path d="${d}" class="co-line" stroke-width="${f(2.8 * k)}"/>`,
      )
      front.push(`<polygon points="${head}" class="co-head"/>`)
    }
    front.push(
      `<circle cx="${f(b.x)}" cy="${f(b.y)}" r="${f(R)}" class="co-badge" stroke-width="${f(2.4 * k)}"/>`,
      `<text x="${f(b.x)}" y="${f(b.y)}" class="co-num" font-size="${f(13 * k)}">${m.n}</text>`,
    )
  }

  const shade = dim
    ? `<defs><mask id="m${maskId}"><rect width="${W}" height="${H}" fill="#fff"/>${holes.join('')}</mask></defs>` +
      `<rect width="${W}" height="${H}" class="co-dim" mask="url(#m${maskId++})"/>`
    : ''
  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">${shade}${back.join('')}${front.join('')}</svg>`
}

let maskId = 0
const f = (n: number) => String(Math.round(n * 10) / 10)
const clamp = (n: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, n))

// ---------- Page parts (HTML strings) ----------

export type Frame = 'browser' | 'plain' | 'phone' | 'paper'

/** Where the picture sits inside its frame (borders, address bar). */
const FRAME_INSET: Record<Frame, { x: number; top: number }> = {
  browser: { x: 2, top: 29 },
  plain: { x: 2, top: 2 },
  phone: { x: 10, top: 10 },
  paper: { x: 1, top: 1 },
}

/** A screenshot in a frame, with its callouts drawn on top. */
export function figure(
  shot: Shot,
  opts: {
    /** Width on the page, in px (the page's text column is 704). */
    width: number
    frame?: Frame
    /** Darken everything but the callouts' targets. */
    dim?: boolean
    /**
     * Blank space kept around the frame (inside `width`) where numbers can
     * sit without covering the picture. Default: 24, or 0 for browser frames.
     */
    gutter?: number
    caption?: string
  },
) {
  const frame = opts.frame ?? 'browser'
  const gutter = opts.gutter ?? (frame === 'browser' ? 0 : 24)
  const inset = FRAME_INSET[frame]
  const shown = opts.width - 2 * gutter - 2 * inset.x
  const shownHeight = (shown * shot.height) / shot.width
  const bar =
    frame === 'browser'
      ? `<div class="bar"><i></i><i></i><i></i><span class="url">teachforfree.com${esc(shot.path)}</span></div>`
      : ''
  const place = `left:${gutter + inset.x}px;top:${gutter + inset.top}px;width:${f(shown)}px;height:${f(shownHeight)}px`
  return `<figure class="fig" style="width:${opts.width}px;padding:${gutter}px">
  <div class="frame frame-${frame}">${bar}<div class="shot">
    <img src="${shot.src}" width="${shot.width}" height="${shot.height}" alt="">
  </div></div>
  <div class="overlay" style="${place}">${overlay(shot, shown, opts.dim ?? false, gutter)}</div>
  ${opts.caption ? `<figcaption>${opts.caption}</figcaption>` : ''}
</figure>`
}

/** Numbered steps, matching the callouts' numbers. */
export function steps(items: Array<string>, first = 1) {
  return `<ol class="steps">${items
    .map(
      (text, i) =>
        `<li><span class="badge">${first + i}</span><div>${text}</div></li>`,
    )
    .join('')}</ol>`
}

/** A button or label as it reads in the app. */
export const ui = (label: string) => `<span class="ui">${esc(label)}</span>`

/** Columns side by side. `columns` is a CSS grid-template-columns value. */
export const row = (columns: string, ...cells: Array<string>) =>
  `<div class="row" style="grid-template-columns:${columns}">${cells
    .map((c) => `<div>${c}</div>`)
    .join('')}</div>`

export const tip = (html: string, label = 'Tip') =>
  `<aside class="tip"><b class="tip-label">${label}</b><div>${html}</div></aside>`

export type Section = 'start' | 'behavior' | 'plans' | 'conferences' | 'extras'

export const SECTION_NAMES: Record<Section, string> = {
  start: 'Getting started',
  behavior: 'Behavior monitoring',
  plans: 'Lesson plans',
  conferences: 'Parent conferences',
  extras: 'Good to know',
}

export type GuidePage = {
  section: Section
  title: string
  intro?: string
  body: string
}

function pageHtml(p: GuidePage, n: number) {
  return `<section class="page" data-section="${p.section}">
  <header class="page-head">
    <div class="kicker">${SECTION_NAMES[p.section]}</div>
    <h1>${p.title}</h1>
    ${p.intro ? `<p class="intro">${p.intro}</p>` : ''}
  </header>
  <div class="page-body">${p.body}</div>
  <footer class="page-foot"><span>TeachForFree · Teacher quick-start guide</span><span>${n}</span></footer>
</section>`
}

/** A Lucide icon (the app's icon set) as inline SVG. */
export function icon(name: string, size = 24) {
  const src = readFileSync(
    `${REPO}node_modules/lucide-react/dist/esm/icons/${name}.mjs`,
    'utf8',
  )
  const literal = /const __iconData = (\{[\s\S]*?\});/.exec(src)?.[1]
  if (!literal) throw new Error(`Can't read the ${name} icon`)
  const data = new Function(`return ${literal}`)() as {
    node: Array<[string, Record<string, string>]>
  }
  const parts = data.node
    .map(([tag, attrs]) => {
      const a = Object.entries(attrs)
        .filter(([k]) => k !== 'key')
        .map(([k, v]) => `${k}="${v}"`)
        .join(' ')
      return `<${tag} ${a}/>`
    })
    .join('')
  return `<svg class="icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${parts}</svg>`
}

export const LOGO_URL = pathToFileURL(
  `${REPO}public/branding/chalkboard.png`,
).href

function fontFaces() {
  const file = (p: string) => pathToFileURL(`${REPO}node_modules/${p}`).href
  return `
@font-face { font-family: 'DM Sans'; font-weight: 100 1000; font-style: normal;
  src: url(${file('@fontsource-variable/dm-sans/files/dm-sans-latin-wght-normal.woff2')}) format('woff2'); }
@font-face { font-family: 'Space Mono'; font-weight: 400;
  src: url(${file('@fontsource/space-mono/files/space-mono-latin-400-normal.woff2')}) format('woff2'); }
@font-face { font-family: 'Space Mono'; font-weight: 700;
  src: url(${file('@fontsource/space-mono/files/space-mono-latin-700-normal.woff2')}) format('woff2'); }
`
}

// ---------- The PDF ----------

/**
 * Writes the guide's HTML next to its pictures and prints it to `pdfName`.
 * Fails if anything spills off a page.
 */
export async function renderGuide(
  browser: Browser,
  cover: string,
  pages: Array<GuidePage>,
  pdfName: string,
) {
  const css = fontFaces() + readFileSync(`${CAPTURE_DIR}lib/guide.css`, 'utf8')
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>TeachForFree teacher quick-start guide</title>
<style>${css}</style></head>
<body>
${cover}
${pages.map((p, i) => pageHtml(p, i + 2)).join('\n')}
</body></html>`
  const htmlFile = `${GUIDE_DIR}guide.html`
  writeFileSync(htmlFile, html)

  const context = await browser.newContext()
  const page = await context.newPage()
  await page.goto(pathToFileURL(htmlFile).href)
  await page.evaluate(async () => {
    await document.fonts.ready
    await Promise.all(
      [...document.images].map((img) =>
        img.complete
          ? null
          : new Promise((r) => (img.onload = img.onerror = r)),
      ),
    )
  })
  const broken = await page.evaluate(() =>
    [...document.images]
      .filter((img) => !img.naturalWidth)
      .map((img) => img.getAttribute('src')),
  )
  if (broken.length) throw new Error(`Guide images didn't load: ${broken}`)
  // Pages have a fixed size; anything taller is cut off, so stop here.
  const spills = await page.evaluate(() =>
    [...document.querySelectorAll('.page')].flatMap((el, i) => {
      const body = el.querySelector<HTMLElement>('.page-body') ?? el
      return body.scrollHeight > body.clientHeight + 1 ||
        body.scrollWidth > body.clientWidth + 1
        ? [
            `page ${i + 1} (${body.scrollHeight - body.clientHeight}px too tall, ${body.scrollWidth - body.clientWidth}px too wide)`,
          ]
        : []
    }),
  )
  const pdf = GUIDE_DIR + pdfName
  await page.pdf({ path: pdf, preferCSSPageSize: true, printBackground: true })
  await context.close()
  if (spills.length)
    throw new Error(`Guide content doesn't fit: ${spills.join(', ')}`)
  return pdf
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
