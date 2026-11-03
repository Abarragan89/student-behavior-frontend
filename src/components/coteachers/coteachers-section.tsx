import { useId, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  CircleAlert,
  Pencil,
  QrCode,
  RefreshCw,
  UserMinus,
  UserPlus,
  WifiOff,
  X,
} from 'lucide-react'
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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'
import { formatExpiry, InviteLink } from '#/components/coteachers/invite-link'
import { PermissionRows } from '#/components/coteachers/permission-rows'
import { useCreateDialogs } from '#/components/create-dialogs'
import { OfflineNote } from '#/components/offline-note'
import { ResponsiveDialog } from '#/components/responsive-dialogue'
import { TeacherAvatar } from '#/components/teacher-avatar'
import {
  cancelInvite,
  coteachersQueryOptions,
  permissionSummary,
  removeCoteacher,
  sharesAnything,
  updateCoteacher,
} from '#/lib/coteachers'
import type {
  Coteacher,
  CoteachersOverview,
  Invite,
  Permissions,
} from '#/lib/coteachers'
import { useOnline } from '#/lib/online'

/**
 * The Account page's Co-teachers: the teachers you share your classroom with,
 * what each can see or change (editable), and invite links nobody has used
 * yet. New invites come from + → Add co-teacher, or the button here.
 */
export function CoteachersSection({ ownerName }: { ownerName: string }) {
  const headingId = useId()
  // Focus lands here when a row leaves the list with its focused button.
  const headingRef = useRef<HTMLHeadingElement>(null)
  const list = useQuery(coteachersQueryOptions)
  const online = useOnline()
  const { openAddCoteacher } = useCreateDialogs()

  const [editing, setEditing] = useState<Coteacher | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [removing, setRemoving] = useState<Coteacher | null>(null)
  const [showing, setShowing] = useState<Invite | null>(null)
  const [showOpen, setShowOpen] = useState(false)

  const data = list.data
  return (
    <section aria-labelledby={headingId}>
      <Card className="gap-5 rounded-lg border-2 border-border shadow-md ring-0 [--card-spacing:--spacing(6)]">
        <CardHeader>
          <h2
            id={headingId}
            ref={headingRef}
            tabIndex={-1}
            className="text-lg font-bold outline-none"
          >
            Co-teachers
          </h2>
          <CardDescription>
            Teachers who can open your classroom with their own Google account.
            You choose what each one can see or change.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {data ? (
            <>
              {data.coteachers.length === 0 && data.invites.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No co-teachers yet.
                </p>
              )}
              {data.coteachers.length > 0 && (
                <ul className="flex flex-col gap-3">
                  {data.coteachers.map((c) => (
                    <li
                      key={c.user_id}
                      className="flex flex-col gap-3 rounded-lg border-2 border-border p-4"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <TeacherAvatar teacher={c} className="size-10" />
                        <div className="flex min-w-0 flex-col">
                          <p className="truncate font-bold">{c.name}</p>
                          <p className="truncate text-sm text-muted-foreground">
                            {c.email}
                          </p>
                        </div>
                      </div>
                      <p className="text-sm">
                        {permissionSummary(c.permissions)}
                      </p>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          onClick={() => {
                            setEditing(c)
                            setEditOpen(true)
                          }}
                          disabled={!online}
                          aria-label={`Change what ${c.name} can do`}
                          className="h-10 flex-1 rounded-lg border-2 font-bold sm:flex-none"
                        >
                          <Pencil />
                          Permissions
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => setRemoving(c)}
                          disabled={!online}
                          aria-label={`Remove ${c.name}`}
                          className="h-10 flex-1 rounded-lg border-2 font-bold sm:flex-none"
                        >
                          <UserMinus className="text-destructive" />
                          Remove
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              {data.invites.length > 0 && (
                <div className="flex flex-col gap-2">
                  <h3 className="text-sm font-bold">Invites not used yet</h3>
                  <ul className="flex flex-col gap-3">
                    {data.invites.map((invite) => (
                      <InviteRow
                        key={invite.id}
                        invite={invite}
                        onShow={() => {
                          setShowing(invite)
                          setShowOpen(true)
                        }}
                        onRemoved={() => headingRef.current?.focus()}
                      />
                    ))}
                  </ul>
                </div>
              )}

              <OfflineNote action="change your co-teachers" />
              <Button
                variant="outline"
                onClick={openAddCoteacher}
                disabled={!online}
                className="h-11 self-start rounded-lg border-2 px-4 font-bold"
              >
                <UserPlus />
                Add co-teacher
              </Button>
            </>
          ) : list.fetchStatus === 'paused' ? (
            <p
              role="status"
              className="flex items-center gap-2 text-sm font-medium text-muted-foreground"
            >
              <WifiOff className="size-4 shrink-0" />
              You’re offline. Connect to the internet to see your co-teachers.
            </p>
          ) : list.isError ? (
            <div role="alert" className="flex flex-col items-start gap-3">
              <p className="flex items-center gap-2 text-sm font-medium">
                <CircleAlert className="size-5 shrink-0 text-destructive" />
                Couldn’t load your co-teachers.
              </p>
              <Button
                variant="outline"
                onClick={() => void list.refetch()}
                disabled={list.isFetching}
                className="h-10 rounded-lg border-2 font-bold"
              >
                <RefreshCw className={cn(list.isFetching && 'animate-spin')} />
                Try again
              </Button>
            </div>
          ) : (
            <p
              role="status"
              className="flex items-center gap-2 text-sm font-medium text-muted-foreground"
            >
              <Spinner aria-hidden className="size-4" />
              Loading co-teachers…
            </p>
          )}
        </CardContent>
      </Card>

      {editing && (
        <EditPermissionsDialog
          key={editing.user_id}
          coteacher={editing}
          open={editOpen}
          onOpenChange={setEditOpen}
        />
      )}
      <RemoveDialog
        coteacher={removing}
        onClose={() => setRemoving(null)}
        onRemoved={() => headingRef.current?.focus()}
      />
      {showing && (
        <ResponsiveDialog
          isOpen={showOpen}
          setIsOpen={setShowOpen}
          title="Invite link"
          description="Works once. Send it only to your co-teacher."
          showDescription
        >
          <InviteLink invite={showing} ownerName={ownerName} />
        </ResponsiveDialog>
      )}
    </section>
  )
}

/** A pending invite: what it gives, when it stops working, its buttons. */
function InviteRow({
  invite,
  onShow,
  onRemoved,
}: {
  invite: Invite
  onShow: () => void
  onRemoved: () => void
}) {
  const queryClient = useQueryClient()
  const online = useOnline()
  const cancel = useMutation({
    mutationFn: () => cancelInvite(invite.id),
    onSuccess: () => {
      onRemoved()
      queryClient.setQueryData<CoteachersOverview>(
        coteachersQueryOptions.queryKey,
        (o) =>
          o && { ...o, invites: o.invites.filter((i) => i.id !== invite.id) },
      )
      toast.success('Invite cancelled', {
        description: 'Its link and QR code no longer work.',
      })
    },
    onError: (error) => {
      console.error('Cancelling the invite failed:', error)
      toast.error('Couldn’t cancel the invite. Try again.')
      void queryClient.invalidateQueries({
        queryKey: coteachersQueryOptions.queryKey,
      })
    },
  })
  const busy = cancel.isPending

  return (
    <li className="flex flex-col gap-3 rounded-lg border-2 border-dashed border-border p-4 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="text-sm">{permissionSummary(invite.permissions)}</p>
        <p className="text-sm text-muted-foreground">
          Works until{' '}
          <time dateTime={invite.expires_at}>
            {formatExpiry(invite.expires_at)}
          </time>
        </p>
      </div>
      <div className="flex gap-2">
        <Button
          variant="outline"
          onClick={onShow}
          disabled={!invite.url}
          className="h-10 flex-1 rounded-lg border-2 font-bold sm:flex-none"
        >
          <QrCode />
          Show
        </Button>
        <Button
          variant="outline"
          onClick={() => cancel.mutate()}
          disabled={busy || !online}
          aria-busy={busy}
          className="h-10 flex-1 rounded-lg border-2 font-bold sm:flex-none"
        >
          {busy ? <Spinner aria-hidden className="size-4" /> : <X />}
          Cancel invite
        </Button>
      </div>
    </li>
  )
}

/** The same rows as the invite, saved for one co-teacher. */
function EditPermissionsDialog({
  coteacher,
  open,
  onOpenChange,
}: {
  coteacher: Coteacher
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const online = useOnline()
  const [permissions, setPermissions] = useState<Permissions>(
    coteacher.permissions,
  )
  const save = useMutation({
    mutationFn: () => updateCoteacher(coteacher.user_id, permissions),
    onSuccess: (saved) => {
      queryClient.setQueryData<CoteachersOverview>(
        coteachersQueryOptions.queryKey,
        (o) =>
          o && {
            ...o,
            coteachers: o.coteachers.map((c) =>
              c.user_id === saved.user_id ? saved : c,
            ),
          },
      )
      onOpenChange(false)
      toast.success(`Saved ${coteacher.name}’s permissions`, {
        description: 'They take effect right away.',
      })
    },
    onError: (error) => {
      console.error('Saving co-teacher permissions failed:', error)
      toast.error('Couldn’t save. Try again.')
      void queryClient.invalidateQueries({
        queryKey: coteachersQueryOptions.queryKey,
      })
    },
  })
  const busy = save.isPending

  return (
    <ResponsiveDialog
      isOpen={open}
      setIsOpen={onOpenChange}
      title={`What ${coteacher.name} can do`}
      description="Changes take effect right away. To take away everything, remove them instead."
      showDescription
    >
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (!busy) save.mutate()
        }}
        className="flex flex-col gap-6"
      >
        <PermissionRows
          value={permissions}
          onChange={setPermissions}
          disabled={busy}
        />
        {!sharesAnything(permissions) && (
          <p className="text-sm font-medium">
            Choose View or Edit for at least one, or remove them.
          </p>
        )}
        <OfflineNote action="change permissions" />
        <Button
          type="submit"
          disabled={!online || busy || !sharesAnything(permissions)}
          aria-busy={busy}
          className="h-12 rounded-lg text-base font-bold"
        >
          {busy && <Spinner aria-hidden className="size-4" />}
          Save
        </Button>
      </form>
    </ResponsiveDialog>
  )
}

/** "Remove Mr. Lee?" Their access ends on their next request. */
function RemoveDialog({
  coteacher,
  onClose,
  onRemoved,
}: {
  coteacher: Coteacher | null
  onClose: () => void
  onRemoved: () => void
}) {
  const queryClient = useQueryClient()
  // Kept while closing, so the text doesn't blank out.
  const [shown, setShown] = useState<Coteacher | null>(coteacher)
  if (coteacher && coteacher !== shown) setShown(coteacher)

  const remove = useMutation({
    mutationFn: (c: Coteacher) => removeCoteacher(c.user_id),
    onSuccess: (_result, c) => {
      onRemoved()
      queryClient.setQueryData<CoteachersOverview>(
        coteachersQueryOptions.queryKey,
        (o) =>
          o && {
            ...o,
            coteachers: o.coteachers.filter((x) => x.user_id !== c.user_id),
          },
      )
      onClose()
      toast.success(`Removed ${c.name}`, {
        description: 'They can no longer open your classroom.',
      })
    },
    onError: (error) => {
      console.error('Removing the co-teacher failed:', error)
      toast.error('Couldn’t remove them. Try again.')
      void queryClient.invalidateQueries({
        queryKey: coteachersQueryOptions.queryKey,
      })
    },
  })
  const busy = remove.isPending

  return (
    <AlertDialog
      open={coteacher !== null}
      onOpenChange={(open) => {
        if (!open && !busy) onClose()
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="font-bold wrap-break-word">
            Remove {shown?.name}?
          </AlertDialogTitle>
          <AlertDialogDescription>
            They’ll no longer be able to open your classroom. Marks and changes
            they made stay. To add them back, send a new invite.
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
