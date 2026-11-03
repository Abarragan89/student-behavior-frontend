import { useId, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ArrowRight, LogOut } from 'lucide-react'
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
import { OfflineNote } from '#/components/offline-note'
import { TeacherAvatar } from '#/components/teacher-avatar'
import { meQueryOptions } from '#/lib/auth'
import type { Me } from '#/lib/auth'
import { leaveSpace, permissionSummary } from '#/lib/coteachers'
import type { Space } from '#/lib/coteachers'
import { useOnline } from '#/lib/online'
import { spaceOf, useSwitchSpace } from '#/lib/workspace'

/**
 * The Account page's Co-teaching: teachers who made you their co-teacher,
 * what they let you do, and a way into (or out of) each classroom. Shown
 * only when there's at least one.
 */
export function CoteachingSection({ me }: { me: Me }) {
  const headingId = useId()
  const online = useOnline()
  const { switchTo, switching } = useSwitchSpace()
  const [leaving, setLeaving] = useState<Space | null>(null)
  const spaces = me.coteaching ?? []
  const current = spaceOf(me)
  if (spaces.length === 0) return null

  return (
    <section aria-labelledby={headingId}>
      <Card className="gap-5 rounded-lg border-2 border-border shadow-md ring-0 [--card-spacing:--spacing(6)]">
        <CardHeader>
          <h2 id={headingId} className="text-lg font-bold">
            Co-teaching
          </h2>
          <CardDescription>
            Classrooms other teachers share with you. They choose what you can
            see or change.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <ul className="flex flex-col gap-3">
            {spaces.map((s) => {
              const here = s.owner_id === current
              return (
                <li
                  key={s.owner_id}
                  className="flex flex-col gap-3 rounded-lg border-2 border-border p-4"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <TeacherAvatar teacher={s} className="size-10" />
                    <div className="flex min-w-0 flex-1 flex-col">
                      <p className="truncate font-bold">{s.name}</p>
                      <p className="truncate text-sm text-muted-foreground">
                        {s.email}
                      </p>
                    </div>
                    {here && <Badge variant="secondary">Open now</Badge>}
                  </div>
                  <p className="text-sm">{permissionSummary(s.permissions)}</p>
                  <div className="flex gap-2">
                    {!here && (
                      <Button
                        onClick={() => void switchTo(s.owner_id)}
                        disabled={!online || switching !== undefined}
                        aria-busy={switching === s.owner_id}
                        className="h-10 flex-1 rounded-lg border-2 border-border font-bold sm:flex-none"
                      >
                        {switching === s.owner_id ? (
                          <Spinner aria-hidden className="size-4" />
                        ) : (
                          <ArrowRight />
                        )}
                        Open {s.name}’s classroom
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      onClick={() => setLeaving(s)}
                      disabled={!online}
                      aria-label={`Leave ${s.name}’s classroom`}
                      className="h-10 flex-1 rounded-lg border-2 font-bold sm:flex-none"
                    >
                      <LogOut />
                      Leave
                    </Button>
                  </div>
                </li>
              )
            })}
          </ul>
          <OfflineNote action="open or leave a classroom" />
        </CardContent>
      </Card>

      <LeaveDialog
        space={leaving}
        current={current}
        onClose={() => setLeaving(null)}
      />
    </section>
  )
}

/** "Leave Ms. Rivera's classroom?" Only they can invite you back. */
function LeaveDialog({
  space,
  current,
  onClose,
}: {
  space: Space | null
  current: string | null
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const { switchTo } = useSwitchSpace()
  // Kept while closing, so the text doesn't blank out.
  const [shown, setShown] = useState<Space | null>(space)
  if (space && space !== shown) setShown(space)

  const leave = useMutation({
    mutationFn: (s: Space) => leaveSpace(s.owner_id),
    onSuccess: async (_result, s) => {
      onClose()
      if (s.owner_id === current) {
        // Leaving the classroom on screen: back to your own.
        await switchTo(null, { to: '/account', quiet: true })
      } else {
        void queryClient.invalidateQueries({
          queryKey: meQueryOptions.queryKey,
        })
      }
      toast.success(`You left ${s.name}’s classroom`)
    },
    onError: (error) => {
      console.error('Leaving the classroom failed:', error)
      toast.error('Couldn’t leave. Try again.')
    },
  })
  const busy = leave.isPending

  return (
    <AlertDialog
      open={space !== null}
      onOpenChange={(open) => {
        if (!open && !busy) onClose()
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="font-bold wrap-break-word">
            Leave {shown?.name}’s classroom?
          </AlertDialogTitle>
          <AlertDialogDescription>
            You’ll no longer be able to open it. Only {shown?.name} can invite
            you back.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={busy}
            onClick={() => shown && leave.mutate(shown)}
          >
            {busy && <Spinner aria-hidden className="size-4" />}
            Leave
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
