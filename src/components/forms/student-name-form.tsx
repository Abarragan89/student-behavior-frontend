import { useId, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { z } from 'zod'
import { CircleAlert, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'
import { OfflineNote } from '#/components/offline-note'
import { ApiError } from '#/lib/api'
import { useOnline } from '#/lib/online'
import { cacheStudentName, updateStudentName } from '#/lib/students'
import type { StudentDetail } from '#/lib/students'

// The backend's limit for each name, counted in characters.
const MAX_NAME_LENGTH = 100
const tooLong = `Names can be up to ${MAX_NAME_LENGTH} characters.`

// The backend's rules: a first name is required, a last name is optional.
const nameSchema = z.object({
  first_name: z
    .string()
    .trim()
    .min(1, 'Enter a first name.')
    .max(MAX_NAME_LENGTH, tooLong),
  last_name: z.string().trim().max(MAX_NAME_LENGTH, tooLong),
})

type NameInput = z.input<typeof nameSchema>
type NameOutput = z.output<typeof nameSchema>

const inputClass =
  'h-10 rounded-lg border-2 border-border bg-card px-3 text-base'

function saveErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 401) {
      return 'Your session has ended. Sign in again to rename this student.'
    }
    if (error.status === 404) {
      return 'This student isn’t in your classes anymore.'
    }
    if (error.status === 400) return 'That name can’t be used. Try another.'
    // The backend allows 60 renames an hour.
    if (error.status === 429) {
      return 'Too many name changes for now. Wait a few minutes, then save again.'
    }
    return 'Couldn’t save the name. Please try again.'
  }
  // fetch() throws a TypeError when the server can't be reached.
  return 'Couldn’t reach the server. Check your connection and try again.'
}

/**
 * The student's name as the page heading, with an Edit button. Editing shows
 * the first and last name; Save turns on once either is changed.
 */
export function StudentNameForm({ student }: { student: StudentDetail }) {
  const [editing, setEditing] = useState(false)
  const fullName = `${student.first_name} ${student.last_name}`.trim()

  if (!editing) {
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h1 className="min-w-0 text-2xl font-bold break-words">{fullName}</h1>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setEditing(true)}
          className="rounded-lg border-2 border-border font-bold"
        >
          <Pencil />
          Edit
        </Button>
      </div>
    )
  }
  return (
    <>
      {/* The page keeps its heading while the name is being edited. */}
      <h1 className="sr-only">{fullName}</h1>
      <EditName student={student} onDone={() => setEditing(false)} />
    </>
  )
}

function EditName({
  student,
  onDone,
}: {
  student: StudentDetail
  onDone: () => void
}) {
  const firstId = useId()
  const lastId = useId()
  const queryClient = useQueryClient()

  const form = useForm<NameInput, unknown, NameOutput>({
    resolver: zodResolver(nameSchema),
    defaultValues: {
      first_name: student.first_name,
      last_name: student.last_name,
    },
  })
  // Dirty = different from the saved name (typing it back makes it clean).
  const { isDirty, errors } = form.formState

  const save = useMutation({
    mutationFn: (name: NameOutput) => updateStudentName(student.id, name),
    onSuccess: (updated) => {
      // The answer is the saved student: put it in the cache, no refetch.
      cacheStudentName(queryClient, updated)
      toast.success('Name saved')
      onDone()
    },
    onError: (error) => {
      console.error('Renaming a student failed:', error)
      form.setError('root.server', { message: saveErrorMessage(error) })
    },
  })
  const isSaving = save.isPending
  const online = useOnline()

  return (
    <form
      onSubmit={form.handleSubmit((name) => save.mutate(name))}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && !isSaving) onDone()
      }}
      noValidate
      aria-label="Edit name"
      className="flex flex-col gap-3"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Controller
          name="first_name"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid} className="gap-1.5">
              <FieldLabel htmlFor={firstId}>First name</FieldLabel>
              <Input
                {...field}
                id={firstId}
                aria-invalid={fieldState.invalid}
                readOnly={isSaving}
                autoComplete="off"
                autoFocus
                className={inputClass}
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        <Controller
          name="last_name"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid} className="gap-1.5">
              <FieldLabel htmlFor={lastId}>Last name</FieldLabel>
              <Input
                {...field}
                id={lastId}
                aria-invalid={fieldState.invalid}
                readOnly={isSaving}
                autoComplete="off"
                className={inputClass}
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
      </div>

      {errors.root?.server && (
        <p role="alert" className="flex items-center gap-2 text-sm font-medium">
          <CircleAlert className="size-4 shrink-0 text-destructive" />
          {errors.root.server.message}
        </p>
      )}

      <OfflineNote action="rename students" />

      <div className="flex items-center gap-2">
        <Button
          type="submit"
          size="sm"
          disabled={!isDirty || isSaving || !online}
          aria-busy={isSaving}
          // Solid while saving, with the spinner over the hidden label so the
          // button keeps its size.
          className={cn(
            'relative rounded-lg border-2 border-border font-bold',
            isSaving && 'disabled:opacity-100',
          )}
        >
          <span className={cn(isSaving && 'invisible')}>Save</span>
          {isSaving && (
            <Spinner aria-hidden className="absolute inset-0 m-auto size-4" />
          )}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onDone}
          disabled={isSaving}
          className="font-bold"
        >
          Cancel
        </Button>
      </div>
    </form>
  )
}
