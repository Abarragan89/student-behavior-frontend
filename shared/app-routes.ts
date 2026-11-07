// Which URLs belong to the app (src/routes) and which to the marketing site
// (site/src/pages). Both are served from the same domain:
//
// - The service worker answers only app URLs from its saved copy of the app
//   (navigateFallbackAllowlist in vite.config.ts). Everything else, like / and
//   /privacy, always comes from the network.
// - nginx serves a page's .html file if the site built one, and app.html
//   otherwise.
//
// Adding a top-level app route? Add it here too. The build fails if you don't.

import { readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

export const APP_ROUTES = [
  'classes',
  'marks',
  'account',
  'lesson-plans',
  'students',
  'login',
  'sub',
  'conferences',
  'conference',
  'invite',
  'school',
  'join',
  'dashboard',
  'calendar',
  'schedules',
  'staff-conferences',
  'staff',
  'unsubscribe',
] as const

/** Matches an app URL. Workbox tests path + query string, hence the `?`. */
export const APP_PATH = new RegExp(`^/(?:${APP_ROUTES.join('|')})(?:[/?]|$)`)

const ROUTES_DIR = fileURLToPath(new URL('../src/routes/', import.meta.url))
const PAGES_DIR = fileURLToPath(new URL('../site/src/pages/', import.meta.url))

/** Top-level URL segment of each route file (`_authed/lesson-plans.$date.tsx` → `lesson-plans`). */
function topSegments(dir: string, isRouter: boolean) {
  const segments = new Set<string>()
  for (const entry of readdirSync(dir, { recursive: true, encoding: 'utf8' })) {
    if (!/\.(tsx?|astro|md|mdx)$/.test(entry)) continue
    // Router: pathless layout folders (_authed/) and layout files (_authed.tsx, __root.tsx) add no URL.
    const parts = entry
      .split(/[\\/]/)
      .filter((part) => !(isRouter && part.startsWith('_')))
    const first = parts[0]
    if (!first) continue
    // `lesson-plans.$date_.present.tsx` → `lesson-plans`; folders have no dot.
    segments.add(first.split('.')[0].replace(/_$/, ''))
  }
  return segments
}

/** Fails the build when an app route and a site page could be mixed up. */
export function checkRoutes() {
  const app = topSegments(ROUTES_DIR, true)
  const site = topSegments(PAGES_DIR, false)
  const problems: Array<string> = []

  if (app.has('index')) {
    problems.push(
      'src/routes has an index route, but / is the marketing page (site/src/pages/index.astro).',
    )
  }
  for (const segment of app) {
    if (
      segment !== 'index' &&
      !(APP_ROUTES as ReadonlyArray<string>).includes(segment)
    ) {
      problems.push(
        `App route "/${segment}" is missing from APP_ROUTES in shared/app-routes.ts.`,
      )
    }
  }
  for (const segment of site) {
    if ((APP_ROUTES as ReadonlyArray<string>).includes(segment)) {
      problems.push(`Site page "/${segment}" has the same URL as an app route.`)
    }
  }
  if (problems.length) throw new Error(problems.join('\n'))
}
