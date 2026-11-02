import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import type { Plugin } from 'vite'
import { devtools } from '@tanstack/devtools-vite'

import { tanstackRouter } from '@tanstack/router-plugin/vite'

import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

/**
 * `branding/<file>?v=<hash of the file>`. The images in public/branding/ keep
 * their names when the logo changes, and phones, browsers and Cloudflare keep
 * what they saved under a name (iPhones hold on to home-screen icons for a
 * long time). A changed image gets a new URL, so everyone fetches it again.
 */
function brandingUrl(file: string) {
  const hash = createHash('sha256')
    .update(readFileSync(`public/branding/${file}`))
    .digest('hex')
    .slice(0, 8)
  return `branding/${file}?v=${hash}`
}

/** Adds the ?v= from brandingUrl to every /branding/ image in index.html. */
function versionBrandingInHtml(): Plugin {
  return {
    name: 'version-branding-in-html',
    transformIndexHtml: (html) =>
      html.replace(
        /\/branding\/([\w.-]+\.(?:png|ico))/g,
        (_, file: string) => `/${brandingUrl(file)}`,
      ),
  }
}

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  // The header logo (src/components/Wordmark.tsx).
  define: {
    'import.meta.env.VITE_LOGO_URL': JSON.stringify(
      `/${brandingUrl('chalkboard.png')}`,
    ),
  },
  plugins: [
    versionBrandingInHtml(),
    devtools(),
    tailwindcss(),
    tanstackRouter({ target: 'react', autoCodeSplitting: true }),
    viteReact(),
    // Makes the site installable: writes manifest.webmanifest and a service
    // worker that caches the app's own files. Icons and launch images live in
    // public/branding/ and come from `npm run generate-pwa-assets`.
    VitePWA({
      // Ask before switching to a new version (src/components/pwa-updater.tsx),
      // so a teacher typing a note isn't reloaded mid-sentence.
      registerType: 'prompt',
      manifest: {
        id: '/',
        name: 'TeachForFree',
        short_name: 'TeachForFree',
        description:
          'Free behavior tracking and lesson notes for teachers. Tap a student to give a mark.',
        lang: 'en',
        dir: 'ltr',
        // Signed-out teachers are sent on to /login from here.
        start_url: '/classes',
        scope: '/',
        display: 'standalone',
        // Android builds its launch screen from this color and the icon.
        // Same light background as #splash in index.html.
        background_color: '#f7f9f3',
        theme_color: '#f7f9f3',
        categories: ['education', 'productivity'],
        icons: [
          {
            src: brandingUrl('pwa-64x64.png'),
            sizes: '64x64',
            type: 'image/png',
          },
          {
            src: brandingUrl('pwa-192x192.png'),
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: brandingUrl('pwa-512x512.png'),
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: brandingUrl('maskable-icon-512x512.png'),
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
        // Long-press the home-screen icon (Android, desktop).
        shortcuts: [
          { name: 'Classes', url: '/classes' },
          { name: 'Lesson Plans', url: '/lesson-plans' },
        ],
      },
      // The icon URLs have a ?v=, which the plugin can't match to a file.
      // Install screens fetch icons from the network anyway.
      includeManifestIcons: false,
      workbox: {
        // Only the logo of all the PNGs: the header, the offline screen and
        // #splash show it. Launch images are left out: each phone only needs
        // one of the 22.
        globPatterns: ['**/*.{js,css,html,svg,ico}', 'branding/chalkboard.png'],
        // Answer branding URLs (?v=<hash>) from the cached file. The default
        // list, plus v.
        ignoreURLParametersMatching: [/^utm_/, /^fbclid$/, /^v$/],
        // The API lives on another origin and has no rule here, so it is
        // never cached. Only Google Fonts are.
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'google-fonts-css',
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts',
              cacheableResponse: { statuses: [0, 200] },
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
        ],
      },
    }),
  ],
})

export default config
