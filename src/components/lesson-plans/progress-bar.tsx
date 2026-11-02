import { cn } from '@/lib/utils'

/** "3 of 8 done" with a bar, for a day or a section. */
export function ProgressBar({
  done,
  total,
  label,
  className,
}: {
  done: number
  total: number
  label: string
  className?: string
}) {
  const percent = total === 0 ? 0 : Math.round((done / total) * 100)
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={done}
        className="h-3 flex-1 overflow-hidden rounded-full border-2 border-border bg-muted"
      >
        <div
          className="h-full bg-chart-5 transition-[width] duration-300 motion-reduce:transition-none"
          style={{ width: `${percent}%` }}
        />
      </div>
      <span aria-hidden className="shrink-0 text-sm font-bold">
        {label}
      </span>
    </div>
  )
}
