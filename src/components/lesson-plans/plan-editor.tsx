import { Fragment, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
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
import { Copy, LayoutTemplate, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { MAX_TITLE_LENGTH } from '#/lib/lesson-plans'
import type { PlanDay } from '#/lib/lesson-plans'
import { flushDrafts } from '#/lib/lesson-plan-queue'
import { uuidv7 } from '#/lib/uuid'
import { EditorSection } from '#/components/lesson-plans/editor-section'
import {
  addLineField,
  focusField,
  useAddBox,
  useAutoGrow,
} from '#/components/lesson-plans/editor-text'
import {
  PlanTargetProvider,
  usePlanTarget,
} from '#/components/lesson-plans/plan-target'
import type { PlanTarget } from '#/components/lesson-plans/plan-target'

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
 * A day, or a template, in edit mode. On a day every change shows at once
 * and saves in the background, in order; there's no Save button. A template
 * is changed the same way, but kept on the page until it's saved (target).
 */
export function PlanEditor({
  day,
  target,
  onCopyFromDay,
  onStartWithTemplate,
}: {
  day: PlanDay
  /** What changes go to: useDayTarget or useTemplateDraft (plan-target.tsx). */
  target: PlanTarget
  /** Opens "Copy from another day", offered while the day is empty. */
  onCopyFromDay?: () => void
  /** Opens the template picker, offered while the day is empty. */
  onStartWithTemplate?: () => void
}) {
  return (
    <PlanTargetProvider value={target}>
      <Sections
        day={day}
        onCopyFromDay={onCopyFromDay}
        onStartWithTemplate={onStartWithTemplate}
      />
    </PlanTargetProvider>
  )
}

function Sections({
  day,
  onCopyFromDay,
  onStartWithTemplate,
}: {
  day: PlanDay
  onCopyFromDay?: () => void
  onStartWithTemplate?: () => void
}) {
  const target = usePlanTarget()
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
    target.run({
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
      target.run({
        kind: 'item-order',
        date: day.date,
        sectionId: section.id,
        ids: arrayMove(ids, from, to),
      })
    }
  }

  // Where a new subject is being named: above the subject with id `before`,
  // or at the end (null). `made` is the subject Enter just made; the card
  // stays until it's on screen, so the cursor goes straight to its first
  // line and a phone keeps its keyboard up.
  const [adding, setAdding] = useState<{
    before: string | null
    made?: string
  } | null>(null)
  if (adding?.made && day.sections.some((s) => s.id === adding.made)) {
    setAdding(null)
  }

  if (day.sections.length === 0) {
    return (
      <EmptyPlanCard
        onCopyFromDay={onCopyFromDay}
        onStartWithTemplate={onStartWithTemplate}
      />
    )
  }

  const slot = (before: string | null, name?: string) => (
    <SubjectSlot
      before={before}
      name={name}
      open={adding?.before === before}
      // Out of the way while subjects are dragged.
      hidden={dragging === 'section'}
      onOpen={() => setAdding({ before })}
      onMade={(id) => setAdding({ before, made: id })}
      // Only if it's still this one: a card closing as another opens
      // mustn't close that one.
      onClose={() => setAdding((a) => (a?.before === before ? null : a))}
    />
  )

  return (
    <div className="flex flex-col">
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
            <Fragment key={section.id}>
              {slot(section.id, section.title.trim() || 'Untitled section')}
              <EditorSection
                section={section}
                index={index}
                count={day.sections.length}
                // Short sections are easier to drag past each other.
                collapsed={dragging === 'section'}
                onMove={moveSection}
              />
            </Fragment>
          ))}
        </SortableContext>
      </DndContext>
      {slot(null)}
    </div>
  )
}

/**
 * Makes a subject named text above the subject with id `before` (or at the
 * end, if that's null or gone). Returns its id, or undefined if it wasn't
 * made (nothing loaded, or a template is full).
 */
function addSubject(target: PlanTarget, text: string, before: string | null) {
  const sections = target.sections()
  if (!sections) return undefined
  const at = before === null ? -1 : sections.findIndex((s) => s.id === before)
  const id = uuidv7()
  target.run({
    kind: 'section-add',
    date: target.date,
    id,
    title: text.replace(/\s*\n\s*/g, ' ').slice(0, MAX_TITLE_LENGTH),
    start_time: null,
    end_time: null,
    position: at < 0 ? sections.length : at,
  })
  return target.section(id) ? id : undefined
}

/**
 * A place a subject can go: above one, or at the end. Closed, it's a thin
 * row, a + between two lines, that opens on a tap. Open, it's a card for the
 * new subject's name, made on Enter (or on leaving it with a name typed).
 */
function SubjectSlot({
  before,
  name,
  open,
  hidden,
  onOpen,
  onMade,
  onClose,
}: {
  before: string | null
  /** The subject it's above, for screen readers. */
  name?: string
  open: boolean
  hidden: boolean
  onOpen: () => void
  onMade: (id: string) => void
  onClose: () => void
}) {
  const button = useRef<HTMLButtonElement>(null)

  if (open) {
    return (
      <NewSubjectCard
        before={before}
        onMade={onMade}
        onClose={onClose}
        onCancel={() => {
          // Back to the row, for someone using the keyboard.
          flushSync(onClose)
          button.current?.focus()
        }}
      />
    )
  }

  // On hover (or keyboard focus) it turns the success color and grows a
  // little. Scaled, not resized, so nothing around it moves.
  const line = (
    <span
      aria-hidden
      className="h-0.5 flex-1 rounded-full bg-border transition-[background-color,scale] duration-150 group-hover:scale-y-150 group-hover:bg-primary group-focus-visible:scale-y-150 group-focus-visible:bg-primary"
    />
  )
  return (
    <button
      ref={button}
      type="button"
      // Pressing it doesn't take the focus, so a card open elsewhere stays
      // (and nothing jumps) until the tap lands, and a phone's keyboard
      // stays up.
      onPointerDown={(e) => e.preventDefault()}
      onClick={() => {
        // A name typed in a card open elsewhere is added, not lost.
        flushDrafts()
        // Rendered and focused within the tap: iOS only brings up the
        // keyboard for a field focused during the tap itself.
        flushSync(onOpen)
      }}
      aria-label={
        name ? `Add a subject before “${name}”` : 'Add a subject at the end'
      }
      title="Add a subject here"
      className={cn(
        'group flex h-8 w-full shrink-0 items-center gap-2 rounded-lg px-1 outline-none focus-visible:ring-4 focus-visible:ring-ring',
        hidden && 'pointer-events-none invisible',
      )}
    >
      {line}
      <Plus
        strokeWidth={2.5}
        className="size-6 shrink-0 text-border transition-[color,scale] duration-150 group-hover:scale-125 group-hover:text-primary group-focus-visible:scale-125 group-focus-visible:text-primary"
      />
      {line}
    </button>
  )
}

/** The new subject's card, open in its slot, ready to type its name. */
function NewSubjectCard({
  before,
  onMade,
  onClose,
  onCancel,
}: {
  before: string | null
  onMade: (id: string) => void
  onClose: () => void
  onCancel: () => void
}) {
  const target = usePlanTarget()
  const card = useRef<HTMLDivElement>(null)
  const ref = useRef<HTMLTextAreaElement>(null)
  const box = useAddBox({
    id: `insert-section:${target.date}`,
    onAdd: (text) => addSubject(target, text, before),
  })
  useAutoGrow(ref, box.value)
  useLayoutEffect(() => {
    // Opened in a flushSync from the tap, so this is still within it.
    ref.current?.focus({ preventScroll: true })
    // All of the card in view, clear of the bottom bar (scroll-mb).
    const frame = requestAnimationFrame(() =>
      card.current?.scrollIntoView({ block: 'nearest' }),
    )
    return () => cancelAnimationFrame(frame)
  }, [])

  return (
    <div
      ref={card}
      className="scroll-mb-[calc(6rem+env(safe-area-inset-bottom))] py-2"
    >
      <div className="flex items-start gap-1 rounded-xl border-2 border-dashed border-border bg-card p-1.5 shadow-md">
        <span
          aria-hidden
          className="mt-0.5 flex size-10 shrink-0 items-center justify-center text-muted-foreground"
        >
          <Plus className="size-5" />
        </span>
        <textarea
          ref={ref}
          rows={1}
          value={box.value}
          maxLength={MAX_TITLE_LENGTH}
          aria-label="New subject’s name"
          placeholder="Name the subject, like “Math”"
          enterKeyHint="next"
          onChange={(e) => box.set(e.target.value.replace(/\n/g, ' '))}
          onKeyDown={(e) => {
            if (e.nativeEvent.isComposing || e.keyCode === 229) return
            if (e.key === 'Escape') {
              e.preventDefault()
              box.set('')
              onCancel()
              return
            }
            if (e.key !== 'Enter') return
            e.preventDefault()
            const id = box.commit()
            if (!id) {
              onClose()
              return
            }
            focusField(addLineField(id), 0)
            onMade(id)
          }}
          onBlur={() => {
            box.commit()
            onClose()
          }}
          className="field-sizing-content min-h-11 min-w-0 flex-1 resize-none rounded-md bg-transparent px-2 py-2 text-lg leading-snug font-bold outline-none placeholder:font-medium placeholder:text-muted-foreground/70 focus-visible:bg-muted/60"
        />
      </div>
    </div>
  )
}

/**
 * A plan with no subjects yet: where to start. Type the first subject (Enter
 * adds it and moves on to its first line), or start from a template or
 * another day's plan instead.
 */
function EmptyPlanCard({
  onCopyFromDay,
  onStartWithTemplate,
}: {
  onCopyFromDay?: () => void
  onStartWithTemplate?: () => void
}) {
  const target = usePlanTarget()
  const box = useAddBox({
    id: `add-section:${target.date}`,
    onAdd: (text) => addSubject(target, text, null),
  })

  return (
    <div className="flex flex-col gap-2 rounded-xl border-2 border-border bg-card p-3 shadow-md">
      {target.kind === 'template' ? (
        <div className="flex flex-col gap-1 px-1">
          <h2 className="text-lg font-bold">Add your subjects</h2>
          <p className="text-sm text-muted-foreground">
            Add the subjects of a usual day, like “Morning meeting” or “Math”,
            with their times and the lines you always do. Add as much or as
            little as you like.
          </p>
        </div>
      ) : (
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
          aria-label="Add a subject"
          placeholder="Add a subject…"
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
          className="field-sizing-content min-h-10 min-w-0 flex-1 resize-none rounded-md border-2 border-border bg-background px-2 py-2 text-lg leading-snug font-bold outline-none placeholder:font-medium placeholder:text-muted-foreground focus-visible:bg-muted/60"
        />
      </div>
      {onStartWithTemplate && (
        <Button
          variant="outline"
          onClick={onStartWithTemplate}
          className="mt-1 h-11 rounded-lg border-2 border-border bg-card text-base font-bold"
        >
          <LayoutTemplate className="size-4" />
          Start with a template
        </Button>
      )}
      {onCopyFromDay && (
        <Button
          variant="outline"
          onClick={onCopyFromDay}
          className={cn(
            'h-11 rounded-lg border-2 border-border bg-card text-base font-bold',
            !onStartWithTemplate && 'mt-1',
          )}
        >
          <Copy className="size-4" />
          Copy from another day
        </Button>
      )}
    </div>
  )
}
