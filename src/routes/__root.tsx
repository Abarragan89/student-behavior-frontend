import {
  Outlet,
  createRootRouteWithContext,
  useRouterState,
} from '@tanstack/react-router'
import type { QueryClient } from '@tanstack/react-query'

import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'
import { Toaster } from '@/components/ui/sonner'
import { PwaUpdater } from '#/components/pwa-updater'
import { ThemeProvider } from '#/components/theme-provider'

import '../styles.css'

// Shared with every route's beforeLoad/loader (e.g. the login check in _authed.tsx).
export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()(
  {
    component: RootComponent,
  },
)

function RootComponent() {
  // A substitute's link (/sub) is a one-day visit: no "new version" offers,
  // and the app isn't downloaded for offline use.
  const isSub = useRouterState({
    select: (s) => s.location.pathname === '/sub',
  })
  return (
    <ThemeProvider>
      <Outlet />
      {/* For toast() anywhere in the app. Top center stays clear of the
          devtools button and is easy to spot on phones. */}
      <Toaster position="top-center" />
      {!isSub && <PwaUpdater />}
      {/* <TanStackDevtools
        config={{
          position: 'bottom-right',
        }}
        plugins={[
          {
            name: 'TanStack Router',
            render: <TanStackRouterDevtoolsPanel />,
          },
        ]}
      /> */}
    </ThemeProvider>
  )
}
