import { useMutationState } from '@tanstack/react-query'
import { LESSON_PLAN_MUTATION_KEY } from '#/lib/lesson-plans'
import type { Op } from '#/lib/lesson-plans'
import { countUnsent } from '#/lib/mark-queue'
import { MARK_MUTATION_KEY } from '#/lib/marks'
import type { QueuedMark } from '#/lib/marks'
import { SUB_MARK_KEY, SUB_PLAN_KEY } from '#/lib/sub'

/**
 * What's waiting to be sent: students' marks, and lesson plan lines checked
 * or unchecked. Other lesson plan changes aren't counted: they need a
 * connection, and counting them would flash "Syncing" while typing. A
 * substitute's (sub.ts) are counted the same way.
 */
export function useUnsentChanges() {
  const marks = countUnsent(
    useMutationState({
      filters: {
        predicate: (m) => isMarkKey(m.options.mutationKey?.[0]),
        status: 'pending',
      },
      select: (mutation) => mutation.state.variables as QueuedMark,
    }),
  )
  const checked = useMutationState({
    filters: {
      predicate: (m) => {
        const key = m.options.mutationKey
        return (
          (key?.[0] === LESSON_PLAN_MUTATION_KEY[0] && key[1] === 'done') ||
          key?.[0] === SUB_PLAN_KEY[0]
        )
      },
      status: 'pending',
    },
    select: (mutation) =>
      (mutation.state.variables as Extract<Op, { kind: 'done' }>).id,
  })
  // A line checked and unchecked again is one change.
  const checkmarks = new Set(checked).size
  return { marks, checkmarks, total: marks + checkmarks }
}

/** "3 marks and 2 checkmarks", "1 mark", "2 checkmarks". */
export function describeUnsent({
  marks,
  checkmarks,
}: {
  marks: number
  checkmarks: number
}) {
  const parts = []
  if (marks > 0) parts.push(`${marks} ${marks === 1 ? 'mark' : 'marks'}`)
  if (checkmarks > 0) {
    parts.push(`${checkmarks} ${checkmarks === 1 ? 'checkmark' : 'checkmarks'}`)
  }
  return parts.join(' and ')
}

function isMarkKey(first: unknown) {
  return first === MARK_MUTATION_KEY[0] || first === SUB_MARK_KEY[0]
}
