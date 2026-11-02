import { useQuery } from '@tanstack/react-query'
import { useToday } from '#/lib/day'
import { markCountsQueryOptions } from '#/lib/marks'
import type { Today } from '#/components/student-card'

/**
 * Today's marks for the whole class, added up, for its ring. The same
 * request as the student cards' counts, so it's only fetched once. Null
 * until it loads, and while `enabled` is false (a class switch under way).
 */
export function useClassToday(classroomId: string, enabled = true): Today {
  const date = useToday()
  const counts = useQuery({
    ...markCountsQueryOptions(classroomId, date),
    enabled,
  })
  if (!counts.data || !enabled) return null
  return counts.data.students.reduce(
    (sum, s) => ({
      positive: sum.positive + s.positive,
      negative: sum.negative + s.negative,
    }),
    { positive: 0, negative: 0 },
  )
}
