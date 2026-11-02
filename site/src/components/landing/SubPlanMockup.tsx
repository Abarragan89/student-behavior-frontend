import { Check, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PhoneFrame } from './PhoneFrame'

// What a substitute sees when they open a shared day. Decorative only.
const LINES: Array<{ text: string; done: boolean; sub?: boolean }> = [
  { text: 'Warm-up: 3 problems on the board', done: true },
  { text: 'Read pages 42–45 together', done: true },
  { text: 'Partners: worksheet #1–10', done: false },
  { text: 'Collect worksheets at the door', done: false, sub: true },
  { text: 'Exit ticket', done: false },
]

export function SubPlanMockup() {
  return (
    <div aria-hidden>
      <PhoneFrame>
        <div className="flex items-center justify-between border-b-2 border-border bg-card px-3 py-2 font-mono text-xs">
          <span className="font-bold">Thursday</span>
          <span className="text-muted-foreground">Ms. Lee’s plan</span>
        </div>

        <div className="space-y-3 p-4">
          <div>
            <p className="text-lg font-bold leading-tight">
              Period 3 — Reading
            </p>
            <p className="font-mono text-xs text-muted-foreground">
              10:15 – 11:00
            </p>
          </div>
          <ul className="space-y-2 text-sm">
            {LINES.map((line) => (
              <li
                key={line.text}
                className={cn('flex items-start gap-2', line.sub && 'ml-6')}
              >
                <span
                  className={cn(
                    'mt-0.5 grid size-5 shrink-0 place-items-center border-2 border-border',
                    line.sub ? 'rounded-full' : 'rounded-sm',
                    line.done && 'bg-chart-5',
                  )}
                >
                  {line.done && <Check className="size-3.5" strokeWidth={3} />}
                </span>
                <span
                  className={cn(
                    line.done && 'text-muted-foreground line-through',
                  )}
                >
                  {line.text}
                </span>
              </li>
            ))}
          </ul>
          <p className="flex items-center justify-center gap-2 rounded-md border-2 border-border bg-primary px-2 py-2 text-sm font-bold text-primary-foreground">
            <Users className="size-4" />
            Period 3 · 24 students
          </p>
        </div>
      </PhoneFrame>
    </div>
  )
}
