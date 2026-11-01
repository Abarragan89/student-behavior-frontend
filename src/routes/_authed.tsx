import { useEffect } from 'react'
import {
  Link,
  Navigate,
  Outlet,
  createFileRoute,
  redirect,
  useRouter,
} from '@tanstack/react-router'
import type { ErrorComponentProps } from '@tanstack/react-router'
import { RefreshCw, WifiOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Wordmark } from '#/components/Wordmark'
import { ConnectionStatus } from '#/components/connection-status'
import { BottomNav, HeaderNav } from '#/components/app-nav'
import { CreateDialogsProvider } from '#/components/create-dialogs'
import { CreateMenu } from '#/components/create-menu'
import { UserMenu } from '#/components/user-menu'
import { InstallBanner } from '#/components/install/install-banner'
import { meQueryOptions, useMe } from '#/lib/auth'
import { OfflineError, isOnline, useOnline } from '#/lib/online'
import { isStandalone } from '#/lib/pwa-install'

// Layout for pages that need a login: put them in src/routes/_authed/.
// The leading "_" keeps it out of the URL (_authed/classes.tsx → /classes).
// Pages here read the teacher with useSuspenseQuery(meQueryOptions): this check
// has already loaded it, and it stays up to date when 'me' is refetched.
export const Route = createFileRoute('/_authed')({
  beforeLoad: async ({ context: { queryClient } }) => {
    // Already known (this visit, or saved on the device): show the page now.
    // useMe() in the layout checks again in the background when it's old.
    const cached = queryClient.getQueryData(meQueryOptions.queryKey)
    if (cached) return

    // Offline, a request would wait for the connection instead of failing.
    if (!isOnline()) {
      if (cached === null) throw redirect({ to: '/login' })
      throw new OfflineError()
    }
    const me = await queryClient.query({ ...meQueryOptions, retry: 1 })
    if (!me) throw redirect({ to: '/login' })
  },
  errorComponent: AuthedError,
  component: AuthedLayout,
})

function AuthedLayout() {
  const { data: me } = useMe()

  // Logged out while on the page (session ended, or logged out in another tab).
  if (me === null) return <Navigate to="/login" />
  if (!me) return null

  return (
    // The + menu's dialogs (Add Students, Create class), for every page here.
    <CreateDialogsProvider me={me}>
      {/* Column layout so pages can fill the space under the header
          (flex-1). On phones the bottom padding leaves room for the fixed
          bottom bar, and the top padding keeps pages clear of the notch
          (0 with today's status bar style, which keeps the page below it). */}
      <div className="flex min-h-dvh flex-col bg-background pt-[env(safe-area-inset-top)] pb-[calc(4rem+env(safe-area-inset-bottom))] text-foreground md:pt-0 md:pb-0">
        {/* Tablets and laptops only. Phones get the bottom bar instead (links,
            +, the avatar, and the offline pill), so the first screen is all
            students. */}
        <header className="hidden items-center gap-4 border-b-2 border-border bg-card px-4 py-3 md:flex">
          <Link to="/classes">
            <Wordmark />
          </Link>
          <HeaderNav />
          <div className="ml-auto flex items-center gap-3">
            <ConnectionStatus />
            <CreateMenu />
            <UserMenu teacher={me.teacher} />
          </div>
        </header>

        {/* Phones in the browser only; hidden in the installed app. */}
        <InstallBanner className="md:hidden" />

        <Outlet />

        <BottomNav teacher={me.teacher} className="md:hidden" />
      </div>
    </CreateDialogsProvider>
  )
}

/**
 * The login check couldn't finish: offline with nothing saved on the device
 * yet, or the server couldn't be reached.
 */
function AuthedError({ error }: ErrorComponentProps) {
  const router = useRouter()
  const online = useOnline()
  const offline = error instanceof OfflineError

  // Try again by itself once the connection is back.
  useEffect(() => {
    if (offline && online) void router.invalidate()
  }, [offline, online, router])

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-background px-4 py-12 text-center text-foreground">
      <Wordmark />
      <span
        aria-hidden
        className="grid size-14 place-items-center rounded-lg border-2 border-border bg-card"
      >
        <WifiOff className="size-7" />
      </span>
      <div className="flex max-w-sm flex-col gap-2">
        <h1 className="text-2xl font-bold">
          {offline ? 'You’re offline' : 'Couldn’t reach TeachForFree'}
        </h1>
        <p className="text-base text-muted-foreground">
          {offline
            ? isStandalone()
              ? 'Connect to the internet once so your classes can load on this device. After that, the app opens even without a connection.'
              : 'Connect to the internet to see your classes.'
            : 'Check your connection and try again.'}
        </p>
      </div>
      <Button
        variant="outline"
        onClick={() => void router.invalidate()}
        className="h-12 rounded-lg border-2 border-border bg-card px-6 text-base font-bold text-card-foreground shadow-md"
      >
        <RefreshCw />
        Try again
      </Button>
    </main>
  )
}
