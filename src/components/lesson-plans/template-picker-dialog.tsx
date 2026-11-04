import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Check, LayoutTemplate, RefreshCw, TriangleAlert } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button, buttonVariants } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'
import { ApiError } from '#/lib/api'
import { formatClockRange, formatWeekday } from '#/lib/calendar'
import { formatLongDate } from '#/lib/day'
import { lessonPlanDayQueryOptions } from '#/lib/lesson-plans'
import { whenSaved } from '#/lib/lesson-plan-queue'
import {
  applyTemplate,
  lessonPlanTemplateQueryOptions,
  lessonPlanTemplatesKey,
  lessonPlanTemplatesQueryOptions,
  subjectCount,
  templateHours,
} from '#/lib/lesson-plan-templates'
import type {
  LessonPlanTemplate,
  TemplateSummary,
} from '#/lib/lesson-plan-templates'
import { useOnline } from '#/lib/online'
import { OfflineNote } from '#/components/offline-note'
import { ResponsiveDialog } from '#/components/responsive-dialogue'

/**
 * Starts a day from one of the teacher's templates. On a day that already
 * has a plan, it says first that the template replaces it, checkmarks and
 * all, and only then replaces it.
 */
export function TemplatePickerDialog({
  open,
  onOpenChange,
  date,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  date: string
}) {
  // The plan as it is now, so the warning shows if one appears meanwhile.
  const day = useQuery(lessonPlanDayQueryOptions(date))
  const planned = day.data?.sections.length ?? 0

  return (
    <ResponsiveDialog
      isOpen={open}
      setIsOpen={onOpenChange}
      title={planned > 0 ? 'Use a template' : 'Start with a template'}
      description={
        planned > 0
          ? `Replace ${formatWeekday(date)}’s plan with a template.`
          : `Pick a template for ${formatLongDate(date)}. Nothing comes over checked off.`
      }
      showDescription
    >
      {open && (
        <PickerForm
          date={date}
          planned={planned}
          onDone={() => onOpenChange(false)}
        />
      )}
    </ResponsiveDialog>
  )
}

function PickerForm({
  date,
  planned,
  onDone,
}: {
  date: string
  /** How many sections the day has now. */
  planned: number
  onDone: () => void
}) {
  const queryClient = useQueryClient()
  const [busy, setBusy] = useState(false)
  const replacing = planned > 0
  const weekday = formatWeekday(date)

  async function apply(template: TemplateSummary) {
    setBusy(true)
    try {
      // Changes still on their way would land on the new plan (or fail on
      // lines it no longer has), so everything is sent first.
      if (!(await whenSaved(queryClient))) {
        setBusy(false)
        toast.error('Still saving your changes', {
          description: 'Try again in a moment.',
        })
        return
      }
      // Only replace what the teacher was warned about. If the day got a
      // plan since, the server refuses and the warning shows.
      const next = await applyTemplate(date, template.id, replacing)
      const { queryKey } = lessonPlanDayQueryOptions(date)
      await queryClient.cancelQueries({ queryKey, exact: true })
      queryClient.setQueryData(queryKey, next)
      void queryClient.invalidateQueries({ queryKey: ['lesson-plan-calendar'] })
      onDone()
      toast.success(
        replacing
          ? `Replaced ${weekday}’s plan with “${template.name}”`
          : `Started ${weekday} with “${template.name}”`,
      )
    } catch (error) {
      console.error('Using a template failed:', error)
      setBusy(false)
      const status = error instanceof ApiError ? error.status : undefined
      if (status === 409) {
        // Planned meanwhile (another device). Show that plan, and the
        // warning, before anything is replaced.
        void queryClient.invalidateQueries({
          queryKey: lessonPlanDayQueryOptions(date).queryKey,
          exact: true,
        })
        toast.error(`${weekday} has a plan now`, {
          description: 'Using a template would replace it. Look it over first.',
        })
        return
      }
      if (status === 404) {
        void queryClient.invalidateQueries({ queryKey: lessonPlanTemplatesKey })
        toast.error('That template was deleted', {
          description: 'It may have been deleted on another device.',
        })
        return
      }
      toast.error('Couldn’t use the template', {
        description: 'Check your connection and try again.',
      })
    }
  }

  return (
    <TemplateChooser
      busy={busy}
      action={replacing ? `Replace ${weekday}’s plan` : 'Use this template'}
      destructive={replacing}
      offlineAction="use a template"
      onChoose={(t) => void apply(t)}
      empty={
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <span className="flex size-14 items-center justify-center rounded-lg border-2 border-border bg-chart-3">
            <LayoutTemplate className="size-7" aria-hidden />
          </span>
          <p className="text-lg font-bold">No templates yet</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Make one for the days that look alike, like “Regular Monday”. You
            can also save a planned day as a template.
          </p>
          <Link
            to="/lesson-plans/templates/new"
            className={cn(
              buttonVariants(),
              'h-11 w-full rounded-lg border-2 border-border text-base font-bold',
            )}
          >
            Make a template
          </Link>
        </div>
      }
      footer={
        <Link
          to="/lesson-plans/templates"
          className={cn(
            buttonVariants({ variant: 'link' }),
            'h-auto self-center px-0 text-base font-bold',
          )}
        >
          Manage templates
        </Link>
      }
    >
      {replacing && (
        <Alert
          variant="destructive"
          className="rounded-lg border-2 border-destructive"
        >
          <TriangleAlert aria-hidden />
          <AlertTitle className="font-bold">
            This replaces what you have
          </AlertTitle>
          <AlertDescription>
            Using a template replaces the {subjectCount(planned)} already on{' '}
            {weekday}, checkmarks and all. This can’t be undone.
          </AlertDescription>
        </Alert>
      )}
    </TemplateChooser>
  )
}

/**
 * Starts a new template from one of the teacher's others: everything in it
 * comes over, to reorder, reword or retime. Nothing is saved here; the
 * template editor's Save does that.
 */
export function StartFromTemplateDialog({
  open,
  onOpenChange,
  onPick,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The whole template picked. */
  onPick: (template: LessonPlanTemplate) => void
}) {
  return (
    <ResponsiveDialog
      isOpen={open}
      setIsOpen={onOpenChange}
      title="Start with a template"
      description="Pick one to start from. Change anything you like, then save it as a new template."
      showDescription
    >
      {open && (
        <StartFromForm
          onPick={(template) => {
            onPick(template)
            onOpenChange(false)
          }}
        />
      )}
    </ResponsiveDialog>
  )
}

function StartFromForm({
  onPick,
}: {
  onPick: (template: LessonPlanTemplate) => void
}) {
  const queryClient = useQueryClient()
  const [busy, setBusy] = useState(false)
  // Closed while loading: the teacher changed their mind, so nothing fills in.
  const open = useRef(true)
  useEffect(() => {
    open.current = true
    return () => {
      open.current = false
    }
  }, [])

  // The list only has outlines; the editor needs every line.
  async function load(summary: TemplateSummary) {
    setBusy(true)
    try {
      const template = await queryClient.fetchQuery(
        lessonPlanTemplateQueryOptions(summary.id),
      )
      if (open.current) onPick(template)
    } catch (error) {
      console.error('Loading a template failed:', error)
      setBusy(false)
      if (error instanceof ApiError && error.status === 404) {
        void queryClient.invalidateQueries({ queryKey: lessonPlanTemplatesKey })
        toast.error('That template was deleted', {
          description: 'It may have been deleted on another device.',
        })
        return
      }
      toast.error('Couldn’t open the template', {
        description: 'Check your connection and try again.',
      })
    }
  }

  return (
    <TemplateChooser
      busy={busy}
      action="Start with this template"
      offlineAction="open a template"
      onChoose={(t) => void load(t)}
      empty={
        <p className="py-8 text-center font-medium text-muted-foreground">
          No templates yet.
        </p>
      }
    />
  )
}

/**
 * The teacher's templates to pick one from, with a peek at the picked one's
 * sections and the button that uses it.
 */
function TemplateChooser({
  busy,
  action,
  destructive = false,
  offlineAction,
  onChoose,
  empty,
  footer,
  children,
}: {
  busy: boolean
  /** The button's label. */
  action: string
  /** A red button: the choice replaces something. */
  destructive?: boolean
  /** What can't be done offline, for OfflineNote. */
  offlineAction: string
  onChoose: (template: TemplateSummary) => void
  /** Shown instead when there are no templates. */
  empty: ReactNode
  /** Under the button. */
  footer?: ReactNode
  /** Above the list, e.g. a warning. */
  children?: ReactNode
}) {
  const online = useOnline()
  const templates = useQuery(lessonPlanTemplatesQueryOptions())
  const list = templates.data ?? []
  const [pickedId, setPickedId] = useState<string | null>(null)
  // The first one until the teacher picks.
  const picked = list.find((t) => t.id === pickedId) ?? list.at(0)

  if (templates.isPending) {
    return (
      <p
        role="status"
        className="flex items-center justify-center gap-2 py-10 font-medium text-muted-foreground"
      >
        <Spinner aria-hidden className="size-5" />
        Loading templates…
      </p>
    )
  }

  if (templates.isError && list.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-center">
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
    )
  }

  if (list.length === 0) return empty

  return (
    <div className="flex flex-col gap-4">
      {children}

      <div
        role="radiogroup"
        aria-label="Templates"
        className="flex max-h-60 flex-col gap-2 overflow-y-auto p-0.5"
      >
        {list.map((t) => {
          const selected = t.id === picked?.id
          const h = templateHours(t.outline)
          return (
            <button
              key={t.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setPickedId(t.id)}
              className={cn(
                'flex min-h-14 items-center gap-3 rounded-lg border-2 border-border bg-card px-3 py-2 text-left outline-none focus-visible:ring-4 focus-visible:ring-ring',
                selected && 'border-primary bg-primary/10',
              )}
            >
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-bold">{t.name}</span>
                <span className="truncate text-sm text-muted-foreground">
                  {subjectCount(t.outline.length)}
                  {h.start && ` · ${formatClockRange(h.start, h.end)}`}
                </span>
              </span>
              <Check
                aria-hidden
                className={cn(
                  'size-5 shrink-0 text-primary',
                  !selected && 'invisible',
                )}
              />
            </button>
          )
        })}
      </div>

      {picked && (
        <div
          aria-live="polite"
          className="flex flex-col gap-1 rounded-lg border-2 border-border bg-muted/40 p-3"
        >
          <ul
            aria-label={`Sections in “${picked.name}”`}
            className="flex flex-col gap-0.5 text-sm"
          >
            {picked.outline.map((s, i) => (
              <li key={i} className="flex items-baseline gap-2">
                <span className="truncate font-medium">
                  {s.title || 'Untitled section'}
                </span>
                <span className="shrink-0 text-muted-foreground">
                  {formatClockRange(s.start_time, s.end_time)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <OfflineNote action={offlineAction} />
      <Button
        onClick={() => picked && onChoose(picked)}
        disabled={busy || !online || !picked}
        aria-busy={busy}
        className={cn(
          'h-11 rounded-lg border-2 border-border text-base font-bold',
          destructive &&
            'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        )}
      >
        {busy && <Spinner aria-hidden className="size-4" />}
        {action}
      </Button>
      {footer}
    </div>
  )
}
