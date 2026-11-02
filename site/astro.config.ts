// The marketing pages (/, /privacy, /terms, …): plain HTML that search
// engines and link previews can read without running JavaScript. Built into
// the same dist/ as the app (see `npm run build`), and served by the same
// nginx. The app itself is src/ (Vite); shared/app-routes.ts says which URLs
// belong to which.

import { fileURLToPath } from 'node:url'
import { defineConfig } from 'astro/config'
import react from '@astrojs/react'
import sitemap from '@astrojs/sitemap'
import tailwindcss from '@tailwindcss/vite'
import { checkRoutes } from '../shared/app-routes'
import { tffHead } from '../shared/branding'

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
    plugins: [tailwindcss(), tffHead()],
  },
})
