import { useId, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { GraduationCap, ShieldCheck, UserMinus } from 'lucide-react'
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
import { ApiError } from '#/lib/api'
import { useOnline } from '#/lib/online'
import {
  changeMember,
  removeSchoolMember,
  schoolQueryOptions,
} from '#/lib/school'
import type { SchoolDetail, SchoolMember } from '#/lib/school'

/**
 * Who's joined: the administrators first, then the teachers. Each person
 * but you has Make administrator (or Make teacher) and Remove. A school
 * always keeps one administrator: you can't change or remove yourself, so
 * someone is always left (the server checks the same).
 */
export function SchoolMembersList({ detail }: { detail: SchoolDetail }) {
  const headingId = useId()
  // Focus lands here when a row leaves the list with its focused button.
  const headingRef = useRef<HTMLHeadingElement>(null)
  const online = useOnline()
  const [removing, setRemoving] = useState<SchoolMember | null>(null)
  const [changing, setChanging] = useState<SchoolMember | null>(null)
  const all = detail.members ?? []
  const members = [
    ...all.filter((m) => m.role === 'admin'),
    ...all.filter((m) => m.role === 'teacher'),
  ]
  const admins = all.length - all.filter((m) => m.role === 'teacher').length
  const teachers = all.length - admins
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
            {admins > 1 && `${admins} administrators. `}
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
                className="flex flex-col gap-3 rounded-lg border-2 border-border p-4"
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <TeacherAvatar teacher={m} className="size-10" />
                  <div className="flex min-w-0 flex-col">
                    <p className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="truncate font-bold">{m.name}</span>
                      {m.is_you && <Badge variant="secondary">You</Badge>}
                      {m.role === 'teacher' && m.can_edit_calendar && (
                        <Badge variant="outline">Calendar editor</Badge>
                      )}
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
                {!m.is_you && (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setChanging(m)}
                      disabled={!online}
                      aria-label={
                        m.role === 'admin'
                          ? `Make ${m.name} a teacher`
                          : `Make ${m.name} an administrator`
                      }
                      className="h-10 rounded-lg border-2 font-bold"
                    >
                      {m.role === 'admin' ? <GraduationCap /> : <ShieldCheck />}
                      {m.role === 'admin'
                        ? 'Make teacher'
                        : 'Make administrator'}
                    </Button>
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
                  </div>
                )}
              </li>
            ))}
          </ul>
          <OfflineNote action="change your staff list" />
        </CardContent>
      </Card>
      <RoleDialog
        member={changing}
        schoolName={detail.school.name}
        onClose={() => setChanging(null)}
      />
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
          m.role === 'admin'
            ? 'Their account stays theirs.'
            : 'Their account and classes stay theirs. You can no longer view their classes.',
      })
    },
    onError: (error) => {
      console.error('Removing the school member failed:', error)
      toast.error(problem(error) ?? 'Couldn’t remove them. Try again.')
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
            {shown?.role === 'admin'
              ? 'They stop being an administrator and keep their TeachForFree account. To add them back, send them a join link.'
              : 'They keep their TeachForFree account, classes and students, and you can no longer view their classes. To add them back, send them a join link.'}
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

/** What a refused change means, in words; null for anything else. */
function problem(error: unknown): string | null {
  if (!(error instanceof ApiError)) return null
  if (error.reason === 'last_admin')
    return 'A school needs at least one administrator.'
  if (error.reason === 'own_role')
    return 'Another administrator has to change your role.'
  return null
}

/**
 * "Make Ana an administrator of Lincoln?" or "Make Ana a teacher again?"
 * An administrator sees exactly what you see and has no teacher tabs; their
 * own classes and lesson plans are kept, hidden, until they're a teacher
 * again.
 */
function RoleDialog({
  member,
  schoolName,
  onClose,
}: {
  member: SchoolMember | null
  schoolName: string
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  // Kept while closing, so the text doesn't blank out.
  const [shown, setShown] = useState<SchoolMember | null>(member)
  if (member && member !== shown) setShown(member)
  const toAdmin = shown?.role !== 'admin'

  const change = useMutation({
    mutationFn: (m: SchoolMember) =>
      changeMember(m.user_id, {
        role: m.role === 'admin' ? 'teacher' : 'admin',
      }),
    onSuccess: (saved, m) => {
      queryClient.setQueryData<SchoolDetail | null>(
        schoolQueryOptions.queryKey,
        (d) =>
          d && {
            ...d,
            members: d.members?.map((x) =>
              x.user_id === saved.user_id
                ? { ...x, ...saved, is_you: x.is_you }
                : x,
            ),
          },
      )
      onClose()
      // Teachers have a ring on the dashboard and administrators a badge
      // on the staff list.
      void queryClient.invalidateQueries({ queryKey: ['school-behavior'] })
      void queryClient.invalidateQueries({ queryKey: ['school-staff'] })
      toast.success(
        saved.role === 'admin'
          ? `${m.name} is now an administrator`
          : `${m.name} is a teacher again`,
      )
    },
    onError: (error) => {
      console.error('Changing the member’s role failed:', error)
      toast.error(problem(error) ?? 'Couldn’t change their role. Try again.')
      void queryClient.invalidateQueries({
        queryKey: schoolQueryOptions.queryKey,
      })
    },
  })
  const busy = change.isPending

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
            {toAdmin
              ? `Make ${shown?.name} an administrator of ${schoolName}?`
              : `Make ${shown.name} a teacher again?`}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {toAdmin
              ? 'They’ll see what you see: the dashboard, every teacher’s classes, students and notes (view only), the calendar and the staff list. Their own classes and lesson plans are hidden while they’re an administrator. Nothing is deleted: making them a teacher again brings it all back.'
              : 'They lose the administrator tabs and get their own classes and lesson plans back.'}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={busy}
            onClick={() => shown && change.mutate(shown)}
          >
            {busy && <Spinner aria-hidden className="size-4" />}
            {toAdmin ? 'Make administrator' : 'Make teacher'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
