import { onlineManager, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { Student } from '#/lib/auth'
import { formatStudentCount } from '#/lib/classroom'
import { bumpGroupScore } from '#/lib/groups'
import type { StudentGroup } from '#/lib/groups'
import { openMarkNote } from '#/lib/mark-note'
import { useMarkSource } from '#/lib/mark-source'
import { bumpCounts } from '#/lib/marks'
import type { MarkType, QueuedMark } from '#/lib/marks'
import { playMarkSound } from '#/lib/sounds'
import { currentSpace } from '#/lib/space-state'
import { uuidv7 } from '#/lib/uuid'

/** How long the toast, and so the Undo button, stays up. */
const UNDO_MS = 5000

/** Who a mark is for. */
export type MarkTarget =
  | { kind: 'student'; student: Student }
  | { kind: 'selected'; students: Array<Student> }
  // Everyone in the class. The backend looks up the roster itself; these are
  // the students on screen, whose cards change at once.
  | { kind: 'class'; students: Array<Student> }
  // A whole group: each member on screen gets the mark, and the group a
  // point on its team score.
  | { kind: 'group'; group: StudentGroup; students: Array<Student> }

export function targetStudents(target: MarkTarget) {
  return target.kind === 'student' ? [target.student] : target.students
}

/**
 * Giving a mark to one student, some, a group, or the whole class. The cards'
 * counts (and a group's team points) change at once, and the mark goes into
 * the queue (src/lib/mark-queue.ts), which sends it right away, or when the
 * connection is back. The toast's Undo takes it back from all of them, online
 * or not.
 *
 * Not useMutation: Undo is pressed after the dialog that started it has
 * closed, and must still work. Failures are reported by the queue, which
 * also handles marks restored after the app was closed.
 */
export function useGiveMark(classroomId: string) {
  const queryClient = useQueryClient()
  // The teacher's own queue, or a substitute's (see mark-source.tsx).
  const source = useMarkSource()

  return function give(target: MarkTarget, markType: MarkType) {
    const words = describe(target)
    const now = new Date()
    const mark: QueuedMark = {
      kind: 'give',
      target: target.kind,
      // Picked here, so Undo works before the server has answered (or seen
      // it), and sending it twice saves it once.
      id: uuidv7(now.getTime()),
      classroomId,
      groupId: target.kind === 'group' ? target.group.id : undefined,
      studentIds: targetStudents(target).map((s) => s.id),
      markTypeId: markType.id,
      isPositive: markType.is_positive,
      // The tap's day and time, so a mark sent later still counts when it
      // was given, and an undo just after midnight fixes the right day.
      date: source.dayOf(now),
      occurredAt: now.toISOString(),
    }
    const countsKey = source.countsKey(classroomId, mark.date)
    const groupsKey = source.groupsKey(classroomId)
    let undone = false

    function bumpGroup(delta: 1 | -1) {
      if (!mark.groupId) return
      bumpGroupScore(
        queryClient,
        groupsKey,
        mark.groupId,
        mark.isPositive,
        delta,
      )
    }

    bumpCounts(queryClient, mark, 1, countsKey)
    bumpGroup(1)
    source.enqueue(queryClient, mark)
    // Here, not when it's sent: once per tap, even for the whole class, and
    // never again for a mark sent later or resent. Undo makes none.
    playMarkSound(markType.is_positive)

    function undo() {
      if (undone) return
      undone = true
      bumpCounts(queryClient, mark, -1, countsKey)
      bumpGroup(-1)
      // Queued after the mark, so it's always sent after it.
      source.enqueue(queryClient, { ...mark, kind: 'undo' })
      toast(`Removed “${markType.name}” from ${words.from}`)
    }

    const online = onlineManager.isOnline()
    // A mark for one student can get a note, positive or negative. It
    // needs a connection (notes are never saved on the device), so offline
    // it's added later from the student's page.
    const student = target.kind === 'student' ? target.student : null
    const canAddNote = student && online
    // Space now, as the queued mark records it, in case the teacher switches
    // spaces before tapping Add note.
    const space = currentSpace()

    toast.success(markType.name, {
      description: online
        ? `Given to ${words.given}`
        : `Given to ${words.given} · saves when you’re back online`,
      duration: UNDO_MS,
      // Sonner's second button, grey, left of Undo. It closes the toast: a
      // teacher adding a note means to keep the mark.
      cancel: canAddNote
        ? {
            label: 'Add note',
            onClick: () =>
              openMarkNote({
                kind: source.kind,
                markId: mark.id,
                studentId: student.id,
                studentName: words.from,
                markName: markType.name,
                note: '',
                space,
              }),
          }
        : undefined,
      action: { label: 'Undo', onClick: undo },
    })
  }
}

/**
 * The toasts' wording: "Given to Ava Adams" / "3 students" / "Sharks (4
 * students)" / "all 14 students", "Removed … from Ava".
 */
function describe(target: MarkTarget) {
  if (target.kind === 'student') {
    const { first_name: first, last_name: last } = target.student
    return { given: `${first} ${last}`.trim(), from: first }
  }
  const { length } = target.students
  const count = formatStudentCount(length)
  if (target.kind === 'selected') return { given: count, from: count }
  if (target.kind === 'group') {
    const { name } = target.group
    return { given: `${name} (${count})`, from: name }
  }
  const everyone = length === 1 ? 'the whole class' : `all ${count}`
  return { given: everyone, from: everyone }
}
