import { useId, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CircleAlert, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { MarkSourceProvider } from '#/lib/mark-source'
import { subMarkSource, subRosterQueryOptions } from '#/lib/sub'
import type { SubClassroom } from '#/lib/sub'
import { ClassHeader } from '#/components/class-header'
import { ClassRoster } from '#/components/class-roster'
import {
  ClassLayerShell,
  OpeningClass,
} from '#/components/lesson-plans/presenter-class'
import type { ClassViewState } from '#/components/lesson-plans/presenter-view'
import { SwitchClassDialog } from '#/components/switch-class-dialog'
import { useClassToday } from '#/hooks/useClassToday'

/**
 * A substitute's class, over the plan: the same layer and round button as
 * the teacher's (ClassLayerShell), with the classes the teacher shared.
 * Marks go through the link (see subMarkSource). Switching only changes
 * what's on screen, so it works offline once the classes have loaded.
 */
export function SubClass({
  classrooms,
  planDate,
  ...state
}: ClassViewState & {
  /** At least one, in the teacher's order. */
  classrooms: Array<SubClassroom>
  planDate: string
}) {
  const source = useMemo(() => subMarkSource(planDate), [planDate])
  return (
    <MarkSourceProvider value={source}>
      <SubClassLayer classrooms={classrooms} {...state} />
    </MarkSourceProvider>
  )
}

function SubClassLayer({
  classrooms,
  open,
  onOpenChange,
}: ClassViewState & { classrooms: Array<SubClassroom> }) {
  const [openId, setOpenId] = useState(classrooms[0].id)
  const [switchOpen, setSwitchOpen] = useState(false)
  // The first one if the teacher took this class off the link meanwhile.
  const shown = classrooms.find((c) => c.id === openId) ?? classrooms[0]
  const roster = useQuery(subRosterQueryOptions(shown.id))
  const today = useClassToday(shown.id, roster.isSuccess)
  const headingId = useId()
  const classroom = {
    id: shown.id,
    name: shown.name,
    students: roster.data ?? [],
  }

  return (
    <ClassLayerShell
      open={open}
      onOpenChange={onOpenChange}
      // Only open on its day.
      isToday
      today={today}
      busy={roster.isPending}
      headingId={headingId}
    >
      <ClassHeader
        classroom={classroom}
        name={shown.name}
        loading={!roster.isSuccess}
        onSwitch={classrooms.length > 1 ? () => setSwitchOpen(true) : undefined}
        headingLevel="h2"
        headingId={headingId}
      />

      {roster.isPending ? (
        <OpeningClass name={shown.name} />
      ) : roster.isError ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <p className="flex items-center gap-2 font-medium">
            <CircleAlert className="size-5 shrink-0 text-destructive" />
            Couldn’t load {shown.name}.
          </p>
          <Button
            variant="outline"
            onClick={() => void roster.refetch()}
            disabled={roster.isFetching}
            className="h-11 rounded-lg border-2 border-border font-bold"
          >
            <RefreshCw className={cn(roster.isFetching && 'animate-spin')} />
            Try again
          </Button>
        </div>
      ) : roster.data.length > 0 ? (
        // Keyed by class, so switching starts fresh (no picks carried over).
        <ClassRoster key={shown.id} classroom={classroom} pageLinks={false} />
      ) : (
        <p className="py-16 text-center text-muted-foreground">
          No students in {shown.name}.
        </p>
      )}

      {classrooms.length > 1 && (
        <SwitchClassDialog
          classrooms={classrooms}
          openId={shown.id}
          open={switchOpen}
          onOpenChange={setSwitchOpen}
          onPick={(c) => setOpenId(c.id)}
          needsConnection={false}
        />
      )}
    </ClassLayerShell>
  )
}
