import { createFileRoute } from '@tanstack/react-router'
import { NotebookPen } from 'lucide-react'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'

export const Route = createFileRoute('/_authed/lesson-plans')({
  component: LessonPlansPage,
})

function LessonPlansPage() {
  return (
    <main className="flex flex-1 flex-col p-4">
      <h1 className="sr-only">Lesson Plans</h1>
      {/* No side padding: main already has some, and phones need the width. */}
      <Empty className="mx-auto max-w-md px-0">
        <EmptyHeader>
          <EmptyMedia
            variant="icon"
            className="size-14 rounded-lg border-2 border-border bg-chart-3 text-foreground"
          >
            <NotebookPen className="size-7" />
          </EmptyMedia>
          <EmptyTitle className="text-2xl font-bold">
            Lesson plans are coming soon
          </EmptyTitle>
          <EmptyDescription className="text-base">
            You’ll be able to write and keep your lesson plans here.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    </main>
  )
}
