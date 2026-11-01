// First, so the browser's install offer is caught however early it comes.
import { isStandalone } from '#/lib/pwa-install'
import ReactDOM from 'react-dom/client'
import { RouterProvider, createRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'
import {
  QueryClient,
  QueryClientProvider,
  onlineManager,
} from '@tanstack/react-query'
import { ApiError } from './lib/api'
import { forgetOnTeacherChange } from './lib/auth'
import {
  registerMarkMutations,
  resumeMarkQueue,
  watchMarkQueue,
} from './lib/mark-queue'
import {
  QUERY_MAX_AGE,
  restoreMarkQueue,
  restoreQueryCache,
  saveMarkQueue,
} from './lib/persist'
import { hideSplashAfterFirstRender } from './lib/splash'

// React Query assumes it's online until the browser says otherwise. Start
// from the real state, so an offline launch doesn't wait on requests.
onlineManager.setOnline(navigator.onLine)

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Kept as long as the copy saved on the device (see persist.ts), so
      // saved data isn't thrown away just because no page is showing it.
      gcTime: QUERY_MAX_AGE,
      // A 401 means "not logged in"; retrying won't change that.
      retry: (failureCount, error) =>
        !(error instanceof ApiError && error.status === 401) &&
        failureCount < 3,
    },
  },
})

const router = createRouter({
  routeTree,
  context: { queryClient },
  defaultPreload: 'intent',
  scrollRestoration: true,
})

// The installed app's launch screen stays up until the first page is ready.
hideSplashAfterFirstRender(router)

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

async function boot() {
  const rootElement = document.getElementById('app')!
  if (rootElement.innerHTML) return

  // How queued marks are sent. Before loading the saved queue, which needs it.
  registerMarkMutations(queryClient)

  // Installed app only (see persist.ts): load the data and the mark queue
  // saved on the device before the first page runs its login check, so the
  // class shows at once, even offline. Takes a few milliseconds under the
  // launch screen; capped in case the browser's storage is slow to open.
  const standalone = isStandalone()
  const queueRestored = standalone
    ? restoreMarkQueue(queryClient)
    : Promise.resolve()
  if (standalone) {
    await Promise.race([
      Promise.all([restoreQueryCache(queryClient), queueRestored]),
      wait(2000),
    ])
    // Ask the browser not to clear it to free up space.
    if ('persist' in navigator.storage) {
      void navigator.storage.persist().catch(() => {})
    }
  }
  forgetOnTeacherChange(queryClient)

  ReactDOM.createRoot(rootElement).render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )

  // Only once the saved queue is loaded: saving earlier could overwrite marks
  // that haven't been sent with an empty queue.
  await queueRestored
  watchMarkQueue(
    queryClient,
    standalone ? () => saveMarkQueue(queryClient) : undefined,
  )
  resumeMarkQueue(queryClient)
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

void boot()
