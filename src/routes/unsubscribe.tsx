import { useState } from 'react'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { useMutation } from '@tanstack/react-query'
import { BellOff, BellRing, MailX } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CardContent } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import {
  LinkPage,
  LinkPageHeader,
  Problem,
  ProblemText,
} from '#/components/link-page'
import {
  API_URL,
  ApiError,
  DEFAULT_TIMEOUT_MS,
  apiErrorFrom,
  timeoutSignal,
} from '#/lib/api'

// /unsubscribe#t=<token>: the "Stop these emails" link at the bottom of a
// school's event email (reminder, invite, change). The person needn't have an account: the signed
// token is all it takes. It asks first (mail scanners open links), then
// offers Undo.
export const Route = createFileRoute('/unsubscribe')({
  beforeLoad: ({ location }) => {
    if (location.hash) {
      const token = new URLSearchParams(location.hash.replace(/^#/, '')).get(
        't',
      )
      if (token) keepToken(token)
      // Off the address bar at once.
      throw redirect({ to: '/unsubscribe', replace: true })
    }
  },
  loader: () => readToken(),
  component: UnsubscribePage,
})

const KEY = 'tff:unsubscribe'

function keepToken(token: string) {
  try {
    sessionStorage.setItem(KEY, token)
  } catch {
    // Storage off: the link can be opened again.
  }
}

function readToken() {
  try {
    return sessionStorage.getItem(KEY)
  } catch {
    return null
  }
}

type Answer = { school: string; subscribed: boolean }

async function setEmails(token: string, undo: boolean): Promise<Answer> {
  const res = await fetch(`${API_URL}/email/unsubscribe`, {
    method: 'POST',
    credentials: 'omit',
    cache: 'no-store',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ undo }),
    signal: timeoutSignal(DEFAULT_TIMEOUT_MS),
  })
  if (!res.ok) throw apiErrorFrom(res)
  return res.json() as Promise<Answer>
}

function UnsubscribePage() {
  const token = Route.useLoaderData()
  return (
    <LinkPage>
      {token ? (
        <Unsubscribe token={token} />
      ) : (
        <Problem
          icon={MailX}
          title="This link is incomplete"
          text="Open the “Stop these emails” link at the bottom of a reminder email again."
        />
      )}
    </LinkPage>
  )
}

function Unsubscribe({ token }: { token: string }) {
  const [answer, setAnswer] = useState<Answer | null>(null)
  const change = useMutation({
    mutationFn: (undo: boolean) => setEmails(token, undo),
    onSuccess: setAnswer,
  })
  const gone = change.error instanceof ApiError && change.error.status === 404

  if (gone) {
    return (
      <Problem
        icon={MailX}
        title="This link doesn’t work"
        text="You may no longer be on your school’s staff list, so no reminders will come. If they still do, ask your school."
      />
    )
  }

  const off = answer !== null && !answer.subscribed
  const busy = change.isPending
  return (
    <>
      <LinkPageHeader
        icon={off ? BellOff : answer ? BellRing : MailX}
        title={
          !answer
            ? 'Stop event emails?'
            : off
              ? 'You’re unsubscribed'
              : 'Event emails are back on'
        }
      >
        {!answer
          ? 'You’ll stop getting the event invites, changes and reminders your school sends through TeachForFree.'
          : off
            ? `${answer.school} won’t send you event emails through TeachForFree anymore.`
            : `You’ll get ${answer.school}’s event emails again.`}
      </LinkPageHeader>
      <CardContent className="flex flex-col gap-3">
        {change.isError ? (
          <ProblemText
            title="That didn’t go through"
            text="Check your connection and try again."
          />
        ) : null}
        <Button
          variant={off ? 'outline' : 'default'}
          onClick={() => change.mutate(off)}
          disabled={busy}
          className={
            off
              ? 'h-11 rounded-lg border-2 text-base font-bold'
              : 'h-11 rounded-lg text-base font-bold'
          }
        >
          {busy && <Spinner aria-hidden className="size-4" />}
          {off ? 'Undo' : answer ? 'Stop them again' : 'Stop emails'}
        </Button>
      </CardContent>
    </>
  )
}
