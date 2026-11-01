import { queryOptions } from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'
import { ApiError, apiGet, apiPatch } from './api'
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
