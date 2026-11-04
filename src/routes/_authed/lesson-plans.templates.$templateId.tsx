import { Link, createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { CircleAlert, LayoutTemplate, RefreshCw } from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'
import { ApiError } from '#/lib/api'
import { lessonPlanTemplateQueryOptions } from '#/lib/lesson-plan-templates'
import { useOnline } from '#/lib/online'
import { mayLoad } from '#/lib/workspace'
import { TemplateEditor } from '#/components/lesson-plans/template-editor'

// /lesson-plans/templates/<id>: changing a template.
export const Route = createFileRoute(
  '/_authed/lesson-plans/templates/$templateId',
)({
  staticData: { feature: { key: 'lesson_plans', level: 'edit' } },
  loader: ({ context: { queryClient }, params }) => {
    if (!mayLoad(queryClient, 'lesson_plans')) return
    void queryClient
      .query(lessonPlanTemplateQueryOptions(params.templateId))
      .catch(() => null)
  },
  component: EditTemplatePage,
})

function EditTemplatePage() {
  const { templateId } = Route.useParams()
  const navigate = Route.useNavigate()
  const online = useOnline()
  const template = useQuery(lessonPlanTemplateQueryOptions(templateId))
  const gone =
    template.error instanceof ApiError &&
    (template.error.status === 404 || template.error.status === 400)

  return (
    <main className="mx-auto flex w-full max-w-3xl min-w-0 flex-1 flex-col gap-5 px-4 py-6 sm:py-8">
      <Link
        to="/lesson-plans/templates"
        className={cn(
          buttonVariants({ variant: 'link' }),
          'h-auto self-start px-0 text-base font-bold',
        )}
      >
        <LayoutTemplate className="size-5" />
        Templates
      </Link>

      {template.data ? (
        // A new editor for each template, so nothing carries over.
        <TemplateEditor
          key={templateId}
          heading={<h1 className="text-2xl font-bold">Edit template</h1>}
          saved={template.data}
          onSaved={() =>
            void navigate({ to: '/lesson-plans/templates', replace: true })
          }
        />
      ) : template.isError ? (
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <p className="flex items-center gap-2 font-medium">
            <CircleAlert className="size-5 shrink-0 text-destructive" />
            {gone
              ? 'This template isn’t here anymore. It may have been deleted.'
              : online
                ? 'Couldn’t load this template.'
                : 'Connect to the internet to open this template.'}
          </p>
          {!gone && (
            <Button
              variant="outline"
              onClick={() => void template.refetch()}
              disabled={template.isFetching}
              className="h-11 rounded-lg border-2 border-border font-bold"
            >
              <RefreshCw
                className={cn(template.isFetching && 'animate-spin')}
              />
              Try again
            </Button>
          )}
        </div>
      ) : (
        <p
          role="status"
          className="flex items-center justify-center gap-2 py-16 font-medium text-muted-foreground"
        >
          <Spinner aria-hidden className="size-5" />
          {online ? 'Loading template…' : 'Waiting for a connection…'}
        </p>
      )}
    </main>
  )
}
