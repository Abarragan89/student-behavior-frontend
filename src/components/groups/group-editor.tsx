import { useRef, useState } from 'react'
import type { ReactNode } from 'react'
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  pointerWithin,
  rectIntersection,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import type {
  Announcements,
  CollisionDetection,
  DragEndEvent,
  DragStartEvent,
} from '@dnd-kit/core'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Check, Plus, RotateCcw, Shuffle, X } from 'lucide-react'
import { toast } from 'sonner'
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
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'
import { ApiError } from '#/lib/api'
import type { Student } from '#/lib/auth'
import {
  MAX_GROUPS,
  MAX_GROUP_NAME_LENGTH,
  cacheGroups,
  draftsFrom,
  groupColorClass,
  groupsQueryOptions,
  isGroupsConflict,
  makeRandomGroups,
  newGroupDraft,
  sameLayout,
  saveBody,
  saveGroups,
} from '#/lib/groups'
import type { ClassGroups, GroupDraft, ShufflePlan } from '#/lib/groups'
import { useOnline } from '#/lib/online'
import { OfflineNote } from '#/components/offline-note'
import { ShuffleSheet } from './shuffle-sheet'

/** The drop target for "Not in a group". Never a group's id (those are UUIDs). */
const TRAY = 'ungrouped'

const linkClass = 'h-9 px-2 text-base font-bold'
const boxClass =
  'h-9 rounded-lg border-2 border-border bg-card px-2.5 text-base font-bold'

// Pick first, drag second: a tap always picks, so a press has to be held
// still a moment (touch) or moved a few pixels (mouse) to start a drag. On
// touch, moving during the hold scrolls the page as usual.
const SENSOR_OPTIONS = {
  mouse: { activationConstraint: { distance: 6 } },
  touch: { activationConstraint: { delay: 250, tolerance: 8 } },
}

// Where the pointer is, or else whatever the chip overlaps most.
const collision: CollisionDetection = (args) => {
  const hits = pointerWithin(args)
  return hits.length > 0 ? hits : rectIntersection(args)
}

/**
 * The Groups tab while editing: everyone not in a group at the top, then a
 * panel per group with its name, who's in it, and a remove button. Nothing is
 * saved until Save; Cancel asks before throwing changes away.
 *
 * Moving students: tap one or more to pick them, then pick where they go in
 * the bar that appears at the bottom (works on phones, keyboards and screen
 * readers). Or drag one onto a panel (a short hold on touch).
 *
 * Shuffle deals the whole class into groups at random (see ShuffleSheet).
 * Reset team points starts every group's points at 0 when saved.
 */
export function GroupEditor({
  classroomId,
  data,
  students,
  labelFor,
  startWithShuffle,
  onClose,
}: {
  classroomId: string
  /** The saved groups the edit starts from. */
  data: ClassGroups
  /** The roster, in its order. */
  students: Array<Student>
  /** The name on a student's card ("Sam L." when two share it). */
  labelFor: (student: Student) => string
  /** Open Random groups straight away. */
  startWithShuffle: boolean
  /** Saved or cancelled. */
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const online = useOnline()

  // The saved copy the edit is based on: its version is what a save says it
  // was made from.
  const [base, setBase] = useState(data)
  // What the draft started as, to tell whether Cancel throws anything away.
  // A class without groups starts with two empty ones to fill.
  const [start, setStart] = useState(() =>
    data.groups.length > 0 || startWithShuffle
      ? draftsFrom(data)
      : twoEmptyGroups(),
  )
  const [drafts, setDrafts] = useState(start)
  const [reset, setReset] = useState(false)
  const [picked, setPicked] = useState<ReadonlySet<string>>(() => new Set())
  const [dragging, setDragging] = useState<string | null>(null)
  const [shuffleOpen, setShuffleOpen] = useState(startWithShuffle)
  // Each opening starts the sheet fresh, with the draft's group count.
  const [shuffleKey, setShuffleKey] = useState(0)
  const [discardOpen, setDiscardOpen] = useState(false)
  const [removing, setRemoving] = useState<Array<string> | null>(null)
  const [conflict, setConflict] = useState<ClassGroups | null>(null)
  const nameRefs = useRef(new Map<string, HTMLInputElement>())

  const byId = new Map(students.map((s) => [s.id, s]))
  const groupOf = new Map<string, string>()
  for (const d of drafts) for (const id of d.studentIds) groupOf.set(id, d.id)
  const tray = students.filter((s) => !groupOf.has(s.id))
  const membersOf = (d: GroupDraft) => {
    const ids = new Set(d.studentIds)
    return students.filter((s) => ids.has(s.id))
  }
  const hadPoints = base.groups.some(
    (g) => g.score.positive + g.score.negative > 0,
  )
  const changed = reset || !sameDrafts(start, drafts)

  // ---------- Changing the draft ----------

  /** Moves students into a group, or out of every group (to = null). */
  function move(ids: Array<string>, to: string | null) {
    const moving = new Set(ids)
    setDrafts((prev) =>
      prev.map((d) => {
        const kept = d.studentIds.filter((id) => !moving.has(id))
        if (d.id === to) return { ...d, studentIds: [...kept, ...ids] }
        return kept.length === d.studentIds.length
          ? d
          : { ...d, studentIds: kept }
      }),
    )
    setPicked(new Set())
  }

  function togglePick(id: string) {
    setPicked((prev) => {
      const next = new Set(prev)
      if (!next.delete(id)) next.add(id)
      return next
    })
  }

  /** A new group at the end, holding `ids` (the picked students, or none). */
  function addGroup(ids: Array<string> = []) {
    const group = newGroupDraft(drafts)
    const moving = new Set(ids)
    setDrafts((prev) => [
      ...prev.map((d) => ({
        ...d,
        studentIds: d.studentIds.filter((id) => !moving.has(id)),
      })),
      { ...group, studentIds: ids },
    ])
    setPicked(new Set())
    // Ready to name it, with a mouse. Not on touch: the keyboard would pop up
    // over the groups.
    if (window.matchMedia('(pointer: fine)').matches) {
      requestAnimationFrame(() => nameRefs.current.get(group.id)?.select())
    }
  }

  function rename(id: string, name: string) {
    setDrafts((prev) => prev.map((d) => (d.id === id ? { ...d, name } : d)))
  }

  function removeGroup(id: string) {
    // Its members go back to "Not in a group".
    setDrafts((prev) => prev.filter((d) => d.id !== id))
  }

  function shuffle(plan: ShufflePlan, resetPoints: boolean) {
    setDrafts((prev) => makeRandomGroups(students, plan, prev))
    setPicked(new Set())
    if (resetPoints) setReset(true)
  }

  // ---------- Saving ----------

  const save = useMutation({
    mutationFn: (version: number) =>
      saveGroups(classroomId, saveBody(version, drafts, reset)),
    onSuccess: finish,
    onError: async (error) => {
      if (isGroupsConflict(error)) {
        // Saved on another device since this edit began, or this device's
        // own save went through but its answer was lost.
        const fresh = await queryClient
          .fetchQuery({ ...groupsQueryOptions(classroomId), staleTime: 0 })
          .catch(() => null)
        if (fresh && !reset && sameLayout(fresh, drafts)) finish(fresh)
        else if (fresh) setConflict(fresh)
        else toast.error('Couldn’t save the groups', { description: retryNote })
        return
      }
      console.error('Saving the groups failed:', error)
      toast.error('Couldn’t save the groups', {
        description:
          error instanceof ApiError && error.status === 404
            ? 'This class was removed or archived.'
            : error instanceof ApiError && error.status === 403
              ? 'You can no longer change this class.'
              : retryNote,
      })
    },
  })

  function finish(saved: ClassGroups) {
    cacheGroups(queryClient, classroomId, saved)
    toast.success('Groups saved')
    onClose()
  }

  function requestSave() {
    // Removing a group removes its points; say so first (not when they're
    // being reset anyway).
    const lost = reset
      ? []
      : base.groups.filter(
          (g) =>
            g.score.positive + g.score.negative > 0 &&
            !drafts.some((d) => d.id === g.id),
        )
    if (lost.length > 0) setRemoving(lost.map((g) => g.name))
    else save.mutate(base.version)
  }

  function requestCancel() {
    if (changed) setDiscardOpen(true)
    else onClose()
  }

  // ---------- Dragging ----------

  const sensors = useSensors(
    useSensor(MouseSensor, SENSOR_OPTIONS.mouse),
    useSensor(TouchSensor, SENSOR_OPTIONS.touch),
  )
  const nameOf = (id: unknown) => {
    const s = byId.get(String(id))
    return s ? labelFor(s) : 'Student'
  }
  const placeOf = (id: unknown) =>
    id === TRAY
      ? 'Not in a group'
      : (drafts.find((d) => d.id === id)?.name ?? 'a group')
  // Read out with names, not ids.
  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up ${nameOf(active.id)}.`,
    onDragOver: ({ active, over }) =>
      over
        ? `${nameOf(active.id)} is over ${placeOf(over.id)}.`
        : `${nameOf(active.id)} is not over a group.`,
    onDragEnd: ({ active, over }) =>
      over
        ? `Moved ${nameOf(active.id)} to ${placeOf(over.id)}.`
        : `${nameOf(active.id)} was put back.`,
    onDragCancel: ({ active }) => `${nameOf(active.id)} was put back.`,
  }

  function onDragStart({ active }: DragStartEvent) {
    setDragging(String(active.id))
    // Close the phone keyboard if a name was being typed.
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur()
    }
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    setDragging(null)
    if (!over) return
    const id = String(active.id)
    // Dragging a picked student takes the others picked along.
    const ids = picked.has(id) ? [...picked] : [id]
    move(ids, over.id === TRAY ? null : String(over.id))
  }

  const pickedIds = [...picked].filter((id) => byId.has(id))
  const draggingStudent = dragging ? byId.get(dragging) : undefined

  return (
    <section aria-label="Edit groups" className="flex flex-col gap-3">
      {/* The editing bar, in place of the roster's toolbar. */}
      <div className="mb-1 flex min-h-9 items-center justify-between gap-2">
        <h2 className="truncate text-base font-bold sm:text-lg">Edit groups</h2>
        <div className="flex items-center gap-1 sm:gap-2">
          <Button variant="link" onClick={requestCancel} className={linkClass}>
            Cancel
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setShuffleKey((k) => k + 1)
              setShuffleOpen(true)
            }}
            disabled={students.length === 0}
            aria-label="Random groups"
            title="Random groups"
            className={boxClass}
          >
            <Shuffle className="size-5" aria-hidden />
            <span className="max-sm:hidden">Shuffle</span>
          </Button>
          <Button
            onClick={requestSave}
            disabled={!online || save.isPending}
            aria-busy={save.isPending}
            className="relative h-9 rounded-lg border-2 border-border px-4 text-base font-bold shadow-md active:scale-95 motion-reduce:transition-none"
          >
            <span className={cn(save.isPending && 'invisible')}>Save</span>
            {save.isPending && (
              <Spinner
                aria-label="Saving groups"
                className="absolute inset-0 m-auto size-4"
              />
            )}
          </Button>
        </div>
      </div>

      <p className="text-sm font-medium text-muted-foreground">
        Tap students to pick them, then choose where they go. Or drag them.
      </p>
      <OfflineNote action="save groups" />

      <DndContext
        sensors={sensors}
        collisionDetection={collision}
        accessibility={{ announcements }}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragCancel={() => setDragging(null)}
      >
        <DropZone
          id={TRAY}
          className="border-dashed bg-muted/40"
          label="Not in a group"
        >
          <PanelHeading>
            Not in a group
            <span className="ml-1.5 font-medium text-muted-foreground">
              {tray.length}
            </span>
          </PanelHeading>
          {tray.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Everyone’s in a group.
            </p>
          ) : (
            <Chips>
              {tray.map((s) => (
                <StudentChip
                  key={s.id}
                  student={s}
                  label={labelFor(s)}
                  picked={picked.has(s.id)}
                  onToggle={() => togglePick(s.id)}
                />
              ))}
            </Chips>
          )}
        </DropZone>

        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {drafts.map((d, i) => {
            const members = membersOf(d)
            const points = d.score.positive + d.score.negative
            return (
              <li key={d.id} className="min-w-0">
                <DropZone id={d.id} label={d.name || `Group ${i + 1}`}>
                  <div className="flex items-center gap-2">
                    <span
                      aria-hidden
                      className={cn(
                        'size-5 shrink-0 rounded-full border-2 border-border',
                        groupColorClass(d.color),
                      )}
                    />
                    <input
                      ref={(el) => {
                        if (el) nameRefs.current.set(d.id, el)
                        else nameRefs.current.delete(d.id)
                      }}
                      value={d.name}
                      onChange={(e) => rename(d.id, e.target.value)}
                      maxLength={MAX_GROUP_NAME_LENGTH}
                      placeholder={`Group ${i + 1}`}
                      aria-label={`Name of group ${i + 1}`}
                      enterKeyHint="done"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') e.currentTarget.blur()
                      }}
                      className="h-9 min-w-0 flex-1 rounded-md border-2 border-transparent bg-transparent px-1.5 text-base font-bold outline-none hover:border-border/30 focus-visible:border-border focus-visible:bg-card"
                    />
                    <button
                      type="button"
                      onClick={() => removeGroup(d.id)}
                      aria-label={`Remove ${d.name || `group ${i + 1}`}`}
                      title="Remove group"
                      className="flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-4 focus-visible:ring-ring"
                    >
                      <X className="size-5" aria-hidden />
                    </button>
                  </div>
                  <p className="text-xs font-medium text-muted-foreground">
                    {members.length === 1
                      ? '1 student'
                      : `${members.length} students`}
                    {reset && hadPoints
                      ? ' · team points 0 after you save'
                      : points > 0
                        ? ` · team points +${d.score.positive} −${d.score.negative}`
                        : ''}
                  </p>
                  {members.length === 0 ? (
                    <p className="rounded-lg border-2 border-dashed border-border/40 px-3 py-3 text-center text-sm text-muted-foreground">
                      Pick students, then choose this group.
                    </p>
                  ) : (
                    <Chips>
                      {members.map((s) => (
                        <StudentChip
                          key={s.id}
                          student={s}
                          label={labelFor(s)}
                          picked={picked.has(s.id)}
                          onToggle={() => togglePick(s.id)}
                        />
                      ))}
                    </Chips>
                  )}
                </DropZone>
              </li>
            )
          })}
          {drafts.length < MAX_GROUPS && (
            <li>
              <button
                type="button"
                onClick={() => addGroup()}
                className="flex h-full min-h-28 w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-card/50 text-base font-bold outline-none hover:bg-muted focus-visible:ring-4 focus-visible:ring-ring"
              >
                <Plus className="size-5" aria-hidden />
                New group
              </button>
            </li>
          )}
        </ul>

        <DragOverlay dropAnimation={null}>
          {draggingStudent && (
            <span
              className={cn(
                chipClass,
                'shadow-lg',
                picked.size > 1 && picked.has(draggingStudent.id) && 'pr-2',
              )}
            >
              {labelFor(draggingStudent)}
              {picked.size > 1 && picked.has(draggingStudent.id) && (
                <span className="rounded-full bg-primary px-1.5 text-xs text-primary-foreground">
                  +{picked.size - 1}
                </span>
              )}
            </span>
          )}
        </DragOverlay>
      </DndContext>

      {/* Team points: start them all over (on Save). */}
      {hadPoints && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-2 text-sm">
          {reset ? (
            <>
              <p className="font-medium">
                Team points will start at 0 when you save.
              </p>
              <Button
                variant="link"
                onClick={() => setReset(false)}
                className="h-auto p-0 text-sm font-bold"
              >
                Keep points
              </Button>
            </>
          ) : (
            <Button
              variant="outline"
              onClick={() => setReset(true)}
              className={cn(boxClass, 'text-sm')}
            >
              <RotateCcw className="size-4" aria-hidden />
              Reset team points
            </Button>
          )}
        </div>
      )}

      {/* Where the picked students go. Sticks to the bottom of the screen,
          above the phone's tab bar, while any are picked. */}
      {pickedIds.length > 0 && (
        <div
          role="region"
          aria-label="Move picked students"
          className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-20 flex flex-col gap-2 rounded-xl border-2 border-border bg-card p-2 shadow-lg md:bottom-4"
        >
          <div className="flex items-center justify-between gap-2 px-1">
            <p role="status" className="text-base font-bold">
              Move{' '}
              {pickedIds.length === 1
                ? nameOf(pickedIds[0])
                : `${pickedIds.length} students`}{' '}
              to:
            </p>
            <Button
              variant="link"
              onClick={() => setPicked(new Set())}
              className="h-8 px-1 text-sm font-bold"
            >
              Clear
            </Button>
          </div>
          <div className="-mx-2 flex gap-2 overflow-x-auto px-2 pb-1">
            {drafts.map((d, i) => (
              <button
                key={d.id}
                type="button"
                onClick={() => move(pickedIds, d.id)}
                className={moveClass}
              >
                <span
                  aria-hidden
                  className={cn(
                    'size-3.5 shrink-0 rounded-full border border-border',
                    groupColorClass(d.color),
                  )}
                />
                {d.name || `Group ${i + 1}`}
              </button>
            ))}
            {drafts.length < MAX_GROUPS && (
              <button
                type="button"
                onClick={() => addGroup(pickedIds)}
                className={moveClass}
              >
                <Plus className="size-4" aria-hidden />
                New group
              </button>
            )}
            {pickedIds.some((id) => groupOf.has(id)) && (
              <button
                type="button"
                onClick={() => move(pickedIds, null)}
                className={cn(moveClass, 'border-dashed')}
              >
                No group
              </button>
            )}
          </div>
        </div>
      )}

      <ShuffleSheet
        key={shuffleKey}
        open={shuffleOpen}
        onOpenChange={setShuffleOpen}
        studentCount={students.length}
        groupCount={drafts.length}
        hasPoints={hadPoints && !reset}
        onShuffle={shuffle}
      />

      {/* Cancel with changes. */}
      <AlertDialog open={discardOpen} onOpenChange={setDiscardOpen}>
        <AlertDialogContent className="rounded-lg border-2 border-border ring-0">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-bold">
              Discard your changes?
            </AlertDialogTitle>
            <AlertDialogDescription>
              The groups stay as they were before you started editing.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <AlertDialogAction
              onClick={onClose}
              className="bg-destructive font-bold text-destructive-foreground hover:bg-destructive/90"
            >
              Discard
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Removing groups that have team points. */}
      <AlertDialog
        open={removing !== null}
        onOpenChange={(open) => !open && setRemoving(null)}
      >
        <AlertDialogContent className="rounded-lg border-2 border-border ring-0">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-bold wrap-break-word">
              Remove {listNames(removing ?? [])}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {(removing?.length ?? 0) === 1 ? 'Its' : 'Their'} team points will
              be removed too. The students keep their own marks.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Go back</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setRemoving(null)
                save.mutate(base.version)
              }}
              className="bg-destructive font-bold text-destructive-foreground hover:bg-destructive/90"
            >
              Remove and save
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Saved on another device while this edit was open. */}
      <AlertDialog
        open={conflict !== null}
        onOpenChange={(open) => !open && setConflict(null)}
      >
        <AlertDialogContent className="rounded-lg border-2 border-border ring-0">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-bold">
              These groups were just changed
            </AlertDialogTitle>
            <AlertDialogDescription>
              Someone saved this class’s groups on another device while you were
              editing. Load their groups, or save yours in their place.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                if (!conflict) return
                const theirs = draftsFrom(conflict)
                setBase(conflict)
                // Their groups are the new starting point: nothing to
                // discard until the teacher changes them.
                setStart(theirs)
                setDrafts(theirs)
                setReset(false)
                setPicked(new Set())
              }}
            >
              Load theirs
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!conflict) return
                setBase(conflict)
                setConflict(null)
                save.mutate(conflict.version)
              }}
              className="font-bold"
            >
              Save mine
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}

const retryNote = 'Check your connection and try again.'

const chipClass =
  'inline-flex h-9 max-w-full items-center gap-1.5 rounded-full border-2 border-border bg-card px-3 text-sm font-bold'
const moveClass =
  'flex h-10 shrink-0 items-center gap-2 rounded-lg border-2 border-border bg-card px-3 text-sm font-bold whitespace-nowrap outline-none hover:bg-muted focus-visible:ring-4 focus-visible:ring-ring active:scale-95 motion-reduce:transition-none'

/** A panel students can be dropped on: a group, or "Not in a group". */
function DropZone({
  id,
  label,
  className,
  children,
}: {
  id: string
  label: string
  className?: string
  children: ReactNode
}) {
  const { setNodeRef, isOver } = useDroppable({ id })
  return (
    <section
      ref={setNodeRef}
      aria-label={label}
      className={cn(
        'flex h-full flex-col gap-2 rounded-xl border-2 border-border bg-card p-3 shadow-md transition-colors motion-reduce:transition-none',
        isOver && 'bg-primary/10 ring-4 ring-ring',
        className,
      )}
    >
      {children}
    </section>
  )
}

function PanelHeading({ children }: { children: ReactNode }) {
  return <h3 className="text-base font-bold">{children}</h3>
}

function Chips({ children }: { children: ReactNode }) {
  return <ul className="flex flex-wrap gap-1.5">{children}</ul>
}

/**
 * One student in the editor: tap to pick (or unpick), or drag. Not given
 * dnd-kit's own attributes, so it stays a plain toggle button for screen
 * readers, which use picking instead of dragging.
 */
function StudentChip({
  student,
  label,
  picked,
  onToggle,
}: {
  student: Student
  label: string
  picked: boolean
  onToggle: () => void
}) {
  const { setNodeRef, listeners, isDragging } = useDraggable({
    id: student.id,
  })
  return (
    <li className="min-w-0">
      <button
        ref={setNodeRef}
        type="button"
        {...listeners}
        onClick={onToggle}
        aria-pressed={picked}
        title={`${student.first_name} ${student.last_name}`.trim()}
        className={cn(
          chipClass,
          // Long-press drags, so no text selection or iOS callout. Not
          // touch-none: swiping across chips still scrolls the page.
          'touch-manipulation outline-none select-none [-webkit-touch-callout:none] focus-visible:ring-4 focus-visible:ring-ring',
          picked
            ? 'border-primary bg-primary text-primary-foreground'
            : 'hover:bg-muted',
          isDragging && 'opacity-40',
        )}
      >
        {picked && (
          <Check className="size-3.5 shrink-0" strokeWidth={4} aria-hidden />
        )}
        <span className="truncate">{label}</span>
      </button>
    </li>
  )
}

/** Two empty groups, for a class that has none yet. */
function twoEmptyGroups() {
  const first = newGroupDraft([])
  return [first, newGroupDraft([first])]
}

/** "Sharks", "Sharks and Owls", "Sharks, Owls and Foxes". */
function listNames(names: Array<string>) {
  if (names.length <= 1) return names[0] ?? ''
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

/** Whether two drafts have the same groups, names, colors and members. */
function sameDrafts(a: Array<GroupDraft>, b: Array<GroupDraft>) {
  if (a.length !== b.length) return false
  return a.every((d, i) => {
    const e = b[i]
    const members = new Set(e.studentIds)
    return (
      d.id === e.id &&
      d.name === e.name &&
      d.color === e.color &&
      d.studentIds.length === members.size &&
      d.studentIds.every((id) => members.has(id))
    )
  })
}
