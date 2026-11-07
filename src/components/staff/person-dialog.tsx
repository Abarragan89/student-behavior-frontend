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
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { OfflineNote } from '#/components/offline-note'
import { ResponsiveDialog } from '#/components/responsive-dialogue'
import { ApiError } from '#/lib/api'
import { useOnline } from '#/lib/online'
import {
  addPerson,
  cleanEmail,
  displayName,
  removePerson,
  staffQueryOptions,
  updateGroup,
  updatePerson,
} from '#/lib/staff'
import type { StaffDirectory, StaffGroup, StaffPerson } from '#/lib/staff'

/**
 * Add someone to the staff list, or edit them: name, email, title,
 * department, and which groups they're in. The email of someone who uses the
 * app comes from their Google account, so it's fixed.
 */
export function PersonDialog({
  open,
  onOpenChange,
  person,
  groups,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** null: adding someone new. */
  person: StaffPerson | null
  groups: Array<StaffGroup>
}) {
  return (
    <ResponsiveDialog
      isOpen={open}
      setIsOpen={onOpenChange}
      title={person ? `Edit ${displayName(person)}` : 'Add a person'}
      description={
        person
          ? 'Changes show everywhere they’re invited.'
          : 'They don’t need to use TeachForFree: their email is enough for events and reminders.'
      }
      showDescription
      keyboardAware
    >
      {/* Remounted each time it opens, so it starts from the person. */}
      {open && (
        <PersonForm
          person={person}
          groups={groups}
          onDone={() => onOpenChange(false)}
        />
      )}
    </ResponsiveDialog>
  )
}

function PersonForm({
  person,
  groups,
  onDone,
}: {
  person: StaffPerson | null
  groups: Array<StaffGroup>
  onDone: () => void
}) {
  const id = useId()
  const online = useOnline()
  const queryClient = useQueryClient()
  const [email, setEmail] = useState(person?.email ?? '')
  const [first, setFirst] = useState(person?.first_name ?? '')
  const [last, setLast] = useState(person?.last_name ?? '')
  const [title, setTitle] = useState(person?.title ?? '')
  const [department, setDepartment] = useState(person?.department ?? '')
  const startGroups = new Set(
    person
      ? groups.filter((g) => g.staff_ids.includes(person.id)).map((g) => g.id)
      : [],
  )
  const [inGroups, setInGroups] = useState<Set<string>>(startGroups)
  const emailLocked =
    !!person && (person.uses_app || person.source === 'joined')
  const emailOk = cleanEmail(email) !== null

  const save = useMutation({
    mutationFn: async () => {
      const details = {
        email: cleanEmail(email) ?? email,
        first_name: first,
        last_name: last,
        title,
        department,
      }
      const saved = person
        ? await updatePerson(
            person.id,
            emailLocked ? { ...details, email: undefined } : details,
          )
        : await addPerson(details)
      // Groups whose membership changed.
      for (const g of groups) {
        const was = g.staff_ids.includes(saved.id)
        const is = inGroups.has(g.id)
        if (was === is) continue
        await updateGroup(g.id, {
          staff_ids: is
            ? [...g.staff_ids, saved.id]
            : g.staff_ids.filter((x) => x !== saved.id),
        })
      }
      return saved
    },
    onSuccess: (saved) => {
      void queryClient.invalidateQueries({
        queryKey: staffQueryOptions.queryKey,
      })
      onDone()
      toast.success(person ? 'Saved' : `Added ${displayName(saved)}`)
    },
    onError: (error) => {
      console.error('Saving a staff member failed:', error)
      void queryClient.invalidateQueries({
        queryKey: staffQueryOptions.queryKey,
      })
      toast.error(
        error instanceof ApiError && error.reason === 'already_listed'
          ? 'Someone with that email is already on your staff list.'
          : error instanceof ApiError && error.reason === 'too_many_staff'
            ? 'Your staff list is full.'
            : 'Couldn’t save. Try again.',
      )
    },
  })
  const busy = save.isPending

  const field = 'h-11 rounded-lg border-2 border-border bg-card text-base'
  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        if (emailOk && !busy) save.mutate()
      }}
      className="flex flex-col gap-4"
    >
      <div className="flex flex-col gap-2">
        <label htmlFor={`${id}-email`} className="text-sm font-bold">
          Email
        </label>
        <Input
          id={`${id}-email`}
          type="email"
          inputMode="email"
          autoComplete="off"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={busy || emailLocked}
          aria-invalid={(email !== '' && !emailOk) || undefined}
          aria-describedby={`${id}-email-about`}
          className={field}
        />
        <p id={`${id}-email-about`} className="text-sm text-muted-foreground">
          {emailLocked
            ? 'From their Google account, since they use TeachForFree.'
            : email !== '' && !emailOk
              ? 'Enter one email address, like ana@school.org.'
              : 'Reminders go here.'}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-2">
          <label htmlFor={`${id}-first`} className="text-sm font-bold">
            First name
          </label>
          <Input
            id={`${id}-first`}
            value={first}
            onChange={(e) => setFirst(e.target.value)}
            maxLength={100}
            disabled={busy}
            className={field}
          />
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor={`${id}-last`} className="text-sm font-bold">
            Last name
          </label>
          <Input
            id={`${id}-last`}
            value={last}
            onChange={(e) => setLast(e.target.value)}
            maxLength={100}
            disabled={busy}
            className={field}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-2">
          <label htmlFor={`${id}-title`} className="text-sm font-bold">
            Title{' '}
            <span className="font-normal text-muted-foreground">
              (optional)
            </span>
          </label>
          <Input
            id={`${id}-title`}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={200}
            placeholder="4th grade"
            disabled={busy}
            className={field}
          />
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor={`${id}-dept`} className="text-sm font-bold">
            Department{' '}
            <span className="font-normal text-muted-foreground">
              (optional)
            </span>
          </label>
          <Input
            id={`${id}-dept`}
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            maxLength={200}
            placeholder="Math"
            disabled={busy}
            className={field}
          />
        </div>
      </div>
      {groups.length > 0 && (
        <fieldset disabled={busy} className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-bold">Groups</legend>
          <div className="flex flex-wrap gap-2">
            {groups.map((g) => (
              <label
                key={g.id}
                className="flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border-2 border-border bg-card px-3 text-sm font-bold transition-colors has-checked:border-primary has-checked:bg-primary/10 motion-reduce:transition-none"
              >
                <input
                  type="checkbox"
                  checked={inGroups.has(g.id)}
                  onChange={(e) => {
                    const next = new Set(inGroups)
                    if (e.target.checked) next.add(g.id)
                    else next.delete(g.id)
                    setInGroups(next)
                  }}
                  className="size-4 shrink-0 accent-primary"
                />
                {g.name}
              </label>
            ))}
          </div>
        </fieldset>
      )}
      <OfflineNote action="change your staff list" />
      <Button
        type="submit"
        disabled={!online || busy || !emailOk}
        aria-busy={busy}
        className="h-12 rounded-lg text-base font-bold"
      >
        {busy && <Spinner aria-hidden className="size-4" />}
        {person ? 'Save' : 'Add person'}
      </Button>
    </form>
  )
}

/**
 * "Remove Ana Ruiz?" Off the staff list, every group and event; and, if
 * they use TeachForFree, out of the school there too.
 */
export function RemovePersonDialog({
  person,
  schoolName,
  onClose,
}: {
  person: StaffPerson | null
  schoolName: string
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  // Kept while closing, so the text doesn't blank out.
  const [shown, setShown] = useState<StaffPerson | null>(person)
  if (person && person !== shown) setShown(person)

  const remove = useMutation({
    mutationFn: (p: StaffPerson) => removePerson(p.id),
    onSuccess: (_r, p) => {
      queryClient.setQueryData<StaffDirectory>(
        staffQueryOptions.queryKey,
        (d) =>
          d && {
            people: d.people.filter((x) => x.id !== p.id),
            groups: d.groups.map((g) => ({
              ...g,
              staff_ids: g.staff_ids.filter((x) => x !== p.id),
            })),
          },
      )
      // The dashboard and Account → School list app users.
      void queryClient.invalidateQueries({ queryKey: ['school'] })
      void queryClient.invalidateQueries({ queryKey: ['school-behavior'] })
      onClose()
      toast.success(`Removed ${displayName(p)}`)
    },
    onError: (error) => {
      console.error('Removing a staff member failed:', error)
      toast.error('Couldn’t remove them. Try again.')
    },
  })
  const busy = remove.isPending

  return (
    <AlertDialog
      open={person !== null}
      onOpenChange={(open) => {
        if (!open && !busy) onClose()
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="font-bold wrap-break-word">
            Remove {shown ? displayName(shown) : ''}?
          </AlertDialogTitle>
          <AlertDialogDescription>
            They’ll be taken off your staff list, every group and every event.
            {shown?.uses_app &&
              ` They also leave ${schoolName} in TeachForFree, so you can no longer view their classes. Their account stays theirs.`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={busy}
            onClick={() => shown && remove.mutate(shown)}
          >
            {busy && <Spinner aria-hidden className="size-4" />}
            Remove
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
