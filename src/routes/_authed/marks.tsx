import { Link, createFileRoute } from '@tanstack/react-router'
import { ChevronLeft } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { MarkTypeList } from '#/components/mark-type-list'
import { OfflineNote } from '#/components/offline-note'
import { markTypesQueryOptions } from '#/lib/marks'

// Opened from the avatar menu and from "Edit marks" in the mark picker. Not in
// the main nav: teachers set marks up once, then tweak them now and then.
export const Route = createFileRoute('/_authed/marks')({
  // Started but not waited for, so the page shows at once (and offline, from
  // the saved list).
  loader: ({ context }) => {
    void context.queryClient.query(markTypesQueryOptions).catch(() => null)
  },
  component: MarksPage,
})

function MarksPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl min-w-0 flex-1 flex-col gap-6 px-4 py-6 sm:py-8">
      <Link
        to="/classes"
        className={cn(
          buttonVariants({ variant: 'link' }),
          'h-auto self-start px-0 text-base font-bold',
        )}
      >
        <ChevronLeft className="size-5" />
        Classes
      </Link>

      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold">Marks</h1>
        <p className="text-muted-foreground">
          The buttons you tap to give students a mark. Changes apply to all your
          classes.
        </p>
      </header>

      <OfflineNote action="change your marks" />

      <MarkTypeList />
    </main>
  )
}
