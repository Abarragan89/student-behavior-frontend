import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
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
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'
import { OfflineNote } from '#/components/offline-note'
import { ApiError } from '#/lib/api'
import { deleteMark, restoreMark } from '#/lib/marks'
import type { Mark } from '#/lib/marks'
import { useOnline } from '#/lib/online'
import { cacheRestoredMark, forgetDeletedMark } from '#/lib/students'

/**
 * How long the toast, and so its Undo, stays up. Longer than after a tap
 * (useGiveMark): this mark is from earlier, so a mistake takes longer to
 * notice. The server can restore it for 10 minutes.
 */
const UNDO_MS = 8000

/** The mark the dialog was opened for, as it was then. */
export type DeleteMarkTarget = {
  mark: Mark
  /** The day it's listed under on the student's page, "2026-11-01". */
  date: string
  /** When it was given, as shown on the page: "9:41 AM". */
  time: string
  /** Whose it is, for the words: their first name. */
  studentName: string
}

/**
 * The trash can on a mark in a student's "All marks". Asks first, then
 * deletes it; the toast that follows has an Undo that puts it back exactly as
 * it was.
 *
 * target is a snapshot taken when the dialog opened, so it doesn't change
 * while it closes.
 */
export function DeleteMarkDialog({
  target,
  open,
  onOpenChange,
  onDeleted,
  finalFocus,
}: {
  target: DeleteMarkTarget
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Called once the mark is gone, just before the dialog closes. */
  onDeleted: () => void
  /** Where focus goes when the dialog closes (see the dialog's finalFocus). */
  finalFocus?: () => HTMLElement | boolean | null
}) {
  const queryClient = useQueryClient()
  const online = useOnline()
  const { mark, time, studentName } = target

  const remove = useMutation({
    mutationFn: (t: DeleteMarkTarget) => deleteMark(t.mark.id),
    onSuccess: (_, t) => {
      onDeleted()
      forgetDeletedMark(queryClient, t.mark)
      onOpenChange(false)
      toast.success(`Deleted “${t.mark.name}”`, {
        description: `${t.studentName} · ${t.time}`,
        duration: UNDO_MS,
        action: {
          label: 'Undo',
          onClick: () => void putBack(queryClient, t),
        },
      })
    },
    onError: (error) => {
      console.error('Deleting the mark failed:', error)
      // Stays open, so it's easy to try again.
      toast.error(deleteErrorMessage(error))
    },
  })
  const deleting = remove.isPending

  return (
    <AlertDialog
      open={open}
      // Stay open while deleting, so it can't be dismissed halfway.
      onOpenChange={(next) => {
        if (!deleting) onOpenChange(next)
      }}
    >
      <AlertDialogContent
        finalFocus={finalFocus}
        className="rounded-lg border-2 border-border ring-0"
      >
        <AlertDialogHeader>
          <AlertDialogTitle className="font-bold wrap-break-word">
            Delete “{mark.name}”?
          </AlertDialogTitle>
          <AlertDialogDescription>
            This takes the {time} mark off {studentName}’s record. You’ll have a
            few seconds to undo it.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <OfflineNote action="delete marks" />
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => remove.mutate(target)}
            disabled={deleting || !online}
            aria-busy={deleting}
            // Solid red, like removing a mark type. The label stays
            // (invisible) under the spinner so the size holds.
            className={cn(
              'relative bg-destructive font-bold text-destructive-foreground hover:bg-destructive/90',
              deleting && 'disabled:opacity-100',
            )}
          >
            <span className={cn(deleting && 'invisible')}>Delete mark</span>
            {deleting && (
              <Spinner
                aria-label="Deleting mark"
                className="absolute inset-0 m-auto size-4"
              />
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

/**
 * The toast's Undo. Not tied to the dialog or the page, which may both be
 * gone by the time it's pressed.
 */
async function putBack(queryClient: QueryClient, target: DeleteMarkTarget) {
  const { mark, date, time, studentName } = target
  const description = `${studentName} · ${time}`
  const id = toast.loading(`Restoring “${mark.name}”…`, { description })
  try {
    const restored = await restoreMark(mark.id)
    cacheRestoredMark(queryClient, restored, date)
    toast.success(`Restored “${mark.name}”`, { id, description })
  } catch (error) {
    console.error('Restoring the mark failed:', error)
    // 404: too long ago, or the student or class was deleted since. Trying
    // again won't help.
    const gone = error instanceof ApiError && error.status === 404
    toast.error(`Couldn’t restore “${mark.name}”`, {
      id,
      description: restoreErrorMessage(error),
      duration: gone ? undefined : UNDO_MS,
      action: gone
        ? undefined
        : {
            label: 'Try again',
            onClick: () => void putBack(queryClient, target),
          },
    })
  }
}

function deleteErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 401) {
      return 'Your session has ended. Sign in again to delete marks.'
    }
    if (error.status === 429) {
      return 'Too many changes for now. Wait a minute, then try again.'
    }
    return 'Couldn’t delete the mark. Please try again.'
  }
  // fetch() throws a TypeError when the server can't be reached (and an
  // AbortError when it takes too long).
  return 'Couldn’t reach the server. Check your connection and try again.'
}

function restoreErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 404) return 'It can’t be brought back anymore.'
    if (error.status === 401) return 'Your session has ended.'
    if (error.status === 429) return 'Too many changes for now.'
    return 'Something went wrong on our side.'
  }
  return 'Couldn’t reach the server. Check your connection.'
}
