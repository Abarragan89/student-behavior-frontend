import { useId } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CircleAlert, RefreshCw, ThumbsDown, ThumbsUp } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'
import { markTypesQueryOptions } from '#/lib/marks'
import type { MarkType } from '#/lib/marks'
import { ResponsiveDialog } from '#/components/responsive-dialogue'

/**
 * Picking a mark to give: positive marks on the left, negative on the right.
 * Used for one student, the picked students, or the whole class; the caller
 * says who in the title. One tap closes it and gives the mark (see
 * useGiveMark).
 */
export function MarkDialog({
  title,
  description,
  open,
  onOpenChange,
  onPick,
}: {
  /** Who it's for: "Ava Adams", "3 students", "All 14 students". */
  title: string
  description: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onPick: (markType: MarkType) => void
}) {
  const markTypes = useQuery(markTypesQueryOptions)

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
        <p className="py-6 text-center text-sm text-muted-foreground">
          You don’t have any marks yet.
        </p>
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
