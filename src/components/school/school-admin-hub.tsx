import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { ArrowRight, LogOut, UsersRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SchoolInviteCard } from '#/components/school/school-invite-card'
import { LeaveDialog } from '#/components/school/school-member-view'
import { SchoolMembersList } from '#/components/school/school-members-list'
import { SchoolNameCard } from '#/components/school/school-name-card'
import { useOnline } from '#/lib/online'
import type { SchoolDetail } from '#/lib/school'

/**
 * Account → School → View school, for an administrator: the join link
 * (always here, even when hidden on the dashboard), who's joined in the app,
 * the school's name and plan, and Leave (only while another administrator
 * remains: a school always has one). The whole staff, app or not, is on the
 * Staff tab.
 */
export function SchoolAdminHub({
  detail,
  adminName,
}: {
  detail: SchoolDetail
  adminName: string
}) {
  const online = useOnline()
  const [leaving, setLeaving] = useState(false)
  const anotherAdmin = !!detail.members?.some(
    (m) => m.role === 'admin' && !m.is_you,
  )
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
      <div className="flex flex-col items-start gap-2">
        <Button
          variant="outline"
          onClick={() => setLeaving(true)}
          disabled={!online || !anotherAdmin}
          className="h-11 rounded-lg border-2 px-4 font-bold"
        >
          <LogOut />
          Leave {detail.school.name}
        </Button>
        {!anotherAdmin && (
          <p className="text-sm text-muted-foreground">
            You’re the only administrator. Make someone else an administrator
            before you leave.
          </p>
        )}
      </div>
      <LeaveDialog
        open={leaving}
        schoolName={detail.school.name}
        onClose={() => setLeaving(false)}
        description="You keep your account. The other administrators keep running the school. To join again, ask one of them for a new link."
      />
    </>
  )
}
