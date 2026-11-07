import { createFileRoute, redirect } from '@tanstack/react-router'
import { meQueryOptions } from '#/lib/auth'
import type { Me } from '#/lib/auth'
import { isSchoolAdmin } from '#/lib/workspace'

// /school: an old address. A school's administrator goes to their dashboard
// (keeping ?welcome); everyone else to Account → School. _authed has already
// loaded `me`.
export const Route = createFileRoute('/_authed/school/')({
  validateSearch: (search: Record<string, unknown>): { welcome?: boolean } => ({
    welcome:
      search.welcome === true || search.welcome === 'true' ? true : undefined,
  }),
  beforeLoad: ({ context: { queryClient }, search }) => {
    const me = queryClient.getQueryData<Me | null>(meQueryOptions.queryKey)
    if (isSchoolAdmin(me)) {
      throw redirect({
        to: '/dashboard',
        search: { welcome: search.welcome },
        replace: true,
      })
    }
    throw redirect({ to: '/account/school', replace: true })
  },
})
