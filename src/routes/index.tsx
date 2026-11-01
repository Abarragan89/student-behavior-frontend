import { createFileRoute, redirect } from '@tanstack/react-router'
import { LandingPage } from '#/components/landing/LandingPage'
import { meQueryOptions } from '#/lib/auth'
import { validateClassroomResult } from '#/lib/classroom'

export const Route = createFileRoute('/')({
  // The backend sends teachers here after "Connect Google Classroom".
  validateSearch: validateClassroomResult,
  // Logged-in teachers skip the landing page and go straight to their class.
  // No retries and errors ignored, so the page still shows right away if the
  // backend is down.
  beforeLoad: async ({ context, search }) => {
    const user = await context.queryClient
      .query({ ...meQueryOptions, retry: false })
      .catch(() => null)
    // Pass any Google Classroom result on for the Classes page to show.
    if (user) throw redirect({ to: '/classes', search })
  },
  component: LandingPage,
})
