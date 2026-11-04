import { useState } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  CalendarDays,
  ChevronRight,
  Copy,
  EllipsisVertical,
  LayoutTemplate,
  Plus,
  RefreshCw,
  Trash2,
} from 'lucide-react'
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
import { Button, buttonVariants } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
import { formatClockRange } from '#/lib/calendar'
import {
  deleteTemplate,
  lessonPlanTemplateQueryOptions,
  lessonPlanTemplatesKey,
  lessonPlanTemplatesQueryOptions,
  subjectCount,
  templateHours,
} from '#/lib/lesson-plan-templates'
import type { TemplateSummary } from '#/lib/lesson-plan-templates'
import { useOnline } from '#/lib/online'
import { mayLoad } from '#/lib/workspace'
import { OfflineNote } from '#/components/offline-note'

// /lesson-plans/templates: the teacher's templates, to make, change and
// delete. Days start from them through "Start with a template" on a day.
export const Route = createFileRoute('/_authed/lesson-plans/templates/')({
  // Templates are only for planning, so a co-teacher needs Edit.
  staticData: { feature: { key: 'lesson_plans', level: 'edit' } },
  loader: ({ context: { queryClient } }) => {
    if (!mayLoad(queryClient, 'lesson_plans')) return
    void queryClient.query(lessonPlanTemplatesQueryOptions()).catch(() => null)
  },
  component: TemplatesPage,
})

function TemplatesPage() {
  const online = useOnline()
  const templates = useQuery(lessonPlanTemplatesQueryOptions())
  const list = templates.data ?? []
  const [deleting, setDeleting] = useState<TemplateSummary | null>(null)

  const newButton = (
    <Link
      to="/lesson-plans/templates/new"
      disabled={!online}
      className={cn(
        buttonVariants(),
        'h-11 rounded-lg border-2 border-border text-base font-bold shadow-sm',
        !online && 'pointer-events-none opacity-50',
      )}
    >
      <Plus className="size-5" />
      New template
    </Link>
  )

  return (
    <main className="mx-auto flex w-full max-w-3xl min-w-0 flex-1 flex-col gap-5 px-4 py-6 sm:py-8">
      <Link
        to="/lesson-plans"
        className={cn(
          buttonVariants({ variant: 'link' }),
          'h-auto self-start px-0 text-base font-bold',
        )}
      >
        <CalendarDays className="size-5" />
        Lesson Plans
      </Link>

      <header className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Templates</h1>
        {list.length > 0 && newButton}
      </header>
      <p className="text-sm text-muted-foreground">
        A template is a usual day: its sections, times and lines. Start any day
        from one with “Start with a template”. For one that’s almost the same as
        another, use “Make a copy” in that template’s menu.
      </p>
      <OfflineNote action="make or change templates" />

      {templates.isPending ? (
        <p
          role="status"
          className="flex items-center justify-center gap-2 py-16 font-medium text-muted-foreground"
        >
          <Spinner aria-hidden className="size-5" />
          Loading templates…
        </p>
      ) : templates.isError && list.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <p className="font-medium">Couldn’t load your templates.</p>
          <Button
            variant="outline"
            onClick={() => void templates.refetch()}
            disabled={templates.isFetching}
            className="h-11 rounded-lg border-2 border-border font-bold"
          >
            <RefreshCw className={cn(templates.isFetching && 'animate-spin')} />
            Try again
          </Button>
        </div>
      ) : list.length === 0 ? (
        <Empty className="rounded-xl border-2 border-dashed border-border px-4 py-10">
          <EmptyHeader>
            <EmptyMedia
              variant="icon"
              className="size-14 rounded-lg border-2 border-border bg-chart-3 text-foreground"
            >
              <LayoutTemplate className="size-7" />
            </EmptyMedia>
            <EmptyTitle className="text-xl font-bold">
              No templates yet
            </EmptyTitle>
            <EmptyDescription>
              Make one for the days that look alike, like “Regular Monday”. Or
              open a planned day and tap “Save as template”.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>{newButton}</EmptyContent>
        </Empty>
      ) : (
        <ul className="flex flex-col gap-3">
          {list.map((t) => (
            <TemplateCard
              key={t.id}
              template={t}
              onDelete={() => setDeleting(t)}
            />
          ))}
        </ul>
      )}

      <DeleteDialog template={deleting} onClose={() => setDeleting(null)} />
    </main>
  )
}

function TemplateCard({
  template,
  onDelete,
}: {
  template: TemplateSummary
  onDelete: () => void
}) {
  const online = useOnline()
  const navigate = Route.useNavigate()
  const hours = templateHours(template.outline)
  const titles = template.outline
    .map((s) => s.title.trim() || 'Untitled section')
    .join(', ')

  return (
    <li className="flex items-center gap-1 rounded-xl border-2 border-border bg-card p-1.5 shadow-md">
      <Link
        to="/lesson-plans/templates/$templateId"
        params={{ templateId: template.id }}
        className="flex min-h-14 min-w-0 flex-1 items-center gap-3 rounded-lg px-2 py-1.5 outline-none hover:bg-muted focus-visible:ring-4 focus-visible:ring-ring"
      >
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-lg font-bold">{template.name}</span>
          <span className="truncate text-sm font-medium text-muted-foreground">
            {subjectCount(template.outline.length)}
            {hours.start && ` · ${formatClockRange(hours.start, hours.end)}`}
          </span>
          <span className="truncate text-sm text-muted-foreground">
            {titles}
          </span>
        </span>
        <ChevronRight
          aria-hidden
          className="size-5 shrink-0 text-muted-foreground"
        />
      </Link>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={`More for “${template.name}”`}
          disabled={!online}
          className="flex size-10 shrink-0 items-center justify-center rounded-lg text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-4 focus-visible:ring-ring disabled:opacity-50"
        >
          <EllipsisVertical className="size-5" />
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="w-48 rounded-lg border-2 border-border p-1 shadow-md ring-0"
        >
          <DropdownMenuItem
            className="h-10 rounded-md font-bold"
            onClick={() =>
              // A new template that starts as this one: change what differs.
              void navigate({
                to: '/lesson-plans/templates/new',
                search: { copy: template.id },
              })
            }
          >
            <Copy />
            Make a copy
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            className="h-10 rounded-md font-bold"
            onClick={onDelete}
          >
            <Trash2 />
            Delete template
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  )
}

function DeleteDialog({
  template,
  onClose,
}: {
  template: TemplateSummary | null
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const [busy, setBusy] = useState(false)

  async function remove(t: TemplateSummary) {
    setBusy(true)
    try {
      await deleteTemplate(t.id)
      queryClient.setQueryData(
        lessonPlanTemplatesQueryOptions().queryKey,
        (list) => list?.filter((x) => x.id !== t.id),
      )
      queryClient.removeQueries({
        queryKey: lessonPlanTemplateQueryOptions(t.id).queryKey,
      })
      void queryClient.invalidateQueries({ queryKey: lessonPlanTemplatesKey })
      onClose()
      toast.success(`Deleted “${t.name}”`)
    } catch (error) {
      console.error('Deleting a template failed:', error)
      toast.error('Couldn’t delete the template', {
        description: 'Check your connection and try again.',
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <AlertDialog
      open={template !== null}
      onOpenChange={(open) => !open && !busy && onClose()}
    >
      <AlertDialogContent className="rounded-lg border-2 border-border ring-0">
        <AlertDialogHeader>
          <AlertDialogTitle className="font-bold wrap-break-word">
            Delete “{template?.name}”?
          </AlertDialogTitle>
          <AlertDialogDescription>
            Days you started from it keep their plans. This can’t be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            // Stays open until it's deleted.
            onClick={() => template && void remove(template)}
            disabled={busy}
            aria-busy={busy}
            className="bg-destructive font-bold text-destructive-foreground hover:bg-destructive/90"
          >
            {busy && <Spinner aria-hidden className="size-4" />}
            Delete template
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
