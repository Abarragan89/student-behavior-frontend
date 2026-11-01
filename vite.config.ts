import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'

import { tanstackRouter } from '@tanstack/router-plugin/vite'

import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [
    devtools(),
    tailwindcss(),
    tanstackRouter({ target: 'react', autoCodeSplitting: true }),
    viteReact(),
    // Makes the site installable: writes manifest.webmanifest and a service
    // worker that caches the app's own files. Icons come from
    // `npm run generate-pwa-assets` (see pwa-assets.config.ts).
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
        background_color: '#4f46e5',
        theme_color: '#f7f9f3',
        categories: ['education', 'productivity'],
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'maskable-icon-512x512.png',
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
      workbox: {
        // No png: each phone only needs one of the 22 iOS launch images.
        globPatterns: ['**/*.{js,css,html,svg,ico}'],
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
