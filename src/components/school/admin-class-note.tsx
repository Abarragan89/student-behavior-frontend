import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Building2, Undo2 } from 'lucide-react'
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
import { meQueryOptions } from '#/lib/auth'
import type { OpenClassroom } from '#/lib/auth'
import { useOnline } from '#/lib/online'
import {
  HELD_CLASS_DAYS,
  heldClassesQueryOptions,
  releaseSchoolClass,
} from '#/lib/school'

/**
 * Under a class an administrator is viewing: that it's part of the school's
 * records (or kept after its teacher left), and "Give back": the class
 * becomes the teacher's own again, for a class added to the school by
 * mistake. Teachers can't take a class out of the school themselves.
 */
export function AdminClassNote({
  classroom,
  teacherName,
}: {
  classroom: OpenClassroom
  teacherName: string
}) {
  const online = useOnline()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const release = useMutation({
    mutationFn: () => releaseSchoolClass(classroom.id),
    onSuccess: async () => {
      setOpen(false)
      toast.success(`${classroom.name} is ${teacherName}’s own again`)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: meQueryOptions.queryKey }),
        queryClient.invalidateQueries({
          queryKey: heldClassesQueryOptions.queryKey,
        }),
      ])
    },
    onError: (error) => {
      console.error('Giving a class back failed:', error)
      toast.error('Couldn’t give the class back. Try again.')
    },
  })
  const busy = release.isPending

  return (
    <div className="mt-auto pt-10">
      <div className="flex flex-col items-start gap-3 border-t-2 border-border pt-6">
        <p className="flex gap-2 text-sm text-muted-foreground">
          <Building2 className="mt-0.5 size-4 shrink-0" />
          {classroom.held
            ? `${teacherName} left the school. The school keeps this class for ${HELD_CLASS_DAYS} days after they left, then it’s deleted.`
            : `This class is part of your school’s records. ${teacherName}’s own classes aren’t shown to you.`}
        </p>
        <OfflineNote action="give the class back" />
        <Button
          variant="outline"
          onClick={() => setOpen(true)}
          disabled={!online}
          className="h-11 rounded-lg border-2 px-4 font-bold whitespace-normal"
        >
          <Undo2 />
          Give back to {teacherName}
        </Button>
      </div>
      <AlertDialog
        open={open}
        onOpenChange={(next) => {
          if (!next && !busy) setOpen(false)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-bold wrap-break-word">
              Give {classroom.name} back to {teacherName}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              It becomes their own class, with its students, marks and notes.
              It’s no longer part of the school’s records, and you won’t see it
              anymore. Only {teacherName} can add it to the school again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={(e) => {
                e.preventDefault()
                release.mutate()
              }}
            >
              {busy && <Spinner aria-hidden className="size-4" />}
              Give back
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
