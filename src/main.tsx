// First, so the browser's install offer is caught however early it comes.
import '#/lib/pwa-install'
import ReactDOM from 'react-dom/client'
import { RouterProvider, createRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'
import {
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query'
import { ApiError } from './lib/api'
import { hideSplashAfterFirstRender } from './lib/splash'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
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

const rootElement = document.getElementById('app')!

if (!rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement)
  root.render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
}
