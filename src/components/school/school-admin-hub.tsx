import { SchoolComingCard } from '#/components/school/school-coming-card'
import { SchoolInviteCard } from '#/components/school/school-invite-card'
import { SchoolMembersList } from '#/components/school/school-members-list'
import { SchoolNameCard } from '#/components/school/school-name-card'
import type { SchoolDetail } from '#/lib/school'

/**
 * The administrator's School page. The join link comes first, so it's the
 * first thing they see after starting the school (and above the fold on a
 * phone); then who's joined, the school itself, and what's coming.
 */
export function SchoolAdminHub({
  detail,
  adminName,
  welcome,
}: {
  detail: SchoolDetail
  adminName: string
  welcome: boolean
}) {
  return (
    <>
      <SchoolInviteCard
        detail={detail}
        adminName={adminName}
        welcome={welcome}
      />
      <SchoolMembersList detail={detail} />
      <SchoolNameCard detail={detail} />
      <SchoolComingCard forAdmin />
    </>
  )
}
