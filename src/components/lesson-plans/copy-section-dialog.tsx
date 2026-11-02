import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { ApiError } from '#/lib/api'
import { formatShortDate, monthOf, stepSchoolDay } from '#/lib/calendar'
import { useToday } from '#/lib/day'
import {
  copySection,
  lessonPlanCalendarQueryOptions,
  lessonPlanDayQueryOptions,
} from '#/lib/lesson-plans'
import type { PlanSection } from '#/lib/lesson-plans'
import { whenSaved } from '#/lib/lesson-plan-queue'
import { useOnline } from '#/lib/online'
import { uuidv7 } from '#/lib/uuid'
import { OfflineNote } from '#/components/offline-note'
import { ResponsiveDialog } from '#/components/responsive-dialogue'
import { MonthCalendar } from '#/components/lesson-plans/month-calendar'

/**
 * Copies one section, with its lines unchecked, to the end of another day's
 * plan: a lesson that runs again on Thursday, or the same block every day.
 */
export function CopySectionDialog({
  open,
  onOpenChange,
  section,
  name,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  section: PlanSection
  name: string
}) {
  return (
    <ResponsiveDialog
      isOpen={open}
      setIsOpen={onOpenChange}
      title={`Copy “${name}”`}
      description="Pick a day. The copy goes at the end of that day’s plan, with nothing checked off."
      showDescription
    >
      {open && (
        <CopySectionForm section={section} onDone={() => onOpenChange(false)} />
      )}
    </ResponsiveDialog>
  )
}

function CopySectionForm({
  section,
  onDone,
}: {
  section: PlanSection
  onDone: () => void
}) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const online = useOnline()
  const today = useToday()
  const [picked, setPicked] = useState(() => stepSchoolDay(section.date, 1))
  const [month, setMonth] = useState(() => monthOf(picked))
  const calendar = useQuery(lessonPlanCalendarQueryOptions(month))
  const [busy, setBusy] = useState(false)

  async function copy() {
    setBusy(true)
    try {
      // The server copies what it has, so send any changes still queued.
      await whenSaved(queryClient)
      const copied = await copySection(section.id, uuidv7(), picked)
      queryClient.setQueryData(
        lessonPlanDayQueryOptions(picked).queryKey,
        (day) =>
          day && !day.sections.some((s) => s.id === copied.id)
            ? { ...day, sections: [...day.sections, copied] }
            : day,
      )
      void queryClient.invalidateQueries({ queryKey: ['lesson-plan-calendar'] })
      onDone()
      toast.success(`Copied to ${formatShortDate(picked)}`, {
        action: {
          label: 'Open',
          onClick: () =>
            void navigate({
              to: '/lesson-plans/$date',
              params: { date: picked },
            }),
        },
      })
    } catch (error) {
      console.error('Copying a section failed:', error)
      setBusy(false)
      toast.error('Couldn’t copy the section', {
        description:
          error instanceof ApiError && error.status === 409
            ? 'That day already has 40 sections.'
            : 'Check your connection and try again.',
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
      <OfflineNote action="copy sections" />
      <Button
        onClick={() => void copy()}
        disabled={busy || !online}
        aria-busy={busy}
        className="h-11 rounded-lg border-2 border-border text-base font-bold"
      >
        {busy && <Spinner aria-hidden className="size-4" />}
        Copy to {formatShortDate(picked)}
      </Button>
    </div>
  )
}
