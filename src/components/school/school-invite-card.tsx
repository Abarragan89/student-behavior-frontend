import { useId, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Copy, Link2, Link2Off, Mail, RotateCw } from 'lucide-react'
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
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { formatExpiry } from '#/components/coteachers/invite-link'
import { OfflineNote } from '#/components/offline-note'
import { QrSvg } from '#/components/qr-svg'
import { NewLinkDialog } from '#/components/school/new-link-dialog'
import { useOnline } from '#/lib/online'
import {
  revokeSchoolInvite,
  schoolQueryOptions,
  staffMessage,
} from '#/lib/school'
import type { SchoolDetail, SchoolInvite } from '#/lib/school'

/**
 * The top of the administrator's School page: the join link, ready to copy,
 * and a ready-made message to paste into an email from their own account.
 * The app never sends anything. Below: the QR code for a staff meeting, and
 * making a new link or turning this one off.
 */
export function SchoolInviteCard({
  detail,
  adminName,
  welcome,
}: {
  detail: SchoolDetail
  adminName: string
  /** Just created: say the school is ready. */
  welcome: boolean
}) {
  const headingId = useId()
  const [newLinkOpen, setNewLinkOpen] = useState(false)
  const invite = detail.invite
  const open = invite?.status === 'open' && invite.url !== ''

  return (
    <section aria-labelledby={headingId}>
      <Card className="gap-5 rounded-lg border-2 border-primary shadow-md ring-0 [--card-spacing:--spacing(6)]">
        <CardHeader>
          <h2 id={headingId} className="text-xl font-bold wrap-break-word">
            {welcome ? `${detail.school.name} is ready` : 'Invite your staff'}
          </h2>
          <CardDescription className="text-base">
            {open
              ? 'Send this link to your teachers. They open it, sign in with Google, and join your school.'
              : 'Make a link to send your teachers. They open it, sign in with Google, and join your school.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          {open ? (
            <OpenLink
              invite={invite}
              schoolName={detail.school.name}
              adminName={adminName}
              onNewLink={() => setNewLinkOpen(true)}
            />
          ) : (
            <ClosedLink
              invite={invite}
              onNewLink={() => setNewLinkOpen(true)}
            />
          )}
        </CardContent>
      </Card>
      <NewLinkDialog
        open={newLinkOpen}
        onOpenChange={setNewLinkOpen}
        staffEstimate={detail.school.staff_estimate}
        replacing={open}
      />
    </section>
  )
}

function OpenLink({
  invite,
  schoolName,
  adminName,
  onNewLink,
}: {
  invite: SchoolInvite
  schoolName: string
  adminName: string
  onNewLink: () => void
}) {
  const fieldId = useId()
  const online = useOnline()
  const [turningOff, setTurningOff] = useState(false)
  const message = staffMessage({
    schoolName,
    adminName,
    url: invite.url,
    expiresAt: invite.expires_at,
  })

  async function copy(
    text: string,
    copied: { title: string; description: string },
    byHand: string,
  ) {
    try {
      await navigator.clipboard.writeText(text)
      toast.success(copied.title, { description: copied.description })
    } catch {
      // Clipboard blocked: show it, so it can be copied by hand.
      toast(byHand, { description: text })
    }
  }

  return (
    <>
      <div className="flex flex-col gap-2">
        <label htmlFor={fieldId} className="text-sm font-bold">
          Join link
        </label>
        <Input
          id={fieldId}
          readOnly
          value={invite.url}
          onFocus={(e) => e.currentTarget.select()}
          className="h-11 rounded-lg border-2 border-border bg-card font-mono text-sm md:text-sm"
        />
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <Button
          onClick={() =>
            void copy(
              invite.url,
              {
                title: 'Link copied',
                description: 'Paste it into an email or message to your staff.',
              },
              'Copy this link',
            )
          }
          className="h-12 rounded-lg border-2 border-border text-base font-bold shadow-sm"
        >
          <Copy className="size-5" />
          Copy link
        </Button>
        <Button
          variant="outline"
          onClick={() =>
            void copy(
              message.body,
              {
                title: 'Message copied',
                description: `Paste it into a new email to your staff. Subject: ${message.subject}`,
              },
              'Copy this message',
            )
          }
          className="h-auto min-h-12 rounded-lg border-2 border-border bg-card py-2 text-base font-bold whitespace-normal"
        >
          <Mail className="size-5" />
          Copy message for staff
        </Button>
      </div>

      <p className="text-sm">
        Works until{' '}
        <time dateTime={invite.expires_at} className="font-bold">
          {formatExpiry(invite.expires_at)}
        </time>
        {' · '}
        <span className="font-bold">
          {invite.max_uses === null
            ? `${invite.uses} joined`
            : `${invite.uses} of ${invite.max_uses} joined`}
        </span>
      </p>

      <details className="group rounded-lg border-2 border-border">
        <summary className="cursor-pointer rounded-lg px-3 py-2 text-sm font-bold">
          See the message
        </summary>
        <div className="flex flex-col gap-2 border-t-2 border-border px-3 py-3 text-sm">
          <p>
            <span className="font-bold">Subject:</span> {message.subject}
          </p>
          <p className="whitespace-pre-line wrap-break-word text-muted-foreground">
            {message.body}
          </p>
        </div>
      </details>

      <div className="flex flex-col items-center gap-2">
        <p className="text-sm font-bold">
          At a staff meeting? Put this on the screen.
        </p>
        {/* A white margin all around: phones need it to find the code. */}
        <div className="rounded-lg border-2 border-border bg-white p-4">
          <QrSvg
            value={invite.url}
            label={`QR code that opens the join page for ${schoolName}`}
            className="size-44 sm:size-52"
          />
        </div>
        <p className="text-center text-sm text-muted-foreground">
          Teachers scan it with their phone camera.
        </p>
      </div>

      <OfflineNote action="change the link" />
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          onClick={onNewLink}
          disabled={!online}
          className="h-10 rounded-lg border-2 font-bold"
        >
          <RotateCw />
          Make a new link
        </Button>
        <Button
          variant="outline"
          onClick={() => setTurningOff(true)}
          disabled={!online}
          className="h-10 rounded-lg border-2 font-bold"
        >
          <Link2Off className="text-destructive" />
          Turn off link
        </Button>
      </div>
      <TurnOffDialog
        invite={turningOff ? invite : null}
        onClose={() => setTurningOff(false)}
      />
    </>
  )
}

/** The link expired, filled up, or was turned off. */
function ClosedLink({
  invite,
  onNewLink,
}: {
  invite: SchoolInvite | null
  onNewLink: () => void
}) {
  const online = useOnline()
  const text = !invite
    ? 'Your join link is turned off. Teachers who joined stay in your school.'
    : invite.status === 'expired'
      ? `Your join link expired on ${formatExpiry(invite.expires_at)}.`
      : invite.status === 'full'
        ? `Your join link is full: ${invite.uses} teachers joined with it.`
        : 'Your join link is turned off.'
  return (
    <>
      <p className="flex gap-2 text-base">
        <Link2 className="mt-1 size-4 shrink-0" />
        {text}
      </p>
      <OfflineNote action="make a new link" />
      <Button
        onClick={onNewLink}
        disabled={!online}
        className="h-12 self-start rounded-lg px-5 text-base font-bold"
      >
        <RotateCw />
        Make a new link
      </Button>
    </>
  )
}

/** "Turn off the join link?" Members stay; nobody new can join with it. */
function TurnOffDialog({
  invite,
  onClose,
}: {
  invite: SchoolInvite | null
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const turnOff = useMutation({
    mutationFn: (id: string) => revokeSchoolInvite(id),
    onSuccess: () => {
      queryClient.setQueryData<SchoolDetail | null>(
        schoolQueryOptions.queryKey,
        (d) => d && { ...d, invite: null },
      )
      onClose()
      toast.success('Link turned off', {
        description: 'It no longer works. Make a new one anytime.',
      })
    },
    onError: (error) => {
      console.error('Turning off the join link failed:', error)
      toast.error('Couldn’t turn off the link. Try again.')
      void queryClient.invalidateQueries({
        queryKey: schoolQueryOptions.queryKey,
      })
    },
  })
  const busy = turnOff.isPending

  return (
    <AlertDialog
      open={invite !== null}
      onOpenChange={(open) => {
        if (!open && !busy) onClose()
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="font-bold">
            Turn off the join link?
          </AlertDialogTitle>
          <AlertDialogDescription>
            Nobody else can join with it, even if you already sent it. Teachers
            who joined stay in your school.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={busy}
            onClick={() => invite && turnOff.mutate(invite.id)}
          >
            {busy && <Spinner aria-hidden className="size-4" />}
            Turn off
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
