import { queryOptions, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { ApiError, apiFetch } from './api'

export type Role = 'teacher' | 'admin'

export type Student = {
  // For giving marks: the {studentId} in POST …/students/{studentId}/marks.
  id: string
  first_name: string
  last_name: string
}

// One of the teacher's classrooms, shown as a tab.
export type ClassroomTab = {
  id: string
  name: string
  is_default: boolean // the open tab
}

// What GET /users/me (and PUT /users/me/default-classroom) send back: the
// signed-in teacher, all their classrooms, and the default one's roster.
// Every teacher has a default classroom. No user or student IDs: the backend
// works out whose data it is from the login cookies.
export type Me = {
  teacher: {
    name: string
    email: string
    // For showing or hiding admin screens. The backend checks it again on
    // every admin route.
    role: Role
    // Their Google profile photo. Not sent by the backend yet; the avatar
    // shows initials until it is.
    picture_url?: string | null
  }
  classrooms: Array<ClassroomTab>
  // The default classroom, the one on screen.
  classroom: {
    id: string
    name: string
    // The Google Classroom class it was imported from; null if made here.
    google_course_id: string | null
    students: Array<Student>
  }
}

// Who is logged in, plus their dashboard data. The login cookies are
// httpOnly, so JavaScript can't read them; we ask the backend instead.
// Resolves to null when logged out.
export const meQueryOptions = queryOptions({
  queryKey: ['me'],
  queryFn: async (): Promise<Me | null> => {
    const res = await apiFetch('/users/me')
    if (res.status === 401) return null
    if (!res.ok) throw new ApiError(res.status)
    return res.json()
  },
  staleTime: 5 * 60 * 1000,
})

// data: Me = logged in, null = logged out, undefined = still checking.
export function useMe() {
  return useQuery(meQueryOptions)
}

export function useLogout() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  return async () => {
    await apiFetch('/auth/logout', { method: 'POST' })
    // Update 'me' in place so everything showing the user re-renders now,
    // then drop anything else cached for the previous user.
    queryClient.setQueryData(meQueryOptions.queryKey, null)
    queryClient.removeQueries({ predicate: (q) => q.queryKey[0] !== 'me' })
    await navigate({ to: '/' })
  }
}
