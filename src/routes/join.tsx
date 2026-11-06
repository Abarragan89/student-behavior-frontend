import { useEffect, useRef } from 'react'
import {
  Link,
  createFileRoute,
  redirect,
  useNavigate,
} from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Building2,
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
import { ApiError, joinLoginUrl } from '#/lib/api'
import { meQueryOptions } from '#/lib/auth'
import { useOnline } from '#/lib/online'
import {
  acceptSchoolInvite,
  forgetJoin,
  formatLongDate,
  joinAfterSignIn,
  joinPreviewQueryOptions,
  keepJoinCode,
  pendingJoin,
  schoolQueryOptions,
  setMySchool,
} from '#/lib/school'
import type { JoinPreview } from '#/lib/school'

// /join#<code>: a school's join link, sent by its administrator. Which school
// and who runs it, then "Continue with Google". Google brings you back here
// (the backend's ?next=join), and you join. Outside _authed: you may not have
// an account yet.
export const Route = createFileRoute('/join')({
  beforeLoad: ({ location, context: { queryClient } }) => {
    if (location.hash) {
      keepJoinCode(location.hash)
      queryClient.removeQueries({ queryKey: ['school-invite'] })
      // Off the address bar at once: it's a secret.
      throw redirect({ to: '/join', replace: true })
    }
  },
  // Read on every visit, so a second link opened in the same tab (only the
  // # changes, so the page isn't reloaded) shows that link, not the last one.
  loader: () => pendingJoin(),
  component: JoinPage,
})

function JoinPage() {
  const saved = Route.useLoaderData()
  return (
    <LinkPage>
      {saved ? (
        <Join
          key={saved.code}
          code={saved.code}
          autoAccept={saved.autoAccept}
        />
      ) : (
        <Problem
          icon={UserRoundX}
          title="This join link is incomplete"
          text="Ask your administrator to send the link again, or scan their QR code."
        />
      )}
    </LinkPage>
  )
}

function Join({ code, autoAccept }: { code: string; autoAccept: boolean }) {
  const preview = useQuery(joinPreviewQueryOptions(code))
  // Signed in? Same question the app asks; null when signed out.
  const me = useQuery({ ...meQueryOptions, retry: false })

  if (preview.isPending) return <Loading text="Opening the join link…" />
  if (preview.isError) {
    return (
      <Problem
        icon={CircleAlert}
        title="Couldn’t open the join link"
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
  const link = preview.data
  if (!link) {
    return (
      <Problem
        icon={UserRoundX}
        title="This join link doesn’t work"
        text="Ask your administrator for a new one."
      />
    )
  }
  if (link.status !== 'open') return <Finished link={link} />
  if (me.isPending) return <Loading text="Checking who’s signed in…" />

  // Already in this school? Joining again is harmless: the server answers
  // with the same membership.
  const signedIn = me.data ?? null
  return (
    <>
      <LinkPageHeader icon={Building2} title={`Join ${link.school_name}`}>
        {link.admin_name
          ? `${link.admin_name} invited you to join your school on TeachForFree.`
          : 'Your school invited you to join it on TeachForFree.'}
      </LinkPageHeader>
      <CardContent className="flex flex-col gap-5">
        <WhatJoiningMeans />
        {signedIn ? (
          <Accept
            code={code}
            email={signedIn.teacher.email}
            schoolName={link.school_name}
            auto={autoAccept}
          />
        ) : (
          <SignInWithGoogle href={joinLoginUrl} onClick={joinAfterSignIn} />
        )}
      </CardContent>
    </>
  )
}

/** What changes for the teacher, and what doesn't. */
function WhatJoiningMeans() {
  return (
    <ul className="flex flex-col gap-2 rounded-lg border-2 border-border p-3 text-sm">
      <li className="flex gap-2">
        <UsersRound className="mt-0.5 size-4 shrink-0" />
        Your administrator sees your name and email on the staff list.
      </li>
      <li className="flex gap-2">
        <Building2 className="mt-0.5 size-4 shrink-0" />
        Your classes, students and marks stay yours. TeachForFree stays free for
        you.
      </li>
    </ul>
  )
}

/**
 * Signed in: one tap to join as this account, or at once when they just came
 * back from Google to do exactly that.
 */
function Accept({
  code,
  email,
  schoolName,
  auto,
}: {
  code: string
  email: string
  schoolName: string
  auto: boolean
}) {
  const online = useOnline()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const accept = useMutation({
    mutationFn: () => acceptSchoolInvite(code),
    onSuccess: async (membership) => {
      forgetJoin()
      setMySchool(queryClient, membership)
      queryClient.removeQueries({ queryKey: schoolQueryOptions.queryKey })
      await navigate({ to: '/school' })
      toast.success(`You’re part of ${membership.name}`, {
        description: 'Your school is in your picture menu.',
      })
    },
    onError: (error) => {
      console.error('Joining the school failed:', error)
      // Keep the link for "leave your other school first"; anything else
      // that the server answered won't work next time either.
      if (
        error instanceof ApiError &&
        !(error.status === 409 && error.reason === 'other_school')
      ) {
        forgetJoin()
      }
    },
  })

  // Back from Google: join once, without asking again.
  const started = useRef(false)
  useEffect(() => {
    if (!auto || started.current || !online) return
    started.current = true
    accept.mutate()
  }, [auto, online, accept])

  if (accept.isPending || accept.isSuccess) {
    return <Loading text={`Joining ${schoolName}…`} />
  }
  if (accept.error) {
    const error = accept.error instanceof ApiError ? accept.error : null
    if (error?.status === 409) {
      if (error.reason === 'other_school') {
        return (
          <ProblemText
            title="You’re already in another school"
            text="You can be in one school at a time. Leave it from your School page, then open this link again."
            action={
              <Link
                to="/school"
                className={cn(buttonVariants(), 'h-11 rounded-lg font-bold')}
              >
                Open my school
              </Link>
            }
          />
        )
      }
      return (
        <ProblemText
          title={finishedTitle(error.reason)}
          text="Ask your administrator for a new link."
        />
      )
    }
    if (error?.status === 404) {
      return (
        <ProblemText
          title="This join link doesn’t work anymore"
          text="Ask your administrator for a new one."
        />
      )
    }
    return (
      <ProblemText
        title="Couldn’t join the school"
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
        className="h-auto min-h-12 rounded-lg py-2 text-base font-bold whitespace-normal"
      >
        Join as {email}
      </Button>
      <NotYou />
    </div>
  )
}

function finishedTitle(status: string | undefined) {
  switch (status) {
    case 'expired':
      return 'This join link has expired'
    case 'full':
      return 'This join link is full'
    case 'revoked':
      return 'This join link was turned off'
  }
  return 'This join link doesn’t work anymore'
}

/** The link expired, filled up or was turned off. */
function Finished({ link }: { link: JoinPreview }) {
  const ask = link.admin_name
    ? `Ask ${link.admin_name} for a new link.`
    : 'Ask your administrator for a new link.'
  const text =
    link.status === 'expired'
      ? `It worked until ${formatLongDate(link.expires_at)}. ${ask}`
      : link.status === 'full'
        ? `Everyone it was made for has joined. ${ask}`
        : `${link.admin_name || 'Your administrator'} turned it off. ${ask}`
  return (
    <Problem
      icon={link.status === 'expired' ? Clock : UserRoundX}
      title={finishedTitle(link.status)}
      text={text}
    />
  )
}
