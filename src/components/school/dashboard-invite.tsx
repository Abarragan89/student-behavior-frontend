import { useState } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { SchoolInviteCard } from '#/components/school/school-invite-card'
import { hideInvite, inviteHidden } from '#/lib/school'
import type { SchoolDetail } from '#/lib/school'

/**
 * The join link at the top of the administrator's dashboard: the first thing
 * they see after starting the school. The X hides it on this device, after
 * saying where to find it again (Account → School → View school).
 */
export function DashboardInvite({
  detail,
  adminName,
  welcome,
}: {
  detail: SchoolDetail
  adminName: string
  welcome: boolean
}) {
  const schoolId = detail.school.id
  const [hidden, setHidden] = useState(() => inviteHidden(schoolId))
  const [asking, setAsking] = useState(false)
  if (hidden) return null

  return (
    <>
      <SchoolInviteCard
        detail={detail}
        adminName={adminName}
        welcome={welcome}
        onDismiss={() => setAsking(true)}
      />
      <AlertDialog open={asking} onOpenChange={setAsking}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-bold">
              Find this link on your Account page
            </AlertDialogTitle>
            <AlertDialogDescription>
              You can copy the join link and the message for your staff again
              anytime: Account → School → View school.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it here</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                hideInvite(schoolId)
                setAsking(false)
                setHidden(true)
              }}
            >
              Hide it
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
