import { useState } from 'react'
import { CircleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { PlanSection } from '#/lib/lesson-plans'
import { flushDrafts } from '#/lib/lesson-plan-queue'
import { ResponsiveDialog } from '#/components/responsive-dialogue'
import { usePlanTarget } from '#/components/lesson-plans/plan-target'

/** Sets or clears when a section happens, like 8:15–9:00. Both are optional. */
export function SectionTimeDialog({
  open,
  onOpenChange,
  section,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  section: PlanSection
}) {
  return (
    <ResponsiveDialog
      isOpen={open}
      setIsOpen={onOpenChange}
      title="Time"
      description="When this section happens. Both times are optional."
      showDescription
    >
      {/* A new form each time it opens, starting from the section's times. */}
      {open && (
        <TimeForm section={section} onDone={() => onOpenChange(false)} />
      )}
    </ResponsiveDialog>
  )
}

function TimeForm({
  section,
  onDone,
}: {
  section: PlanSection
  onDone: () => void
}) {
  const target = usePlanTarget()
  const [start, setStart] = useState(section.start_time ?? '')
  const [end, setEnd] = useState(section.end_time ?? '')
  const backwards = start !== '' && end !== '' && end <= start

  function save(startTime: string | null, endTime: string | null) {
    // Save a title still being typed first, then send it with the times.
    flushDrafts()
    const current = target.section(section.id) ?? section
    target.run({
      kind: 'section-edit',
      date: target.date,
      id: section.id,
      title: current.title,
      start_time: startTime,
      end_time: endTime,
    })
    onDone()
  }

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault()
        if (!backwards) save(start || null, end || null)
      }}
    >
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="section-start" className="font-bold">
            Starts
          </Label>
          <Input
            id="section-start"
            type="time"
            step={300}
            value={start}
            onChange={(e) => setStart(e.target.value)}
            className="h-11 rounded-lg border-2 border-border bg-card px-3 text-base"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="section-end" className="font-bold">
            Ends
          </Label>
          <Input
            id="section-end"
            type="time"
            step={300}
            value={end}
            aria-invalid={backwards || undefined}
            aria-describedby={backwards ? 'section-time-error' : undefined}
            onChange={(e) => setEnd(e.target.value)}
            className="h-11 rounded-lg border-2 border-border bg-card px-3 text-base"
          />
        </div>
      </div>
      {backwards && (
        <p
          id="section-time-error"
          className="flex items-center gap-2 text-sm font-medium"
        >
          <CircleAlert className="size-4 shrink-0 text-destructive" />
          The end has to be after the start.
        </p>
      )}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        {(section.start_time || section.end_time) && (
          <Button
            type="button"
            variant="outline"
            onClick={() => save(null, null)}
            className="h-11 rounded-lg border-2 border-border font-bold sm:mr-auto"
          >
            Clear times
          </Button>
        )}
        <Button
          type="submit"
          disabled={backwards}
          className="h-11 rounded-lg border-2 border-border font-bold"
        >
          Save
        </Button>
      </div>
    </form>
  )
}
