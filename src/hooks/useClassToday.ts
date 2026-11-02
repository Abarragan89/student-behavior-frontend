import { useMarkSource } from '#/lib/mark-source'
import type { Today } from '#/components/student-card'

/**
 * Today's marks for the whole class, added up, for its ring. The same
 * request as the student cards' counts, so it's only fetched once. Null
 * until it loads, and while `enabled` is false (a class switch under way).
 */
export function useClassToday(classroomId: string, enabled = true): Today {
  const counts = useMarkSource().useCounts(classroomId, enabled)
  if (!counts.data || !enabled) return null
  return counts.data.students.reduce(
    (sum, s) => ({
      positive: sum.positive + s.positive,
      negative: sum.negative + s.negative,
    }),
    { positive: 0, negative: 0 },
  )
}
