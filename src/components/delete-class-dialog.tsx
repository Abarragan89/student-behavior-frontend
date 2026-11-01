import { useId, useState } from 'react'
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
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'
import { OfflineNote } from '#/components/offline-note'
import { ApiError } from '#/lib/api'
import { meQueryOptions } from '#/lib/auth'
import {
  archivedClassroomsQueryOptions,
  deleteClassroom,
  forgetDeletedClassroom,
  removeArchived,
} from '#/lib/classroom'
import type { ArchivedClassroom } from '#/lib/classroom'
import { useOnline } from '#/lib/online'

/** What the teacher types to turn on the Delete button. */
const CONFIRM_PHRASE = 'delete this class forever'

/**
 * Typed with any capitals and spacing: phones capitalize the first letter,
 * and a stray space shouldn't block the button.
 */
function matchesPhrase(typed: string) {
  return typed.trim().replace(/\s+/g, ' ').toLowerCase() === CONFIRM_PHRASE
}

/**
 * "Delete forever" for an archived class, on the Account page. Deleting can't
 * be undone, so the Delete button stays off until the teacher types
 * "delete this class forever".
 *
 * classroom is kept by the caller after the class is gone from the list, so
 * the dialog doesn't change while it closes.
 */
export function DeleteClassDialog({
  classroom,
  open,
  onOpenChange,
  onRemoved,
  finalFocus,
}: {
  classroom: ArchivedClassroom
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Called when the class leaves the archived list (deleted, or gone). */
  onRemoved: () => void
  /** Where focus goes when the dialog closes (see the dialog's finalFocus). */
  finalFocus?: () => HTMLElement | boolean | null
}) {
  const queryClient = useQueryClient()
  const online = useOnline()
  const inputId = useId()
  const [typed, setTyped] = useState('')
  const matches = matchesPhrase(typed)

  const remove = useMutation({
    mutationFn: (c: ArchivedClassroom) => deleteClassroom(c.id),
    onSuccess: (_, c) => {
      forgetDeletedClassroom(queryClient, c)
      onRemoved()
      onOpenChange(false)
      toast.success(`Deleted ${c.name}`)
    },
    onError: (error, c) => {
      console.error('Deleting the class failed:', error)
      toast.error(deleteErrorMessage(error, c.name))
      if (!(error instanceof ApiError)) return
      if (error.status === 404) {
        // Already deleted (in another tab, or on another device).
        removeArchived(queryClient, c.id)
        onRemoved()
        onOpenChange(false)
      } else if (error.status === 409) {
        // Unarchived somewhere else meanwhile: it's back in the class list.
        void queryClient.invalidateQueries({
          queryKey: archivedClassroomsQueryOptions.queryKey,
        })
        void queryClient.invalidateQueries({
          queryKey: meQueryOptions.queryKey,
        })
        onRemoved()
        onOpenChange(false)
      }
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
      // Start empty next time, however it was closed.
      onOpenChangeComplete={(isOpen) => {
        if (!isOpen) setTyped('')
      }}
    >
      <AlertDialogContent
        finalFocus={finalFocus}
        // On phones, near the top instead of centered, so the keyboard
        // doesn't cover the box or the Delete button.
        className="rounded-lg border-2 border-border ring-0 max-sm:top-[max(1rem,env(safe-area-inset-top))] max-sm:translate-y-0"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (matches && !deleting && online) remove.mutate(classroom)
          }}
          className="grid gap-6"
        >
          <AlertDialogHeader>
            <AlertDialogTitle className="font-bold wrap-break-word">
              Delete {classroom.name} forever?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This deletes the class and all of its marks. Students who aren’t
              in any of your other classes are deleted too. This can’t be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <Field>
            <FieldLabel htmlFor={inputId} className="block font-normal">
              Type <strong className="font-bold">{CONFIRM_PHRASE}</strong> to
              confirm
            </FieldLabel>
            <Input
              id={inputId}
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              readOnly={deleting}
              // It's a phrase to copy, not words to fix up.
              autoCapitalize="none"
              autoCorrect="off"
              autoComplete="off"
              spellCheck={false}
              enterKeyHint="done"
              className="h-11 rounded-lg border-2 border-border bg-card px-3 text-base"
            />
          </Field>

          <OfflineNote action="delete this class" />

          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              type="submit"
              disabled={!matches || deleting || !online}
              aria-busy={deleting}
              // Solid red: it can't be undone. The label stays (invisible)
              // under the spinner so the size holds.
              className={cn(
                'relative bg-destructive font-bold text-destructive-foreground hover:bg-destructive/90',
                deleting && 'disabled:opacity-100',
              )}
            >
              <span className={cn(deleting && 'invisible')}>
                Delete forever
              </span>
              {deleting && (
                <Spinner
                  aria-label="Deleting class"
                  className="absolute inset-0 m-auto size-4"
                />
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  )
}

function deleteErrorMessage(error: unknown, name: string) {
  if (error instanceof ApiError) {
    if (error.status === 404) return `${name} was already deleted.`
    if (error.status === 409) {
      return `${name} isn’t archived anymore, so it wasn’t deleted.`
    }
    if (error.status === 401) {
      return 'Your session has ended. Sign in again to delete this class.'
    }
    return `Couldn’t delete ${name}. Please try again.`
  }
  // fetch() throws a TypeError when the server can't be reached (and an
  // AbortError when it takes too long).
  return 'Couldn’t reach the server. Check your connection and try again.'
}
