import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Link2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'
import { InviteLink } from '#/components/coteachers/invite-link'
import { PermissionRows } from '#/components/coteachers/permission-rows'
import { OfflineNote } from '#/components/offline-note'
import { ResponsiveDialog } from '#/components/responsive-dialogue'
import { ApiError } from '#/lib/api'
import { cacheInvite, createInvite, sharesAnything } from '#/lib/coteachers'
import type { Invite, Permissions } from '#/lib/coteachers'
import { useOnline } from '#/lib/online'

export type AddCoteacherDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Your name, for the message the link is sent with. */
  ownerName: string
}

/** Everything visible to start; nothing changeable until the teacher says. */
const START: Permissions = {
  classes: 'view',
  lesson_plans: 'view',
  conferences: 'view',
}

/**
 * + → Add co-teacher: pick what they can see or change, then get a one-time
 * link and QR code to the sign-in page. Signing in through it adds them.
 * Loaded the first time it opens (see create-dialogs.tsx).
 */
export default function AddCoteacherDialog({
  open,
  onOpenChange,
  ownerName,
}: AddCoteacherDialogProps) {
  const queryClient = useQueryClient()
  const online = useOnline()
  const [permissions, setPermissions] = useState<Permissions>(START)
  const [invite, setInvite] = useState<Invite | null>(null)

  const create = useMutation({
    mutationFn: () => createInvite(permissions),
    onSuccess: (made) => {
      setInvite(made)
      cacheInvite(queryClient, made)
    },
    onError: (error) => {
      console.error('Making the co-teacher invite failed:', error)
      toast.error('Couldn’t make the invite link', {
        description:
          error instanceof ApiError && error.status === 409
            ? 'You have 10 invite links waiting. Cancel one on your Account page first.'
            : 'Check your connection and try again.',
      })
    },
  })

  function setOpen(next: boolean) {
    onOpenChange(next)
    // Start over next time, once it has animated away.
    if (!next) {
      setTimeout(() => {
        setInvite(null)
        setPermissions(START)
        create.reset()
      }, 300)
    }
  }

  const creating = create.isPending

  return (
    <ResponsiveDialog
      isOpen={open}
      setIsOpen={setOpen}
      title={invite ? 'Send the invite' : 'Add co-teacher'}
      description={
        invite
          ? 'Works once. Anyone with it can sign in as your co-teacher, so send it only to them.'
          : 'Choose what they can see and change. You can change it anytime on your Account page.'
      }
      showDescription
    >
      {invite ? (
        <div className="flex flex-col gap-5">
          <InviteLink invite={invite} ownerName={ownerName} />
          <Button
            onClick={() => setOpen(false)}
            className="h-12 rounded-lg text-base font-bold"
          >
            Done
          </Button>
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (!creating) create.mutate()
          }}
          className="flex flex-col gap-6"
        >
          <PermissionRows
            value={permissions}
            onChange={setPermissions}
            disabled={creating}
          />
          {!sharesAnything(permissions) && (
            <p className="text-sm font-medium">
              Choose View or Edit for at least one.
            </p>
          )}
          <OfflineNote action="make an invite link" />
          <Button
            type="submit"
            disabled={!online || creating || !sharesAnything(permissions)}
            aria-busy={creating}
            className={cn(
              'relative h-12 rounded-lg text-base font-bold',
              creating && 'disabled:opacity-100',
            )}
          >
            <span
              className={cn(
                'inline-flex items-center gap-2',
                creating && 'invisible',
              )}
            >
              <Link2 className="size-5" />
              Make invite link
            </span>
            {creating && (
              <Spinner
                aria-label="Making the link"
                className="absolute inset-0 m-auto size-5"
              />
            )}
          </Button>
        </form>
      )}
    </ResponsiveDialog>
  )
}
