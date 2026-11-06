// The marketing pages (/, /privacy, /terms, …): plain HTML that search
// engines and link previews can read without running JavaScript. Built into
// the same dist/ as the app (see `npm run build`), and served by the same
// nginx. The app itself is src/ (Vite); shared/app-routes.ts says which URLs
// belong to which.

import type { IncomingMessage } from 'node:http'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'astro/config'
import react from '@astrojs/react'
import sitemap from '@astrojs/sitemap'
import tailwindcss from '@tailwindcss/vite'
import type { Plugin } from 'vite'
import { APP_PATH, checkRoutes } from '../shared/app-routes'
import { tffHead } from '../shared/branding'

/** `npm run dev` (package.json). */
const APP_DEV_URL = 'http://localhost:3000'

/**
 * Dev only: an app URL opened on this server (a site link like
 * /school/start, followed from :4321) goes to the app's dev server, the way
 * the app's dev server sends site URLs here (vite.config.ts). In production
 * both are one domain, so site links into the app stay relative.
 */
function appPagesToApp(): Plugin {
  const isPageRequest = (req: IncomingMessage) => {
    const path = (req.url ?? '/').split('?')[0]
    return (
      req.method === 'GET' &&
      (req.headers.accept ?? '').includes('text/html') &&
      !/\.\w+$/.test(path)
    )
  }
  return {
    name: 'tff-app-pages-to-app',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!isPageRequest(req) || !APP_PATH.test(req.url ?? '/')) return next()
        res.statusCode = 302
        res.setHeader('Location', APP_DEV_URL + req.url)
        res.end()
      })
    },
  }
}

const repo = fileURLToPath(new URL('..', import.meta.url))
const src = fileURLToPath(new URL('../src/', import.meta.url))

checkRoutes()

export default defineConfig({
  site: 'https://teachforfree.com',
  outDir: '../dist',
  // The app's public/ (branding images). Copied by both builds; same files.
  publicDir: '../public',
  // /privacy (privacy.html), never /privacy/: one URL per page, the same in
  // the canonical link, the sitemap and nginx.
  trailingSlash: 'never',
  build: { format: 'file' },
  integrations: [react(), sitemap()],
  // Astro collects anonymous usage data unless told not to.
  telemetry: false,
  vite: {
    // The app's .env (VITE_API_URL), and its VITE_ variables.
    envDir: repo,
    envPrefix: ['PUBLIC_', 'VITE_'],
    // Same aliases as the app, so the pages can use its components.
    resolve: {
      alias: [
        { find: /^@\//, replacement: src },
        { find: /^#\//, replacement: src },
      ],
    },
    plugins: [tailwindcss(), tffHead(), appPagesToApp()],
  },
})
