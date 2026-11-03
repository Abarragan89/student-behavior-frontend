import { useId } from 'react'
import { Input } from '@/components/ui/input'
import { QrSvg } from '#/components/qr-svg'
import { SendLinkButtons } from '#/components/send-link-buttons'
import { permissionSummary } from '#/lib/coteachers'
import type { Invite } from '#/lib/coteachers'

/**
 * A co-teacher invite: a QR code to scan with a phone camera, and the link to
 * send. Both open the sign-in page; signing in through them adds the person.
 */
export function InviteLink({
  invite,
  ownerName,
}: {
  invite: Invite
  ownerName: string
}) {
  const fieldId = useId()

  return (
    <div className="flex flex-col gap-5">
      {/* A white margin all around: phones need it to find the code. */}
      <div className="self-center rounded-lg border-2 border-border bg-white p-4">
        <QrSvg
          value={invite.url}
          label="QR code that opens the co-teacher sign-in page"
          className="size-48 sm:size-56"
        />
      </div>
      <p className="text-center text-sm text-muted-foreground">
        Your co-teacher scans this with their phone camera, or opens the link,
        and signs in with Google.
      </p>

      <div className="flex flex-col gap-2">
        <label htmlFor={fieldId} className="text-sm font-bold">
          Invite link
        </label>
        <Input
          id={fieldId}
          readOnly
          value={invite.url}
          onFocus={(e) => e.currentTarget.select()}
          className="h-11 rounded-lg border-2 border-border bg-card font-mono text-sm md:text-sm"
        />
        <SendLinkButtons
          url={invite.url}
          shareTitle="Co-teach with me"
          shareText={`${ownerName} invited you to co-teach on TeachForFree. Open this link and sign in with Google.`}
          copiedDescription="Paste it in a text or email to your co-teacher."
        />
      </div>

      <dl className="grid gap-1 text-sm">
        <div className="flex gap-1">
          <dt className="font-bold">They get:</dt>
          <dd>{permissionSummary(invite.permissions)}</dd>
        </div>
        <div className="flex gap-1">
          <dt className="font-bold">Works:</dt>
          <dd>
            once, until{' '}
            <time dateTime={invite.expires_at}>
              {formatExpiry(invite.expires_at)}
            </time>
          </dd>
        </div>
      </dl>
    </div>
  )
}

/** "Mon, Nov 9" */
export function formatExpiry(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}
