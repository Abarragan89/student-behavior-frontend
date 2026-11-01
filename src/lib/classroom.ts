import { queryOptions } from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'
import {
  ApiError,
  GOOGLE_TIMEOUT_MS,
  apiDelete,
  apiGet,
  apiPost,
  apiPut,
  classroomConnectUrl,
  refreshSession,
} from './api'
import { meQueryOptions } from './auth'
import type { Me } from './auth'

// Connecting Google Classroom is a separate Google consent step from sign-in,
// so signing in only asks for name and email.

export type ClassroomStatus = {
  connected: boolean
  scopes: Array<string>
  connected_at?: string
}

export const classroomStatusQueryOptions = queryOptions({
  queryKey: ['classroom-status'],
  queryFn: () => apiGet<ClassroomStatus>('/auth/google/classroom'),
  staleTime: 5 * 60 * 1000,
})

// One of the teacher's active Google Classroom classes.
export type GoogleCourse = {
  id: string // Google's course ID, for importGoogleCourse
  name: string
  section?: string // e.g. "Period 1"; often missing
  imported: boolean // already brought into TeachForFree
  // Not sent by the backend yet. The card shows it once it is.
  student_count?: number
}

// The backend answers 409 when Classroom isn't connected (or the teacher
// revoked access on Google's side).
export function isNotConnectedError(error: unknown) {
  return error instanceof ApiError && error.status === 409
}

// Read live from Google, so it can take a few seconds. Cached for 5 minutes;
// importing a class updates the cache itself instead of asking Google again.
export const googleCoursesQueryOptions = queryOptions({
  queryKey: ['google-courses'],
  queryFn: async () => {
    const { courses } = await apiGet<{ courses: Array<GoogleCourse> }>(
      '/auth/google/classroom/courses',
      { timeoutMs: GOOGLE_TIMEOUT_MS },
    )
    return courses
  },
  staleTime: 5 * 60 * 1000,
  // Retry once if the server or Google hiccups; 4xx answers won't change.
  retry: (failureCount, error) =>
    !(error instanceof ApiError && error.status < 500) && failureCount < 1,
})

export type CourseImportResult = {
  classroom: { id: string; name: string; is_default: boolean }
  created: boolean // false: imported before, so only new students were added
  students_added: number
}

// The backend fetches the class's roster from Google and adds a student row
// for each student who's new. It also makes that class the teacher's default
// classroom (the open tab), whether it's the first import or a later one.
export function importGoogleCourse(courseId: string) {
  return apiPost<CourseImportResult>(
    `/auth/google/classroom/courses/${encodeURIComponent(courseId)}/import`,
    undefined,
    { timeoutMs: GOOGLE_TIMEOUT_MS },
  )
}

export type CreatedClassroom = {
  id: string
  name: string
  is_default: boolean
  created_at: string
}

// "Create class" from the + menu. The backend is meant to make the new class
// the default; until it does, the create-class form switches to it itself.
export function createClassroom(name: string) {
  return apiPost<CreatedClassroom>('/classrooms', { name })
}

// Opening a classroom tab. The backend makes it the teacher's default and
// sends back the dashboard opened on it, the same shape as GET /users/me.
export function switchClassroom(classroomId: string) {
  return apiPut<Me>('/users/me/default-classroom', {
    classroom_id: classroomId,
  })
}

// One of the teacher's archived classes, for the Account page.
export type ArchivedClassroom = {
  id: string
  name: string
  // The Google Classroom class it was imported from; null if made here.
  google_course_id: string | null
  archived_at: string
  created_at: string
}

// Most recently archived first. Only the Account page shows it, so it isn't
// saved on the device (see SAVED_QUERIES in persist.ts).
export const archivedClassroomsQueryOptions = queryOptions({
  queryKey: ['archived-classrooms'],
  queryFn: () => apiGet<Array<ArchivedClassroom>>('/classrooms/archived'),
  staleTime: 5 * 60 * 1000,
})

// "Archive class". The backend hides it from the class list (its students
// and marks are kept) and sends back the dashboard. If it was the open class,
// the oldest class left is open now. 409 when it's the teacher's only class.
export function archiveClassroom(classroomId: string) {
  return apiPost<Me>(`/classrooms/${encodeURIComponent(classroomId)}/archive`)
}

// Puts an archived class back in the class list and sends back the
// dashboard. The open class doesn't change. 404 if it isn't archived.
export function unarchiveClassroom(classroomId: string) {
  return apiPost<Me>(`/classrooms/${encodeURIComponent(classroomId)}/unarchive`)
}

// Deletes an archived class forever, with all its marks and the students who
// aren't in any of the teacher's other classes. 409 if it isn't archived.
export function deleteClassroom(classroomId: string) {
  return apiDelete(`/classrooms/${encodeURIComponent(classroomId)}`)
}

/** Takes one class off the cached archived list. */
export function removeArchived(queryClient: QueryClient, classroomId: string) {
  queryClient.setQueryData(archivedClassroomsQueryOptions.queryKey, (list) =>
    list?.filter((c) => c.id !== classroomId),
  )
}

/**
 * After archiving: show the dashboard the backend sent (another class may be
 * open now), and refresh the archived list. Student pages list a student's
 * open classes, so they're refreshed too.
 */
export function cacheArchived(queryClient: QueryClient, me: Me) {
  queryClient.setQueryData(meQueryOptions.queryKey, me)
  void queryClient.invalidateQueries({
    queryKey: archivedClassroomsQueryOptions.queryKey,
  })
  void queryClient.invalidateQueries({ queryKey: ['student'] })
}

/** After unarchiving: the class is back in the class list, off this one. */
export function cacheUnarchived(
  queryClient: QueryClient,
  me: Me,
  classroomId: string,
) {
  queryClient.setQueryData(meQueryOptions.queryKey, me)
  removeArchived(queryClient, classroomId)
  void queryClient.invalidateQueries({ queryKey: ['student'] })
}

/** After deleting a class forever: forget what's cached about it. */
export function forgetDeletedClassroom(
  queryClient: QueryClient,
  classroom: ArchivedClassroom,
) {
  removeArchived(queryClient, classroom.id)
  queryClient.removeQueries({ queryKey: ['mark-counts', classroom.id] })
  // Students who were only in it are deleted too, and the backend doesn't say
  // which, so every student page reloads.
  void queryClient.invalidateQueries({ queryKey: ['student'] })
  void queryClient.invalidateQueries({ queryKey: ['student-marks'] })
  // Its Google Classroom class can be imported again, as a new class.
  const courseId = classroom.google_course_id
  if (courseId) {
    queryClient.setQueryData(googleCoursesQueryOptions.queryKey, (list) =>
      list?.map((c) => (c.id === courseId ? { ...c, imported: false } : c)),
    )
  }
}

export type AddStudentsResult = {
  students_added: number
  // Names already in the class, which the backend skips. Always an array.
  skipped: Array<string>
}

// "Add Students" by hand: full names as typed. The backend splits them into
// first and last names, and saves all of them or none (400 if any is invalid).
export function addStudents(classroomId: string, names: Array<string>) {
  return apiPost<AddStudentsResult>(
    `/classrooms/${encodeURIComponent(classroomId)}/students/bulk`,
    { names },
  )
}

/** 1 → "1 student", 24 → "24 students" */
export function formatStudentCount(count: number) {
  return `${count} ${count === 1 ? 'student' : 'students'}`
}

export async function connectClassroom() {
  // The backend asks for a fresh session first: its flow lasts up to 10
  // minutes and a new access token 15, so the teacher is still signed in when
  // Google sends them back. If the refresh fails, go anyway: the backend
  // sends a signed-out teacher back with an error to show.
  await refreshSession().catch(() => {})
  window.location.assign(classroomConnectUrl)
}

// When the flow ends, the backend sends the browser to the site root with
// ?classroom=connected or ?classroom_error=<code>.
export type ClassroomResult = {
  classroom?: string
  classroom_error?: string
}

export function validateClassroomResult(
  search: Record<string, unknown>,
): ClassroomResult {
  return {
    classroom:
      typeof search.classroom === 'string' ? search.classroom : undefined,
    classroom_error:
      typeof search.classroom_error === 'string'
        ? search.classroom_error
        : undefined,
  }
}
