import { useId } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import {
  ChartNoAxesGantt,
  CircleAlert,
  Pencil,
  Plus,
  RefreshCw,
  ThumbsDown,
  ThumbsUp,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'
import { markTypesQueryOptions } from '#/lib/marks'
import type { MarkType } from '#/lib/marks'
import { ResponsiveDialog } from '#/components/responsive-dialogue'

/**
 * Picking a mark to give: positive marks on the left, negative on the right.
 * Used for one student, the picked students, or the whole class; the caller
 * says who in the title. One tap closes it and gives the mark (see
 * useGiveMark). "Edit marks" goes to the Marks page.
 */
export function MarkDialog({
  title,
  description,
  studentId,
  open,
  onOpenChange,
  onPick,
}: {
  /** Who it's for: "Ava Adams", "3 students", "All 14 students". */
  title: string
  description: string
  /** For one student: adds a link to their page. */
  studentId?: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onPick: (markType: MarkType) => void
}) {
  const markTypes = useQuery(markTypesQueryOptions)
  // With none, the empty state has its own "Add marks" button instead.
  const hasMarks = (markTypes.data?.length ?? 0) > 0

  function give(markType: MarkType) {
    onOpenChange(false)
    onPick(markType)
  }

  return (
    <ResponsiveDialog
      isOpen={open}
      setIsOpen={onOpenChange}
      title={title}
      description={description}
      showDescription
    >
      {markTypes.isPending ? (
        <p
          role="status"
          className="flex items-center justify-center gap-2 py-6 text-sm font-medium text-muted-foreground"
        >
          <Spinner aria-hidden className="size-4" />
          Loading your marks…
        </p>
      ) : markTypes.isError ? (
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <p className="flex items-center gap-2 text-sm font-medium">
            <CircleAlert className="size-5 shrink-0 text-destructive" />
            Couldn’t load your marks.
          </p>
          <Button
            variant="outline"
            onClick={() => void markTypes.refetch()}
            disabled={markTypes.isFetching}
            className="rounded-lg border-2 border-border font-bold"
          >
            <RefreshCw className={cn(markTypes.isFetching && 'animate-spin')} />
            Try again
          </Button>
        </div>
      ) : markTypes.data.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <p className="text-sm text-muted-foreground">
            You don’t have any marks yet.
          </p>
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link to="/marks" />}
            // Closed first, so it isn't left open behind the new page.
            onClick={() => onOpenChange(false)}
            className="h-11 rounded-lg border-2 border-border px-4 font-bold"
          >
            <Plus />
            Add marks
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <MarkColumn
            title="Positive"
            icon={ThumbsUp}
            markTypes={markTypes.data.filter((t) => t.is_positive)}
            buttonClassName="bg-chart-5 text-foreground hover:bg-chart-5/80"
            onGive={give}
          />
          <MarkColumn
            title="Negative"
            icon={ThumbsDown}
            markTypes={markTypes.data.filter((t) => !t.is_positive)}
            buttonClassName="bg-destructive text-destructive-foreground hover:bg-destructive/80"
            onGive={give}
          />
        </div>
      )}

      {/* Links sit below a divider and look like links, so a rushed tap
          lands on a mark, not here. "Edit marks" is the quieter one. */}
      {(studentId || hasMarks) && (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-x-6 border-t border-foreground/10 pt-3">
          {studentId && (
            <Link
              to="/students/$studentId"
              params={{ studentId }}
              // Closed first, so it isn't left open behind the new page.
              onClick={() => onOpenChange(false)}
              className={cn(
                buttonVariants({ variant: 'link' }),
                'text-base font-bold',
              )}
            >
              <ChartNoAxesGantt className="size-5" />
              View student
            </Link>
          )}
          {hasMarks && (
            <Link
              to="/marks"
              onClick={() => onOpenChange(false)}
              className={cn(
                buttonVariants({ variant: 'link' }),
                'text-base font-bold text-muted-foreground hover:text-foreground',
              )}
            >
              <Pencil className="size-5" />
              Edit marks
            </Link>
          )}
        </div>
      )}
    </ResponsiveDialog>
  )
}

function MarkColumn({
  title,
  icon: Icon,
  markTypes,
  buttonClassName,
  onGive,
}: {
  title: string
  icon: LucideIcon
  markTypes: Array<MarkType>
  buttonClassName: string
  onGive: (markType: MarkType) => void
}) {
  const headingId = useId()
  return (
    <section
      aria-labelledby={headingId}
      className="flex min-w-0 flex-col gap-2"
    >
      <h3
        id={headingId}
        className="flex items-center gap-1.5 text-sm font-bold"
      >
        <Icon className="size-4" />
        {title}
      </h3>
      {markTypes.length === 0 ? (
        <p className="text-sm text-muted-foreground">None yet</p>
      ) : (
        markTypes.map((markType) => (
          <Button
            key={markType.id}
            onClick={() => onGive(markType)}
            // Tall and wrapping: long names stay readable, and big targets
            // are easy to hit in a busy classroom.
            className={cn(
              'h-auto min-h-12 rounded-lg border-2 border-border px-3 py-2 text-base font-bold whitespace-normal shadow-md active:scale-95 motion-reduce:transition-none',
              buttonClassName,
            )}
          >
            {markType.name}
          </Button>
        ))
      )}
    </section>
  )
}
