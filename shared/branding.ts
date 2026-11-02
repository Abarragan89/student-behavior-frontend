// Build-time helpers shared by vite.config.ts (the app) and
// site/astro.config.ts (the marketing pages). Runs in Node, never in the
// browser.

import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { Plugin } from 'vite'

const BRANDING_DIR = fileURLToPath(
  new URL('../public/branding/', import.meta.url),
)
const PWA_HEAD_FILE = fileURLToPath(new URL('./pwa-head.html', import.meta.url))

/**
 * `branding/<file>?v=<hash of the file>`. The images in public/branding/ keep
 * their names when the logo changes, and phones, browsers and Cloudflare keep
 * what they saved under a name (iPhones hold on to home-screen icons for a
 * long time). A changed image gets a new URL, so everyone fetches it again.
 */
export function brandingUrl(file: string) {
  const hash = createHash('sha256')
    .update(readFileSync(BRANDING_DIR + file))
    .digest('hex')
    .slice(0, 8)
  return `branding/${file}?v=${hash}`
}

/** Adds the ?v= from brandingUrl to every /branding/ image in some HTML. Run it once per page. */
export function versionBranding(html: string) {
  return html.replace(
    /\/branding\/([\w.-]+\.(?:png|ico))/g,
    (_, file: string) => `/${brandingUrl(file)}`,
  )
}

/** shared/pwa-head.html as written, without ?v=. */
export function pwaHeadRaw() {
  return readFileSync(PWA_HEAD_FILE, 'utf8')
}

/** The API's URL, required for a build: without it every sign-in link is broken. */
export function requireApiUrl(value: string | undefined) {
  if (!value) {
    throw new Error(
      'VITE_API_URL is not set. Put it in .env, or pass --build-arg VITE_API_URL=… to docker build.',
    )
  }
  return value
}

const VIRTUAL_ID = 'virtual:tff-head'

/**
 * `import { pwaHead, logoUrl, … } from 'virtual:tff-head'` for the Astro
 * pages. The hashes are worked out here, in the config, because Astro bundles
 * page code elsewhere, where reading public/branding/ by relative path would
 * break.
 */
export function tffHead(): Plugin {
  return {
    name: 'tff-head',
    resolveId: (id) => (id === VIRTUAL_ID ? '\0' + VIRTUAL_ID : undefined),
    load(id) {
      if (id !== '\0' + VIRTUAL_ID) return
      const values = {
        pwaHead: versionBranding(pwaHeadRaw()),
        logoUrl: `/${brandingUrl('chalkboard.png')}`,
        ogImageUrl: `/${brandingUrl('og-image.png')}`,
        iconUrl: `/${brandingUrl('pwa-512x512.png')}`,
      }
      return Object.entries(values)
        .map(
          ([name, value]) => `export const ${name} = ${JSON.stringify(value)}`,
        )
        .join('\n')
    },
  }
}
