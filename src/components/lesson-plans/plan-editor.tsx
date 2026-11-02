import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import type {
  CollisionDetection,
  DragEndEvent,
  DragStartEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { restrictToVerticalAxis } from '@dnd-kit/modifiers'
import { Copy, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { MAX_TITLE_LENGTH, lessonPlanDayQueryOptions } from '#/lib/lesson-plans'
import type { PlanDay } from '#/lib/lesson-plans'
import { flushDrafts, runOp } from '#/lib/lesson-plan-queue'
import { uuidv7 } from '#/lib/uuid'
import { EditorSection } from '#/components/lesson-plans/editor-section'
import {
  addLineField,
  focusField,
  useAddBox,
} from '#/components/lesson-plans/editor-text'

type DragData = { type: 'section' } | { type: 'item'; sectionId: string }

/**
 * Only drop where the thing dragged can go: a section among sections, a
 * line among its own section's lines.
 */
const sameKind: CollisionDetection = (args) => {
  const active = args.active.data.current as DragData | undefined
  return closestCenter({
    ...args,
    droppableContainers: args.droppableContainers.filter((c) => {
      const over = c.data.current as DragData | undefined
      if (!active || !over || over.type !== active.type) return false
      return (
        active.type === 'section' ||
        (over.type === 'item' && over.sectionId === active.sectionId)
      )
    }),
  })
}

/**
 * The day in edit mode. Every change shows at once and saves in the
 * background, in order; there's no Save button.
 */
export function PlanEditor({
  day,
  onCopyFromDay,
}: {
  day: PlanDay
  /** Opens "Copy from another day", offered while the day is empty. */
  onCopyFromDay: () => void
}) {
  const queryClient = useQueryClient()
  const [dragging, setDragging] = useState<DragData['type'] | null>(null)
  const sensors = useSensors(
    // A few pixels of movement before a drag starts, so a tap on the handle
    // is still a tap.
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  // Typing not saved yet is saved when the app goes to the background, and
  // when leaving edit mode.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden') flushDrafts()
    }
    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('pagehide', flushDrafts)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('pagehide', flushDrafts)
      flushDrafts()
    }
  }, [])

  function moveSection(from: number, to: number) {
    const ids = day.sections.map((s) => s.id)
    if (to < 0 || to >= ids.length) return
    runOp(queryClient, {
      kind: 'section-order',
      date: day.date,
      ids: arrayMove(ids, from, to),
    })
  }

  function onDragStart(event: DragStartEvent) {
    flushDrafts()
    // Closes the phone keyboard, which would otherwise cover the drop spot.
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur()
    }
    setDragging(
      (event.active.data.current as DragData | undefined)?.type ?? null,
    )
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    setDragging(null)
    if (!over || active.id === over.id) return
    const data = active.data.current as DragData | undefined
    if (data?.type === 'section') {
      const ids = day.sections.map((s) => s.id)
      moveSection(ids.indexOf(String(active.id)), ids.indexOf(String(over.id)))
      return
    }
    if (data?.type === 'item') {
      const section = day.sections.find((s) => s.id === data.sectionId)
      if (!section) return
      const ids = section.items.map((i) => i.id)
      const from = ids.indexOf(String(active.id))
      const to = ids.indexOf(String(over.id))
      if (from < 0 || to < 0) return
      runOp(queryClient, {
        kind: 'item-order',
        date: day.date,
        sectionId: section.id,
        ids: arrayMove(ids, from, to),
      })
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <DndContext
        sensors={sensors}
        collisionDetection={sameKind}
        modifiers={[restrictToVerticalAxis]}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragCancel={() => setDragging(null)}
      >
        <SortableContext
          items={day.sections.map((s) => s.id)}
          strategy={verticalListSortingStrategy}
        >
          {day.sections.map((section, index) => (
            <EditorSection
              key={section.id}
              section={section}
              index={index}
              count={day.sections.length}
              date={day.date}
              // Short sections are easier to drag past each other.
              collapsed={dragging === 'section'}
              onMove={moveSection}
            />
          ))}
        </SortableContext>
      </DndContext>
      <AddSectionInput
        date={day.date}
        first={day.sections.length === 0}
        onCopyFromDay={onCopyFromDay}
      />
    </div>
  )
}

/**
 * "Add a section…" at the end of the day. Enter adds the section and moves
 * on to its first line. On an empty day it's a card that explains where to
 * start, with the choice to copy another day's plan instead.
 */
function AddSectionInput({
  date,
  first,
  onCopyFromDay,
}: {
  date: string
  first: boolean
  onCopyFromDay: () => void
}) {
  const queryClient = useQueryClient()
  const box = useAddBox({
    id: `add-section:${date}`,
    onAdd: (text) => {
      const sections = queryClient.getQueryData(
        lessonPlanDayQueryOptions(date).queryKey,
      )?.sections
      if (!sections) return undefined
      const id = uuidv7()
      runOp(queryClient, {
        kind: 'section-add',
        date,
        id,
        title: text.replace(/\s*\n\s*/g, ' ').slice(0, MAX_TITLE_LENGTH),
        start_time: null,
        end_time: null,
        position: sections.length,
      })
      return id
    },
  })

  return (
    <div
      className={cn(
        'flex flex-col gap-2 rounded-xl border-2 border-dashed border-border p-3',
        first && 'border-solid bg-card shadow-md',
      )}
    >
      {first && (
        <div className="flex flex-col gap-1 px-1">
          <h2 className="text-lg font-bold">Nothing planned yet</h2>
          <p className="text-sm text-muted-foreground">
            Start with a section, like “Period 1”, “Morning meeting” or “Math”,
            then add lines to check off under it.
          </p>
        </div>
      )}
      <div className="flex items-center gap-2">
        <Plus
          aria-hidden
          className="ml-1 size-5 shrink-0 text-muted-foreground"
        />
        <textarea
          rows={1}
          value={box.value}
          aria-label="Add a section"
          placeholder="Add a section…"
          enterKeyHint="next"
          onChange={(e) => box.set(e.target.value)}
          onKeyDown={(e) => {
            if (e.nativeEvent.isComposing || e.keyCode === 229) return
            if (e.key !== 'Enter') return
            e.preventDefault()
            const id = box.commit()
            if (id) focusField(addLineField(id), 0)
          }}
          onBlur={() => box.commit()}
          className={cn(
            'field-sizing-content min-h-10 min-w-0 flex-1 resize-none rounded-md bg-transparent px-2 py-2 text-lg leading-snug font-bold outline-none placeholder:font-medium placeholder:text-muted-foreground focus-visible:bg-muted/60',
            first && 'border-2 border-border bg-background',
          )}
        />
      </div>
      {first && (
        <Button
          variant="outline"
          onClick={onCopyFromDay}
          className="mt-1 h-11 rounded-lg border-2 border-border bg-card text-base font-bold"
        >
          <Copy className="size-4" />
          Copy from another day
        </Button>
      )}
    </div>
  )
}
