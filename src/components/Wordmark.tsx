import { Plus } from 'lucide-react'

export function Wordmark() {
  return (
    <span className="inline-flex items-center gap-2">
      <span
        aria-hidden
        className="grid size-8 place-items-center rounded-md border-2 border-border bg-primary text-primary-foreground"
      >
        <Plus className="size-4" strokeWidth={3.5} />
      </span>
      <span className="text-lg font-bold tracking-tight">
        Teach<span className="text-primary">For</span>Free
      </span>
    </span>
  )
}
