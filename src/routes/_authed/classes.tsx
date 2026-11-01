import { useEffect } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'
import { Plus, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { ClassRoster } from '#/components/class-roster'
import { ClassroomFolder } from '#/components/classroom-folder'
import { connectNotice } from '#/components/classroom-connect-notice'
import { useCreateDialogs } from '#/components/create-dialogs'
import {
  classroomStatusQueryOptions,
  validateClassroomResult,
} from '#/lib/classroom'
import { meQueryOptions } from '#/lib/auth'
import type { Me } from '#/lib/auth'
import { markTypesQueryOptions } from '#/lib/marks'

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
  // GET /users/me (sends the login cookies): the teacher, their classroom
  // tabs, and the open (default) class's roster. The login check in
  // _authed.tsx makes this same request, so it has already loaded and isn't
  // fetched twice. Refetching 'me', or switching tabs, updates this page.
  const { data: me } = useSuspenseQuery(meQueryOptions)

  // Logged out: the layout is already sending the teacher to /login.
  if (!me) return null
  return <ClassesContent me={me} />
}

function ClassesContent({ me }: { me: Me }) {
  const { teacher, classroom } = me
  const firstName = teacher.name.split(' ')[0]
  const hasStudents = classroom.students.length > 0
  // Adding students (typed, or from Google Classroom) is in the + menu.
  const { openAddStudents } = useCreateDialogs()

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
    <main className="flex min-w-0 flex-1 flex-col">
      {/* Each classroom is a folder tab; the open one is the default. */}
      <ClassroomFolder tabs={me.classrooms} openId={classroom.id}>
        {hasStudents ? (
          // Keyed by class, so switching classes starts fresh (no picks
          // carried over).
          <ClassRoster key={classroom.id} classroom={classroom} />
        ) : (
          // No side padding: the folder already has some, and phones need the
          // width. It fills the folder and sits in the middle.
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
                Add your class roster to start giving students positive and
                negative marks.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              {/* The same dialog as + → Add students. */}
              <Button onClick={() => openAddStudents()} size="lg">
                <Plus className="size-5" strokeWidth={3} />
                Add Students
              </Button>
            </EmptyContent>
          </Empty>
        )}
      </ClassroomFolder>
    </main>
  )
}
