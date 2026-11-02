import { useRef, useState } from 'react'
import type { KeyboardEvent, PointerEvent } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { IndentDecrease, IndentIncrease, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { MAX_LINE_LENGTH, cachedSection } from '#/lib/lesson-plans'
import type { PlanItem, PlanSection } from '#/lib/lesson-plans'
import { runOp } from '#/lib/lesson-plan-queue'
import { uuidv7 } from '#/lib/uuid'
import { DragHandle } from '#/components/lesson-plans/drag-handle'
import {
  focusField,
  titleField,
  useAutoGrow,
  useDraftText,
  useFocusTarget,
} from '#/components/lesson-plans/editor-text'

/**
 * One checklist line in edit mode. Keys work like a notes app: Enter starts
 * a new line (splitting this one at the cursor), Backspace at the start joins
 * it to the line above, Tab indents. Phones have no Tab, so the focused line
 * shows indent and delete buttons.
 */
export function EditorLine({
  item,
  index,
  section,
  date,
}: {
  item: PlanItem
  index: number
  section: PlanSection
  date: string
}) {
  const queryClient = useQueryClient()
  const ref = useRef<HTMLTextAreaElement>(null)
  const [focused, setFocused] = useState(false)
  const deleted = useRef(false)
  const draft = useDraftText({
    id: item.id,
    value: item.text,
    onSave: (text) =>
      runOp(queryClient, { kind: 'item-edit', date, id: item.id, text }),
  })
  useFocusTarget(item.id, ref, draft.replace)
  useAutoGrow(ref, draft.text)

  const sortable = useSortable({
    id: item.id,
    data: { type: 'item', sectionId: section.id },
  })

  function setIndent(indent: 0 | 1) {
    if (indent !== item.indent) {
      runOp(queryClient, { kind: 'item-edit', date, id: item.id, indent })
    }
  }

  function remove() {
    if (deleted.current) return
    deleted.current = true
    draft.drop()
    runOp(queryClient, { kind: 'item-delete', date, id: item.id })
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    // Mid-word in a phone keyboard's suggestions, or an IME: leave it alone.
    if (e.nativeEvent.isComposing || e.keyCode === 229) return
    const el = e.currentTarget
    const text = draft.text
    // The cache, not this render: two quick keys can come before a re-render.
    const lines =
      cachedSection(queryClient, date, section.id)?.items ?? section.items
    const at = Math.max(
      0,
      lines.findIndex((i) => i.id === item.id),
    )

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      // Enter on an empty sub-step makes it a main line, like most editors.
      if (text === '' && item.indent === 1) {
        setIndent(0)
        return
      }
      const before = text.slice(0, el.selectionStart)
      const after = text.slice(el.selectionEnd)
      draft.commit(before)
      const id = uuidv7()
      runOp(queryClient, {
        kind: 'item-add',
        date,
        sectionId: section.id,
        id,
        text: after,
        indent: item.indent,
        position: at + 1,
      })
      focusField(id, 0)
      return
    }

    if (
      e.key === 'Backspace' &&
      el.selectionStart === 0 &&
      el.selectionEnd === 0
    ) {
      // A sub-step first goes back to being a main line.
      if (item.indent === 1) {
        e.preventDefault()
        setIndent(0)
        return
      }
      const previous = at > 0 ? lines[at - 1] : undefined
      if (!previous) {
        if (text === '') {
          e.preventDefault()
          remove()
          focusField(titleField(section.id), section.title.length)
        }
        return
      }
      const joined = previous.text + text
      if (joined.length > MAX_LINE_LENGTH) return
      e.preventDefault()
      if (text !== '') {
        runOp(queryClient, {
          kind: 'item-edit',
          date,
          id: previous.id,
          text: joined,
        })
      }
      remove()
      focusField(previous.id, previous.text.length, joined)
      return
    }

    if (e.key === 'Tab') {
      e.preventDefault()
      setIndent(e.shiftKey ? 0 : 1)
    }
  }

  // The buttons act without taking focus from the line, so the phone's
  // keyboard stays up and they don't vanish before the tap lands.
  const keepFocus = (e: PointerEvent) => e.preventDefault()

  return (
    <li
      ref={sortable.setNodeRef}
      style={{
        transform: CSS.Translate.toString(sortable.transform),
        transition: sortable.transition,
      }}
      className={cn(
        'flex items-start gap-1 bg-card py-0.5 pr-2',
        sortable.isDragging &&
          'relative z-10 rounded-lg shadow-lg ring-2 ring-border',
      )}
    >
      <DragHandle
        ref={sortable.setActivatorNodeRef}
        label={`Move line “${item.text || 'empty line'}”`}
        {...sortable.attributes}
        {...sortable.listeners}
      />
      <span
        aria-hidden
        className={cn(
          'mt-3 shrink-0 border-2 border-border',
          item.indent === 1 ? 'ml-6 size-3.5 rounded-full' : 'size-4 rounded',
          item.done && 'bg-chart-5',
        )}
      />
      <textarea
        ref={ref}
        rows={1}
        value={draft.text}
        maxLength={MAX_LINE_LENGTH}
        aria-label={item.indent === 1 ? 'Sub-step' : 'Line'}
        placeholder="Type here…"
        enterKeyHint="next"
        onChange={(e) => draft.change(e.target.value)}
        onKeyDown={onKeyDown}
        onFocus={() => {
          draft.onFocus()
          setFocused(true)
        }}
        onBlur={() => {
          draft.onBlur()
          setFocused(false)
          // Lines left empty (an extra Enter) tidy themselves away.
          if (draft.text === '' && !deleted.current) remove()
        }}
        className={cn(
          'field-sizing-content min-h-10 min-w-0 flex-1 resize-none rounded-md bg-transparent px-2 py-2 text-base leading-snug outline-none placeholder:text-muted-foreground/70 focus-visible:bg-muted/60',
          'scroll-mb-[calc(6rem+env(safe-area-inset-bottom))]',
          item.done && 'text-muted-foreground line-through',
        )}
      />
      {focused && (
        <div className="flex shrink-0 items-center">
          <button
            type="button"
            onPointerDown={keepFocus}
            onClick={() => setIndent(item.indent === 1 ? 0 : 1)}
            aria-label={
              item.indent === 1 ? 'Make it a main line' : 'Make it a sub-step'
            }
            className="flex size-10 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            {item.indent === 1 ? (
              <IndentDecrease className="size-5" />
            ) : (
              <IndentIncrease className="size-5" />
            )}
          </button>
          <button
            type="button"
            onPointerDown={keepFocus}
            onClick={() => {
              const previous = section.items.at(index - 1)
              remove()
              if (index > 0 && previous) {
                focusField(previous.id, previous.text.length)
              }
            }}
            aria-label="Delete line"
            className="flex size-10 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="size-5" />
          </button>
        </div>
      )}
    </li>
  )
}
