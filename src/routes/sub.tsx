import { createFileRoute, redirect } from '@tanstack/react-router'
import { keepSubToken, subToken } from '#/lib/sub'
import { SubPage } from '#/components/sub/sub-page'

// /sub#<key>: a substitute's view of one day, from a link the teacher shared
// (see src/lib/sub.ts). No account and no sign-in: the key is the way in.
// Outside _authed, so nothing here asks who's signed in.
export const Route = createFileRoute('/sub')({
  beforeLoad: ({ location, context: { queryClient } }) => {
    if (location.hash) {
      // Another link in the same tab: none of the last one's data carries
      // over.
      if (keepSubToken(location.hash)) {
        queryClient.removeQueries({ queryKey: ['sub'] })
      }
      // Off the address bar at once, so a projected screen doesn't show it.
      throw redirect({ to: '/sub', replace: true })
    }
    // Through the context, so the page follows a new link opened in a tab
    // that's already here.
    return { subKey: subToken() }
  },
  component: SubRoute,
})

function SubRoute() {
  const { subKey } = Route.useRouteContext()
  return <SubPage key={subKey ?? ''} hasKey={subKey !== null} />
}
