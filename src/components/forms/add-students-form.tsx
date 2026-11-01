import { useId } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Controller, useForm, useWatch } from 'react-hook-form'
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
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { OfflineNote } from '#/components/offline-note'
import { ApiError } from '#/lib/api'
import { useOnline } from '#/lib/online'
import { meQueryOptions } from '#/lib/auth'
import { addStudents, formatStudentCount } from '#/lib/classroom'
import type { AddStudentsResult } from '#/lib/classroom'

const MAX_STUDENTS = 100
const MAX_NAME_LENGTH = 50

/** "Ava Johnson, Ben Lee,,  Carlos" → ["Ava Johnson", "Ben Lee", "Carlos"] */
function parseNames(text: string) {
  return text
    .split(/[,\n]/) // commas, plus line breaks for lists pasted from a spreadsheet
    .map((name) => name.trim())
    .filter(Boolean)
}

// Takes the raw textarea text and gives the submit handler a clean list of
// names. Only the first problem is shown, in this order.
const addStudentsSchema = z.object({
  names: z
    .string()
    .transform(parseNames)
    .superRefine((names, ctx) => {
      if (names.length === 0) {
        ctx.addIssue({
          code: 'custom',
          message: 'Enter at least one student name.',
        })
        return
      }
      if (names.length > MAX_STUDENTS) {
        ctx.addIssue({
          code: 'custom',
          message: `You can add up to ${MAX_STUDENTS} students at a time. You entered ${names.length}.`,
        })
        return
      }
      const tooLong = names.find((name) => name.length > MAX_NAME_LENGTH)
      if (tooLong) {
        ctx.addIssue({
          code: 'custom',
          message: `“${tooLong.slice(0, 20).trimEnd()}…” is too long. Names can be up to ${MAX_NAME_LENGTH} characters. Is a comma missing?`,
        })
        return
      }
      const seen = new Set<string>()
      const duplicate = names.find((name) => {
        const key = name.toLowerCase()
        if (seen.has(key)) return true
        seen.add(key)
        return false
      })
      if (duplicate) {
        ctx.addIssue({
          code: 'custom',
          message: `“${duplicate}” is listed more than once.`,
        })
      }
    }),
})

type AddStudentsInput = z.input<typeof addStudentsSchema> // { names: string }
type AddStudentsOutput = z.output<typeof addStudentsSchema> // { names: string[] }

function submitErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 401) {
      return 'Your session has ended. Sign in again to add students.'
    }
    if (error.status === 400 || error.status === 422) {
      return 'Some names couldn’t be saved. Check them and try again.'
    }
    if (error.status === 404) {
      return 'This class isn’t available anymore. Reload the page and try again.'
    }
    return 'Something went wrong saving your students. Please try again.'
  }
  // fetch() throws a TypeError when the server can't be reached.
  return 'Couldn’t reach the server. Check your connection and try again.'
}

/** The toast after saving: how many were added, and who was already there. */
function showAddedToast({ students_added, skipped }: AddStudentsResult) {
  const skippedText =
    skipped.length > 0
      ? `Already in this class: ${skipped.join(', ')}.`
      : undefined
  if (students_added === 0) {
    toast.info('No new students added', { description: skippedText })
    return
  }
  toast.success(`${formatStudentCount(students_added)} added`, {
    description: skippedText,
  })
}

export default function AddStudentsForm({
  onSuccess,
  classroomId,
}: {
  /** Called after the students are saved and on the dashboard, e.g. to close the dialog. */
  onSuccess?: (result: AddStudentsResult) => void
  /** The class to add them to: the open tab. */
  classroomId: string
}) {
  const textareaId = useId()
  const descriptionId = useId()
  const queryClient = useQueryClient()

  const form = useForm<AddStudentsInput, unknown, AddStudentsOutput>({
    resolver: zodResolver(addStudentsSchema),
    defaultValues: { names: '' },
  })
  const { errors } = form.formState
  const count = parseNames(
    useWatch({ control: form.control, name: 'names' }),
  ).length

  const save = useMutation({
    mutationFn: (names: Array<string>) => addStudents(classroomId, names),
    onSuccess: async (result) => {
      // The dashboard's roster comes from GET /users/me. Refetch it before the
      // spinner stops, so the new students are there when the dialog closes.
      await queryClient.invalidateQueries({
        queryKey: meQueryOptions.queryKey,
      })
      form.reset()
      showAddedToast(result)
      onSuccess?.(result)
    },
    onError: (error) => {
      console.error('Add students failed:', error)
      form.setError('root.server', { message: submitErrorMessage(error) })
    },
  })
  const isSaving = save.isPending
  const online = useOnline()

  function onSubmit({ names }: AddStudentsOutput) {
    save.mutate(names)
  }

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      noValidate
      className="flex flex-col gap-6"
    >
      <FieldGroup>
        <Controller
          name="names"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={textareaId}>Student names</FieldLabel>
              <Textarea
                {...field}
                id={textareaId}
                aria-invalid={fieldState.invalid}
                aria-describedby={descriptionId}
                readOnly={isSaving}
                placeholder="e.g. Ava Johnson, Ben Lee, Carlos Diaz"
                autoComplete="off"
                spellCheck={false}
                // White box with the theme's black border (shadcn's default
                // background is the theme's gray --input, which looks
                // disabled), and a lighter placeholder so the example can't be
                // mistaken for typed names.
                className="max-h-60 min-h-28 rounded-lg border-2 border-border bg-card placeholder:text-muted-foreground/70"
                // Ctrl/⌘ + Enter submits; plain Enter adds a new line.
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault()
                    e.currentTarget.form?.requestSubmit()
                  }
                }}
              />
              <FieldDescription id={descriptionId}>
                Separate names with commas.
                {count > 0 &&
                  ` ${count} ${count === 1 ? 'student' : 'students'}.`}
              </FieldDescription>
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
      </FieldGroup>

      {errors.root?.server && (
        <Alert
          variant="destructive"
          className="*:data-[slot=alert-description]:text-foreground"
        >
          <CircleAlert />
          <AlertTitle>Couldn’t add students</AlertTitle>
          <AlertDescription>{errors.root.server.message}</AlertDescription>
        </Alert>
      )}

      <OfflineNote action="add students" />

      <Button
        type="submit"
        disabled={isSaving || !online}
        aria-busy={isSaving}
        // The label stays in place (invisible) under the spinner, so the
        // button keeps its exact size: no layout shift. `relative` keeps the
        // spinner on the button, and the button stays solid while it spins.
        className={cn('relative', isSaving && 'disabled:opacity-100')}
      >
        <span className={cn(isSaving && 'invisible')}>Add students</span>
        {isSaving && (
          <Spinner
            aria-label="Adding students"
            className="absolute inset-0 m-auto size-5"
          />
        )}
      </Button>
    </form>
  )
}
