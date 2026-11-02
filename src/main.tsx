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
import { forgetOnTeacherChange, rememberSignedIn } from './lib/auth'
import {
  prefetchLessonPlans,
  reapplyPendingOps,
  registerLessonPlanMutations,
  resumeLessonPlanQueue,
  watchLessonPlanQueue,
} from './lib/lesson-plan-queue'
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
import { registerSubMutations } from './lib/sub'

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

  // How queued marks and lesson plan changes are sent. Before loading the
  // saved queue, which needs it.
  registerMarkMutations(queryClient)
  registerLessonPlanMutations(queryClient)
  // A substitute's, through a shared link. Never saved on the device.
  registerSubMutations(queryClient)

  // Installed app only (see persist.ts): load the data and the mark queue
  // saved on the device before the first page runs its login check, so the
  // class shows at once, even offline. Takes a few milliseconds under the
  // launch screen; capped in case the browser's storage is slow to open.
  const standalone = isStandalone()
  const queueRestored = standalone
    ? restoreMarkQueue(queryClient)
    : Promise.resolve()
  if (standalone) {
    const restored = Promise.all([
      restoreQueryCache(queryClient),
      queueRestored,
    ])
    void restored.then(() => {
      // Checkmarks still queued go on the saved days, which can be a tap
      // behind.
      reapplyPendingOps(queryClient)
      // The saved copy shows at once, but may be days old, or older than
      // changes made on another device: ask the server again (in the
      // background, and only once online).
      void queryClient.invalidateQueries()
    })
    await Promise.race([restored, wait(2000)])
    // Ask the browser not to clear it to free up space.
    if ('persist' in navigator.storage) {
      void navigator.storage.persist().catch(() => {})
    }
  }
  forgetOnTeacherChange(queryClient)
  rememberSignedIn(queryClient)

  ReactDOM.createRoot(rootElement).render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )

  // Only once the saved queue is loaded: saving earlier could overwrite marks
  // that haven't been sent with an empty queue.
  await queueRestored
  const saveQueue = standalone ? () => saveMarkQueue(queryClient) : undefined
  watchMarkQueue(queryClient, saveQueue)
  watchLessonPlanQueue(queryClient, saveQueue)
  resumeMarkQueue(queryClient)
  resumeLessonPlanQueue(queryClient)
  if (standalone) prefetchLessonPlans(queryClient)
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

void boot()
