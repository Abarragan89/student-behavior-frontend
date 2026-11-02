import { createContext, useContext } from 'react'
import { useQuery } from '@tanstack/react-query'
import type {
  QueryClient,
  QueryKey,
  UseQueryResult,
} from '@tanstack/react-query'
import { useToday } from './day'
import { LIVE_REFRESH_MS } from './freshness'
import { enqueueMark } from './mark-queue'
import {
  localDate,
  markCountsQueryOptions,
  markTypesQueryOptions,
} from './marks'
import type { MarkCounts, MarkType, QueuedMark } from './marks'

/**
 * Where a class's marks are read from and sent to. The student grid, the mark
 * buttons and the class ring all go through this, so the same screens work
 * for the signed-in teacher (the default) and for a substitute opening a
 * shared link (sub.ts, which provides its own with MarkSourceProvider).
 */
export type MarkSource = {
  kind: 'teacher' | 'sub'
  /** The day a tap at `now` counts toward, "2026-11-05". */
  dayOf: (now: Date) => string
  /** Where one class's counts for a day are cached, for changing at once. */
  countsKey: (classroomId: string, date: string) => QueryKey
  /** Each student's counts for the day on screen. */
  useCounts: (
    classroomId: string,
    enabled?: boolean,
  ) => UseQueryResult<MarkCounts>
  /** The mark buttons. */
  useMarkTypes: () => UseQueryResult<Array<MarkType>>
  /** Sends a tap or an Undo (see mark-queue.ts). */
  enqueue: (queryClient: QueryClient, mark: QueuedMark) => void
}

/** The teacher's own marks: today, in their own time zone. */
const teacherSource: MarkSource = {
  kind: 'teacher',
  dayOf: localDate,
  countsKey: (classroomId, date) =>
    markCountsQueryOptions(classroomId, date).queryKey,
  useCounts: (classroomId, enabled = true) => {
    const date = useToday()
    return useQuery({
      ...markCountsQueryOptions(classroomId, date),
      enabled,
      // Marks given on the teacher's other devices (or by a sub).
      refetchInterval: LIVE_REFRESH_MS,
    })
  },
  useMarkTypes: () => useQuery(markTypesQueryOptions),
  enqueue: enqueueMark,
}

const MarkSourceContext = createContext<MarkSource>(teacherSource)

export const MarkSourceProvider = MarkSourceContext.Provider

export function useMarkSource() {
  return useContext(MarkSourceContext)
}
