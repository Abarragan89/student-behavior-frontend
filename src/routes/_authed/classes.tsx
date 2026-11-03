import { useEffect, useRef, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'
import { Archive, CircleAlert, Plus, Users } from 'lucide-react'
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
import { ArchiveClassDialog } from '#/components/archive-class-dialog'
import type { ArchiveTarget } from '#/components/archive-class-dialog'
import { ClassHeader } from '#/components/class-header'
import { ClassRoster } from '#/components/class-roster'
import { connectNotice } from '#/components/classroom-connect-notice'
import { useCreateDialogs } from '#/components/create-dialogs'
import { SwitchClassDialog } from '#/components/switch-class-dialog'
import { useClassroomSwitch } from '#/hooks/useClassroomSwitch'
import {
  classroomStatusQueryOptions,
  validateClassroomResult,
} from '#/lib/classroom'
import { meQueryOptions } from '#/lib/auth'
import type { Me, OpenClassroom } from '#/lib/auth'
import { markTypesQueryOptions } from '#/lib/marks'
import { canEdit, currentSpace, mayLoad } from '#/lib/workspace'

export const Route = createFileRoute('/_authed/classes')({
  // ?classroom=connected or ?classroom_error=…, from the backend after
  // "Connect Google Classroom".
  validateSearch: validateClassroomResult,
  // A co-teacher needs at least View on Classes (_authed.tsx checks).
  staticData: { feature: { key: 'classes', level: 'view' } },
  // Started early but not waited for, so the page shows at once (and
  // offline): the mark types, so the buttons are ready when a student is
  // tapped, and whether Google Classroom is connected, for Add Students.
  loader: ({ context }) => {
    if (!mayLoad(context.queryClient, 'classes')) return
    void context.queryClient.query(markTypesQueryOptions).catch(() => null)
    // Google Classroom is the owner's own account: not in someone's space.
    if (currentSpace()) return
    void context.queryClient
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

  // Logged out: the layout is already sending the teacher to /login. No
  // class: a co-teacher without Classes, whom the layout sends elsewhere.
  if (!me?.classroom) return null
  return <ClassesContent me={me} classroom={me.classroom} />
}

function ClassesContent({
  me,
  classroom,
}: {
  me: Me
  classroom: OpenClassroom
}) {
  const { teacher } = me
  // A co-teacher with View only: see the class, change nothing.
  const editable = canEdit(me, 'classes')
  // Adding students (typed, or from Google Classroom) is in the + menu.
  const { openAddStudents, openCreateClass } = useCreateDialogs()

  // "Archive class" at the bottom. The dialog keeps the class it was opened
  // for, since another class opens as soon as archiving works.
  const [archiveTarget, setArchiveTarget] = useState<ArchiveTarget | null>(null)
  const [archiveOpen, setArchiveOpen] = useState(false)
  // After archiving, focus moves to the newly opened class's name, not back
  // to the Archive button at the bottom of the page.
  const headingRef = useRef<HTMLHeadingElement>(null)
  const justArchived = useRef(false)

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
        classroom={classroom}
        name={shownName}
        loading={isLoading}
        onSwitch={() => setSwitchOpen(true)}
        headingRef={headingRef}
        // Long names stop before the phone avatar (see _authed.tsx).
        className="max-md:pr-12"
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
        <ClassRoster
          key={classroom.id}
          classroom={classroom}
          readOnly={!editable}
        />
      ) : (
        <NoStudents
          firstName={teacher.name.split(' ')[0]}
          onAdd={editable ? () => openAddStudents() : undefined}
        />
      )}

      {/* At the very bottom, below the students (mt-auto), and set apart
          by a line: it's for the end of the year, not everyday use. Only
          for your own classes: a co-teacher never archives the owner's. */}
      {!isLoading && editable && !me.acting_for && (
        <div className="mt-auto pt-10">
          <div className="border-t-2 border-border pt-6">
            <Button
              variant="outline"
              onClick={() => {
                setArchiveTarget({
                  id: classroom.id,
                  name: classroom.name,
                  onlyClass: me.classrooms.length <= 1,
                })
                setArchiveOpen(true)
              }}
              className="h-11 rounded-lg border-2 px-4 font-bold"
            >
              <Archive />
              Archive class
            </Button>
          </div>
        </div>
      )}

      {archiveTarget && (
        <ArchiveClassDialog
          target={archiveTarget}
          open={archiveOpen}
          onOpenChange={setArchiveOpen}
          onArchived={() => {
            justArchived.current = true
            window.scrollTo({ top: 0 })
          }}
          onCreateClass={openCreateClass}
          finalFocus={() => {
            if (!justArchived.current) return true
            justArchived.current = false
            return headingRef.current
          }}
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

function NoStudents({
  firstName,
  onAdd,
}: {
  firstName: string
  /** Left out for a co-teacher who can't add students. */
  onAdd?: () => void
}) {
  if (!onAdd) {
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
            No students yet
          </EmptyTitle>
          <EmptyDescription className="text-base">
            Students show here once they’re added to this class.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }
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
