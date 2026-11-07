import { useId, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { UserMinus } from 'lucide-react'
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
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import { formatExpiry } from '#/components/coteachers/invite-link'
import { OfflineNote } from '#/components/offline-note'
import { TeacherAvatar } from '#/components/teacher-avatar'
import { useOnline } from '#/lib/online'
import { removeSchoolMember, schoolQueryOptions } from '#/lib/school'
import type { SchoolDetail, SchoolMember } from '#/lib/school'

/**
 * Who's joined: the administrator first, then the teachers by name, each
 * with Remove. The administrator can't remove themself.
 */
export function SchoolMembersList({ detail }: { detail: SchoolDetail }) {
  const headingId = useId()
  // Focus lands here when a row leaves the list with its focused button.
  const headingRef = useRef<HTMLHeadingElement>(null)
  const online = useOnline()
  const [removing, setRemoving] = useState<SchoolMember | null>(null)
  const members = detail.members ?? []
  const teachers = members.filter((m) => m.role === 'teacher').length
  const estimate = detail.school.staff_estimate

  return (
    <section aria-labelledby={headingId}>
      <Card className="gap-5 rounded-lg border-2 border-border shadow-md ring-0 [--card-spacing:--spacing(6)]">
        <CardHeader>
          <h2
            id={headingId}
            ref={headingRef}
            tabIndex={-1}
            className="text-lg font-bold outline-none"
          >
            Who’s joined
          </h2>
          <CardDescription>
            {teachers === 0
              ? 'No teachers yet. They show up here as they join.'
              : estimate
                ? `${teachers} of about ${estimate} teachers.`
                : teachers === 1
                  ? '1 teacher.'
                  : `${teachers} teachers.`}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <ul className="flex flex-col gap-3">
            {members.map((m) => (
              <li
                key={m.user_id}
                className="flex flex-col gap-3 rounded-lg border-2 border-border p-4 sm:flex-row sm:items-center"
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <TeacherAvatar teacher={m} className="size-10" />
                  <div className="flex min-w-0 flex-col">
                    <p className="flex min-w-0 items-center gap-2">
                      <span className="truncate font-bold">{m.name}</span>
                      {m.is_you && <Badge variant="secondary">You</Badge>}
                    </p>
                    <p className="truncate text-sm text-muted-foreground">
                      {m.email}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {m.role === 'admin' ? (
                        'Administrator'
                      ) : (
                        <>
                          Joined{' '}
                          <time dateTime={m.joined_at}>
                            {formatExpiry(m.joined_at)}
                          </time>
                        </>
                      )}
                    </p>
                  </div>
                </div>
                {!m.is_you && m.role === 'teacher' && (
                  <Button
                    variant="outline"
                    onClick={() => setRemoving(m)}
                    disabled={!online}
                    aria-label={`Remove ${m.name}`}
                    className="h-10 rounded-lg border-2 font-bold"
                  >
                    <UserMinus className="text-destructive" />
                    Remove
                  </Button>
                )}
              </li>
            ))}
          </ul>
          <OfflineNote action="change your staff list" />
        </CardContent>
      </Card>
      <RemoveMemberDialog
        member={removing}
        schoolName={detail.school.name}
        onClose={() => setRemoving(null)}
        onRemoved={() => headingRef.current?.focus()}
      />
    </section>
  )
}

/** "Remove Ana from Lincoln?" Their account and classes stay theirs. */
function RemoveMemberDialog({
  member,
  schoolName,
  onClose,
  onRemoved,
}: {
  member: SchoolMember | null
  schoolName: string
  onClose: () => void
  onRemoved: () => void
}) {
  const queryClient = useQueryClient()
  // Kept while closing, so the text doesn't blank out.
  const [shown, setShown] = useState<SchoolMember | null>(member)
  if (member && member !== shown) setShown(member)

  const remove = useMutation({
    mutationFn: (m: SchoolMember) => removeSchoolMember(m.user_id),
    onSuccess: (_result, m) => {
      onRemoved()
      queryClient.setQueryData<SchoolDetail | null>(
        schoolQueryOptions.queryKey,
        (d) =>
          d && {
            ...d,
            members: d.members?.filter((x) => x.user_id !== m.user_id),
          },
      )
      onClose()
      // Their ring leaves the dashboard too.
      void queryClient.invalidateQueries({ queryKey: ['school-behavior'] })
      toast.success(`Removed ${m.name}`, {
        description:
          'Their account and classes stay theirs. You can no longer view their classes.',
      })
    },
    onError: (error) => {
      console.error('Removing the school member failed:', error)
      toast.error('Couldn’t remove them. Try again.')
      void queryClient.invalidateQueries({
        queryKey: schoolQueryOptions.queryKey,
      })
    },
  })
  const busy = remove.isPending

  return (
    <AlertDialog
      open={member !== null}
      onOpenChange={(open) => {
        if (!open && !busy) onClose()
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="font-bold wrap-break-word">
            Remove {shown?.name} from {schoolName}?
          </AlertDialogTitle>
          <AlertDialogDescription>
            They keep their TeachForFree account, classes and students, and you
            can no longer view their classes. To add them back, send them a join
            link.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={busy}
            onClick={() => shown && remove.mutate(shown)}
          >
            {busy && <Spinner aria-hidden className="size-4" />}
            Remove
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
