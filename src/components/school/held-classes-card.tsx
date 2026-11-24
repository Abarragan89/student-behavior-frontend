import { useId, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Eye, Trash2, Undo2 } from 'lucide-react'
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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import { OfflineNote } from '#/components/offline-note'
import { useOnline } from '#/lib/online'
import {
  HELD_CLASS_DAYS,
  deleteHeldClass,
  formatLongDate,
  heldClassesQueryOptions,
  releaseSchoolClass,
} from '#/lib/school'
import type { HeldClass } from '#/lib/school'
import { useSwitchSpace } from '#/lib/workspace'

type Pending = { kind: 'release' | 'delete'; target: HeldClass }

/**
 * For administrators: the school's classes kept after their teachers left.
 * Each is deleted HELD_CLASS_DAYS after its teacher left. Until then it can
 * be viewed (and its reports printed), given back to the teacher as their
 * own, or deleted now. Shows nothing while there are none.
 */
export function HeldClassesCard() {
  const headingId = useId()
  const online = useOnline()
  const held = useQuery(heldClassesQueryOptions)
  const { switchTo, switching } = useSwitchSpace()
  const [pending, setPending] = useState<Pending | null>(null)

  if (!held.data || held.data.length === 0) return null
  const busy = switching !== undefined

  return (
    <section aria-labelledby={headingId}>
      <Card className="gap-4 rounded-lg border-2 border-border shadow-md ring-0 [--card-spacing:--spacing(6)]">
        <CardHeader>
          <h2 id={headingId} className="text-lg font-bold">
            Classes from teachers who left
          </h2>
          <CardDescription>
            When a teacher leaves, the school’s classes stay with the school for{' '}
            {HELD_CLASS_DAYS} days, so you can view them and print reports. Then
            they’re deleted. The teacher can’t see them anymore.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <ul className="flex flex-col divide-y-2 divide-border rounded-lg border-2 border-border">
            {held.data.map((c) => (
              <li
                key={c.id}
                className="flex flex-col gap-2 px-3 py-3 sm:flex-row sm:items-center"
              >
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="font-bold wrap-break-word">{c.name}</span>
                  <span className="text-sm text-muted-foreground">
                    {c.teacher_name} · deleted on{' '}
                    {formatLongDate(c.delete_after)}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    onClick={() =>
                      void switchTo(c.teacher_id, {
                        to: '/classes',
                        asAdmin: true,
                      })
                    }
                    disabled={busy || !online}
                    className="h-9 rounded-lg border-2 px-3 font-bold"
                  >
                    {switching === c.teacher_id ? (
                      <Spinner aria-hidden className="size-4" />
                    ) : (
                      <Eye />
                    )}
                    View
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setPending({ kind: 'release', target: c })}
                    disabled={!online}
                    className="h-9 rounded-lg border-2 px-3 font-bold"
                  >
                    <Undo2 />
                    Give back
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setPending({ kind: 'delete', target: c })}
                    disabled={!online}
                    className="h-9 rounded-lg border-2 px-3 font-bold"
                  >
                    <Trash2 />
                    Delete now
                  </Button>
                </div>
              </li>
            ))}
          </ul>
          <OfflineNote action="change these classes" />
        </CardContent>
      </Card>
      <ConfirmDialog pending={pending} onClose={() => setPending(null)} />
    </section>
  )
}

function ConfirmDialog({
  pending,
  onClose,
}: {
  pending: Pending | null
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const act = useMutation({
    mutationFn: (p: Pending) =>
      p.kind === 'release'
        ? releaseSchoolClass(p.target.id)
        : deleteHeldClass(p.target.id),
    onSuccess: async (_, p) => {
      await queryClient.invalidateQueries({
        queryKey: heldClassesQueryOptions.queryKey,
      })
      onClose()
      toast.success(
        p.kind === 'release'
          ? `${p.target.name} is ${p.target.teacher_name}’s again`
          : `${p.target.name} was deleted`,
      )
    },
    onError: (error, p) => {
      console.error('Changing a held class failed:', error)
      toast.error(
        p.kind === 'release'
          ? 'Couldn’t give the class back. Try again.'
          : 'Couldn’t delete the class. Try again.',
      )
    },
  })
  const busy = act.isPending
  const c = pending?.target
  const release = pending?.kind === 'release'

  return (
    <AlertDialog
      open={pending !== null}
      onOpenChange={(next) => {
        if (!next && !busy) onClose()
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="font-bold wrap-break-word">
            {release
              ? `Give ${c?.name} back to ${c?.teacher_name}?`
              : `Delete ${c?.name}?`}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {release
              ? 'It goes back into their account as their own class, with its students, marks and notes. It’s no longer part of the school’s records, and you won’t see it.'
              : 'Its marks and notes, and the students who aren’t in another of their classes, are deleted for good. This can’t be undone.'}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant={release ? 'default' : 'destructive'}
            disabled={busy}
            onClick={(e) => {
              e.preventDefault()
              if (pending) act.mutate(pending)
            }}
          >
            {busy && <Spinner aria-hidden className="size-4" />}
            {release ? 'Give back' : 'Delete'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
