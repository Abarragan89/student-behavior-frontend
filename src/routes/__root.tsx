import {
  Link,
  Outlet,
  createRootRouteWithContext,
  useRouterState,
} from '@tanstack/react-router'
import type { QueryClient } from '@tanstack/react-query'

import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'
import { buttonVariants } from '@/components/ui/button'
import { Toaster } from '@/components/ui/sonner'
import { cn } from '@/lib/utils'
import { Wordmark } from '#/components/Wordmark'
import { MarkNoteHost } from '#/components/mark-note-dialog'
import { PwaUpdater } from '#/components/pwa-updater'
import { ThemeProvider } from '#/components/theme-provider'

import '../styles.css'

// Shared with every route's beforeLoad/loader (e.g. the login check in _authed.tsx).
export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()(
  {
    component: RootComponent,
    notFoundComponent: NotFound,
  },
)

/** Pages opened from a link by someone without an account. */
const LINK_PAGES = new Set([
  '/sub',
  '/conference',
  '/invite',
  '/join',
  '/school/start',
])

function RootComponent() {
  // A substitute's link (/sub) and a family's conference page (/conference)
  // are visits, not the app: no "new version" offers, and the app isn't
  // downloaded for offline use.
  const isLinkPage = useRouterState({
    select: (s) => LINK_PAGES.has(s.location.pathname),
  })
  return (
    <ThemeProvider>
      <Outlet />
      {/* For toast() anywhere in the app. Top center stays clear of the
          devtools button and is easy to spot on phones. */}
      <Toaster position="top-center" />
      {/* The note sheet opened from a give-mark toast's "Add note". Here,
          like the toaster, so it outlives the page that gave the mark. */}
      <MarkNoteHost />
      {!isLinkPage && <PwaUpdater />}
      <TanStackDevtools
        config={{
          position: 'bottom-left',
        }}
        plugins={[
          {
            name: 'TanStack Router',
            render: <TanStackRouterDevtoolsPanel />,
          },
        ]}
      />
    </ThemeProvider>
  )
}

/**
 * Any URL that isn't a page. nginx sends unknown URLs to the app (so new app
 * pages need no server change) with a noindex header, so search engines
 * don't list them.
 */
function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-background px-4 py-12 text-center text-foreground">
      {/* Full page loads: the homepage is a separate page (site/). */}
      <a href="/" aria-label="TeachForFree home">
        <Wordmark className="h-24" />
      </a>
      <div>
        <h1 className="text-2xl font-bold">Page not found</h1>
        <p className="mt-2 text-muted-foreground">
          This link doesn’t go to a page in TeachForFree.
        </p>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Link
          to="/classes"
          className={cn(
            buttonVariants(),
            'h-12 rounded-lg border-2 border-border px-6 text-base font-bold shadow-md',
          )}
        >
          Go to my classes
        </Link>
        <a
          href="/"
          className={cn(
            buttonVariants({ variant: 'outline' }),
            'h-12 rounded-lg border-2 border-border bg-card px-6 text-base font-bold text-card-foreground shadow-md',
          )}
        >
          TeachForFree home
        </a>
      </div>
    </main>
  )
}
