import { Link } from '@tanstack/react-router'
import { ArrowRight, UsersRound } from 'lucide-react'
import { SchoolInviteCard } from '#/components/school/school-invite-card'
import { SchoolMembersList } from '#/components/school/school-members-list'
import { SchoolNameCard } from '#/components/school/school-name-card'
import type { SchoolDetail } from '#/lib/school'

/**
 * Account → School → View school, for the administrator: the join link (always
 * here, even when hidden on the dashboard), who's joined in the app, and the
 * school's name and plan. The whole staff, app or not, is on the Staff tab.
 */
export function SchoolAdminHub({
  detail,
  adminName,
}: {
  detail: SchoolDetail
  adminName: string
}) {
  return (
    <>
      <SchoolInviteCard detail={detail} adminName={adminName} welcome={false} />
      <SchoolMembersList detail={detail} />
      <Link
        to="/staff"
        className="flex items-center gap-3 rounded-lg border-2 border-border bg-card px-4 py-3 text-sm font-bold outline-none hover:bg-muted focus-visible:ring-4 focus-visible:ring-ring"
      >
        <UsersRound className="size-5 shrink-0" />
        <span className="min-w-0 flex-1">
          Your whole staff, including people who don’t use TeachForFree, is on
          the Staff tab.
        </span>
        <ArrowRight className="size-4 shrink-0" />
      </Link>
      <SchoolNameCard detail={detail} />
    </>
  )
}
