import { createFileRoute, redirect } from '@tanstack/react-router'
import { LandingPage } from '#/components/landing/LandingPage'
import { signedInTeacher } from '#/lib/auth'
import { validateClassroomResult } from '#/lib/classroom'
import { isStandalone } from '#/lib/pwa-install'

export const Route = createFileRoute('/')({
  // The backend sends teachers here after "Connect Google Classroom".
  validateSearch: validateClassroomResult,
  // Logged-in teachers skip the landing page and go straight to their class.
  // The page still shows right away if the backend is down or offline.
  beforeLoad: async ({ context, search }) => {
    const user = await signedInTeacher(context.queryClient)
    // Pass any Google Classroom result on for the Classes page to show.
    if (user) throw redirect({ to: '/classes', search })
    // The installed app skips the marketing page and goes to sign-in.
    if (isStandalone()) throw redirect({ to: '/login' })
  },
  component: LandingPage,
})
