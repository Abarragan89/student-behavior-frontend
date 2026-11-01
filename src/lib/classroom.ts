import { queryOptions } from '@tanstack/react-query'
import {
  ApiError,
  apiGet,
  apiPost,
  apiPut,
  classroomConnectUrl,
  refreshSession,
} from './api'
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
  // Google sends them back.
  await refreshSession()
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
