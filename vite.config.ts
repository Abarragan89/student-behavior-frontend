import { createHash, randomBytes } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig, loadEnv } from 'vite'
import type { Connect, Plugin } from 'vite'
import { devtools } from '@tanstack/devtools-vite'

import { tanstackRouter } from '@tanstack/router-plugin/vite'

import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

import { APP_PATH, checkRoutes } from './shared/app-routes'
import {
  brandingUrl,
  pwaHeadRaw,
  requireApiUrl,
  versionBranding,
} from './shared/branding'

/**
 * `<file>?v=<hash of public/<file>>`. Fails the build if the file is missing:
 * an importScripts that 404s (or gets app.html) stops the whole service
 * worker from installing, offline mode included.
 */
function publicFileUrl(file: string) {
  const hash = createHash('sha256')
    .update(readFileSync(resolve(import.meta.dirname, 'public', file)))
    .digest('hex')
    .slice(0, 8)
  return `${file}?v=${hash}`
}

/**
 * The app's page as the service worker saves it: a copy of app.html under a
 * name only this build has. During a deploy the old and new servers both
 * answer for a moment. If the worker's request for its page reaches the old
 * one, it gets a 404 and tries again later, instead of saving the old page as
 * the new one (which then asks for files the new server doesn't have).
 * Random, not a hash of the page: a name must never come back with other
 * content. nginx.conf gives it app.html's headers.
 */
const APP_SHELL = `assets/app-shell-${randomBytes(4).toString('hex')}.html`

/** Where `npm run dev:site` serves the marketing pages (site/). */
const SITE_DEV_URL = 'http://localhost:4321'

/** A page load (not a script, image or fetch) for a URL without a file extension. */
function isPageRequest(req: Connect.IncomingMessage) {
  const path = (req.url ?? '/').split('?')[0]
  return (
    req.method === 'GET' &&
    (req.headers.accept ?? '').includes('text/html') &&
    !/\.\w+$/.test(path)
  )
}

/**
 * The app's page is app.html, since / belongs to the marketing site:
 * - adds shared/pwa-head.html, then ?v= to every /branding/ image
 * - build: adds the service worker's copy of it (APP_SHELL)
 * - dev: app URLs get app.html, anything else is sent to the Astro dev server
 * - preview: the same rules as nginx.conf
 */
function appShell(): Plugin {
  return {
    name: 'tff-app-shell',
    transformIndexHtml: (html) =>
      versionBranding(html.replace('<!-- tff:pwa-head -->', pwaHeadRaw())),
    // Last, so app.html is finished: script tags, manifest link and all.
    generateBundle: {
      order: 'post',
      handler(_options, bundle) {
        const page = 'app.html' in bundle ? bundle['app.html'] : undefined
        if (page?.type !== 'asset') this.error('app.html is not in the build')
        this.emitFile({
          type: 'asset',
          fileName: APP_SHELL,
          source: page.source,
        })
      },
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!isPageRequest(req)) return next()
        if (APP_PATH.test(req.url ?? '/')) {
          req.url = '/app.html'
          return next()
        }
        res.statusCode = 302
        res.setHeader('Location', SITE_DEV_URL + req.url)
        res.end()
      })
    },
    configurePreviewServer(server) {
      const outDir = resolve(server.config.root, server.config.build.outDir)
      server.middlewares.use((req, _res, next) => {
        if (!isPageRequest(req)) return next()
        const [path, query = ''] = (req.url ?? '/').split('?')
        const page = path === '/' ? '/index.html' : `${path}.html`
        req.url =
          (existsSync(outDir + page) ? page : '/app.html') +
          (query && `?${query}`)
        next()
      })
    },
  }
}

const config = defineConfig(({ command, mode }) => {
  checkRoutes()
  if (command === 'build') {
    requireApiUrl(loadEnv(mode, process.cwd(), 'VITE_').VITE_API_URL)
  }

  return {
    resolve: { tsconfigPaths: true },
    // The header logo (src/components/Wordmark.tsx).
    define: {
      'import.meta.env.VITE_LOGO_URL': JSON.stringify(
        `/${brandingUrl('chalkboard.png')}`,
      ),
    },
    build: {
      // `npm run build` runs Astro first, into the same dist/.
      emptyOutDir: false,
      rolldownOptions: { input: 'app.html' },
    },
    plugins: [
      appShell(),
      devtools(),
      tailwindcss(),
      tanstackRouter({ target: 'react', autoCodeSplitting: true }),
      viteReact(),
      // Makes the site installable: writes manifest.webmanifest and a service
      // worker that caches the app's own files. Icons and launch images live in
      // public/branding/ and come from `npm run generate-pwa-assets`.
      VitePWA({
        // The app picks when to switch to a new version
        // (src/components/pwa-updater.tsx), so a teacher typing a note isn't
        // reloaded mid-sentence.
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
          // Same light background as #splash in app.html.
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
          // Only the app's own files. dist/ also holds the marketing pages
          // (Astro), which are never saved for offline. Of the images, only
          // the logo: the header, the offline screen and #splash show it.
          // Launch images are left out: each phone only needs one of the 22.
          // The mark sounds, since marks can be given offline.
          globPatterns: [
            APP_SHELL,
            'assets/**/*.{js,css,woff2}',
            'branding/favicon.ico',
            'branding/chalkboard.png',
            'sounds/*.mp3',
          ],
          // App URLs open the saved page (app.html's copy), even offline.
          // Others (/, /privacy, …) always come from the network. A newer
          // version waits for a safe moment (src/components/pwa-updater.tsx).
          navigateFallback: APP_SHELL,
          navigateFallbackAllowlist: [APP_PATH],
          // Answer branding URLs (?v=<hash>) from the cached file. The default
          // list, plus v.
          ignoreURLParametersMatching: [/^utm_/, /^fbclid$/, /^v$/],
          // The API lives on another origin and is never cached. Fonts are
          // self-hosted (src/styles.css), so they're in assets/ above.

          // Push reminders: shows them and opens the plan on a tap. The ?v=
          // changes with the file, so editing only it still makes a new
          // service worker (and the "new version" toast).
          importScripts: [publicFileUrl('push-sw.js')],
        },
      }),
    ],
  }
})

export default config
