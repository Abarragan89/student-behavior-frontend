import { useState } from 'react'
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { Trash2 } from 'lucide-react'
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'
import { meQueryOptions } from '#/lib/auth'
import {
  CUTOFF_HOURS,
  cacheConference,
  conferenceQueryOptions,
  conferencesQueryOptions,
  conflictMessage,
  createConference,
  deleteConference,
  updateConference,
} from '#/lib/conferences'
import type { Conference } from '#/lib/conferences'
import { timeZone } from '#/lib/marks'
import { useOnline } from '#/lib/online'
import { OfflineNote } from '#/components/offline-note'
import { ResponsiveDialog } from '#/components/responsive-dialogue'

const MAX_TITLE = 80
const MAX_NOTICE_NAME = 60
const MAX_LOCATION = 80

/**
 * Sets up a new conference (no `conference`), or changes one's settings:
 * its name, how the teacher signs notices, where, which classes, and
 * whether families can change their time online.
 */
export function SettingsDialog({
  open,
  onOpenChange,
  conference,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  conference?: Conference
}) {
  return (
    <ResponsiveDialog
      isOpen={open}
      setIsOpen={onOpenChange}
      title={conference ? 'Conference settings' : 'New parent conferences'}
      description={
        conference
          ? undefined
          : 'Set up times, put each student in one, then print a notice for each family. Families can scan its QR code to pick another open time.'
      }
      showDescription={!conference}
    >
      {open && (
        <SettingsForm
          conference={conference}
          onDone={() => onOpenChange(false)}
        />
      )}
    </ResponsiveDialog>
  )
}

function SettingsForm({
  conference,
  onDone,
}: {
  conference?: Conference
  onDone: () => void
}) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const online = useOnline()
  // Already loaded by the login check (see _authed.tsx).
  const { data: me } = useSuspenseQuery(meQueryOptions)
  const classrooms = me?.classrooms ?? []

  const [title, setTitle] = useState(conference?.title ?? 'Parent conferences')
  const [noticeName, setNoticeName] = useState(
    conference?.notice_name ?? me?.teacher.name ?? '',
  )
  const [location, setLocation] = useState(conference?.location ?? '')
  const [picked, setPicked] = useState<Array<string>>(
    conference?.classroom_ids ??
      classrooms.filter((c) => c.is_default).map((c) => c.id),
  )
  const [parentChanges, setParentChanges] = useState(
    conference?.parent_changes ?? true,
  )
  const [deleteOpen, setDeleteOpen] = useState(false)

  const save = useMutation({
    mutationFn: () => {
      const settings = {
        title: title.trim(),
        notice_name: noticeName.trim(),
        location: location.trim(),
        // In the class list's order.
        classroom_ids: classrooms
          .filter((c) => picked.includes(c.id))
          .map((c) => c.id),
      }
      return conference
        ? updateConference(conference.id, {
            ...settings,
            parent_changes: parentChanges,
          })
        : createConference({ ...settings, timezone: timeZone() })
    },
    onSuccess: (saved) => {
      cacheConference(queryClient, saved)
      onDone()
      if (!conference) {
        void navigate({
          to: '/conferences/$conferenceId',
          params: { conferenceId: saved.id },
        })
      }
    },
    onError: (error) => {
      console.error('Saving the conference failed:', error)
      toast.error('Couldn’t save', { description: conflictMessage(error) })
    },
  })

  const missing = !title.trim() || !noticeName.trim()
  const busy = save.isPending

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault()
        if (!missing && !busy) save.mutate()
      }}
    >
      <TextField
        id="conference-title"
        label="Name"
        hint="Only you see this."
        value={title}
        onChange={setTitle}
        maxLength={MAX_TITLE}
      />
      <TextField
        id="conference-notice-name"
        label="Your name on notices"
        hint="How families know you, like “Ms. Lee”."
        value={noticeName}
        onChange={setNoticeName}
        maxLength={MAX_NOTICE_NAME}
      />
      <TextField
        id="conference-location"
        label="Where (optional)"
        hint="Printed as you type it on both the English and Spanish halves, like “Room 12 / Salón 12”."
        value={location}
        onChange={setLocation}
        maxLength={MAX_LOCATION}
      />

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-bold">Classes to schedule</legend>
        <ul className="flex flex-col gap-2">
          {classrooms.map((c) => (
            <li key={c.id}>
              <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border-2 border-border bg-card px-4 py-2 font-bold transition-colors has-checked:border-primary has-checked:bg-primary/10 motion-reduce:transition-none">
                <input
                  type="checkbox"
                  checked={picked.includes(c.id)}
                  onChange={(e) =>
                    setPicked(
                      e.target.checked
                        ? [...picked, c.id]
                        : picked.filter((id) => id !== c.id),
                    )
                  }
                  className="size-5 shrink-0 accent-primary"
                />
                <span className="min-w-0 flex-1 truncate">{c.name}</span>
              </label>
            </li>
          ))}
        </ul>
      </fieldset>

      {conference && (
        <label className="flex cursor-pointer items-start gap-3 rounded-lg border-2 border-border bg-card px-4 py-3 has-checked:border-primary has-checked:bg-primary/10">
          <input
            type="checkbox"
            checked={parentChanges}
            onChange={(e) => setParentChanges(e.target.checked)}
            className="mt-0.5 size-5 shrink-0 accent-primary"
          />
          <span className="flex flex-col">
            <span className="font-bold">
              Families can change their time online
            </span>
            <span className="text-sm text-muted-foreground">
              Until {CUTOFF_HOURS} hours before it. Turn this off to freeze the
              schedule: families can still see their time.
            </span>
          </span>
        </label>
      )}

      <div className="flex flex-col gap-2">
        <OfflineNote action="save" />
        <Button
          type="submit"
          disabled={missing || busy || !online}
          aria-busy={busy}
          className="h-12 rounded-lg border-2 border-border text-base font-bold shadow-sm"
        >
          {busy && <Spinner aria-hidden className="size-5" />}
          {conference ? 'Save' : 'Create'}
        </Button>
        {conference && (
          <Button
            type="button"
            variant="outline"
            onClick={() => setDeleteOpen(true)}
            disabled={busy || !online}
            className="h-12 rounded-lg border-2 border-border bg-card text-base font-bold text-destructive"
          >
            <Trash2 className="size-5" />
            Delete conference
          </Button>
        )}
      </div>

      {conference && (
        <DeleteConferenceDialog
          conference={conference}
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          onDeleted={() => {
            onDone()
            void navigate({ to: '/conferences' })
            queryClient.removeQueries({
              queryKey: conferenceQueryOptions(conference.id).queryKey,
            })
            void queryClient.invalidateQueries({
              queryKey: conferencesQueryOptions.queryKey,
            })
          }}
        />
      )}
    </form>
  )
}

function TextField({
  id,
  label,
  hint,
  value,
  onChange,
  maxLength,
}: {
  id: string
  label: string
  hint: string
  value: string
  onChange: (value: string) => void
  maxLength: number
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id} className="font-bold">
        {label}
      </Label>
      <Input
        id={id}
        value={value}
        maxLength={maxLength}
        onChange={(e) => onChange(e.target.value)}
        aria-describedby={`${id}-hint`}
        className="h-11 rounded-lg border-2 border-border bg-card px-3 text-base"
      />
      <p id={`${id}-hint`} className="text-sm text-muted-foreground">
        {hint}
      </p>
    </div>
  )
}

function DeleteConferenceDialog({
  conference,
  open,
  onOpenChange,
  onDeleted,
}: {
  conference: Conference
  open: boolean
  onOpenChange: (open: boolean) => void
  onDeleted: () => void
}) {
  const remove = useMutation({
    mutationFn: () => deleteConference(conference.id),
    onSuccess: () => {
      onOpenChange(false)
      onDeleted()
      toast.success(`Deleted “${conference.title}”`)
    },
    onError: (error) => {
      console.error('Deleting the conference failed:', error)
      toast.error('Couldn’t delete it. Check your connection and try again.')
    },
  })
  const deleting = remove.isPending

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!deleting) onOpenChange(next)
      }}
    >
      <AlertDialogContent className="rounded-lg border-2 border-border ring-0">
        <AlertDialogHeader>
          <AlertDialogTitle className="font-bold wrap-break-word">
            Delete “{conference.title}”?
          </AlertDialogTitle>
          <AlertDialogDescription>
            Every time and every family’s change is deleted, and the QR codes on
            the notices stop working. This can’t be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => remove.mutate()}
            disabled={deleting}
            aria-busy={deleting}
            className={cn(
              'relative bg-destructive font-bold text-destructive-foreground hover:bg-destructive/90',
              deleting && 'disabled:opacity-100',
            )}
          >
            <span className={cn(deleting && 'invisible')}>Delete</span>
            {deleting && (
              <Spinner
                aria-label="Deleting"
                className="absolute inset-0 m-auto size-4"
              />
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
