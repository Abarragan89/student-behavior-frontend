import { useEffect } from 'react'
import {
  Link,
  Navigate,
  Outlet,
  createFileRoute,
  redirect,
  useMatches,
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
import { NotificationsBanner } from '#/components/notifications/notifications-banner'
import { SpaceBadge } from '#/components/space-badge'
import { meQueryOptions, useMe } from '#/lib/auth'
import { useReminders } from '#/lib/notifications'
import type { FeatureKey } from '#/lib/coteachers'
import { homeOf, isSchoolAdmin, permissionIn, spaceOf } from '#/lib/workspace'
import { OfflineError, isOnline, useOnline } from '#/lib/online'
import { isStandalone } from '#/lib/pwa-install'

// Layout for pages that need a login: put them in src/routes/_authed/.
// The leading "_" keeps it out of the URL (_authed/classes.tsx → /classes).
// Pages here read the teacher with useSuspenseQuery(meQueryOptions): this check
// has already loaded it, and it stays up to date when 'me' is refetched.
declare module '@tanstack/react-router' {
  interface StaticDataRouteOption {
    /**
     * The page takes the whole screen: no header, bottom bar or install
     * banner (e.g. a lesson plan's presenter view, used while teaching).
     */
    fullScreen?: boolean
    /**
     * What a co-teacher needs to open the page in another teacher's space
     * (see workspace.ts). Without it they're sent to a page they can open.
     * The server checks every request too; this keeps the screens honest.
     */
    feature?: { key: FeatureKey; level: 'view' | 'edit' }
    /**
     * Only a school's administrator, in their own space, opens the page
     * (their dashboard and its tabs). Anyone else is sent home.
     */
    schoolAdmin?: boolean
  }
}

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
  // Reminder taps while the app is open, and this device's subscription.
  useReminders(!!me)
  const fullScreen = useMatches({
    select: (matches) => matches.some((m) => m.staticData.fullScreen),
  })
  const adminOnly = useMatches({
    select: (matches) => matches.some((m) => m.staticData.schoolAdmin),
  })
  // The deepest page's requirement, if it has one.
  const feature = useMatches({
    select: (matches) =>
      [...matches].reverse().find((m) => m.staticData.feature)?.staticData
        .feature,
  })

  // Logged out while on the page (session ended, or logged out in another tab).
  if (me === null) return <Navigate to="/login" />
  if (!me) return null

  // A school administrator's page, for someone who isn't one (or is one,
  // but is viewing a teacher's classes).
  if (adminOnly && !isSchoolAdmin(me)) {
    return <Navigate to={homeOf(me)} replace />
  }
  // A page this space doesn't open: in another teacher's space, beyond what
  // they share; in a school administrator's own, any teacher page.
  if (feature) {
    const level = permissionIn(me, feature.key)
    if (level === 'none' || (feature.level === 'edit' && level !== 'edit')) {
      return <Navigate to={homeOf(me)} replace />
    }
  }
  // Every page and dialog starts fresh in another space: nothing on screen
  // may carry over from the last one.
  const space = spaceOf(me) ?? 'own'

  if (fullScreen) {
    return (
      <CreateDialogsProvider key={space} me={me}>
        <Outlet key={space} />
      </CreateDialogsProvider>
    )
  }

  return (
    // The + menu's dialogs (Add Students, Create class, Add co-teacher), for
    // every page here.
    <CreateDialogsProvider key={space} me={me}>
      {/* Column layout so pages can fill the space under the header
          (flex-1). On phones the bottom padding leaves room for the fixed
          bottom bar, and the top padding keeps pages clear of the notch
          (0 with today's status bar style, which keeps the page below it).
          On paper only the page itself shows (e.g. a student's report). */}
      <div className="flex min-h-dvh flex-col bg-background pt-[env(safe-area-inset-top)] pb-[calc(4rem+env(safe-area-inset-bottom))] text-foreground md:pt-0 md:pb-0 print:min-h-0 print:bg-white print:p-0">
        {/* Tablets and laptops only. Phones get the bottom bar instead (+,
            links, and the offline pill) and the avatar floating at the top
            right, so the first screen is all students. */}
        <header className="hidden items-center gap-4 border-b-2 border-border bg-card px-4 py-3 md:flex print:hidden!">
          <Link to={homeOf(me)}>
            <Wordmark />
          </Link>
          {/* In another teacher's space: whose, and the way back. */}
          <SpaceBadge me={me} placement="header" className="max-w-lg" />
          <div className="ml-auto flex items-center gap-3">
            <ConnectionStatus />
            <HeaderNav />
            <CreateMenu />
            <UserMenu me={me} />
          </div>
        </header>

        {/* Phones: the same, as a line across the top. */}
        <SpaceBadge
          me={me}
          placement="strip"
          className="md:hidden print:hidden!"
        />

        {/* Phones in the browser only; hidden in the installed app. */}
        <InstallBanner className="md:hidden print:hidden!" />

        {/* The installed app only, phones and computers alike, once: the
            offer to turn on reminders before each subject. Not for a
            school's administrator: they have no lesson plans. */}
        {me.school?.role !== 'admin' && (
          <NotificationsBanner className="print:hidden!" />
        )}

        {/* Phones: the avatar alone at the top right, floating over the
            page and scrolling away with it. The anchor sits under the
            install banner, so it never covers the banner, and its 10px
            (h-2.5) moves the page down a little so the avatar has room.
            Pages keep that corner clear on phones: they start with a back
            link or a short title, or pad the first row (max-md:pr-12). */}
        <div className="relative h-2.5 md:hidden print:hidden!">
          <div className="absolute top-5 right-4 z-10">
            <UserMenu me={me} />
          </div>
        </div>

        <Outlet key={space} />

        <BottomNav className="md:hidden print:hidden!" />
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
      <Wordmark className="h-24" />
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
