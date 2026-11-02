import { createFileRoute, redirect } from '@tanstack/react-router'
import type { Lang } from '#/lib/conference-i18n'
import {
  conferenceToken,
  keepConferenceToken,
  keepLanguage,
} from '#/lib/conference-link'
import { FamilyPage } from '#/components/conference-link/family-page'

// /conference#<code> (or /conference?lang=es#<code>): a family's page for
// their child's parent conference, opened from the QR code on the notice
// (see src/lib/conference-link.ts). No account and no sign-in: the code is
// the way in. Outside _authed, so nothing here asks who's signed in.
export const Route = createFileRoute('/conference')({
  validateSearch: (search: Record<string, unknown>): { lang?: Lang } => ({
    lang:
      search.lang === 'es' || search.lang === 'en' ? search.lang : undefined,
  }),
  beforeLoad: ({ location, search, context: { queryClient } }) => {
    if (location.hash || search.lang) {
      // The Spanish half of the notice has its own code that says so.
      if (search.lang) keepLanguage(search.lang)
      // Another code in the same tab: none of the last one's data carries
      // over.
      if (location.hash && keepConferenceToken(location.hash)) {
        queryClient.removeQueries({ queryKey: ['conference-link'] })
      }
      // Off the address bar at once, so it isn't in a screenshot or a
      // copied link.
      throw redirect({ to: '/conference', search: {}, replace: true })
    }
    // Through the context, so the page follows a new code opened in a tab
    // that's already here.
    return { conferenceKey: conferenceToken() }
  },
  component: ConferenceRoute,
})

function ConferenceRoute() {
  const { conferenceKey } = Route.useRouteContext()
  return (
    <FamilyPage key={conferenceKey ?? ''} hasKey={conferenceKey !== null} />
  )
}
