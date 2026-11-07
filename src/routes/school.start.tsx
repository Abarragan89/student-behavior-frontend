import { useId, useState } from 'react'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Building2, CircleAlert, RefreshCw } from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
import { CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'
import { GoogleIcon } from '#/components/GoogleIcon'
import { OfflineNote } from '#/components/offline-note'
import {
  LinkPage,
  LinkPageHeader,
  Loading,
  NotYou,
  OfflineSignIn,
  Problem,
  ProblemText,
  googleButtonClass,
} from '#/components/link-page'
import { ApiError, schoolStartLoginUrl } from '#/lib/api'
import { meQueryOptions } from '#/lib/auth'
import type { Me } from '#/lib/auth'
import { useOnline } from '#/lib/online'
import {
  MAX_NAME_LENGTH,
  MAX_STAFF,
  createSchool,
  forgetSchoolDraft,
  keepSchoolDraft,
  pendingSchoolDraft,
  schoolQueryOptions,
  setMySchool,
} from '#/lib/school'
import type { SchoolDraft } from '#/lib/school'

// /school/start: an administrator starts a school. The school's name comes
// first, then Google sign-in (the name waits in this tab), then one tap to
// create it. They land on /school with the join link to send their staff.
// Outside _authed: they may not have an account yet. The marketing page
// /for-schools links here.
export const Route = createFileRoute('/school/start')({
  component: StartSchoolPage,
})

function StartSchoolPage() {
  // Signed in? null when signed out.
  const me = useQuery({ ...meQueryOptions, retry: false })

  return (
    <LinkPage>
      {me.isPending ? (
        <Loading text="Getting ready…" />
      ) : me.isError ? (
        <Problem
          icon={CircleAlert}
          title="Couldn’t reach TeachForFree"
          text="Check your connection and try again."
          action={
            <Button
              variant="outline"
              onClick={() => void me.refetch()}
              disabled={me.isFetching}
              className="h-11 rounded-lg border-2 font-bold"
            >
              <RefreshCw className={cn(me.isFetching && 'animate-spin')} />
              Try again
            </Button>
          }
        />
      ) : me.data?.school ? (
        <Problem
          icon={Building2}
          title={`You’re already part of ${me.data.school.name}`}
          text="You can be in one school at a time."
          action={
            <Link
              to={
                me.data.school.role === 'admin'
                  ? '/dashboard'
                  : '/account/school'
              }
              className={cn(buttonVariants(), 'h-11 rounded-lg font-bold')}
            >
              Open your school
            </Link>
          }
        />
      ) : (
        <StartForm me={me.data ?? null} draft={pendingSchoolDraft()} />
      )}
    </LinkPage>
  )
}

function StartForm({
  me,
  draft,
}: {
  me: Me | null
  draft: SchoolDraft | null
}) {
  const id = useId()
  const online = useOnline()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [name, setName] = useState(draft?.name ?? '')
  const [staff, setStaff] = useState(
    draft?.staff_estimate ? String(draft.staff_estimate) : '',
  )

  const trimmed = name.trim()
  const staffNumber = staff.trim() === '' ? null : Number(staff)
  const staffValid =
    staffNumber === null ||
    (Number.isInteger(staffNumber) &&
      staffNumber >= 1 &&
      staffNumber <= MAX_STAFF)
  const valid = trimmed.length > 0 && staffValid

  const create = useMutation({
    mutationFn: () =>
      createSchool({ name: trimmed, staff_estimate: staffNumber }),
    onSuccess: async (detail) => {
      forgetSchoolDraft()
      queryClient.setQueryData(schoolQueryOptions.queryKey, detail)
      setMySchool(queryClient, {
        id: detail.school.id,
        name: detail.school.name,
        role: detail.role,
      })
      await navigate({ to: '/dashboard', search: { welcome: true } })
    },
    onError: (error) => {
      console.error('Starting the school failed:', error)
      if (error instanceof ApiError && error.reason === 'already_member') {
        forgetSchoolDraft()
        // The page above shows "You're already part of …".
        void queryClient.invalidateQueries({
          queryKey: meQueryOptions.queryKey,
        })
      }
    },
  })
  const busy = create.isPending || create.isSuccess

  function submit() {
    if (!valid || busy) return
    if (me) {
      create.mutate()
      return
    }
    // Signed out: keep the name in this tab, sign in, and come back here.
    keepSchoolDraft({ name: trimmed, staff_estimate: staffNumber })
    window.location.assign(schoolStartLoginUrl)
  }

  const fresh = me && draft
  return (
    <>
      <LinkPageHeader
        icon={Building2}
        title={fresh ? `Create ${draft.name}` : 'Start your school'}
      >
        {me
          ? `You’ll be its administrator, signed in as ${me.teacher.email}.`
          : 'Name your school, then sign in with Google. You’ll be its administrator, and you’ll get a link to send your staff.'}
      </LinkPageHeader>
      {me && (
        // Starting a school turns this account into an administrator's: say
        // so before a teacher loses sight of their own classes.
        <CardContent className="pb-0">
          <p className="rounded-lg bg-muted px-3 py-2 text-sm">
            This account becomes your school’s administrator account. It opens
            on your school’s dashboard, without Classes or Lesson Plans. Teach
            too? Keep your classes on another Google account.
          </p>
        </CardContent>
      )}
      <CardContent>
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault()
            submit()
          }}
          className="flex flex-col gap-5"
        >
          <div className="flex flex-col gap-2">
            <label htmlFor={`${id}-name`} className="text-sm font-bold">
              School name
            </label>
            <Input
              id={`${id}-name`}
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={MAX_NAME_LENGTH}
              autoComplete="organization"
              placeholder="e.g. Lincoln Elementary"
              required
              disabled={busy}
              className="h-11 rounded-lg border-2 border-border bg-card text-base"
            />
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor={`${id}-staff`} className="text-sm font-bold">
              About how many teachers?{' '}
              <span className="font-normal text-muted-foreground">
                (optional)
              </span>
            </label>
            <Input
              id={`${id}-staff`}
              value={staff}
              onChange={(e) => setStaff(e.target.value)}
              inputMode="numeric"
              type="number"
              min={1}
              max={MAX_STAFF}
              placeholder="e.g. 40"
              disabled={busy}
              aria-describedby={`${id}-staff-about`}
              aria-invalid={!staffValid || undefined}
              className="h-11 rounded-lg border-2 border-border bg-card text-base"
            />
            <p
              id={`${id}-staff-about`}
              className="text-sm text-muted-foreground"
            >
              {staffValid
                ? 'Your join link stops after this many teachers join. You can change it anytime.'
                : `Enter a whole number from 1 to ${MAX_STAFF}, or leave it empty.`}
            </p>
          </div>

          {create.error &&
            !(
              create.error instanceof ApiError &&
              create.error.reason === 'already_member'
            ) && (
              <ProblemText
                title="Couldn’t start the school"
                text={
                  create.error instanceof ApiError &&
                  create.error.status === 429
                    ? 'Too many tries. Wait a little and try again.'
                    : 'Check your connection and try again.'
                }
              />
            )}

          {me ? (
            <div className="flex flex-col gap-3">
              <Button
                type="submit"
                disabled={!valid || busy || !online}
                aria-busy={busy}
                className="h-12 rounded-lg text-base font-bold"
              >
                {busy && <Spinner aria-hidden className="size-4" />}
                Create school
              </Button>
              <OfflineNote
                action="start your school"
                className="justify-center"
              />
              <NotYou />
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <Button
                type="submit"
                variant="outline"
                disabled={!valid || !online}
                className={googleButtonClass}
              >
                <GoogleIcon />
                Continue with Google
              </Button>
              {!online && <OfflineSignIn />}
            </div>
          )}

          <p className="text-center text-sm text-muted-foreground">
            Founding schools are free through June 2027. No credit card.
            Teachers stay free.
          </p>
        </form>
      </CardContent>
    </>
  )
}
