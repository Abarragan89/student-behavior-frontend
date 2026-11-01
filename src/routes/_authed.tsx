import {
  Link,
  Navigate,
  Outlet,
  createFileRoute,
  redirect,
} from '@tanstack/react-router'
import { Wordmark } from '#/components/Wordmark'
import { BottomNav, HeaderNav } from '#/components/app-nav'
import { CreateDialogsProvider } from '#/components/create-dialogs'
import { CreateMenu } from '#/components/create-menu'
import { UserMenu } from '#/components/user-menu'
import { InstallBanner } from '#/components/install/install-banner'
import { meQueryOptions, useMe } from '#/lib/auth'

// Layout for pages that need a login: put them in src/routes/_authed/.
// The leading "_" keeps it out of the URL (_authed/classes.tsx → /classes).
// Pages here read the teacher with useSuspenseQuery(meQueryOptions): this check
// has already loaded it, and it stays up to date when 'me' is refetched.
export const Route = createFileRoute('/_authed')({
  beforeLoad: async ({ context }) => {
    const me = await context.queryClient.query(meQueryOptions)
    if (!me) throw redirect({ to: '/login' })
  },
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
          bottom bar. */}
      <div className="flex min-h-dvh flex-col bg-background pb-[calc(4rem+env(safe-area-inset-bottom))] text-foreground md:pb-0">
        <header className="flex items-center gap-4 border-b-2 border-border bg-card px-4 py-3">
          <Link to="/classes">
            <Wordmark />
          </Link>
          {/* Below 768px these move to the bottom bar. */}
          <HeaderNav className="hidden md:flex" />
          <div className="ml-auto flex items-center gap-3">
            <CreateMenu className="hidden md:inline-flex" />
            <UserMenu teacher={me.teacher} />
          </div>
        </header>

        {/* Phones in the browser only; hidden in the installed app. */}
        <InstallBanner className="md:hidden" />

        <Outlet />

        <BottomNav className="md:hidden" />
      </div>
    </CreateDialogsProvider>
  )
}
