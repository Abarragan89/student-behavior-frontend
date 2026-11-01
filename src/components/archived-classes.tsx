import { useId, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  ArchiveRestore,
  CircleAlert,
  RefreshCw,
  Trash2,
  WifiOff,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'
import { DeleteClassDialog } from '#/components/delete-class-dialog'
import { OfflineNote } from '#/components/offline-note'
import { ApiError } from '#/lib/api'
import { meQueryOptions } from '#/lib/auth'
import {
  archivedClassroomsQueryOptions,
  cacheUnarchived,
  unarchiveClassroom,
} from '#/lib/classroom'
import type { ArchivedClassroom } from '#/lib/classroom'
import { useOnline } from '#/lib/online'

/**
 * The Account page's list of archived classes (archived from the bottom of
 * the Classes page). Each can be unarchived, which puts it back in the class
 * list, or deleted forever.
 */
export function ArchivedClasses() {
  const headingId = useId()
  // Focus lands here when a class leaves the list, since the button that
  // was focused goes with it.
  const headingRef = useRef<HTMLHeadingElement>(null)
  const archived = useQuery(archivedClassroomsQueryOptions)

  // Kept after the class is deleted, so the dialog doesn't blank out while it
  // closes.
  const [deleteTarget, setDeleteTarget] = useState<ArchivedClassroom | null>(
    null,
  )
  const [deleteOpen, setDeleteOpen] = useState(false)
  const deleted = useRef(false)

  return (
    <section aria-labelledby={headingId}>
      <Card className="gap-5 rounded-lg border-2 border-border shadow-md ring-0 [--card-spacing:--spacing(6)]">
        <CardHeader>
          <h2
            id={headingId}
            ref={headingRef}
            tabIndex={-1}
            className="text-lg font-bold outline-none"
          >
            Archived classes
          </h2>
          <CardDescription>
            Archived classes are hidden from your class list. Their students and
            marks are kept until you delete them.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {archived.data ? (
            archived.data.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No archived classes. To archive one, open it and choose Archive
                class at the bottom of the page.
              </p>
            ) : (
              <>
                <ul className="flex flex-col gap-3">
                  {archived.data.map((classroom) => (
                    <ArchivedClassRow
                      key={classroom.id}
                      classroom={classroom}
                      onDelete={() => {
                        setDeleteTarget(classroom)
                        setDeleteOpen(true)
                      }}
                      onRemoved={() => headingRef.current?.focus()}
                    />
                  ))}
                </ul>
                <OfflineNote action="unarchive or delete classes" />
              </>
            )
          ) : archived.fetchStatus === 'paused' ? (
            <p
              role="status"
              className="flex items-center gap-2 text-sm font-medium text-muted-foreground"
            >
              <WifiOff className="size-4 shrink-0" />
              You’re offline. Connect to the internet to see your archived
              classes.
            </p>
          ) : archived.isError ? (
            <div role="alert" className="flex flex-col items-start gap-3">
              {/* Red icon, normal text: small red text is hard to read. */}
              <p className="flex items-center gap-2 text-sm font-medium">
                <CircleAlert className="size-5 shrink-0 text-destructive" />
                Couldn’t load your archived classes.
              </p>
              <Button
                variant="outline"
                onClick={() => void archived.refetch()}
                disabled={archived.isFetching}
                className="h-10 rounded-lg border-2 font-bold"
              >
                <RefreshCw
                  className={cn(archived.isFetching && 'animate-spin')}
                />
                Try again
              </Button>
            </div>
          ) : (
            <p
              role="status"
              className="flex items-center gap-2 text-sm font-medium text-muted-foreground"
            >
              <Spinner aria-hidden className="size-4" />
              Loading archived classes…
            </p>
          )}
        </CardContent>
      </Card>

      {deleteTarget && (
        <DeleteClassDialog
          classroom={deleteTarget}
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          onRemoved={() => {
            deleted.current = true
          }}
          // The Delete button that opened it is gone once the class is.
          finalFocus={() => {
            if (!deleted.current) return true
            deleted.current = false
            return headingRef.current
          }}
        />
      )}
    </section>
  )
}

/** One archived class: its name, when it was archived, and its buttons. */
function ArchivedClassRow({
  classroom,
  onDelete,
  onRemoved,
}: {
  classroom: ArchivedClassroom
  onDelete: () => void
  /** Called when this row is about to leave the list. */
  onRemoved: () => void
}) {
  const queryClient = useQueryClient()
  const online = useOnline()
  const { name } = classroom

  const unarchive = useMutation({
    mutationFn: () => unarchiveClassroom(classroom.id),
    onSuccess: (me) => {
      cacheUnarchived(queryClient, me, classroom.id)
      onRemoved()
      toast.success(`Unarchived ${name}`, {
        description: 'It’s back in your class list.',
      })
    },
    onError: (error) => {
      console.error('Unarchiving the class failed:', error)
      toast.error(unarchiveErrorMessage(error, name))
      if (error instanceof ApiError && error.status === 404) {
        // Unarchived or deleted somewhere else: refresh both lists.
        void queryClient.invalidateQueries({
          queryKey: archivedClassroomsQueryOptions.queryKey,
        })
        void queryClient.invalidateQueries({
          queryKey: meQueryOptions.queryKey,
        })
        onRemoved()
      }
    },
  })
  const unarchiving = unarchive.isPending

  return (
    <li className="flex flex-col gap-3 rounded-lg border-2 border-border p-4 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p title={name} className="truncate font-bold">
          {name}
        </p>
        <p className="text-sm text-muted-foreground">
          Archived{' '}
          <time dateTime={classroom.archived_at}>
            {formatShortDate(classroom.archived_at)}
          </time>
        </p>
      </div>
      {/* Phones: side by side under the name, sharing the width. */}
      <div className="flex gap-2">
        <Button
          variant="outline"
          onClick={() => unarchive.mutate()}
          disabled={unarchiving || !online}
          aria-busy={unarchiving}
          aria-label={`Unarchive ${name}`}
          className={cn(
            'relative h-10 flex-1 rounded-lg border-2 font-bold sm:flex-none',
            unarchiving && 'disabled:opacity-100',
          )}
        >
          <span
            className={cn(
              'inline-flex items-center gap-1.5',
              unarchiving && 'invisible',
            )}
          >
            <ArchiveRestore />
            Unarchive
          </span>
          {unarchiving && (
            <Spinner
              aria-label="Unarchiving"
              className="absolute inset-0 m-auto size-4"
            />
          )}
        </Button>
        <Button
          variant="outline"
          onClick={onDelete}
          disabled={unarchiving || !online}
          aria-label={`Delete ${name} forever`}
          className="h-10 flex-1 rounded-lg border-2 font-bold sm:flex-none"
        >
          {/* Red icon, normal text: small red text is hard to read. */}
          <Trash2 className="text-destructive" />
          Delete forever
        </Button>
      </div>
    </li>
  )
}

/** "Jun 12", with the year only when it isn't this year. */
function formatShortDate(iso: string) {
  const date = new Date(iso)
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year:
      date.getFullYear() === new Date().getFullYear() ? undefined : 'numeric',
  })
}

function unarchiveErrorMessage(error: unknown, name: string) {
  if (error instanceof ApiError) {
    if (error.status === 404) return `${name} isn’t archived anymore.`
    if (error.status === 401) {
      return 'Your session has ended. Sign in again to unarchive this class.'
    }
    return `Couldn’t unarchive ${name}. Please try again.`
  }
  // fetch() throws a TypeError when the server can't be reached (and an
  // AbortError when it takes too long).
  return 'Couldn’t reach the server. Check your connection and try again.'
}
