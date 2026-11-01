import { useEffect, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useSuspenseQuery } from '@tanstack/react-query'
import { CircleAlert, Plus, Users } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { Spinner } from '@/components/ui/spinner'
import { ClassRoster } from '#/components/class-roster'
import { connectNotice } from '#/components/classroom-connect-notice'
import { useCreateDialogs } from '#/components/create-dialogs'
import { MarkRing } from '#/components/student-card'
import { SwitchClassDialog } from '#/components/switch-class-dialog'
import { useClassroomSwitch } from '#/hooks/useClassroomSwitch'
import {
  classroomStatusQueryOptions,
  formatStudentCount,
  validateClassroomResult,
} from '#/lib/classroom'
import { meQueryOptions } from '#/lib/auth'
import type { Me } from '#/lib/auth'
import {
  localDate,
  markCountsQueryOptions,
  markTypesQueryOptions,
} from '#/lib/marks'

export const Route = createFileRoute('/_authed/classes')({
  // ?classroom=connected or ?classroom_error=…, passed on from / after
  // "Connect Google Classroom".
  validateSearch: validateClassroomResult,
  // Loaded ahead, so the Add Students dialog knows right away whether Google
  // Classroom is connected. No retries, and the page still shows if this
  // fails.
  loader: async ({ context }) => {
    // Not waited for: just so the mark buttons are ready when a student is
    // tapped.
    void context.queryClient.query(markTypesQueryOptions).catch(() => null)
    await context.queryClient
      .query({ ...classroomStatusQueryOptions, retry: false })
      .catch(() => null)
  },
  component: ClassesPage,
})

function ClassesPage() {
  // GET /users/me (sends the login cookies): the teacher, their classes, and
  // the open (default) class's roster. The login check in _authed.tsx makes
  // this same request, so it has already loaded and isn't fetched twice.
  // Refetching 'me', or switching classes, updates this page.
  const { data: me } = useSuspenseQuery(meQueryOptions)

  // Logged out: the layout is already sending the teacher to /login.
  if (!me) return null
  return <ClassesContent me={me} />
}

function ClassesContent({ me }: { me: Me }) {
  const { teacher, classroom } = me
  // Adding students (typed, or from Google Classroom) is in the + menu.
  const { openAddStudents } = useCreateDialogs()

  // The open class is the teacher's default on the server. Picking another
  // in the Switch dialog makes it the default and shows it here.
  const { shownId, isLoading, error, select } = useClassroomSwitch(classroom.id)
  const [switchOpen, setSwitchOpen] = useState(false)
  // While a switch loads, the header already names the picked class.
  const shownName =
    me.classrooms.find((c) => c.id === shownId)?.name ?? classroom.name

  // Back from "Connect Google Classroom": reopen Add Students, where the
  // Connect button and the class cards are, with how it went. Then take it
  // out of the address bar, so a reload doesn't do it again.
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const { classroom: connected, classroom_error: connectError } = search
  useEffect(() => {
    if (!connected && !connectError) return
    openAddStudents(
      connectNotice({ classroom_error: connectError }, teacher.email),
    )
    void navigate({ to: '.', search: {}, replace: true })
  }, [connected, connectError, openAddStudents, navigate, teacher.email])

  return (
    <main
      aria-busy={isLoading || undefined}
      className="mx-auto flex w-full max-w-5xl min-w-0 flex-1 flex-col gap-2 px-4 py-6 sm:py-8"
    >
      <ClassHeader
        me={me}
        name={shownName}
        loading={isLoading}
        onSwitch={() => setSwitchOpen(true)}
      />

      {/* Red icon, black text: small red text on white is hard to read. */}
      {error && (
        <p role="alert" className="flex items-center gap-2 text-sm font-medium">
          <CircleAlert className="size-5 shrink-0 text-destructive" />
          {error}
        </p>
      )}

      {isLoading ? (
        <p
          role="status"
          className="flex items-center justify-center gap-2 py-16 font-medium text-muted-foreground"
        >
          <Spinner aria-hidden className="size-5" />
          Opening {shownName}…
        </p>
      ) : classroom.students.length > 0 ? (
        // Keyed by class, so switching classes starts fresh (no picks carried
        // over).
        <ClassRoster key={classroom.id} classroom={classroom} />
      ) : (
        <NoStudents
          firstName={teacher.name.split(' ')[0]}
          onAdd={() => openAddStudents()}
        />
      )}

      <SwitchClassDialog
        classrooms={me.classrooms}
        openId={shownId}
        open={switchOpen}
        onOpenChange={setSwitchOpen}
        onPick={select}
      />
    </main>
  )
}

/**
 * Like the top of a student's page: today's marks for the whole class as a
 * ring, the class name with a small Switch link, and (not on phones) a line
 * under it.
 */
function ClassHeader({
  me,
  name,
  loading,
  onSwitch,
}: {
  me: Me
  name: string
  /** A switch is under way: me.classroom is still the old class. */
  loading: boolean
  onSwitch: () => void
}) {
  const { classroom } = me
  // The same request as the cards' counts, so it's only fetched once.
  const counts = useQuery({
    ...markCountsQueryOptions(classroom.id, localDate()),
    enabled: !loading,
  })
  const today =
    counts.data && !loading
      ? counts.data.students.reduce(
          (sum, s) => ({
            positive: sum.positive + s.positive,
            negative: sum.negative + s.negative,
          }),
          { positive: 0, negative: 0 },
        )
      : null

  return (
    // Phones: one short row (small ring, name cut off with "…", Switch), so
    // the student cards get the screen.
    <header className="flex items-center gap-3 sm:items-start sm:gap-4">
      <MarkRing today={today} className="size-10 sm:size-20">
        <Avatar aria-hidden className="size-full after:hidden">
          <AvatarFallback className="bg-muted text-foreground">
            <Users className="size-4 sm:size-7" />
          </AvatarFallback>
        </Avatar>
      </MarkRing>
      <div className="flex min-w-0 flex-1 flex-col gap-1 sm:pt-2">
        <div className="flex items-baseline gap-x-3 gap-y-1 sm:flex-wrap">
          <h1
            title={name}
            className="min-w-0 truncate text-xl font-bold sm:overflow-visible sm:text-2xl sm:whitespace-normal sm:wrap-break-word"
          >
            {name}
          </h1>
          <Button
            variant="link"
            onClick={onSwitch}
            aria-label="Switch class"
            className="h-auto px-0 text-sm font-bold"
          >
            Switch
          </Button>
        </div>
        {/* Not on phones: space for the cards matters more there. */}
        {!loading && (
          <p className="hidden text-sm text-muted-foreground sm:block">
            {formatStudentCount(classroom.students.length)}
            {today && classroom.students.length > 0 && (
              <>
                {' · '}
                {today.positive + today.negative === 0
                  ? 'No marks yet today'
                  : `Today: ${today.positive} positive, ${today.negative} negative`}
              </>
            )}
          </p>
        )}
      </div>
    </header>
  )
}

function NoStudents({
  firstName,
  onAdd,
}: {
  firstName: string
  onAdd: () => void
}) {
  return (
    <Empty className="max-w-md self-center px-0">
      <EmptyHeader>
        <EmptyMedia
          variant="icon"
          className="size-14 rounded-lg border-2 border-border bg-secondary text-foreground"
        >
          <Users className="size-7" />
        </EmptyMedia>
        <EmptyTitle className="text-2xl font-bold">
          Welcome, {firstName}
        </EmptyTitle>
        <EmptyDescription className="text-base">
          Add your class roster to start giving students positive and negative
          marks.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        {/* The same dialog as + → Add students. */}
        <Button onClick={onAdd} size="lg">
          <Plus className="size-5" strokeWidth={3} />
          Add Students
        </Button>
      </EmptyContent>
    </Empty>
  )
}
