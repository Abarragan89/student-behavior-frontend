import { useEffect, useRef } from 'react'
import { Link, createFileRoute, redirect } from '@tanstack/react-router'
import { useMutation, useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  CircleAlert,
  Clock,
  RefreshCw,
  UserRoundX,
  UsersRound,
} from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
import { CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import {
  LinkPage,
  LinkPageHeader,
  Loading,
  NotYou,
  Problem,
  ProblemText,
  SignInWithGoogle,
} from '#/components/link-page'
import { ApiError, inviteLoginUrl } from '#/lib/api'
import { meQueryOptions } from '#/lib/auth'
import { FEATURES, levelOf } from '#/lib/coteachers'
import type { Permissions } from '#/lib/coteachers'
import {
  acceptAfterSignIn,
  acceptInvite,
  forgetInvite,
  invitePreviewQueryOptions,
  keepInviteCode,
  pendingInvite,
} from '#/lib/invite'
import type { InvitePreview } from '#/lib/invite'
import { useOnline } from '#/lib/online'
import { useSwitchSpace } from '#/lib/workspace'

// /invite#<code>: a teacher invited you to co-teach (src/lib/invite.ts). The
// sign-in page for that invite: who sent it and what it gives, then
// "Continue with Google". Google brings you back here (the backend's
// ?next=invite), and the invite is accepted. Outside _authed: you may not
// have an account yet.
export const Route = createFileRoute('/invite')({
  beforeLoad: ({ location, context: { queryClient } }) => {
    if (location.hash) {
      keepInviteCode(location.hash)
      queryClient.removeQueries({ queryKey: ['coteacher-invite'] })
      // Off the address bar at once: it's a secret.
      throw redirect({ to: '/invite', replace: true })
    }
  },
  // Read on every visit, so a second link opened in the same tab (only the
  // # changes, so the page isn't reloaded) shows that invite, not the last.
  loader: () => pendingInvite(),
  component: InvitePage,
})

function InvitePage() {
  const saved = Route.useLoaderData()

  return (
    <LinkPage>
      {saved ? (
        <Invite
          key={saved.code}
          code={saved.code}
          autoAccept={saved.autoAccept}
        />
      ) : (
        <Problem
          icon={UserRoundX}
          title="This invite link is incomplete"
          text="Ask the teacher who invited you to send the link again, or scan their QR code."
        />
      )}
    </LinkPage>
  )
}

function Invite({ code, autoAccept }: { code: string; autoAccept: boolean }) {
  const preview = useQuery(invitePreviewQueryOptions(code))
  // Signed in? Same question the app asks; null when signed out.
  const me = useQuery({ ...meQueryOptions, retry: false })

  if (preview.isPending) return <Loading text="Opening the invite…" />
  if (preview.isError) {
    return (
      <Problem
        icon={CircleAlert}
        title="Couldn’t open the invite"
        text="Check your connection and try again."
        action={
          <Button
            variant="outline"
            onClick={() => void preview.refetch()}
            disabled={preview.isFetching}
            className="h-11 rounded-lg border-2 font-bold"
          >
            <RefreshCw className={cn(preview.isFetching && 'animate-spin')} />
            Try again
          </Button>
        }
      />
    )
  }
  const invite = preview.data
  if (!invite) {
    return (
      <Problem
        icon={UserRoundX}
        title="This invite link doesn’t work"
        text="Ask the teacher who invited you to make a new one."
      />
    )
  }
  if (invite.status !== 'pending') return <Finished invite={invite} />
  if (me.isPending) return <Loading text="Checking who’s signed in…" />

  const signedIn = me.data ?? null
  return (
    <>
      <LinkPageHeader
        icon={UsersRound}
        title={`${invite.owner_name} invited you to co-teach`}
      >
        You’ll be able to open their classroom on TeachForFree, alongside your
        own classes.
      </LinkPageHeader>
      <CardContent className="flex flex-col gap-5">
        <WhatYouGet permissions={invite.permissions} />
        {signedIn ? (
          <Accept
            code={code}
            email={signedIn.teacher.email}
            ownerName={invite.owner_name}
            auto={autoAccept}
          />
        ) : (
          <SignInWithGoogle href={inviteLoginUrl} onClick={acceptAfterSignIn} />
        )}
      </CardContent>
    </>
  )
}

/**
 * Signed in: one tap to accept as this account, or at once when they just
 * came back from Google to do exactly that.
 */
function Accept({
  code,
  email,
  ownerName,
  auto,
}: {
  code: string
  email: string
  ownerName: string
  auto: boolean
}) {
  const online = useOnline()
  const { switchTo } = useSwitchSpace()
  const accept = useMutation({
    mutationFn: () => acceptInvite(code),
    onSuccess: async (space) => {
      forgetInvite()
      const opened = await switchTo(space.owner_id, { quiet: true })
      if (opened) {
        toast.success(`You’re now a co-teacher in ${ownerName}’s classroom`, {
          description: 'Switch classrooms anytime from your picture menu.',
        })
      }
    },
    onError: (error) => {
      console.error('Accepting the invite failed:', error)
      if (error instanceof ApiError && error.status !== 409) forgetInvite()
    },
  })

  // Back from Google: accept once, without asking again.
  const started = useRef(false)
  useEffect(() => {
    if (!auto || started.current || !online) return
    started.current = true
    accept.mutate()
  }, [auto, online, accept])

  if (accept.isPending || accept.isSuccess) {
    return <Loading text={`Opening ${ownerName}’s classroom…`} />
  }
  if (accept.error) {
    const status =
      accept.error instanceof ApiError ? accept.error.status : undefined
    if (status === 409) {
      return (
        <ProblemText
          title="This is your own invite"
          text="Send the link or QR code to your co-teacher. They sign in with their own Google account."
          action={
            <Link
              to="/classes"
              className={cn(buttonVariants(), 'h-11 rounded-lg font-bold')}
            >
              Back to my classes
            </Link>
          }
        />
      )
    }
    if (status === 404) {
      return (
        <ProblemText
          title="This invite link doesn’t work anymore"
          text="It was used, cancelled or has expired. Ask for a new one."
        />
      )
    }
    return (
      <ProblemText
        title="Couldn’t accept the invite"
        text="Check your connection and try again."
        action={
          <Button
            onClick={() => accept.mutate()}
            className="h-11 rounded-lg font-bold"
          >
            Try again
          </Button>
        }
      />
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <Button
        onClick={() => accept.mutate()}
        disabled={!online}
        className="h-12 rounded-lg text-base font-bold"
      >
        Accept as {email}
      </Button>
      <NotYou />
    </div>
  )
}

/** What the invite lets you do, one line per feature it shares. */
function WhatYouGet({ permissions }: { permissions: Permissions }) {
  const shared = FEATURES.filter((f) => levelOf(permissions, f.key) !== 'none')
  return (
    <ul className="flex flex-col gap-1.5 rounded-lg border-2 border-border p-3 text-sm">
      {shared.map((f) => (
        <li key={f.key} className="flex justify-between gap-3">
          <span>{f.label}</span>
          <span className="font-bold">
            {levelOf(permissions, f.key) === 'edit' ? 'View and edit' : 'View'}
          </span>
        </li>
      ))}
    </ul>
  )
}

/** The invite was used, cancelled or ran out. */
function Finished({ invite }: { invite: InvitePreview }) {
  const text =
    invite.status === 'used'
      ? 'Someone already signed in with it. If that was you, open the app: you’ll find the classroom in your picture menu.'
      : invite.status === 'cancelled'
        ? `${invite.owner_name} cancelled it. Ask them for a new one.`
        : `It worked for 7 days. Ask ${invite.owner_name} for a new one.`
  return (
    <Problem
      icon={invite.status === 'expired' ? Clock : UserRoundX}
      title={
        invite.status === 'used'
          ? 'This invite was already used'
          : invite.status === 'cancelled'
            ? 'This invite was cancelled'
            : 'This invite has expired'
      }
      text={text}
      action={
        invite.status === 'used' ? (
          <Link
            to="/classes"
            className={cn(buttonVariants(), 'h-11 rounded-lg font-bold')}
          >
            Open TeachForFree
          </Link>
        ) : undefined
      }
    />
  )
}
