// Builds the branding images from the chalkboard logo
// (public/branding/chalkboard-source.png, the original file, never changed):
//   - chalkboard.png: the logo enlarged with sharp edges. The header, the
//     in-app launch screen and pwa-assets.config.ts (favicon and home-screen
//     icons) all use it.
//   - apple-splash-*.png: iPhone launch screens.
//   - og-image.png: the picture shown when a link to the site is shared.
// Run with `npm run generate-pwa-assets`, then commit the files it writes.
import sharp from 'sharp'
import {
  createAppleSplashScreens,
  defaultSplashScreenName,
} from '@vite-pwa/assets-generator/config'

const DIR = 'public/branding'
const SOURCE = `${DIR}/chalkboard-source.png`
const LOGO = `${DIR}/chalkboard.png`

// Width of chalkboard.png. Big enough for the largest launch screen.
const LOGO_WIDTH = 1024

// --background in src/styles.css (light mode).
const BACKGROUND = '#f7f9f3'

// The logo is half the screen's shorter side wide, same as #splash in
// index.html.
const LOGO_SHARE = 0.5

// One iPhone per screen size; iPads get a plain launch. Each has a unique
// width + pixel ratio, which the media queries in index.html rely on.
const DEVICES = [
  'iPhone 17 Pro Max',
  'iPhone 17 Pro',
  'iPhone Air',
  'iPhone 16 Plus',
  'iPhone 16',
  'iPhone 16e',
  'iPhone 14 Plus',
  'iPhone 13 mini',
  'iPhone 11 Pro Max',
  'iPhone 11',
  'iPhone SE 4.7"',
]

const smoothstep = (lo, hi, x) => {
  const t = Math.min(1, Math.max(0, (x - lo) / (hi - lo)))
  return t * t * (3 - 2 * t)
}

/**
 * The logo's own colors: any color that fills at least 1% of the solid
 * pixels. Everything else is an edge blended between two of them.
 */
function findPalette(data) {
  const counts = new Map()
  let solid = 0
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] !== 255) continue
    const key = (data[i] << 16) | (data[i + 1] << 8) | data[i + 2]
    counts.set(key, (counts.get(key) ?? 0) + 1)
    solid++
  }
  return [...counts]
    .filter(([, n]) => n >= solid * 0.01)
    .map(([key]) => [(key >> 16) & 255, (key >> 8) & 255, key & 255])
}

/**
 * Enlarges flat artwork without blur: scale it up smoothly, then push every
 * pixel back to the logo's own colors, keeping only a thin blended edge.
 * Edges come out as clean curves instead of soft or stair-stepped ones.
 */
async function enlarge(input, width) {
  const trimmed = await sharp(input).trim({ threshold: 0 }).png().toBuffer()
  const meta = await sharp(trimmed).metadata()
  if (meta.width >= width) return sharp(trimmed).resize({ width }).png()

  const { data: original } = await sharp(trimmed)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const palette = findPalette(original)

  // Work at twice the final size, then shrink: smoother edges. The margin
  // gives the outer edges room to smooth; it's trimmed off at the end.
  const MARGIN = 4
  const workWidth = width * 2
  const scale = workWidth / meta.width
  const { data, info } = await sharp(trimmed)
    .ensureAlpha()
    .extend({
      top: MARGIN,
      bottom: MARGIN,
      left: MARGIN,
      right: MARGIN,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .resize({
      width: Math.round(workWidth + 2 * MARGIN * scale),
      kernel: 'cubic',
    })
    .blur(Math.max(0.3, scale * 0.5))
    .raw()
    .toBuffer({ resolveWithObject: true })

  // How sharp an edge ends up: about two working pixels wide.
  const edge = Math.min(0.5, 1 / scale)

  const pairs = []
  for (let a = 0; a < palette.length; a++)
    for (let b = a + 1; b < palette.length; b++)
      pairs.push([palette[a], palette[b]])

  for (let i = 0; i < data.length; i += 4) {
    const alpha = smoothstep(0.5 - edge, 0.5 + edge, data[i + 3] / 255)
    if (alpha === 0) {
      data[i] = data[i + 1] = data[i + 2] = data[i + 3] = 0
      continue
    }
    const c = [data[i], data[i + 1], data[i + 2]]

    // The pair of logo colors this pixel sits between, and how far along.
    let best = Infinity
    let from = palette[0]
    let to = palette[0]
    let t = 0
    for (const [p, q] of pairs) {
      const d = [q[0] - p[0], q[1] - p[1], q[2] - p[2]]
      const len = d[0] ** 2 + d[1] ** 2 + d[2] ** 2
      const along = Math.min(
        1,
        Math.max(
          0,
          ((c[0] - p[0]) * d[0] + (c[1] - p[1]) * d[1] + (c[2] - p[2]) * d[2]) /
            len,
        ),
      )
      const dist =
        (p[0] + d[0] * along - c[0]) ** 2 +
        (p[1] + d[1] * along - c[1]) ** 2 +
        (p[2] + d[2] * along - c[2]) ** 2
      if (dist < best) {
        best = dist
        from = p
        to = q
        t = along
      }
    }

    const mix = smoothstep(0.5 - edge, 0.5 + edge, t)
    for (let k = 0; k < 3; k++) {
      data[i + k] = Math.round(from[k] + (to[k] - from[k]) * mix)
    }
    data[i + 3] = Math.round(alpha * 255)
  }

  // sharp trims before it resizes, so this drops the margin first.
  return sharp(data, { raw: info })
    .trim({ threshold: 0 })
    .resize({ width, kernel: 'lanczos3' })
    .png({ compressionLevel: 9, palette: true })
}

async function logo() {
  await (await enlarge(SOURCE, LOGO_WIDTH)).toFile(LOGO)
  const { width, height } = await sharp(LOGO).metadata()
  console.log(`chalkboard.png (${width}x${height})`)
}

/** The logo `logoWidth` wide, centered on a `width` x `height` background. */
async function logoOn(width, height, logoWidth, file) {
  const resized = await sharp(LOGO)
    .resize({ width: logoWidth, kernel: 'lanczos3' })
    .toBuffer()
  await sharp({
    create: { width, height, channels: 4, background: BACKGROUND },
  })
    .composite([{ input: resized, gravity: 'center' }])
    .png({ palette: true, compressionLevel: 9 })
    .toFile(`${DIR}/${file}`)
}

async function splashScreens() {
  const { sizes } = createAppleSplashScreens({}, DEVICES)
  for (const size of sizes) {
    const logoWidth = Math.round(Math.min(size.width, size.height) * LOGO_SHARE)
    const portrait = defaultSplashScreenName(false, size)
    const landscape = defaultSplashScreenName(true, {
      ...size,
      width: size.height,
      height: size.width,
    })
    await logoOn(size.width, size.height, logoWidth, portrait)
    await logoOn(size.height, size.width, logoWidth, landscape)
  }
  console.log(`${sizes.length * 2} launch screens`)
}

async function ogImage() {
  await logoOn(1200, 630, 600, 'og-image.png')
  console.log('og-image.png (1200x630)')
}

await logo()
await splashScreens()
await ogImage()
