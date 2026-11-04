import type { ReactNode } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import {
  CalendarDays,
  CircleAlert,
  LayoutTemplate,
  RefreshCw,
} from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'
import { ApiError } from '#/lib/api'
import { formatWeekday } from '#/lib/calendar'
import { formatLongDate, isDateString } from '#/lib/day'
import { lessonPlanDayQueryOptions } from '#/lib/lesson-plans'
import {
  copyOf,
  lessonPlanTemplateQueryOptions,
  sectionsFromDay,
} from '#/lib/lesson-plan-templates'
import { useOnline } from '#/lib/online'
import { mayLoad } from '#/lib/workspace'
import { TemplateEditor } from '#/components/lesson-plans/template-editor'

// /lesson-plans/templates/new: a new template.
// ?from=2026-11-05 starts it from that day's plan ("Save as template" on a
// day), unchecked. ?copy=<template id> starts it as a copy of that template
// ("Make a copy" on the Templates page).
export const Route = createFileRoute('/_authed/lesson-plans/templates/new')({
  staticData: { feature: { key: 'lesson_plans', level: 'edit' } },
  validateSearch: (
    search: Record<string, unknown>,
  ): { from?: string; copy?: string } => ({
    from: isDateString(search.from) ? search.from : undefined,
    // Checked by the server: a bad id is a 400, shown like a deleted one.
    copy:
      typeof search.copy === 'string' && search.copy !== ''
        ? search.copy
        : undefined,
  }),
  loaderDeps: ({ search }) => ({ from: search.from, copy: search.copy }),
  loader: ({ context: { queryClient }, deps }) => {
    if (!mayLoad(queryClient, 'lesson_plans')) return
    if (deps.from) {
      void queryClient
        .query(lessonPlanDayQueryOptions(deps.from))
        .catch(() => null)
    } else if (deps.copy) {
      void queryClient
        .query(lessonPlanTemplateQueryOptions(deps.copy))
        .catch(() => null)
    }
  },
  component: NewTemplatePage,
})

const backClass = cn(
  buttonVariants({ variant: 'link' }),
  'h-auto self-start px-0 text-base font-bold',
)

const heading = <h1 className="text-2xl font-bold">New template</h1>

function NewTemplatePage() {
  const { from, copy } = Route.useSearch()
  const navigate = Route.useNavigate()
  const toTemplates = () =>
    void navigate({ to: '/lesson-plans/templates', replace: true })

  if (from) {
    return (
      <Page>
        <Link
          to="/lesson-plans/$date"
          params={{ date: from }}
          className={backClass}
        >
          <CalendarDays className="size-5" />
          {formatLongDate(from)}
        </Link>
        <FromDay
          key={from}
          date={from}
          onSaved={() =>
            void navigate({
              to: '/lesson-plans/$date',
              params: { date: from },
              replace: true,
            })
          }
        />
      </Page>
    )
  }

  return (
    <Page>
      <Link to="/lesson-plans/templates" className={backClass}>
        <LayoutTemplate className="size-5" />
        Templates
      </Link>
      {copy ? (
        <FromTemplate key={copy} id={copy} onSaved={toTemplates} />
      ) : (
        <TemplateEditor heading={heading} saved={null} onSaved={toTemplates} />
      )}
    </Page>
  )
}

function Page({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-3xl min-w-0 flex-1 flex-col gap-5 px-4 py-6 sm:py-8">
      {children}
    </main>
  )
}

/** A new template that starts as a copy of date's plan. */
function FromDay({ date, onSaved }: { date: string; onSaved: () => void }) {
  const day = useQuery(lessonPlanDayQueryOptions(date))

  if (day.data) {
    return (
      <TemplateEditor
        heading={heading}
        saved={null}
        initial={{
          name: `${formatWeekday(date)} plan`,
          sections: sectionsFromDay(day.data.sections),
        }}
        onSaved={onSaved}
      />
    )
  }
  if (day.isError) {
    return (
      <LoadFailed
        message="Couldn’t load this day’s plan."
        retrying={day.isFetching}
        onRetry={() => void day.refetch()}
      />
    )
  }
  return <Loading text="Loading plan…" />
}

/** A new template that starts as a copy of another template. */
function FromTemplate({ id, onSaved }: { id: string; onSaved: () => void }) {
  const online = useOnline()
  const template = useQuery(lessonPlanTemplateQueryOptions(id))
  const gone =
    template.error instanceof ApiError &&
    (template.error.status === 404 || template.error.status === 400)

  if (template.data) {
    return (
      <TemplateEditor
        heading={heading}
        saved={null}
        initial={copyOf(template.data)}
        onSaved={onSaved}
      />
    )
  }
  if (template.isError) {
    return (
      <LoadFailed
        message={
          gone
            ? 'That template isn’t here anymore. It may have been deleted.'
            : online
              ? 'Couldn’t load the template to copy.'
              : 'Connect to the internet to copy this template.'
        }
        retrying={template.isFetching}
        onRetry={gone ? undefined : () => void template.refetch()}
      />
    )
  }
  return (
    <Loading
      text={online ? 'Loading template…' : 'Waiting for a connection…'}
    />
  )
}

function LoadFailed({
  message,
  retrying,
  onRetry,
}: {
  message: string
  retrying: boolean
  /** Left out when trying again can't help. */
  onRetry?: () => void
}) {
  return (
    <div className="flex flex-col items-center gap-3 py-10 text-center">
      <p className="flex items-center gap-2 font-medium">
        <CircleAlert className="size-5 shrink-0 text-destructive" />
        {message}
      </p>
      {onRetry && (
        <Button
          variant="outline"
          onClick={onRetry}
          disabled={retrying}
          className="h-11 rounded-lg border-2 border-border font-bold"
        >
          <RefreshCw className={cn(retrying && 'animate-spin')} />
          Try again
        </Button>
      )}
    </div>
  )
}

function Loading({ text }: { text: string }) {
  return (
    <p
      role="status"
      className="flex items-center justify-center gap-2 py-16 font-medium text-muted-foreground"
    >
      <Spinner aria-hidden className="size-5" />
      {text}
    </p>
  )
}
