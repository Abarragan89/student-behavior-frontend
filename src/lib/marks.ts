import { queryOptions } from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'
import { ApiError, apiDelete, apiGet, apiPost } from './api'

// Behavior marks. A mark type is one of the teacher's buttons ("Helping
// others", "Off task"); a mark is one tap of it for one student. Every teacher
// starts with three positive and three negative types.

export type MarkType = {
  id: string
  name: string
  is_positive: boolean // fixed when the type is made
  created_at: string
}

export type Mark = {
  id: string // keep it: Undo deletes the mark by this id
  student_id: string
  classroom_id: string
  mark_type_id: string
  name: string // the type's current name
  is_positive: boolean
  created_at: string // UTC; new Date(created_at) shows local time
}

/** How many marks each student got in a class on one day. */
export type MarkCounts = {
  date: string
  timezone: string
  // Only students with marks that day; anyone missing has 0 and 0.
  students: Array<{ student_id: string; positive: number; negative: number }>
}

/** The teacher's time zone, e.g. "America/Chicago". The backend counts days in it. */
export function timeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone
}

/**
 * The local calendar date as "YYYY-MM-DD". Not toISOString(), which gives the
 * UTC date: a day ahead in the evening in the Americas.
 */
export function localDate(d: Date = new Date()) {
  return d.toLocaleDateString('en-CA')
}

// Active types only, oldest first: the starter set, then the teacher's own.
export const markTypesQueryOptions = queryOptions({
  queryKey: ['mark-types'],
  queryFn: () => apiGet<Array<MarkType>>('/mark-types'),
  staleTime: 5 * 60 * 1000,
})

/** Each student's + / − counts in a class on one local date. */
export function markCountsQueryOptions(classroomId: string, date: string) {
  return queryOptions({
    queryKey: ['mark-counts', classroomId, date],
    queryFn: () => {
      const params = new URLSearchParams({ date, tz: timeZone() })
      return apiGet<MarkCounts>(
        `/classrooms/${encodeURIComponent(classroomId)}/marks/counts?${params}`,
      )
    },
    // Every tap and undo here edits this cache directly, so it stays right
    // without refetching. Refetched only when old (another device, a new day).
    staleTime: 5 * 60 * 1000,
    // A missing or failing route just means no badges; don't keep retrying.
    retry: (failureCount, error) =>
      !(error instanceof ApiError && error.status < 500) && failureCount < 1,
  })
}

// The server stamps the time; only the type is sent.
export function giveMark(
  classroomId: string,
  studentId: string,
  markTypeId: string,
) {
  return apiPost<Mark>(
    `/classrooms/${encodeURIComponent(classroomId)}/students/${encodeURIComponent(studentId)}/marks`,
    { mark_type_id: markTypeId },
  )
}

/** Undo for a mis-tap. Already gone (404) counts as undone. */
export async function undoMark(markId: string) {
  try {
    await apiDelete(`/marks/${encodeURIComponent(markId)}`)
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return
    throw error
  }
}

// Many students at once: one mark each, made together as a batch, so Undo
// takes them all back in one call. All or nothing: if any picked student has
// left the class (404), nobody gets it.

/** What POST /classrooms/{id}/mark-batches answers. */
export type MarkBatch = {
  batch_id: string // Undo deletes the whole batch by this id
  marks: Array<Mark> // one per student who got it
}

/**
 * One mark for every student in the class. No student ids are sent: the
 * backend marks everyone enrolled right now.
 */
export function giveMarkToClass(classroomId: string, markTypeId: string) {
  return apiPost<MarkBatch>(
    `/classrooms/${encodeURIComponent(classroomId)}/mark-batches`,
    { mark_type_id: markTypeId, all_students: true },
  )
}

/** One mark for each of the picked students. */
export function giveMarkToStudents(
  classroomId: string,
  studentIds: Array<string>,
  markTypeId: string,
) {
  return apiPost<MarkBatch>(
    `/classrooms/${encodeURIComponent(classroomId)}/mark-batches`,
    { mark_type_id: markTypeId, student_ids: studentIds },
  )
}

/** Undo for a whole batch. Already gone (404) counts as undone. */
export async function undoMarkBatch(batchId: string) {
  try {
    await apiDelete(`/mark-batches/${encodeURIComponent(batchId)}`)
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return
    throw error
  }
}

/**
 * Changes some students' counts in the cached counts, so cards update the
 * moment marks are tapped (or undone): one write, however many students.
 * Does nothing until the counts have loaded, and never goes below 0.
 */
export function bumpCounts(
  queryClient: QueryClient,
  {
    classroomId,
    date,
    studentIds,
    isPositive,
  }: {
    classroomId: string
    date: string
    studentIds: ReadonlyArray<string>
    isPositive: boolean
  },
  delta: 1 | -1,
) {
  const { queryKey } = markCountsQueryOptions(classroomId, date)
  if (!queryClient.getQueryData(queryKey) || studentIds.length === 0) return
  // A refetch already on its way was asked before this change, so its answer
  // would undo it. Stop it; the cache keeps what it had.
  void queryClient.cancelQueries({ queryKey, exact: true })

  const field = isPositive ? 'positive' : 'negative'
  const ids = new Set(studentIds)
  queryClient.setQueryData(queryKey, (counts) => {
    if (!counts) return counts
    const students = counts.students.map((s) => {
      if (!ids.has(s.student_id)) return s
      ids.delete(s.student_id)
      return { ...s, [field]: Math.max(0, s[field] + delta) }
    })
    // Students with no marks yet that day aren't in the list.
    for (const id of ids) {
      students.push({
        student_id: id,
        positive: 0,
        negative: 0,
        [field]: Math.max(0, delta),
      })
    }
    return { ...counts, students }
  })
}
