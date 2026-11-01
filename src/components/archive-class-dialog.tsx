import { useMutation, useQueryClient } from '@tanstack/react-query'
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
import { meQueryOptions } from '#/lib/auth'
import {
  archiveClassroom,
  archivedClassroomsQueryOptions,
  cacheArchived,
} from '#/lib/classroom'
import { useOnline } from '#/lib/online'

/** The class the dialog was opened for, as it was then. */
export type ArchiveTarget = {
  id: string
  name: string
  /** It was the teacher's only class, so it can't be archived. */
  onlyClass: boolean
}

/**
 * Asks before archiving the open class ("Archive class" at the bottom of the
 * Classes page). Archiving hides it from the class list and opens the oldest
 * class left. Its students and marks are kept, and it can be unarchived from
 * the Account page. A teacher always needs one class open, so for their only
 * class this explains why it can't be archived and offers Create class.
 *
 * target is a snapshot taken when the dialog opened: once archiving works,
 * another class is open, and the dialog shouldn't change while it closes.
 */
export function ArchiveClassDialog({
  target,
  open,
  onOpenChange,
  onArchived,
  onCreateClass,
  finalFocus,
}: {
  target: ArchiveTarget
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Called once the class is archived and another one is open. */
  onArchived: () => void
  onCreateClass: () => void
  /** Where focus goes when the dialog closes (see the dialog's finalFocus). */
  finalFocus?: () => HTMLElement | boolean | null
}) {
  const queryClient = useQueryClient()
  const online = useOnline()

  const archive = useMutation({
    mutationFn: (classroom: ArchiveTarget) => archiveClassroom(classroom.id),
    onSuccess: (me, classroom) => {
      cacheArchived(queryClient, me)
      onArchived()
      onOpenChange(false)
      toast.success(`Archived ${classroom.name}`, {
        description: 'You can unarchive it from your Account page.',
      })
    },
    onError: (error, classroom) => {
      console.error('Archiving the class failed:', error)
      toast.error(archiveErrorMessage(error, classroom.name))
      // This page was out of date (archived in another tab, or another class
      // was archived first): reload the class list and close.
      if (
        error instanceof ApiError &&
        (error.status === 404 || error.status === 409)
      ) {
        void queryClient.invalidateQueries({
          queryKey: meQueryOptions.queryKey,
        })
        void queryClient.invalidateQueries({
          queryKey: archivedClassroomsQueryOptions.queryKey,
        })
        onOpenChange(false)
      }
    },
  })
  const archiving = archive.isPending

  return (
    <AlertDialog
      open={open}
      // Stay open while archiving, so it can't be dismissed halfway.
      onOpenChange={(next) => {
        if (!archiving) onOpenChange(next)
      }}
    >
      <AlertDialogContent
        finalFocus={finalFocus}
        className="rounded-lg border-2 border-border ring-0"
      >
        {target.onlyClass ? (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle className="font-bold">
                Can’t archive your only class
              </AlertDialogTitle>
              <AlertDialogDescription>
                You always need one class open. Create another class first, then
                you can archive {target.name}.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Close</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  onOpenChange(false)
                  onCreateClass()
                }}
                className="font-bold"
              >
                Create class
              </AlertDialogAction>
            </AlertDialogFooter>
          </>
        ) : (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle className="font-bold wrap-break-word">
                Archive {target.name}?
              </AlertDialogTitle>
              <AlertDialogDescription>
                It’ll be hidden from your class list. Its students and marks are
                kept, and you can unarchive it from your Account page.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <OfflineNote action="archive this class" />
            <AlertDialogFooter>
              <AlertDialogCancel disabled={archiving}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => archive.mutate(target)}
                disabled={archiving || !online}
                aria-busy={archiving}
                // Not red: archiving can be undone. The label stays
                // (invisible) under the spinner so the size holds.
                className={cn(
                  'relative font-bold',
                  archiving && 'disabled:opacity-100',
                )}
              >
                <span className={cn(archiving && 'invisible')}>
                  Archive class
                </span>
                {archiving && (
                  <Spinner
                    aria-label="Archiving class"
                    className="absolute inset-0 m-auto size-4"
                  />
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </>
        )}
      </AlertDialogContent>
    </AlertDialog>
  )
}

function archiveErrorMessage(error: unknown, name: string) {
  if (error instanceof ApiError) {
    if (error.status === 409) {
      return `${name} is your only class. Create another class before archiving it.`
    }
    if (error.status === 404) {
      return `${name} was already archived or deleted. Your classes have been refreshed.`
    }
    if (error.status === 401) {
      return 'Your session has ended. Sign in again to archive this class.'
    }
    return `Couldn’t archive ${name}. Please try again.`
  }
  // fetch() throws a TypeError when the server can't be reached (and an
  // AbortError when it takes too long).
  return 'Couldn’t reach the server. Check your connection and try again.'
}
