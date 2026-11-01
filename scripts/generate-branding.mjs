// Builds the branding images that come from the header logo
// (public/branding/teachforfree-apple-light.png):
//   - apple-icon.png: just the apple + star. pwa-assets.config.ts makes the
//     favicon and home-screen icons from it.
//   - apple-splash-*.png: iPhone launch screens with the full logo.
//   - og-image.png: the picture shown when a link to the site is shared.
// Run with `npm run generate-pwa-assets`, then commit the files it writes.
import sharp from 'sharp'
import {
  createAppleSplashScreens,
  defaultSplashScreenName,
} from '@vite-pwa/assets-generator/config'

const DIR = 'public/branding'
const LOGO = `${DIR}/teachforfree-apple-light.png`

// --background in src/styles.css (light mode).
const BACKGROUND = '#f7f9f3'

// The logo takes 60% of the screen's shorter side, same as #splash in
// index.html.
const LOGO_SHARE = 0.6

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

async function appleIcon() {
  const { height } = await sharp(LOGO).metadata()

  // The apple sits in the square at the left of the logo. Cut that out first:
  // sharp trims before it extracts, so they can't be one pipeline.
  const square = await sharp(LOGO)
    .extract({ left: 0, top: 0, width: height, height })
    .toBuffer()
  const { data, info } = await sharp(square)
    .trim({ threshold: 0 })
    .toBuffer({ resolveWithObject: true })

  // Center it on a see-through square.
  const side = Math.max(info.width, info.height)
  const left = Math.floor((side - info.width) / 2)
  const top = Math.floor((side - info.height) / 2)
  await sharp(data)
    .extend({
      left,
      right: side - info.width - left,
      top,
      bottom: side - info.height - top,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toFile(`${DIR}/apple-icon.png`)

  console.log(`apple-icon.png (${side}x${side})`)
}

/** The logo `logoWidth` wide, centered on a `width` x `height` background. */
async function logoOn(width, height, logoWidth, file) {
  const logo = await sharp(LOGO)
    .resize({ width: logoWidth, kernel: 'lanczos3' })
    .toBuffer()
  await sharp({
    create: { width, height, channels: 4, background: BACKGROUND },
  })
    .composite([{ input: logo, gravity: 'center' }])
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
    console.log(`${portrait}, ${landscape}`)
  }
}

async function ogImage() {
  await logoOn(1200, 630, 760, 'og-image.png')
  console.log('og-image.png (1200x630)')
}

await appleIcon()
await splashScreens()
await ogImage()
