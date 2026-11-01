import { queryOptions } from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'
import { ApiError, apiDelete, apiGet, apiPatch, apiPost } from './api'

// Behavior marks. A mark type is one of the teacher's buttons ("Helping
// others", "Off task"); a mark is one tap of it for one student. Every teacher
// starts with three positive and three negative types, and can rename or
// remove them and add their own on the Marks page. Types belong to the
// teacher, so they're the same in every class.

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
  // When it was given (UTC), as the teacher's device saw it. Offline marks
  // reach the server later, so this can be earlier than created_at. Missing
  // from servers older than the offline queue.
  occurred_at?: string
  created_at: string // UTC, when the server saved it
}

/** When a mark was given: use this for times and days. */
export function markTime(mark: Mark) {
  return mark.occurred_at ?? mark.created_at
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

// The backend's limit for a mark type's name, counted in characters. Names
// are also unique per teacher, ignoring case (a taken name answers 409).
export const MAX_MARK_NAME_LENGTH = 50

/** A new button. Positive or negative is set here and can't change later. */
export function createMarkType(name: string, isPositive: boolean) {
  return apiPost<MarkType>('/mark-types', { name, is_positive: isPositive })
}

/** Renames a type. Marks already given show the new name too. */
export function renameMarkType(id: string, name: string) {
  return apiPatch<MarkType>(`/mark-types/${encodeURIComponent(id)}`, { name })
}

/**
 * Takes a type off the buttons. The backend archives it, so marks already
 * given keep it. Already gone (404) counts as removed.
 */
export async function removeMarkType(id: string) {
  try {
    await apiDelete(`/mark-types/${encodeURIComponent(id)}`)
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return
    throw error
  }
}

/**
 * Puts a created or renamed type in the cached list, so the mark buttons
 * change at once without refetching. New ones go last (the list is oldest
 * first).
 */
export function cacheMarkType(queryClient: QueryClient, markType: MarkType) {
  const { queryKey } = markTypesQueryOptions
  // A refetch already on its way was asked before this change; its answer
  // could undo it.
  void queryClient.cancelQueries({ queryKey, exact: true })
  queryClient.setQueryData(queryKey, (types) => {
    if (!types) return types
    return types.some((t) => t.id === markType.id)
      ? types.map((t) => (t.id === markType.id ? markType : t))
      : [...types, markType]
  })
}

/** Takes a removed type out of the cached list. */
export function uncacheMarkType(queryClient: QueryClient, id: string) {
  const { queryKey } = markTypesQueryOptions
  void queryClient.cancelQueries({ queryKey, exact: true })
  queryClient.setQueryData(queryKey, (types) =>
    types?.filter((t) => t.id !== id),
  )
}

/** Each student's + / − counts in a class on one local date. */
export function markCountsQueryOptions(classroomId: string, date: string) {
  return queryOptions({
    queryKey: ['mark-counts', classroomId, date],
    queryFn: async ({ client }) => {
      const params = new URLSearchParams({ date, tz: timeZone() })
      const counts = await apiGet<MarkCounts>(
        `/classrooms/${encodeURIComponent(classroomId)}/marks/counts?${params}`,
      )
      // Marks still waiting to be sent aren't in the server's answer yet.
      return withQueuedMarks(client, classroomId, date, counts)
    },
    // Every tap and undo here edits this cache directly, so it stays right
    // without refetching. Refetched only when old (another device, a new day)
    // and once the offline queue has been sent.
    staleTime: 5 * 60 * 1000,
    // A missing or failing route just means no badges; don't keep retrying.
    retry: (failureCount, error) =>
      !(error instanceof ApiError && error.status < 500) && failureCount < 1,
  })
}

/**
 * The device picks the mark's id and sends when it was given. Sending the
 * same id again (the offline queue retrying) returns the mark already saved
 * instead of adding another.
 */
export function giveMark(
  classroomId: string,
  studentId: string,
  markTypeId: string,
  { id, occurredAt }: { id: string; occurredAt: string },
) {
  return apiPost<Mark>(
    `/classrooms/${encodeURIComponent(classroomId)}/students/${encodeURIComponent(studentId)}/marks`,
    { id, mark_type_id: markTypeId, occurred_at: occurredAt },
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

/** Like giveMark, the device picks the batch id and sends the time. */
type BatchOptions = { batchId: string; occurredAt: string }

/**
 * One mark for every student in the class. No student ids are sent: the
 * backend marks everyone enrolled when it arrives.
 */
export function giveMarkToClass(
  classroomId: string,
  markTypeId: string,
  { batchId, occurredAt }: BatchOptions,
) {
  return apiPost<MarkBatch>(
    `/classrooms/${encodeURIComponent(classroomId)}/mark-batches`,
    {
      batch_id: batchId,
      mark_type_id: markTypeId,
      all_students: true,
      occurred_at: occurredAt,
    },
  )
}

/** One mark for each of the picked students. */
export function giveMarkToStudents(
  classroomId: string,
  studentIds: Array<string>,
  markTypeId: string,
  { batchId, occurredAt }: BatchOptions,
) {
  return apiPost<MarkBatch>(
    `/classrooms/${encodeURIComponent(classroomId)}/mark-batches`,
    {
      batch_id: batchId,
      mark_type_id: markTypeId,
      student_ids: studentIds,
      occurred_at: occurredAt,
    },
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

// ---------- Marks waiting to be sent (src/lib/mark-queue.ts) ----------

/** The mutation key every queued give and undo shares. */
export const MARK_MUTATION_KEY = ['marks'] as const

/**
 * One tap, or its Undo, as kept in the offline queue. Ids and the time only,
 * no names: it can be saved on the device for a while.
 */
export type QueuedMark = {
  kind: 'give' | 'undo'
  target: 'student' | 'selected' | 'class'
  /** The mark's id (one student) or the batch's id (several, or the class). */
  id: string
  classroomId: string
  /** Whose counts it changes. For the class: the roster on screen at the tap. */
  studentIds: Array<string>
  markTypeId: string
  isPositive: boolean
  /** The local day of the tap, "2026-11-01": the counts it belongs to. */
  date: string
  /** When it was tapped (ISO), sent as occurred_at. */
  occurredAt: string
}

/**
 * Adds 1 (or takes 1 off) some students' + or − count. Never below 0.
 * Students with no marks that day aren't in the list, so they're added.
 */
export function applyDelta(
  counts: MarkCounts,
  studentIds: ReadonlyArray<string>,
  isPositive: boolean,
  delta: 1 | -1,
): MarkCounts {
  const field = isPositive ? 'positive' : 'negative'
  const ids = new Set(studentIds)
  const students = counts.students.map((s) => {
    if (!ids.has(s.student_id)) return s
    ids.delete(s.student_id)
    return { ...s, [field]: Math.max(0, s[field] + delta) }
  })
  for (const id of ids) {
    students.push({
      student_id: id,
      positive: 0,
      negative: 0,
      [field]: Math.max(0, delta),
    })
  }
  return { ...counts, students }
}

/**
 * The server's counts plus the marks for that class and day that haven't
 * been sent yet (offline, or still on their way), so a refetch never makes
 * a tap disappear from the cards.
 */
function withQueuedMarks(
  queryClient: QueryClient,
  classroomId: string,
  date: string,
  counts: MarkCounts,
) {
  const pending = queryClient
    .getMutationCache()
    .findAll({ mutationKey: MARK_MUTATION_KEY, status: 'pending' })
  let result = counts
  for (const mutation of pending) {
    const mark = mutation.state.variables as QueuedMark | undefined
    if (mark?.classroomId !== classroomId || mark.date !== date) continue
    result = applyDelta(
      result,
      mark.studentIds,
      mark.isPositive,
      mark.kind === 'give' ? 1 : -1,
    )
  }
  return result
}

/**
 * Changes some students' counts in the cached counts, so cards update the
 * moment marks are tapped (or undone): one write, however many students.
 */
export function bumpCounts(
  queryClient: QueryClient,
  {
    classroomId,
    date,
    studentIds,
    isPositive,
  }: Pick<QueuedMark, 'classroomId' | 'date' | 'studentIds' | 'isPositive'>,
  delta: 1 | -1,
) {
  if (studentIds.length === 0) return
  const { queryKey } = markCountsQueryOptions(classroomId, date)
  const state = queryClient.getQueryState(queryKey)
  // A refetch already on its way was asked before this change, so its answer
  // could undo it. Stop it; the cache keeps what it had.
  void queryClient.cancelQueries({ queryKey, exact: true })

  queryClient.setQueryData(
    queryKey,
    (counts) =>
      applyDelta(
        // Not loaded (e.g. offline on a new day): start from an empty day.
        counts ?? { date, timezone: timeZone(), students: [] },
        studentIds,
        isPositive,
        delta,
      ),
    // Keep the cache's age: a bump doesn't make it any fresher, and an empty
    // day made up here should still be fetched.
    { updatedAt: state?.dataUpdatedAt ?? 0 },
  )
}
