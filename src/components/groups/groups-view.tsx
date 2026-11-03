import { CircleAlert, RefreshCw, Shuffle, UsersRound } from 'lucide-react'
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
import { cn } from '@/lib/utils'
import type { Student } from '#/lib/auth'
import { groupMembers, ungrouped } from '#/lib/groups'
import type { ClassGroups, StudentGroup } from '#/lib/groups'
import { useOnline } from '#/lib/online'
import { OfflineNote } from '#/components/offline-note'
import { GroupCard } from './group-card'

const boxClass =
  'h-11 rounded-lg border-2 border-border px-4 text-base font-bold shadow-md active:scale-95 motion-reduce:transition-none'

/**
 * The Groups tab while not editing: a card per group (tap one to give the
 * whole group a mark), when the team points started, and who isn't in a
 * group yet. With no groups, a way to make some.
 */
export function GroupsView({
  groups,
  students,
  labelFor,
  canEdit,
  canMark,
  onMark,
  onEdit,
  onShuffle,
}: {
  /** The class's groups query: pending, failed, or loaded. */
  groups: {
    data: ClassGroups | undefined
    isPending: boolean
    isError: boolean
    isFetching: boolean
    refetch: () => unknown
  }
  /** The roster, in its order. */
  students: Array<Student>
  /** The name on a student's card ("Sam L." when two share it). */
  labelFor: (student: Student) => string
  /** May make and change groups (the teacher, or a co-teacher with Edit). */
  canEdit: boolean
  /** May give marks (not read-only). */
  canMark: boolean
  onMark: (group: StudentGroup, members: Array<Student>) => void
  /** Opens the editor; with shuffle, straight into Random groups. */
  onEdit: () => void
  onShuffle: () => void
}) {
  const online = useOnline()

  if (groups.isPending) {
    return (
      <p
        role="status"
        className="flex items-center justify-center gap-2 py-16 font-medium text-muted-foreground"
      >
        <Spinner aria-hidden className="size-5" />
        Loading groups…
      </p>
    )
  }

  if (groups.isError || !groups.data) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <p className="flex items-center gap-2 font-medium">
          <CircleAlert className="size-5 shrink-0 text-destructive" />
          Couldn’t load the groups.
        </p>
        <Button
          variant="outline"
          onClick={() => void groups.refetch()}
          disabled={groups.isFetching}
          className="h-11 rounded-lg border-2 border-border font-bold"
        >
          <RefreshCw className={cn(groups.isFetching && 'animate-spin')} />
          Try again
        </Button>
      </div>
    )
  }

  const { groups: list, scores_since: since } = groups.data

  if (list.length === 0) {
    return (
      <Empty className="rounded-xl border-2 border-dashed border-border px-4 py-10">
        <EmptyHeader>
          <EmptyMedia
            variant="icon"
            className="size-14 rounded-lg border-2 border-border bg-card text-foreground"
          >
            <UsersRound className="size-7" />
          </EmptyMedia>
          <EmptyTitle className="text-xl font-bold">No groups yet</EmptyTitle>
          <EmptyDescription className="text-base">
            {canEdit
              ? 'Split the class into groups, then give a mark to a whole group at once. Each group keeps its own team points.'
              : 'Groups made for this class will show here.'}
          </EmptyDescription>
        </EmptyHeader>
        {canEdit && (
          <EmptyContent className="gap-3">
            <div className="flex flex-wrap justify-center gap-2">
              <Button onClick={onEdit} disabled={!online} className={boxClass}>
                <UsersRound aria-hidden />
                Make groups
              </Button>
              <Button
                variant="outline"
                onClick={onShuffle}
                disabled={!online}
                className={cn(boxClass, 'bg-card')}
              >
                <Shuffle aria-hidden />
                Random groups
              </Button>
            </div>
            <OfflineNote action="make groups" />
          </EmptyContent>
        )}
      </Empty>
    )
  }

  const left = ungrouped(list, students)

  return (
    <div className="flex flex-col gap-3">
      {since && (
        <p className="text-sm font-medium text-muted-foreground">
          Team points since {formatSince(since)}
        </p>
      )}

      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4">
        {list.map((group) => {
          const members = groupMembers(group, students)
          return (
            <li key={group.id} className="min-w-0">
              <GroupCard
                group={group}
                memberLabels={members.map(labelFor)}
                onPress={
                  canMark && members.length > 0
                    ? () => onMark(group, members)
                    : undefined
                }
              />
            </li>
          )
        })}
      </ul>

      {left.length > 0 && (
        <p className="text-sm">
          <span className="font-bold">Not in a group:</span>{' '}
          <span className="text-muted-foreground">
            {left.map(labelFor).join(', ')}
          </span>
          {canEdit && online && (
            <>
              {' '}
              <Button
                variant="link"
                onClick={onEdit}
                className="h-auto p-0 text-sm font-bold"
              >
                Add them
              </Button>
            </>
          )}
        </p>
      )}
    </div>
  )
}

/** "Mon, Nov 3", or "Mon, Nov 3, 2025" in another year. */
function formatSince(iso: string) {
  const d = new Date(iso)
  const sameYear = d.getFullYear() === new Date().getFullYear()
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: sameYear ? undefined : 'numeric',
  })
}
