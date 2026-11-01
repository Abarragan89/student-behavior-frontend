import { onlineManager, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { Student } from '#/lib/auth'
import { formatStudentCount } from '#/lib/classroom'
import { enqueueMark } from '#/lib/mark-queue'
import { bumpCounts, localDate } from '#/lib/marks'
import type { MarkType, QueuedMark } from '#/lib/marks'
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

export function targetStudents(target: MarkTarget) {
  return target.kind === 'student' ? [target.student] : target.students
}

/**
 * Giving a mark to one student, some, or the whole class. The cards' counts
 * change at once, and the mark goes into the queue (src/lib/mark-queue.ts),
 * which sends it right away, or when the connection is back. The toast's
 * Undo takes it back from all of them, online or not.
 *
 * Not useMutation: Undo is pressed after the dialog that started it has
 * closed, and must still work. Failures are reported by the queue, which
 * also handles marks restored after the app was closed.
 */
export function useGiveMark(classroomId: string) {
  const queryClient = useQueryClient()

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
      studentIds: targetStudents(target).map((s) => s.id),
      markTypeId: markType.id,
      isPositive: markType.is_positive,
      // The tap's day and time, so a mark sent later still counts when it
      // was given, and an undo just after midnight fixes the right day.
      date: localDate(now),
      occurredAt: now.toISOString(),
    }
    let undone = false

    bumpCounts(queryClient, mark, 1)
    enqueueMark(queryClient, mark)

    function undo() {
      if (undone) return
      undone = true
      bumpCounts(queryClient, mark, -1)
      // Queued after the mark, so it's always sent after it.
      enqueueMark(queryClient, { ...mark, kind: 'undo' })
      toast(`Removed “${markType.name}” from ${words.from}`)
    }

    toast.success(markType.name, {
      description: onlineManager.isOnline()
        ? `Given to ${words.given}`
        : `Given to ${words.given} · saves when you’re back online`,
      duration: UNDO_MS,
      action: { label: 'Undo', onClick: undo },
    })
  }
}

/**
 * The toasts' wording: "Given to Ava Adams" / "3 students" / "all 14
 * students", "Removed … from Ava".
 */
function describe(target: MarkTarget) {
  if (target.kind === 'student') {
    const { first_name: first, last_name: last } = target.student
    return { given: `${first} ${last}`.trim(), from: first }
  }
  const { length } = target.students
  const count = formatStudentCount(length)
  if (target.kind === 'selected') return { given: count, from: count }
  const everyone = length === 1 ? 'the whole class' : `all ${count}`
  return { given: everyone, from: everyone }
}
