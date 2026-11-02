import {
  defineConfig,
  minimal2023Preset,
} from '@vite-pwa/assets-generator/config'

// Makes the favicon and home-screen icons from the chalkboard logo
// (public/branding/chalkboard.png, enlarged by scripts/generate-branding.mjs).
// Run `npm run generate-pwa-assets` after changing the logo, then commit the
// PNGs it writes to public/branding/.

export default defineConfig({
  headLinkOptions: {
    preset: '2023',
    basePath: '/branding/',
  },
  preset: {
    ...minimal2023Preset,
    // Both default to a white background. Android crops maskable icons to a
    // circle; 0.38 keeps the chalkboard's corners inside it.
    maskable: { sizes: [512], padding: 0.38 },
    apple: { sizes: [180], padding: 0.15 },
  },
  images: ['public/branding/chalkboard.png'],
})
