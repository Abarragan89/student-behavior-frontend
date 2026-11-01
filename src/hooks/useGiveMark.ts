import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ApiError } from '#/lib/api'
import { meQueryOptions } from '#/lib/auth'
import type { Student } from '#/lib/auth'
import { formatStudentCount } from '#/lib/classroom'
import {
  bumpCounts,
  giveMark,
  giveMarkToClass,
  giveMarkToStudents,
  localDate,
  markTypesQueryOptions,
  undoMark,
  undoMarkBatch,
} from '#/lib/marks'
import type { Mark, MarkType } from '#/lib/marks'

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
 * Giving a mark to one student, some, or the whole class. It's saved right
 * away and the cards' counts change at once, in the query cache; nothing is
 * refetched. The toast's Undo takes it back from all of them.
 *
 * Plain promises and the query cache, not useMutation: Undo is pressed after
 * the dialog that started it has closed, and must still work.
 */
export function useGiveMark(classroomId: string) {
  const queryClient = useQueryClient()

  return function give(target: MarkTarget, markType: MarkType) {
    const words = describe(target)
    // Today's date at the tap, so an undo just after midnight fixes the
    // right day.
    const date = localDate()
    const bump = (studentIds: Array<string>, delta: 1 | -1) =>
      bumpCounts(
        queryClient,
        { classroomId, date, studentIds, isPositive: markType.is_positive },
        delta,
      )
    // The cards showing this mark. For the whole class, replaced by the
    // server's list once it answers.
    let studentIds = targetStudents(target).map((s) => s.id)
    // Undo pressed. Stops a failed save from rolling the counts back twice.
    let undone = false

    bump(studentIds, 1)
    const saved = save(classroomId, target, markType.id)

    async function undo() {
      if (undone) return
      undone = true
      bump(studentIds, -1)

      let done: Saved
      try {
        // The save may still be on its way; undoing needs its id.
        done = await saved
      } catch {
        return // never saved, so there's nothing to delete
      }
      try {
        await done.undo()
        toast(`Removed “${markType.name}” from ${words.from}`)
      } catch (error) {
        console.error('Undoing a mark failed:', error)
        bump(studentIds, 1)
        toast.error(
          `Couldn’t undo. “${markType.name}” is still on ${words.record}.`,
        )
      }
    }

    const toastId = toast.success(markType.name, {
      description: `Given to ${words.given}`,
      duration: UNDO_MS,
      action: { label: 'Undo', onClick: () => void undo() },
    })

    saved.then(
      ({ marks }) => {
        if (undone || target.kind !== 'class') return
        // The roster on screen can be out of date (students added or removed
        // on another device). Make the counts match who the server marked,
        // and fetch the current roster. Nothing to do in the usual case.
        const serverIds = [...new Set(marks.map((m) => m.student_id))]
        const shown = new Set(studentIds)
        const server = new Set(serverIds)
        const added = serverIds.filter((id) => !shown.has(id))
        const missing = studentIds.filter((id) => !server.has(id))
        if (added.length === 0 && missing.length === 0) return
        bump(added, 1)
        bump(missing, -1)
        studentIds = serverIds
        void queryClient.invalidateQueries({
          queryKey: meQueryOptions.queryKey,
        })
      },
      () => {}, // failures are handled below
    )

    saved.catch((error: unknown) => {
      console.error('Giving a mark failed:', error)
      if (error instanceof ApiError && error.status === 404) {
        // A student, the class or the mark type changed somewhere else:
        // resync them.
        void queryClient.invalidateQueries({
          queryKey: meQueryOptions.queryKey,
        })
        void queryClient.invalidateQueries({
          queryKey: markTypesQueryOptions.queryKey,
        })
      }
      if (undone) return // already taken back
      bump(studentIds, -1)
      // Replaces the "given" toast, Undo button and all.
      toast.error(
        `Couldn’t give “${markType.name}” to ${words.failed}. Try again.`,
        {
          id: toastId,
          description: undefined,
          action: undefined,
          duration: UNDO_MS,
        },
      )
    })
  }
}

/** What a save made, and how to take it back. */
type Saved = { marks: Array<Mark>; undo: () => Promise<void> }

/**
 * One request for any target. One student: a single mark, undone by its id.
 * Several or the whole class: a batch, undone all at once by the batch id.
 */
async function save(
  classroomId: string,
  target: MarkTarget,
  markTypeId: string,
): Promise<Saved> {
  if (target.kind === 'student') {
    const mark = await giveMark(classroomId, target.student.id, markTypeId)
    return { marks: [mark], undo: () => undoMark(mark.id) }
  }
  const batch =
    target.kind === 'selected'
      ? await giveMarkToStudents(
          classroomId,
          target.students.map((s) => s.id),
          markTypeId,
        )
      : await giveMarkToClass(classroomId, markTypeId)
  return { marks: batch.marks, undo: () => undoMarkBatch(batch.batch_id) }
}

/**
 * The toasts' wording: "Given to Ava Adams" / "3 students" / "all 14
 * students", "Removed … from Ava", "Couldn’t give … to the class".
 */
function describe(target: MarkTarget) {
  if (target.kind === 'student') {
    const { first_name: first, last_name: last } = target.student
    return {
      given: `${first} ${last}`.trim(),
      from: first,
      failed: first,
      record: `${first}’s record`,
    }
  }
  const { length } = target.students
  const count = formatStudentCount(length)
  if (target.kind === 'selected') {
    return { given: count, from: count, failed: count, record: 'their records' }
  }
  const everyone = length === 1 ? 'the whole class' : `all ${count}`
  return {
    given: everyone,
    from: everyone,
    failed: 'the class',
    record: 'their records',
  }
}
