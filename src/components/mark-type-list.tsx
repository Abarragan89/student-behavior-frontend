import { useId, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  CircleAlert,
  Pencil,
  Plus,
  RefreshCw,
  ThumbsDown,
  ThumbsUp,
  Trash2,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'
import { MarkNameForm } from '#/components/forms/mark-name-form'
import { ResponsiveDialog } from '#/components/responsive-dialogue'
import { ApiError } from '#/lib/api'
import { useOnline } from '#/lib/online'
import {
  markTypesQueryOptions,
  removeMarkType,
  uncacheMarkType,
} from '#/lib/marks'
import type { MarkType } from '#/lib/marks'

// What the add/rename dialog is for. Kept after it closes, so its title and
// form don't change while it animates away.
type Editing =
  { kind: 'add'; isPositive: boolean } | { kind: 'rename'; markType: MarkType }

/**
 * The teacher's marks on the Marks page: positive and negative, with the same
 * icons and colors as the mark picker. Each can be renamed or removed, and
 * each column has its own Add button, which decides positive or negative.
 */
export function MarkTypeList() {
  const markTypes = useQuery(markTypesQueryOptions)
  const online = useOnline()

  const [editOpen, setEditOpen] = useState(false)
  const [editing, setEditing] = useState<Editing>({
    kind: 'add',
    isPositive: true,
  })
  // A fresh form each time the dialog opens.
  const [formKey, setFormKey] = useState(0)

  const [removeOpen, setRemoveOpen] = useState(false)
  const [removing, setRemoving] = useState<MarkType | null>(null)

  function openEdit(next: Editing) {
    setEditing(next)
    setFormKey((k) => k + 1)
    setEditOpen(true)
  }

  function openRemove(markType: MarkType) {
    setRemoving(markType)
    setRemoveOpen(true)
  }

  if (markTypes.isPending) {
    return (
      <p
        role="status"
        className="flex items-center justify-center gap-2 py-10 text-sm font-medium text-muted-foreground"
      >
        <Spinner aria-hidden className="size-4" />
        Loading your marks…
      </p>
    )
  }

  if (markTypes.isError) {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-center">
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
    )
  }

  const editTitle =
    editing.kind === 'rename'
      ? 'Rename mark'
      : editing.isPositive
        ? 'Add positive mark'
        : 'Add negative mark'

  return (
    <>
      <div className="grid gap-8 md:grid-cols-2 md:gap-6">
        <MarkTypeSection
          title="Positive"
          icon={ThumbsUp}
          dotClassName="bg-chart-5"
          markTypes={markTypes.data.filter((t) => t.is_positive)}
          addLabel="Add positive mark"
          disabled={!online}
          onAdd={() => openEdit({ kind: 'add', isPositive: true })}
          onRename={(markType) => openEdit({ kind: 'rename', markType })}
          onRemove={openRemove}
        />
        <MarkTypeSection
          title="Negative"
          icon={ThumbsDown}
          dotClassName="bg-destructive"
          markTypes={markTypes.data.filter((t) => !t.is_positive)}
          addLabel="Add negative mark"
          disabled={!online}
          onAdd={() => openEdit({ kind: 'add', isPositive: false })}
          onRename={(markType) => openEdit({ kind: 'rename', markType })}
          onRemove={openRemove}
        />
      </div>

      <ResponsiveDialog
        isOpen={editOpen}
        setIsOpen={setEditOpen}
        title={editTitle}
        description={
          editing.kind === 'rename'
            ? `Renaming “${editing.markType.name}”.`
            : 'A new button for giving marks, in all your classes.'
        }
      >
        <MarkNameForm
          key={formKey}
          markType={editing.kind === 'rename' ? editing.markType : undefined}
          isPositive={
            editing.kind === 'rename'
              ? editing.markType.is_positive
              : editing.isPositive
          }
          onDone={() => setEditOpen(false)}
        />
      </ResponsiveDialog>

      <RemoveMarkDialog
        markType={removing}
        open={removeOpen}
        onOpenChange={setRemoveOpen}
      />
    </>
  )
}

function MarkTypeSection({
  title,
  icon: Icon,
  dotClassName,
  markTypes,
  addLabel,
  disabled,
  onAdd,
  onRename,
  onRemove,
}: {
  title: string
  icon: LucideIcon
  /** The column's color in the mark picker. */
  dotClassName: string
  markTypes: Array<MarkType>
  addLabel: string
  /** Offline: the list shows, but nothing can be changed. */
  disabled: boolean
  onAdd: () => void
  onRename: (markType: MarkType) => void
  onRemove: (markType: MarkType) => void
}) {
  const headingId = useId()
  return (
    <section
      aria-labelledby={headingId}
      className="flex min-w-0 flex-col gap-3"
    >
      <h2 id={headingId} className="flex items-center gap-2 text-lg font-bold">
        <Icon className="size-5" />
        {title}
      </h2>

      {markTypes.length === 0 ? (
        <p className="rounded-lg border-2 border-dashed border-border/40 px-3 py-4 text-sm text-muted-foreground">
          No {title.toLowerCase()} marks yet.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {markTypes.map((markType) => (
            <li
              key={markType.id}
              className="flex min-h-14 items-center gap-3 rounded-lg border-2 border-border bg-card py-1.5 pr-1.5 pl-3 shadow-sm"
            >
              <span
                aria-hidden
                className={cn(
                  'size-3 shrink-0 rounded-full border-2 border-border',
                  dotClassName,
                )}
              />
              <span className="min-w-0 flex-1 font-bold break-words">
                {markType.name}
              </span>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onRename(markType)}
                disabled={disabled}
                aria-label={`Rename ${markType.name}`}
                className="size-11 rounded-lg text-muted-foreground [&_svg:not([class*='size-'])]:size-5"
              >
                <Pencil />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onRemove(markType)}
                disabled={disabled}
                aria-label={`Remove ${markType.name}`}
                className="size-11 rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive [&_svg:not([class*='size-'])]:size-5"
              >
                <Trash2 />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <Button
        variant="outline"
        onClick={onAdd}
        disabled={disabled}
        className="h-11 self-start rounded-lg border-2 border-border px-4 font-bold"
      >
        <Plus />
        {addLabel}
      </Button>
    </section>
  )
}

function removeErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 401) {
      return 'Your session has ended. Sign in again to change your marks.'
    }
    if (error.status === 429) {
      return 'Too many changes for now. Wait a few minutes, then try again.'
    }
    return 'Couldn’t remove the mark. Please try again.'
  }
  return 'Couldn’t reach the server. Check your connection and try again.'
}

/**
 * Asks before removing a mark: there's no way to bring it back. Marks already
 * given stay in students' history.
 */
function RemoveMarkDialog({
  markType,
  open,
  onOpenChange,
}: {
  markType: MarkType | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const online = useOnline()

  const remove = useMutation({
    mutationFn: (target: MarkType) => removeMarkType(target.id),
    onSuccess: (_, target) => {
      uncacheMarkType(queryClient, target.id)
      toast.success(`Removed “${target.name}”`)
      onOpenChange(false)
    },
    onError: (error) => {
      console.error('Removing a mark type failed:', error)
      // Stays open, so it's easy to try again.
      toast.error(removeErrorMessage(error))
    },
  })
  const isRemoving = remove.isPending

  return (
    <AlertDialog
      open={open}
      // Stay open while removing, so it can't be dismissed halfway.
      onOpenChange={(next) => {
        if (!isRemoving) onOpenChange(next)
      }}
    >
      <AlertDialogContent className="rounded-lg border-2 border-border ring-0">
        <AlertDialogHeader>
          <AlertDialogTitle className="font-bold break-words">
            Remove “{markType?.name}”?
          </AlertDialogTitle>
          <AlertDialogDescription>
            It won’t show up when you give marks anymore. Marks students already
            got stay in their history.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isRemoving}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => markType && remove.mutate(markType)}
            disabled={isRemoving || !online || !markType}
            aria-busy={isRemoving}
            // Solid red, like Sign out, and solid while it spins. The label
            // stays (invisible) under the spinner so the size holds.
            className={cn(
              'relative bg-destructive font-bold text-destructive-foreground hover:bg-destructive/90',
              isRemoving && 'disabled:opacity-100',
            )}
          >
            <span className={cn(isRemoving && 'invisible')}>Remove mark</span>
            {isRemoving && (
              <Spinner
                aria-label="Removing"
                className="absolute inset-0 m-auto size-4"
              />
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
