import type { LucideIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'

/**
 * A school administrator's tab whose feature isn't built yet: what it will
 * do, plainly labelled as coming.
 */
export function ComingSoonPage({
  icon: Icon,
  title,
  text,
}: {
  icon: LucideIcon
  title: string
  text: string
}) {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 py-10">
      <h1 className="text-2xl font-bold max-md:pr-12">{title}</h1>
      <Empty className="rounded-xl border-2 border-dashed border-border">
        <EmptyHeader>
          <EmptyMedia
            variant="icon"
            className="size-12 rounded-lg bg-chart-3 text-foreground"
          >
            <Icon className="size-6" />
          </EmptyMedia>
          <Badge variant="outline" className="font-bold">
            Coming soon
          </Badge>
          <EmptyTitle className="text-lg font-bold">{text}</EmptyTitle>
          <EmptyDescription>Founding schools get this first.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    </main>
  )
}
