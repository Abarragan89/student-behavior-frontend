import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { ApiError } from '#/lib/api'
import { formatClockRange, formatShortDate, monthOf } from '#/lib/calendar'
import { addDays, formatLongDate, useToday } from '#/lib/day'
import {
  copyDay,
  lessonPlanCalendarQueryOptions,
  lessonPlanDayQueryOptions,
} from '#/lib/lesson-plans'
import { whenSaved } from '#/lib/lesson-plan-queue'
import { useOnline } from '#/lib/online'
import { OfflineNote } from '#/components/offline-note'
import { ResponsiveDialog } from '#/components/responsive-dialogue'
import { MonthCalendar } from '#/components/lesson-plans/month-calendar'

/**
 * Fills an empty day with a copy of another day's plan, unchecked. Starts on
 * the same weekday last week, the usual place to start from. It never
 * replaces a plan: the server refuses if this day already has one.
 */
export function CopyDayDialog({
  open,
  onOpenChange,
  date,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  date: string
}) {
  return (
    <ResponsiveDialog
      isOpen={open}
      setIsOpen={onOpenChange}
      title="Copy from another day"
      description={`Pick a day to copy onto ${formatLongDate(date)}. Nothing comes over checked off.`}
      showDescription
    >
      {open && <CopyDayForm date={date} onDone={() => onOpenChange(false)} />}
    </ResponsiveDialog>
  )
}

function CopyDayForm({ date, onDone }: { date: string; onDone: () => void }) {
  const queryClient = useQueryClient()
  const online = useOnline()
  const today = useToday()
  const [picked, setPicked] = useState(() => addDays(date, -7))
  const [month, setMonth] = useState(() => monthOf(picked))
  const calendar = useQuery(lessonPlanCalendarQueryOptions(month))
  const source = useQuery(lessonPlanDayQueryOptions(picked))
  const sections = source.data?.sections ?? []
  const [busy, setBusy] = useState(false)

  async function copy() {
    setBusy(true)
    try {
      await whenSaved(queryClient)
      const copied = await copyDay(date, picked)
      queryClient.setQueryData(lessonPlanDayQueryOptions(date).queryKey, copied)
      void queryClient.invalidateQueries({ queryKey: ['lesson-plan-calendar'] })
      onDone()
      toast.success(`Copied the plan from ${formatShortDate(picked)}`)
    } catch (error) {
      console.error('Copying a day failed:', error)
      setBusy(false)
      if (error instanceof ApiError && error.status === 409) {
        // Planned meanwhile (another device, or a retry that got through).
        void queryClient.invalidateQueries({
          queryKey: lessonPlanDayQueryOptions(date).queryKey,
        })
        onDone()
        toast.error('This day already has a plan', {
          description: 'Copying never replaces a plan.',
        })
        return
      }
      toast.error('Couldn’t copy the plan', {
        description: 'Check your connection and try again.',
      })
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <MonthCalendar
        size="small"
        month={month}
        onMonthChange={setMonth}
        today={today}
        summaries={calendar.data}
        onPick={setPicked}
        selected={picked}
      />

      <div
        aria-live="polite"
        className="flex min-h-20 flex-col gap-1 rounded-lg border-2 border-border bg-muted/40 p-3"
      >
        <p className="font-bold">{formatLongDate(picked)}</p>
        {source.isPending ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Spinner aria-hidden className="size-4" />
            Loading…
          </p>
        ) : sections.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {source.isError
              ? 'Couldn’t load that day.'
              : 'Nothing planned that day. Pick a day with a dot.'}
          </p>
        ) : (
          <ul className="flex flex-col gap-0.5 text-sm">
            {sections.map((s) => (
              <li key={s.id} className="flex items-baseline gap-2">
                <span className="truncate font-medium">
                  {s.title || 'Untitled section'}
                </span>
                <span className="shrink-0 text-muted-foreground">
                  {formatClockRange(s.start_time, s.end_time)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <OfflineNote action="copy a plan" />
      <Button
        onClick={() => void copy()}
        disabled={busy || !online || sections.length === 0 || picked === date}
        aria-busy={busy}
        className="h-11 rounded-lg border-2 border-border text-base font-bold"
      >
        {busy && <Spinner aria-hidden className="size-4" />}
        Copy this plan
      </Button>
    </div>
  )
}
