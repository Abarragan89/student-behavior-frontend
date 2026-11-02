import { queryOptions } from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'
import { ApiError, apiErrorFrom, apiFetch, apiGet, apiPatch } from './api'
import { meQueryOptions } from './auth'
import type { Me } from './auth'
import { timeZone } from './marks'
import type { Mark } from './marks'

// One student, for their own page. Names are stored encrypted by the
// backend; they're only plain text in its responses.

export type StudentDetail = {
  id: string
  first_name: string
  last_name: string // can be ""
  /** The teacher's classes the student is in, oldest first. */
  classrooms: Array<{ id: string; name: string }>
}

export type StudentName = { first_name: string; last_name: string }

// 4xx (gone, not theirs) won't change on a retry.
const retryServerErrors = (failureCount: number, error: Error) =>
  !(error instanceof ApiError && error.status < 500) && failureCount < 2

export function studentQueryOptions(studentId: string) {
  return queryOptions({
    queryKey: ['student', studentId],
    queryFn: () =>
      apiGet<StudentDetail>(`/students/${encodeURIComponent(studentId)}`),
    retry: retryServerErrors,
  })
}

/**
 * The student as far as the dashboard already knows them (if they're in the
 * open class), so their page can show a name before it has loaded.
 */
export function studentFromMe(
  me: Me | null | undefined,
  studentId: string,
): StudentDetail | undefined {
  const student = me?.classroom.students.find((s) => s.id === studentId)
  if (!me || !student) return undefined
  return {
    ...student,
    classrooms: [{ id: me.classroom.id, name: me.classroom.name }],
  }
}

/**
 * Every mark the student got on one local date, in any of the teacher's
 * classes. The backend works out the day (midnight to midnight) in the
 * teacher's time zone.
 */
export function studentMarksQueryOptions(studentId: string, date: string) {
  return queryOptions({
    queryKey: ['student-marks', studentId, date],
    queryFn: () => {
      const params = new URLSearchParams({
        from: date,
        to: date,
        tz: timeZone(),
      })
      return apiGet<Array<Mark>>(
        `/students/${encodeURIComponent(studentId)}/marks?${params}`,
      )
    },
    // Moving to another day keeps the old day on screen (faded) until the
    // new one arrives, instead of flashing empty. Same student only: never
    // show one student's marks on another's page.
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[1] === studentId ? previous : undefined,
    retry: retryServerErrors,
  })
}

/** A student's + and − counts for each day of a range. */
export type DailyCounts = {
  timezone: string
  from: string
  to: string
  // One per day from `from` to `to`, oldest first; days without marks are 0.
  days: Array<{ date: string; positive: number; negative: number }>
}

/**
 * The student's counts per local date, in all of the teacher's classes, for
 * the printed report's recent-days chart. Not saved on the device (see
 * SAVED_QUERIES in src/lib/persist.ts).
 */
export function studentDailyQueryOptions(
  studentId: string,
  from: string,
  to: string,
) {
  return queryOptions({
    queryKey: ['student-daily', studentId, from, to],
    queryFn: () => {
      const params = new URLSearchParams({ from, to, tz: timeZone() })
      return apiGet<DailyCounts>(
        `/students/${encodeURIComponent(studentId)}/marks/daily?${params}`,
      )
    },
    retry: retryServerErrors,
  })
}

/** Renames a student. The backend encrypts the new name before saving it. */
export function updateStudentName(studentId: string, name: StudentName) {
  return apiPatch<StudentDetail>(
    `/students/${encodeURIComponent(studentId)}`,
    name,
  )
}

/**
 * After a rename: puts the new name everywhere it's cached (this page, and
 * the class grid if the student is in the open class), with no refetch.
 */
export function cacheStudentName(
  queryClient: QueryClient,
  student: StudentDetail,
) {
  queryClient.setQueryData(studentQueryOptions(student.id).queryKey, student)
  queryClient.setQueryData(meQueryOptions.queryKey, (me) => {
    if (!me?.classroom.students.some((s) => s.id === student.id)) return me
    return {
      ...me,
      classroom: {
        ...me.classroom,
        students: me.classroom.students.map((s) =>
          s.id === student.id
            ? {
                ...s,
                first_name: student.first_name,
                last_name: student.last_name,
              }
            : s,
        ),
      },
    }
  })
}

/**
 * Takes a student out of one class. If it was their last class, the backend
 * deletes the student and all of their marks (student_deleted: true);
 * otherwise they stay in their other classes with every mark kept.
 */
export async function removeStudentFromClass(
  classroomId: string,
  studentId: string,
): Promise<{ student_deleted: boolean }> {
  const res = await apiFetch(
    `/classrooms/${encodeURIComponent(classroomId)}/students/${encodeURIComponent(studentId)}`,
    { method: 'DELETE' },
  )
  if (!res.ok) throw apiErrorFrom(res)
  return res.json() as Promise<{ student_deleted: boolean }>
}

/**
 * After removeStudentFromClass: off the class grid at once (if that's the
 * open class), and gone from every cache if the student was deleted.
 */
export function forgetRemovedStudent(
  queryClient: QueryClient,
  studentId: string,
  classroomId: string,
  deleted: boolean,
) {
  queryClient.setQueryData(meQueryOptions.queryKey, (me) => {
    if (me?.classroom.id !== classroomId) return me
    return {
      ...me,
      classroom: {
        ...me.classroom,
        students: me.classroom.students.filter((s) => s.id !== studentId),
      },
    }
  })
  void queryClient.invalidateQueries({ queryKey: meQueryOptions.queryKey })
  void queryClient.invalidateQueries({
    queryKey: ['mark-counts', classroomId],
  })

  if (deleted) {
    for (const key of ['student', 'student-marks', 'student-daily']) {
      queryClient.removeQueries({ queryKey: [key, studentId] })
    }
    return
  }
  queryClient.setQueryData(studentQueryOptions(studentId).queryKey, (s) =>
    s
      ? { ...s, classrooms: s.classrooms.filter((c) => c.id !== classroomId) }
      : s,
  )
}

/** After deleteMark: off the student's page at once, on whichever day. */
export function forgetDeletedMark(queryClient: QueryClient, mark: Mark) {
  const queryKey = ['student-marks', mark.student_id]
  // A fetch already on its way was asked before the delete and could bring
  // the mark back.
  void queryClient.cancelQueries({ queryKey })
  queryClient.setQueriesData<Array<Mark>>({ queryKey }, (marks) =>
    marks?.filter((m) => m.id !== mark.id),
  )
  refetchMarkTotals(queryClient, mark)
}

/** After restoreMark: back on the student's page for its day. */
export function cacheRestoredMark(
  queryClient: QueryClient,
  mark: Mark,
  date: string,
) {
  const { queryKey } = studentMarksQueryOptions(mark.student_id, date)
  void queryClient.cancelQueries({ queryKey, exact: true })
  queryClient.setQueryData(queryKey, (marks) =>
    !marks || marks.some((m) => m.id === mark.id) ? marks : [...marks, mark],
  )
  refetchMarkTotals(queryClient, mark)
}

/**
 * Everything else that counted the mark: the class grid's + and −, the
 * printed report's recent days, and the student's day itself (to match the
 * server exactly).
 */
function refetchMarkTotals(queryClient: QueryClient, mark: Mark) {
  void queryClient.invalidateQueries({
    queryKey: ['mark-counts', mark.classroom_id],
  })
  void queryClient.invalidateQueries({
    queryKey: ['student-daily', mark.student_id],
  })
  void queryClient.invalidateQueries({
    queryKey: ['student-marks', mark.student_id],
  })
}
