import {
  createAppleSplashScreens,
  defineConfig,
  minimal2023Preset,
} from '@vite-pwa/assets-generator/config'

// Generates the app icons and iPhone launch images from public/app-icon.svg.
// Run `npm run generate-pwa-assets` after changing the icon, then commit the
// PNGs it writes to public/. See the launch-image comment in index.html.

const INDIGO = '#4f46e5' // --primary

// `resizeOptions` replaces the defaults instead of merging, so `fit` must be
// passed along with `background`.
const onIndigo = { fit: 'contain', background: INDIGO } as const

export default defineConfig({
  headLinkOptions: {
    preset: '2023',
    // Keep linking the existing browser-tab icon.
    resolveSvgName: () => 'favicon.svg',
  },
  preset: {
    ...minimal2023Preset,
    maskable: { sizes: [512], padding: 0.15, resizeOptions: onIndigo },
    apple: { sizes: [180], padding: 0.15, resizeOptions: onIndigo },
    appleSplashScreens: createAppleSplashScreens(
      {
        // The logo takes 40% of the screen's shorter side, same as the
        // in-app splash in index.html.
        padding: 0.6,
        resizeOptions: onIndigo,
        linkMediaOptions: {
          log: true,
          addMediaScreen: true,
          basePath: '/',
          xhtml: false,
        },
      },
      // One iPhone per screen size. Each has a unique width + pixel ratio, so
      // the media queries still match without device-height (see index.html).
      // iPads get a plain launch.
      [
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
      ],
    ),
  },
  images: ['public/app-icon.svg'],
})
