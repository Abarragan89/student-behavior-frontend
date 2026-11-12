import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { LogOut } from 'lucide-react'
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
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { OfflineNote } from '#/components/offline-note'
import { SchoolComingCard } from '#/components/school/school-coming-card'
import { SchoolNameCard } from '#/components/school/school-name-card'
import { useOnline } from '#/lib/online'
import { leaveSchool, schoolQueryOptions, setMySchool } from '#/lib/school'
import type { SchoolDetail } from '#/lib/school'

/**
 * The rest of a teacher's School page, under the calendar: which school
 * they're in and who runs it, what's coming, and Leave.
 */
export function SchoolMemberView({ detail }: { detail: SchoolDetail }) {
  const online = useOnline()
  const [leaving, setLeaving] = useState(false)

  return (
    <>
      <SchoolNameCard detail={detail} />
      <p className="text-sm text-muted-foreground">
        Your school’s administrators see your name and email on the staff list,
        and can view your classes, students, marks and notes. They can’t change
        anything. Your lesson plans and conferences stay private to you.
      </p>
      <SchoolComingCard forAdmin={false} />
      <OfflineNote action="leave your school" />
      <Button
        variant="outline"
        onClick={() => setLeaving(true)}
        disabled={!online}
        className="h-11 self-start rounded-lg border-2 px-4 font-bold"
      >
        <LogOut />
        Leave {detail.school.name}
      </Button>
      <LeaveDialog
        open={leaving}
        schoolName={detail.school.name}
        onClose={() => setLeaving(false)}
      />
    </>
  )
}

/** "Leave Lincoln?" For a teacher, or an administrator when another remains. */
export function LeaveDialog({
  open,
  schoolName,
  onClose,
  description = 'You keep your account, classes and students. To join again, ask your administrator for a new link.',
}: {
  open: boolean
  schoolName: string
  onClose: () => void
  description?: string
}) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const leave = useMutation({
    mutationFn: leaveSchool,
    onSuccess: async () => {
      setMySchool(queryClient, null)
      queryClient.removeQueries({ queryKey: schoolQueryOptions.queryKey })
      onClose()
      await navigate({ to: '/account' })
      toast.success(`You left ${schoolName}`, {
        description: 'Your account and classes are unchanged.',
      })
    },
    onError: (error) => {
      console.error('Leaving the school failed:', error)
      toast.error('Couldn’t leave the school. Try again.')
    },
  })
  const busy = leave.isPending

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !busy) onClose()
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="font-bold wrap-break-word">
            Leave {schoolName}?
          </AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={busy}
            onClick={() => leave.mutate()}
          >
            {busy && <Spinner aria-hidden className="size-4" />}
            Leave
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
