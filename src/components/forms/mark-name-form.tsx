import { useId } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { z } from 'zod'
import { CircleAlert } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'
import { OfflineNote } from '#/components/offline-note'
import { ApiError } from '#/lib/api'
import { useOnline } from '#/lib/online'
import {
  MAX_MARK_NAME_LENGTH,
  cacheMarkType,
  createMarkType,
  markTypesQueryOptions,
  renameMarkType,
} from '#/lib/marks'
import type { MarkType } from '#/lib/marks'

const markNameSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Enter a name for the mark.')
    .max(
      MAX_MARK_NAME_LENGTH,
      `Names can be up to ${MAX_MARK_NAME_LENGTH} characters.`,
    ),
})

type MarkNameInput = z.input<typeof markNameSchema>
type MarkNameOutput = z.output<typeof markNameSchema>

function saveErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 401) {
      return 'Your session has ended. Sign in again to change your marks.'
    }
    if (error.status === 400) return 'That name can’t be used. Try another.'
    // The backend allows about 10 changes at once, then one every minute or two.
    if (error.status === 429) {
      return 'Too many changes for now. Wait a few minutes, then try again.'
    }
    return 'Couldn’t save the mark. Please try again.'
  }
  // fetch() throws a TypeError when the server can't be reached.
  return 'Couldn’t reach the server. Check your connection and try again.'
}

/**
 * Adds a mark (pass isPositive) or renames one (pass markType). Used inside a
 * dialog on the Marks page; onDone closes it.
 */
export function MarkNameForm({
  markType,
  isPositive,
  onDone,
}: {
  /** The mark to rename. Leave out to add a new one. */
  markType?: MarkType
  /** For a new mark: which column it goes in. Can't be changed later. */
  isPositive: boolean
  onDone: () => void
}) {
  const inputId = useId()
  const queryClient = useQueryClient()
  const online = useOnline()
  const renaming = markType !== undefined

  const form = useForm<MarkNameInput, unknown, MarkNameOutput>({
    resolver: zodResolver(markNameSchema),
    defaultValues: { name: markType?.name ?? '' },
  })
  // Dirty = different from the saved name (typing it back makes it clean).
  const { isDirty, errors } = form.formState

  const save = useMutation({
    mutationFn: (name: string) =>
      markType
        ? renameMarkType(markType.id, name)
        : createMarkType(name, isPositive),
    onSuccess: (saved) => {
      // The answer is the saved type: put it in the cache, no refetch.
      cacheMarkType(queryClient, saved)
      if (renaming) {
        // Marks already given show the type's current name, so saved
        // student days are out of date.
        void queryClient.invalidateQueries({ queryKey: ['student-marks'] })
        toast.success(`Renamed to “${saved.name}”`)
      } else {
        toast.success(`Added “${saved.name}”`)
      }
      onDone()
    },
    onError: (error, name) => {
      console.error('Saving a mark type failed:', error)
      if (error instanceof ApiError && error.status === 409) {
        form.setError('name', {
          message: `You already have a mark called “${name}”.`,
        })
        return
      }
      if (error instanceof ApiError && error.status === 404) {
        // Removed somewhere else (another device): show the current list.
        void queryClient.invalidateQueries({
          queryKey: markTypesQueryOptions.queryKey,
        })
        toast.error('This mark was already removed.')
        onDone()
        return
      }
      form.setError('root.server', { message: saveErrorMessage(error) })
    },
  })
  const isSaving = save.isPending
  const kind = isPositive ? 'positive' : 'negative'

  return (
    <form
      onSubmit={form.handleSubmit(({ name }) => save.mutate(name))}
      noValidate
      className="flex flex-col gap-6"
    >
      <Controller
        name="name"
        control={form.control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor={inputId}>Name</FieldLabel>
            <Input
              {...field}
              id={inputId}
              aria-invalid={fieldState.invalid}
              readOnly={isSaving}
              placeholder={
                renaming
                  ? undefined
                  : isPositive
                    ? 'e.g. Kind words'
                    : 'e.g. Calling out'
              }
              autoComplete="off"
              className="h-11 rounded-lg border-2 border-border bg-card px-3 text-base placeholder:text-muted-foreground/70"
            />
            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            <FieldDescription>
              {renaming
                ? 'Marks students already got will show the new name. For a different behavior, add a new mark instead.'
                : `It goes with your ${kind} marks, and can’t be switched to ${isPositive ? 'negative' : 'positive'} later.`}
            </FieldDescription>
          </Field>
        )}
      />

      {errors.root?.server && (
        <Alert
          variant="destructive"
          className="*:data-[slot=alert-description]:text-foreground"
        >
          <CircleAlert />
          <AlertTitle>Couldn’t save the mark</AlertTitle>
          <AlertDescription>{errors.root.server.message}</AlertDescription>
        </Alert>
      )}

      <OfflineNote action="change your marks" />

      <Button
        type="submit"
        // Renaming: nothing to save until the name changes.
        disabled={(renaming && !isDirty) || isSaving || !online}
        aria-busy={isSaving}
        // The label stays (invisible) under the spinner, so the button keeps
        // its size, and it stays solid while it spins.
        className={cn('relative', isSaving && 'disabled:opacity-100')}
      >
        <span className={cn(isSaving && 'invisible')}>
          {renaming ? 'Save' : 'Add mark'}
        </span>
        {isSaving && (
          <Spinner
            aria-label="Saving"
            className="absolute inset-0 m-auto size-5"
          />
        )}
      </Button>
    </form>
  )
}
