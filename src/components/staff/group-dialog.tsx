import { useId, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { OfflineNote } from '#/components/offline-note'
import { ResponsiveDialog } from '#/components/responsive-dialogue'
import { PeopleChecklist } from '#/components/staff/people-checklist'
import { ApiError } from '#/lib/api'
import { useOnline } from '#/lib/online'
import {
  createGroup,
  deleteGroup,
  staffQueryOptions,
  updateGroup,
} from '#/lib/staff'
import type { StaffDirectory, StaffGroup, StaffPerson } from '#/lib/staff'

/** Make a group, or change one: its name and its people. */
export function GroupDialog({
  open,
  onOpenChange,
  group,
  people,
  startWith,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** null: a new group. */
  group: StaffGroup | null
  people: Array<StaffPerson>
  /** A new group's people to start with (e.g. picked in the event form). */
  startWith?: Array<string>
  onSaved?: (group: StaffGroup) => void
}) {
  return (
    <ResponsiveDialog
      isOpen={open}
      setIsOpen={onOpenChange}
      title={group ? `Edit ${group.name}` : 'New group'}
      description="Invite a whole group to an event at once."
      showDescription
    >
      {open && (
        <GroupForm
          group={group}
          people={people}
          startWith={startWith}
          onDone={(saved) => {
            onOpenChange(false)
            if (saved) onSaved?.(saved)
          }}
        />
      )}
    </ResponsiveDialog>
  )
}

function GroupForm({
  group,
  people,
  startWith,
  onDone,
}: {
  group: StaffGroup | null
  people: Array<StaffPerson>
  startWith?: Array<string>
  onDone: (saved: StaffGroup | null) => void
}) {
  const id = useId()
  const online = useOnline()
  const queryClient = useQueryClient()
  const [name, setName] = useState(group?.name ?? '')
  const [picked, setPicked] = useState<Set<string>>(
    new Set(group?.staff_ids ?? startWith ?? []),
  )
  const [confirmDelete, setConfirmDelete] = useState(false)

  const save = useMutation({
    mutationFn: () =>
      group
        ? updateGroup(group.id, { name, staff_ids: [...picked] })
        : createGroup(name, [...picked]),
    onSuccess: (saved) => {
      queryClient.setQueryData<StaffDirectory>(
        staffQueryOptions.queryKey,
        (d) =>
          d && {
            ...d,
            groups: [...d.groups.filter((g) => g.id !== saved.id), saved].sort(
              (a, b) => a.name.localeCompare(b.name),
            ),
          },
      )
      onDone(saved)
      toast.success(group ? `Saved ${saved.name}` : `Made ${saved.name}`, {
        description: `${saved.staff_ids.length} ${saved.staff_ids.length === 1 ? 'person' : 'people'}`,
      })
    },
    onError: (error) => {
      console.error('Saving a group failed:', error)
      toast.error(
        error instanceof ApiError && error.reason === 'group_exists'
          ? 'Another group already has that name.'
          : error instanceof ApiError && error.reason === 'too_many_groups'
            ? 'You have the most groups allowed. Delete one first.'
            : 'Couldn’t save the group. Try again.',
      )
    },
  })
  const remove = useMutation({
    mutationFn: () => deleteGroup(group!.id),
    onSuccess: () => {
      queryClient.setQueryData<StaffDirectory>(
        staffQueryOptions.queryKey,
        (d) =>
          d && { ...d, groups: d.groups.filter((g) => g.id !== group!.id) },
      )
      onDone(null)
      toast.success(`Deleted ${group!.name}`, {
        description: 'Its people stay on your staff list.',
      })
    },
    onError: (error) => {
      console.error('Deleting a group failed:', error)
      toast.error('Couldn’t delete the group. Try again.')
    },
  })
  const busy = save.isPending || remove.isPending
  const named = name.trim() !== ''

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        if (named && !busy) save.mutate()
      }}
      className="flex flex-col gap-5"
    >
      <div className="flex flex-col gap-2">
        <label htmlFor={`${id}-name`} className="text-base font-bold">
          Name
        </label>
        <Input
          id={`${id}-name`}
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={80}
          placeholder="Teachers, SPED team, 4th grade…"
          disabled={busy}
          className="h-11 rounded-lg border-2 border-border bg-card text-base"
        />
      </div>
      <PeopleChecklist
        people={people}
        selected={picked}
        onChange={setPicked}
        disabled={busy}
      />
      <OfflineNote action="change groups" />
      <Button
        type="submit"
        disabled={!online || busy || !named}
        aria-busy={save.isPending}
        className="h-12 rounded-lg text-base font-bold"
      >
        {save.isPending && <Spinner aria-hidden className="size-4" />}
        {group ? 'Save group' : 'Make group'}
      </Button>
      {group &&
        (confirmDelete ? (
          <div
            role="alert"
            className="flex flex-col gap-2 rounded-lg border-2 border-destructive p-3 text-sm"
          >
            <p className="font-bold">
              Delete {group.name}? Its people stay on your staff list, and
              events it was invited to keep everyone else.
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="destructive"
                onClick={() => remove.mutate()}
                disabled={busy || !online}
                className="h-10 rounded-lg font-bold"
              >
                {remove.isPending && <Spinner aria-hidden className="size-4" />}
                Delete group
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setConfirmDelete(false)}
                disabled={busy}
                className="h-10 rounded-lg border-2 font-bold"
              >
                Keep it
              </Button>
            </div>
          </div>
        ) : (
          <Button
            type="button"
            variant="ghost"
            onClick={() => setConfirmDelete(true)}
            disabled={busy}
            className="h-10 self-start rounded-lg font-bold text-destructive"
          >
            <Trash2 />
            Delete group
          </Button>
        ))}
    </form>
  )
}
