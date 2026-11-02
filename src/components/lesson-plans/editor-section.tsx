import { useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  ArrowDown,
  ArrowUp,
  CalendarPlus,
  Clock,
  EllipsisVertical,
  Plus,
  Trash2,
} from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { formatClockRange } from '#/lib/calendar'
import {
  MAX_LINE_LENGTH,
  MAX_TITLE_LENGTH,
  cachedSection,
  isBlank,
} from '#/lib/lesson-plans'
import type { PlanSection } from '#/lib/lesson-plans'
import { runOp } from '#/lib/lesson-plan-queue'
import { uuidv7 } from '#/lib/uuid'
import { CopySectionDialog } from '#/components/lesson-plans/copy-section-dialog'
import { DragHandle } from '#/components/lesson-plans/drag-handle'
import { EditorLine } from '#/components/lesson-plans/editor-line'
import {
  addLineField,
  focusField,
  titleField,
  useAddBox,
  useAutoGrow,
  useDraftText,
  useFocusTarget,
} from '#/components/lesson-plans/editor-text'
import { SectionTimeDialog } from '#/components/lesson-plans/section-time-dialog'

/** One section in edit mode: its title, time, menu and lines. */
export function EditorSection({
  section,
  index,
  count,
  date,
  collapsed,
  onMove,
}: {
  section: PlanSection
  index: number
  count: number
  date: string
  /** Lines hidden, while sections are being dragged. */
  collapsed: boolean
  onMove: (from: number, to: number) => void
}) {
  const queryClient = useQueryClient()
  const titleRef = useRef<HTMLTextAreaElement>(null)
  const [timeOpen, setTimeOpen] = useState(false)
  const [copyOpen, setCopyOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const title = useDraftText({
    id: titleField(section.id),
    value: section.title,
    onSave: (text) =>
      runOp(queryClient, {
        kind: 'section-edit',
        date,
        id: section.id,
        title: text,
        start_time: section.start_time,
        end_time: section.end_time,
      }),
  })
  useFocusTarget(titleField(section.id), titleRef, title.replace)
  useAutoGrow(titleRef, title.text)

  const sortable = useSortable({ id: section.id, data: { type: 'section' } })
  const time = formatClockRange(section.start_time, section.end_time)
  const name = title.text.trim() || 'Untitled section'

  function onTitleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.nativeEvent.isComposing || e.keyCode === 229) return
    if (e.key !== 'Enter') return
    // Enter goes on to the first line, ready to type.
    e.preventDefault()
    title.commit(title.text)
    const first = section.items.at(0)
    if (first) focusField(first.id, first.text.length)
    else focusField(addLineField(section.id), 0)
  }

  function remove() {
    title.drop()
    runOp(queryClient, { kind: 'section-delete', date, id: section.id })
  }

  return (
    <section
      ref={sortable.setNodeRef}
      style={{
        transform: CSS.Translate.toString(sortable.transform),
        transition: sortable.transition,
      }}
      aria-label={name}
      className={cn(
        'rounded-xl border-2 border-border bg-card shadow-md',
        sortable.isDragging && 'relative z-20 shadow-xl',
      )}
    >
      <div className="flex items-start gap-1 border-b-2 border-border p-1.5">
        <DragHandle
          ref={sortable.setActivatorNodeRef}
          label={`Move section “${name}”`}
          className="mt-1"
          {...sortable.attributes}
          {...sortable.listeners}
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <textarea
            ref={titleRef}
            rows={1}
            value={title.text}
            maxLength={MAX_TITLE_LENGTH}
            aria-label="Section title"
            placeholder="Section title, like “Period 3 — Math”"
            enterKeyHint="next"
            onChange={(e) => title.change(e.target.value.replace(/\n/g, ' '))}
            onKeyDown={onTitleKeyDown}
            onFocus={title.onFocus}
            onBlur={title.onBlur}
            className="field-sizing-content min-h-11 resize-none rounded-md bg-transparent px-2 py-2 text-lg leading-snug font-bold outline-none placeholder:font-medium placeholder:text-muted-foreground/70 focus-visible:bg-muted/60"
          />
          <button
            type="button"
            onClick={() => setTimeOpen(true)}
            className={cn(
              'mb-1 ml-1 inline-flex h-8 items-center gap-1.5 self-start rounded-full px-2 text-sm font-bold hover:bg-muted',
              !time && 'text-muted-foreground',
            )}
          >
            <Clock className="size-4" />
            {time || 'Add a time'}
          </button>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label={`More for “${name}”`}
            className="mt-1 flex size-10 shrink-0 items-center justify-center rounded-lg text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-4 focus-visible:ring-ring"
          >
            <EllipsisVertical className="size-5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-56 rounded-lg border-2 border-border p-1 shadow-md ring-0"
          >
            <DropdownMenuItem
              className="h-10 rounded-md font-bold"
              onClick={() => setTimeOpen(true)}
            >
              <Clock />
              {time ? 'Change the time' : 'Add a time'}
            </DropdownMenuItem>
            <DropdownMenuItem
              className="h-10 rounded-md font-bold"
              onClick={() => setCopyOpen(true)}
            >
              <CalendarPlus />
              Copy to another day
            </DropdownMenuItem>
            <DropdownMenuItem
              className="h-10 rounded-md font-bold"
              disabled={index === 0}
              onClick={() => onMove(index, index - 1)}
            >
              <ArrowUp />
              Move up
            </DropdownMenuItem>
            <DropdownMenuItem
              className="h-10 rounded-md font-bold"
              disabled={index === count - 1}
              onClick={() => onMove(index, index + 1)}
            >
              <ArrowDown />
              Move down
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              className="h-10 rounded-md font-bold"
              onClick={() =>
                section.items.some((i) => !isBlank(i))
                  ? setConfirmDelete(true)
                  : remove()
              }
            >
              <Trash2 />
              Delete section
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {!collapsed && (
        <div className="flex flex-col py-1">
          <SortableContext
            items={section.items.map((i) => i.id)}
            strategy={verticalListSortingStrategy}
          >
            <ul aria-label={`Lines in “${name}”`} className="flex flex-col">
              {section.items.map((item, i) => (
                <EditorLine
                  key={item.id}
                  item={item}
                  index={i}
                  section={section}
                  date={date}
                />
              ))}
            </ul>
          </SortableContext>
          <AddLineInput section={section} date={date} name={name} />
        </div>
      )}

      <SectionTimeDialog
        open={timeOpen}
        onOpenChange={setTimeOpen}
        section={section}
        date={date}
      />
      <CopySectionDialog
        open={copyOpen}
        onOpenChange={setCopyOpen}
        section={section}
        name={name}
      />
      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent className="rounded-lg border-2 border-border ring-0">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-bold">
              Delete “{name}”?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Its {section.items.length}{' '}
              {section.items.length === 1 ? 'line goes' : 'lines go'} too. This
              can’t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmDelete(false)
                remove()
              }}
              className="bg-destructive font-bold text-destructive-foreground hover:bg-destructive/90"
            >
              Delete section
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}

/**
 * "Add a line…" at the end of a section. Enter adds the line and keeps the
 * cursor here for the next one, so a list goes in as fast as it's typed.
 * Pasting several lines adds one line each.
 */
function AddLineInput({
  section,
  date,
  name,
}: {
  section: PlanSection
  date: string
  name: string
}) {
  const queryClient = useQueryClient()
  const ref = useRef<HTMLTextAreaElement>(null)
  const field = addLineField(section.id)
  const box = useAddBox({
    id: field,
    onAdd: (text) => addLines(queryClient, date, section.id, text),
  })
  useFocusTarget(field, ref, box.set)
  useAutoGrow(ref, box.value)

  return (
    <div className="flex items-start gap-1 py-0.5 pr-2">
      <span
        aria-hidden
        className="flex size-10 shrink-0 items-center justify-center text-muted-foreground"
      >
        <Plus className="size-5" />
      </span>
      <textarea
        ref={ref}
        rows={1}
        value={box.value}
        aria-label={`Add a line to “${name}”`}
        placeholder="Add a line…"
        enterKeyHint="enter"
        onChange={(e) => {
          box.set(e.target.value)
          // Pasted lines: add them now, one line each.
          if (e.target.value.includes('\n')) box.commit()
        }}
        onKeyDown={(e) => {
          if (e.nativeEvent.isComposing || e.keyCode === 229) return
          if (e.key === 'Enter') {
            e.preventDefault()
            box.commit()
            return
          }
          // Backspace in the empty box goes back to the last line.
          const last = cachedSection(queryClient, date, section.id)?.items.at(
            -1,
          )
          if (e.key === 'Backspace' && box.value === '' && last) {
            e.preventDefault()
            focusField(last.id, last.text.length)
          }
        }}
        onBlur={() => box.commit()}
        className="field-sizing-content min-h-10 min-w-0 flex-1 resize-none rounded-md bg-transparent px-2 py-2 text-base leading-snug outline-none placeholder:text-muted-foreground focus-visible:bg-muted/60 scroll-mb-[calc(6rem+env(safe-area-inset-bottom))]"
      />
    </div>
  )
}

/** Adds each non-empty line of text to the end of a section. */
function addLines(
  queryClient: QueryClient,
  date: string,
  sectionId: string,
  text: string,
) {
  const section = cachedSection(queryClient, date, sectionId)
  if (!section) return undefined
  let position = section.items.length
  let id: string | undefined
  for (const line of text.split(/\r?\n/)) {
    if (line.trim() === '') continue
    id = uuidv7()
    runOp(queryClient, {
      kind: 'item-add',
      date,
      sectionId,
      id,
      text: line.slice(0, MAX_LINE_LENGTH),
      indent: 0,
      position: position++,
    })
  }
  return id
}
