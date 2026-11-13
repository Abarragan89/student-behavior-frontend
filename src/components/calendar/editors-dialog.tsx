import { Link } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { CircleAlert, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import { OfflineNote } from '#/components/offline-note'
import { ResponsiveDialog } from '#/components/responsive-dialogue'
import { TeacherAvatar } from '#/components/teacher-avatar'
import { useOnline } from '#/lib/online'
import { changeMember, schoolQueryOptions } from '#/lib/school'
import type { SchoolDetail, SchoolMember } from '#/lib/school'

/**
 * Who can edit the calendar: the administrators always, and each teacher
 * who's joined, with a switch. A teacher turned on gets the calendar's
 * editor on their School page (Account → School); nothing else changes for
 * them. Administrators only.
 */
export function EditorsDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const school = useQuery({ ...schoolQueryOptions, enabled: open })
  const queryClient = useQueryClient()
  const online = useOnline()
  const members = school.data?.members ?? []
  const admins = members.filter((m) => m.role === 'admin')
  const teachers = members.filter((m) => m.role === 'teacher')

  const setMember = (userId: string, change: Partial<SchoolMember>) =>
    queryClient.setQueryData<SchoolDetail | null>(
      schoolQueryOptions.queryKey,
      (d) =>
        d && {
          ...d,
          members: d.members?.map((m) =>
            m.user_id === userId ? { ...m, ...change } : m,
          ),
        },
    )

  const toggle = useMutation({
    mutationFn: ({ member, on }: { member: SchoolMember; on: boolean }) =>
      changeMember(member.user_id, { can_edit_calendar: on }),
    // The switch moves at once; a failure puts it back.
    onMutate: ({ member, on }) =>
      setMember(member.user_id, { can_edit_calendar: on }),
    onSuccess: (saved) =>
      setMember(saved.user_id, { can_edit_calendar: saved.can_edit_calendar }),
    onError: (error, { member, on }) => {
      console.error('Changing who can edit the calendar failed:', error)
      setMember(member.user_id, { can_edit_calendar: !on })
      toast.error(`Couldn’t change ${member.name}. Try again.`)
      void queryClient.invalidateQueries({
        queryKey: schoolQueryOptions.queryKey,
      })
    },
  })

  return (
    <ResponsiveDialog
      isOpen={open}
      setIsOpen={onOpenChange}
      title="Who can edit the calendar"
      description="Administrators always can. Teachers you turn on here can add, change and delete events, breaks and categories, and import. They also see private events and your staff list, to send people reminders."
      showDescription
      className="sm:max-w-lg"
    >
      {school.data ? (
        <div className="flex flex-col gap-4">
          <ul className="flex flex-col gap-2">
            {[...admins, ...teachers].map((m) => {
              const admin = m.role === 'admin'
              return (
                <li
                  key={m.user_id}
                  className="flex items-center gap-3 rounded-lg border-2 border-border p-3"
                >
                  <TeacherAvatar teacher={m} className="size-9" />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <p className="truncate font-bold">
                      {m.name}
                      {m.is_you && (
                        <span className="font-normal text-muted-foreground">
                          {' '}
                          (you)
                        </span>
                      )}
                    </p>
                    <p className="truncate text-sm text-muted-foreground">
                      {admin ? 'Administrator · always' : m.email}
                    </p>
                  </div>
                  <Switch
                    checked={admin || m.can_edit_calendar}
                    disabled={admin || !online}
                    onCheckedChange={(on: boolean) =>
                      toggle.mutate({ member: m, on })
                    }
                    aria-label={`${m.name} can edit the calendar`}
                  />
                </li>
              )
            })}
          </ul>
          {teachers.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No teachers have joined yet. Share your join link from{' '}
              <Link
                to="/account/school"
                className="font-bold text-foreground underline underline-offset-4"
              >
                Account → School
              </Link>
              .
            </p>
          )}
          <OfflineNote action="change who can edit" />
        </div>
      ) : school.isError ? (
        <div role="alert" className="flex flex-col items-start gap-3">
          <p className="flex items-center gap-2 font-medium">
            <CircleAlert className="size-5 shrink-0 text-destructive" />
            Couldn’t load your staff.
          </p>
          <Button
            variant="outline"
            onClick={() => void school.refetch()}
            disabled={school.isFetching}
            className="h-10 rounded-lg border-2 font-bold"
          >
            <RefreshCw className={cn(school.isFetching && 'animate-spin')} />
            Try again
          </Button>
        </div>
      ) : (
        <p
          role="status"
          className="flex items-center gap-2 font-medium text-muted-foreground"
        >
          <Spinner aria-hidden className="size-5" />
          Loading…
        </p>
      )}
    </ResponsiveDialog>
  )
}
