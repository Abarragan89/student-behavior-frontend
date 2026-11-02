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
import { useOnline } from '#/lib/online'
import {
  forgetRemovedStudent,
  removeStudentFromClass,
  studentQueryOptions,
} from '#/lib/students'

/** The student the dialog was opened for, as they were then. */
export type DeleteStudentTarget = {
  id: string
  first_name: string
  last_name: string
  /** Their current classes, oldest first. At least one. */
  classrooms: Array<{ id: string; name: string }>
}

/**
 * "Delete student", at the bottom of a student's page. In one class, it
 * deletes the student and all of their marks. In several, the teacher picks
 * the class to delete them from, and they keep their other classes and every
 * mark. Either way the button stays off until the teacher types "delete" and
 * the student's name.
 *
 * target is a snapshot taken when the dialog opened, so it doesn't change
 * while it closes.
 */
export function DeleteStudentDialog({
  target,
  openClassId,
  open,
  onOpenChange,
  onDeleted,
}: {
  target: DeleteStudentTarget
  /** The class open on the Classes page: picked first if they're in it. */
  openClassId?: string
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The student is gone for good: leave their page. */
  onDeleted: () => Promise<void>
}) {
  const queryClient = useQueryClient()
  const online = useOnline()
  const inputId = useId()
  const name = fullName(target)
  const phrase = `delete ${name}`
  const onlyClass = target.classrooms.length === 1

  const [typed, setTyped] = useState('')
  const [classId, setClassId] = useState(
    () =>
      target.classrooms.find((c) => c.id === openClassId)?.id ??
      target.classrooms[0].id,
  )
  const className =
    target.classrooms.find((c) => c.id === classId)?.name ?? 'the class'
  const matches = normalize(typed) === normalize(phrase)

  const remove = useMutation({
    mutationFn: () => removeStudentFromClass(classId, target.id),
    onSuccess: async ({ student_deleted }) => {
      onOpenChange(false)
      if (student_deleted) {
        toast.success(`Deleted ${name}`)
        // Off their page first, so it doesn't try to load them again.
        await onDeleted()
      } else {
        toast.success(`Removed ${name} from ${className}`)
      }
      forgetRemovedStudent(queryClient, target.id, classId, student_deleted)
    },
    onError: (error) => {
      console.error('Deleting the student failed:', error)
      toast.error(deleteErrorMessage(error, name, className))
      if (error instanceof ApiError && error.status === 404) {
        // Already removed (in another tab, or on another device).
        void queryClient.invalidateQueries({
          queryKey: studentQueryOptions(target.id).queryKey,
        })
        void queryClient.invalidateQueries({
          queryKey: meQueryOptions.queryKey,
        })
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
        // On phones, near the top instead of centered, so the keyboard
        // doesn't cover the box or the Delete button.
        className="rounded-lg border-2 border-border ring-0 max-sm:top-[max(1rem,env(safe-area-inset-top))] max-sm:translate-y-0"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (matches && !deleting && online) remove.mutate()
          }}
          className="grid gap-6"
        >
          <AlertDialogHeader>
            <AlertDialogTitle className="font-bold wrap-break-word">
              {onlyClass ? `Delete ${name}?` : `Delete ${name} from a class?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {onlyClass
                ? `${target.first_name} is only in ${className}, so this deletes them and all of their marks. This can’t be undone.`
                : 'They stay in your other classes, and all of their marks are kept.'}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {!onlyClass && (
            <fieldset className="flex flex-col gap-2" disabled={deleting}>
              <legend className="mb-2 text-sm font-bold">
                Delete them from
              </legend>
              {target.classrooms.map((c) => (
                <label
                  key={c.id}
                  className="flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border-2 border-border bg-card px-4 py-2 font-bold transition-colors has-checked:border-primary has-checked:bg-primary/10 has-disabled:cursor-not-allowed has-disabled:opacity-50 motion-reduce:transition-none"
                >
                  <input
                    type="radio"
                    name={`${inputId}-class`}
                    value={c.id}
                    checked={c.id === classId}
                    onChange={() => setClassId(c.id)}
                    className="size-5 shrink-0 accent-primary"
                  />
                  <span className="min-w-0 flex-1 truncate">{c.name}</span>
                </label>
              ))}
            </fieldset>
          )}

          <Field>
            <FieldLabel htmlFor={inputId} className="block font-normal">
              Type <strong className="font-bold">{phrase}</strong> to confirm
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

          <OfflineNote action="delete this student" />

          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              type="submit"
              disabled={!matches || deleting || !online}
              aria-busy={deleting}
              // Solid red, like deleting a class. The label stays (invisible)
              // under the spinner so the size holds.
              className={cn(
                'relative bg-destructive font-bold text-destructive-foreground hover:bg-destructive/90',
                deleting && 'disabled:opacity-100',
              )}
            >
              <span className={cn(deleting && 'invisible')}>
                {onlyClass ? 'Delete student' : 'Delete from class'}
              </span>
              {deleting && (
                <Spinner
                  aria-label="Deleting student"
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

/** "Ava Adams", or just "Ava" without a last name. */
function fullName(s: { first_name: string; last_name: string }) {
  return `${s.first_name} ${s.last_name}`.replace(/\s+/g, ' ').trim()
}

/**
 * Typed with any capitals and spacing (phones capitalize the first letter),
 * and with a phone's curly apostrophes and dashes in names like O’Brien.
 */
function normalize(text: string) {
  return text
    .normalize('NFKC')
    .replace(/[‘’`´]/g, "'")
    .replace(/[‐-―]/g, '-')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
}

function deleteErrorMessage(error: unknown, name: string, className: string) {
  if (error instanceof ApiError) {
    if (error.status === 404) {
      return `${name} isn’t in ${className} anymore. The page has been refreshed.`
    }
    if (error.status === 401) {
      return 'Your session has ended. Sign in again to delete this student.'
    }
    return `Couldn’t delete ${name}. Please try again.`
  }
  // fetch() throws a TypeError when the server can't be reached (and an
  // AbortError when it takes too long).
  return 'Couldn’t reach the server. Check your connection and try again.'
}
