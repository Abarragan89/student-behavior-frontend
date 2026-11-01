import { useId } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { z } from 'zod'
import { CircleAlert } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'
import { OfflineNote } from '#/components/offline-note'
import { ApiError } from '#/lib/api'
import { useOnline } from '#/lib/online'
import { meQueryOptions } from '#/lib/auth'
import { createClassroom, switchClassroom } from '#/lib/classroom'

// The backend's limit for a class name, counted in characters.
const MAX_NAME_LENGTH = 100

const createClassSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Enter a name for your class.')
    .max(
      MAX_NAME_LENGTH,
      `Class names can be up to ${MAX_NAME_LENGTH} characters.`,
    ),
})

type CreateClassInput = z.input<typeof createClassSchema>
type CreateClassOutput = z.output<typeof createClassSchema>

function submitErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 401) {
      return 'Your session has ended. Sign in again to create a class.'
    }
    if (error.status === 400 || error.status === 422) {
      return 'That name can’t be used. Try a different one.'
    }
    return 'Something went wrong creating your class. Please try again.'
  }
  // fetch() throws a TypeError when the server can't be reached.
  return 'Couldn’t reach the server. Check your connection and try again.'
}

/**
 * "Create class" from the + menu. Creates the class, opens it (it becomes the
 * default classroom), and goes to the Classes page.
 */
export default function CreateClassForm({
  onSuccess,
}: {
  /** Called once the class is open on the Classes page, e.g. to close the dialog. */
  onSuccess?: () => void
}) {
  const inputId = useId()
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  const form = useForm<CreateClassInput, unknown, CreateClassOutput>({
    resolver: zodResolver(createClassSchema),
    defaultValues: { name: '' },
  })
  const { errors } = form.formState

  const create = useMutation({
    mutationFn: async (name: string) => {
      const created = await createClassroom(name)
      if (created.is_default) {
        // The backend opened it: reload the tabs and roster.
        await queryClient.invalidateQueries({
          queryKey: meQueryOptions.queryKey,
        })
        return created
      }
      // The backend doesn't make it the default yet, so open it here, the
      // same way clicking its tab would.
      try {
        const me = await switchClassroom(created.id)
        queryClient.setQueryData(meQueryOptions.queryKey, me)
      } catch (error) {
        // The class exists either way, so don't report a failure (trying
        // again would make a second one). Just show its new tab.
        console.error('Opening the new class failed:', error)
        await queryClient.invalidateQueries({
          queryKey: meQueryOptions.queryKey,
        })
      }
      return created
    },
    onSuccess: async (created) => {
      form.reset()
      toast.success(`Created ${created.name}`)
      onSuccess?.()
      await navigate({ to: '/classes' })
    },
    onError: (error) => {
      console.error('Create class failed:', error)
      form.setError('root.server', { message: submitErrorMessage(error) })
    },
  })
  const isSaving = create.isPending
  const online = useOnline()

  return (
    <form
      onSubmit={form.handleSubmit(({ name }) => create.mutate(name))}
      noValidate
      className="flex flex-col gap-6"
    >
      <FieldGroup>
        <Controller
          name="name"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={inputId}>Class name</FieldLabel>
              <Input
                {...field}
                id={inputId}
                aria-invalid={fieldState.invalid}
                readOnly={isSaving}
                placeholder="e.g. Period 3 Biology"
                autoComplete="off"
                // White box with the theme's black border, like the other
                // forms, and a lighter placeholder so the example can't be
                // mistaken for a typed name.
                className="h-11 rounded-lg border-2 border-border bg-card px-3 text-base placeholder:text-muted-foreground/70"
              />
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
          <AlertTitle>Couldn’t create the class</AlertTitle>
          <AlertDescription>{errors.root.server.message}</AlertDescription>
        </Alert>
      )}

      <OfflineNote action="create a class" />

      <Button
        type="submit"
        disabled={isSaving || !online}
        aria-busy={isSaving}
        // The label stays in place (invisible) under the spinner, so the
        // button keeps its exact size. `relative` keeps the spinner on the
        // button, and it stays solid while it spins.
        className={cn('relative', isSaving && 'disabled:opacity-100')}
      >
        <span className={cn(isSaving && 'invisible')}>Create class</span>
        {isSaving && (
          <Spinner
            aria-label="Creating class"
            className="absolute inset-0 m-auto size-5"
          />
        )}
      </Button>
    </form>
  )
}
