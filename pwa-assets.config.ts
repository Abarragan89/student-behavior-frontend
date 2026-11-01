import {
  defineConfig,
  minimal2023Preset,
} from '@vite-pwa/assets-generator/config'

// Makes the favicon and home-screen icons from the apple in the header logo
// (public/branding/apple-icon.png, cut out by scripts/generate-branding.mjs).
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
    // circle; 0.33 keeps the star's tip inside it.
    maskable: { sizes: [512], padding: 0.33 },
    apple: { sizes: [180], padding: 0.2 },
  },
  images: ['public/branding/apple-icon.png'],
})
