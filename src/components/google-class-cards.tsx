import { useEffect, useId, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowRight,
  CircleAlert,
  CircleCheck,
  RefreshCw,
  Users,
} from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'
import { OfflineNote } from '#/components/offline-note'
import { ApiError } from '#/lib/api'
import { useOnline } from '#/lib/online'
import { meQueryOptions } from '#/lib/auth'
import {
  archivedClassroomsQueryOptions,
  classroomStatusQueryOptions,
  formatStudentCount,
  googleCoursesQueryOptions,
  importGoogleCourse,
  isNotConnectedError,
} from '#/lib/classroom'
import type { CourseImportResult, GoogleCourse } from '#/lib/classroom'

type Message = { tone: 'success' | 'error'; text: string }

/**
 * The teacher's Google Classroom classes as cards. Clicking one has the
 * backend fetch that class's roster from Google, add any new students, and
 * open the class (make it the default tab). Only show this while Classroom is
 * connected.
 */
export function GoogleClassCards({
  openCourseId,
  onImported,
}: {
  /** The Google class the open tab came from, if any. */
  openCourseId: string | null
  /** Called after a class is imported and open, e.g. to go to Classes. */
  onImported?: () => void
}) {
  const headingId = useId()
  const queryClient = useQueryClient()
  const courses = useQuery(googleCoursesQueryOptions)
  const [message, setMessage] = useState<Message | null>(null)

  // Access was revoked on Google's side: refresh the connection status, and
  // the Add Students dialog swaps these cards for the Connect button.
  const notConnected = isNotConnectedError(courses.error)
  useEffect(() => {
    if (notConnected) {
      void queryClient.invalidateQueries({
        queryKey: classroomStatusQueryOptions.queryKey,
      })
    }
  }, [notConnected, queryClient])

  // Read live from Google: nothing to show or import without a connection.
  const online = useOnline()
  const importCourse = useMutation({
    // wasOpen: the class was already the open tab when clicked.
    mutationFn: ({ course }: { course: GoogleCourse; wasOpen: boolean }) =>
      importGoogleCourse(course.id),
    onMutate: () => setMessage(null),
    onSuccess: async (result, { course, wasOpen }) => {
      // Mark the card as imported without asking Google for the list again.
      queryClient.setQueryData(googleCoursesQueryOptions.queryKey, (list) =>
        list?.map((c) => (c.id === course.id ? { ...c, imported: true } : c)),
      )
      // Picking a class that was archived brings it back.
      void queryClient.invalidateQueries({
        queryKey: archivedClassroomsQueryOptions.queryKey,
      })
      // Reload the dashboard (tabs and roster) before the spinner stops, so
      // the class is open with its students when it does.
      await queryClient.invalidateQueries({
        queryKey: meQueryOptions.queryKey,
      })
      setMessage({ tone: 'success', text: importedMessage(result, wasOpen) })
      onImported?.()
    },
    onError: (error) => {
      console.error('Import from Google Classroom failed:', error)
      if (isNotConnectedError(error)) {
        // Same as above: the Connect button comes back.
        void queryClient.invalidateQueries({
          queryKey: classroomStatusQueryOptions.queryKey,
        })
        return
      }
      if (error instanceof ApiError && error.status === 404) {
        // Archived or removed in Google Classroom since the list loaded.
        void queryClient.invalidateQueries({
          queryKey: googleCoursesQueryOptions.queryKey,
        })
      }
      setMessage({ tone: 'error', text: importErrorMessage(error) })
    },
  })

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 id={headingId} className="text-lg font-bold">
          Your Google Classroom classes
        </h2>
        <p className="text-sm text-muted-foreground">
          Choose a class to bring in its students and open it. Click it again
          later to add anyone new.
        </p>
      </div>

      <OfflineNote action="bring in your Google Classroom classes" />

      {courses.isPending && !online ? null : courses.isPending ||
        notConnected ? (
        <LoadingCards />
      ) : courses.isError ? (
        <Alert
          variant="destructive"
          className="rounded-lg border-2 *:data-[slot=alert-description]:text-foreground"
        >
          <CircleAlert />
          <AlertTitle className="font-bold">
            Couldn’t load your Google Classroom classes
          </AlertTitle>
          <AlertDescription className="flex flex-col items-start gap-3">
            Google may be slow right now. Please try again.
            <Button
              variant="outline"
              onClick={() => void courses.refetch()}
              disabled={courses.isFetching}
              className="rounded-lg border-2 border-border font-bold"
            >
              <RefreshCw className={cn(courses.isFetching && 'animate-spin')} />
              Try again
            </Button>
          </AlertDescription>
        </Alert>
      ) : courses.data.length === 0 ? (
        <p className="rounded-lg border-2 border-dashed border-border p-6 text-center text-muted-foreground">
          You don’t have any active classes in Google Classroom.
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {courses.data.map((course) => {
            const isOpen = course.id === openCourseId
            return (
              <li key={course.id} className="flex">
                <CourseCard
                  course={course}
                  isOpen={isOpen}
                  importing={
                    importCourse.isPending &&
                    importCourse.variables.course.id === course.id
                  }
                  // One at a time; the backend runs them one by one anyway.
                  disabled={importCourse.isPending || !online}
                  onClick={() =>
                    importCourse.mutate({ course, wasOpen: isOpen })
                  }
                />
              </li>
            )
          })}
        </ul>
      )}

      {/* Always rendered, so screen readers announce the text when it appears. */}
      {/* Red icon, black text: small red text on white is hard to read. */}
      <p role="status" className="flex items-center gap-2 text-sm font-medium">
        {message && (
          <>
            {message.tone === 'success' ? (
              <CircleCheck className="size-5 shrink-0 fill-chart-5 text-foreground" />
            ) : (
              <CircleAlert className="size-5 shrink-0 text-destructive" />
            )}
            {message.text}
          </>
        )}
      </p>
    </section>
  )
}

function CourseCard({
  course,
  isOpen,
  importing,
  disabled,
  onClick,
}: {
  course: GoogleCourse
  /** It's the class in the open tab. */
  isOpen: boolean
  importing: boolean
  disabled: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-busy={importing}
      aria-current={isOpen || undefined}
      className={cn(
        'flex min-h-32 w-full flex-col gap-3 rounded-lg border-2 border-border bg-card p-4 text-left text-card-foreground shadow-md outline-none transition-colors hover:bg-muted focus-visible:ring-4 focus-visible:ring-ring disabled:cursor-not-allowed disabled:hover:bg-card motion-reduce:transition-none',
        // The class being imported stays solid; the rest fade while it runs.
        !importing && 'disabled:opacity-60',
      )}
    >
      <span className="flex w-full items-start justify-between gap-2">
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="line-clamp-2 text-base font-bold">
            {course.name}
          </span>
          {course.section && (
            <span className="text-sm text-muted-foreground">
              {course.section}
            </span>
          )}
        </span>
        {isOpen ? (
          <Badge className="border-2 border-border bg-primary font-bold text-primary-foreground">
            Open now
          </Badge>
        ) : (
          course.imported && (
            <Badge
              variant="outline"
              className="border-2 border-border bg-chart-5 font-bold text-foreground"
            >
              Imported
            </Badge>
          )
        )}
      </span>

      <span className="mt-auto flex w-full flex-wrap items-center justify-between gap-2 text-sm">
        {course.student_count !== undefined && (
          <span className="inline-flex items-center gap-1.5 font-medium">
            <Users className="size-4" />
            {formatStudentCount(course.student_count)}
          </span>
        )}
        <span className="ml-auto inline-flex items-center gap-1.5 font-bold text-primary">
          {importing ? (
            <>
              <Spinner className="size-4" aria-hidden />
              {isOpen
                ? 'Checking…'
                : course.imported
                  ? 'Opening…'
                  : 'Importing…'}
            </>
          ) : isOpen ? (
            <>
              <RefreshCw className="size-4" />
              Check for new students
            </>
          ) : course.imported ? (
            <>
              Open class
              <ArrowRight className="size-4" />
            </>
          ) : (
            <>
              Import students
              <ArrowRight className="size-4" />
            </>
          )}
        </span>
      </span>
    </button>
  )
}

function LoadingCards() {
  return (
    <div
      role="status"
      aria-label="Loading your Google Classroom classes"
      className="grid gap-3 sm:grid-cols-2"
    >
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className="h-32 animate-pulse rounded-lg bg-muted motion-reduce:animate-none"
        />
      ))}
    </div>
  )
}

function importedMessage(
  { classroom, created, students_added }: CourseImportResult,
  wasOpen: boolean,
) {
  const { name } = classroom
  const added = formatStudentCount(students_added)
  if (created) return `Imported ${name} with ${added}.`
  if (wasOpen) {
    return students_added === 0
      ? `${name} is up to date. No new students.`
      : `Added ${added} to ${name}.`
  }
  // An earlier import, now opened again.
  return students_added === 0
    ? `Opened ${name}. No new students.`
    : `Opened ${name} and added ${added}.`
}

function importErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 404) {
      return 'That class isn’t in your Google Classroom anymore. The list has been refreshed.'
    }
    if (error.status === 401) {
      return 'Your session has ended. Sign in again to import students.'
    }
    return 'Something went wrong importing that class. Please try again.'
  }
  // fetch() throws a TypeError when the server can't be reached.
  return 'Couldn’t reach the server. Check your connection and try again.'
}
