import { cn } from '@/lib/utils'
import { REMINDERS } from '#/lib/school-calendar'
import type { Reminder } from '#/lib/school-calendar'

/**
 * The email reminder choices (event form, calendar import). For an all-day
 * event the ones before a start time are off.
 */
export function ReminderChips({
  value,
  onChange,
  allDay = false,
  disabled = false,
}: {
  value: Set<Reminder>
  onChange: (next: Set<Reminder>) => void
  allDay?: boolean
  disabled?: boolean
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {REMINDERS.map((r) => {
        const off = allDay && r.timed
        const on = value.has(r.value) && !off
        return (
          <button
            key={r.value}
            type="button"
            aria-pressed={on}
            disabled={off || disabled}
            onClick={() => {
              const next = new Set(value)
              if (next.has(r.value)) next.delete(r.value)
              else next.add(r.value)
              onChange(next)
            }}
            className={cn(
              'min-h-10 rounded-full border-2 px-3 text-sm font-bold transition-colors outline-none focus-visible:ring-4 focus-visible:ring-ring disabled:opacity-50 motion-reduce:transition-none',
              on
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-card hover:bg-muted',
            )}
          >
            {r.label}
          </button>
        )
      })}
    </div>
  )
}
