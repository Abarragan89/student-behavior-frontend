import {
  onlineManager,
  queryOptions,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { ApiError, apiFetch } from './api'
import type { Space } from './coteachers'
import { SHARED_STALE_MS } from './freshness'
import { turnOff as turnOffNotifications } from './notifications'
import { clearPersistedCache } from './persist'
import { isStandalone } from './pwa-install'
import { setSpace } from './space-state'

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

// The open classroom, with its roster.
export type OpenClassroom = {
  id: string
  name: string
  // The Google Classroom class it was imported from; null if made here.
  google_course_id: string | null
  students: Array<Student>
}

// What GET /users/me (and PUT /users/me/default-classroom) send back: the
// signed-in teacher, the space's classrooms, and the open one's roster. In
// your own space that's your classes; as a co-teacher in another teacher's
// space (workspace.ts), theirs. No user or student IDs of yours: the backend
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
  // The open classroom, the one on screen. Null only for a co-teacher who
  // can't see the owner's classes.
  classroom: OpenClassroom | null
  // The teacher whose space this is; null (or missing, in a copy saved
  // before co-teachers existed) in your own.
  acting_for?: Space | null
  // Teachers who made you their co-teacher.
  coteaching?: Array<Space>
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
  // Classes and rosters change on the teacher's other devices too.
  staleTime: SHARED_STALE_MS,
})

// data: Me = logged in, null = logged out, undefined = still checking.
export function useMe() {
  return useQuery(meQueryOptions)
}

export function useLogout() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  return async () => {
    // This device's reminders stop with the teacher: first, while the
    // session can still remove them on the server. Never holds up signing
    // out for long, and a failure doesn't stop it.
    await Promise.race([
      turnOffNotifications().catch(() => {}),
      new Promise((resolve) => setTimeout(resolve, 2500)),
    ])
    await apiFetch('/auth/logout', { method: 'POST' }, { space: null })
    // The next person on this device starts in their own space.
    setSpace(null)
    // Update 'me' in place so everything showing the user re-renders now,
    // then drop anything else cached for the previous user.
    queryClient.setQueryData(meQueryOptions.queryKey, null)
    queryClient.removeQueries({ predicate: (q) => q.queryKey[0] !== 'me' })
    // Marks not sent yet go too (the sign-out dialog warns first), and
    // anything saved on the device (installed app).
    queryClient.getMutationCache().clear()
    await clearPersistedCache()
    // The installed app's home is the sign-in page. On the website, the
    // homepage is a separate page (site/), so leave the app for it; the full
    // reload also clears everything still in memory on a shared computer.
    if (isStandalone()) await navigate({ to: '/login' })
    else window.location.assign('/')
  }
}

/** Read by the homepage (site/src/components/SignedInRedirect.astro). */
const SIGNED_IN_KEY = 'tff:signed-in'

/**
 * Remembers on this device whether a teacher is signed in: one flag, nothing
 * about who. The homepage only checks the session (and sends the teacher to
 * their class) when it's set, so most visitors and search engines never wait
 * on the API from there.
 */
export function rememberSignedIn(queryClient: QueryClient) {
  return queryClient.getQueryCache().subscribe((event) => {
    if (event.type !== 'updated' || event.query.queryKey[0] !== 'me') return
    const me = event.query.state.data as Me | null | undefined
    if (me === undefined) return
    try {
      if (me) localStorage.setItem(SIGNED_IN_KEY, '1')
      else localStorage.removeItem(SIGNED_IN_KEY)
    } catch {
      // Storage blocked (private mode): the homepage just won't redirect.
    }
  })
}

/**
 * Drops everything cached for a teacher once they're signed out (session
 * ended), a different teacher signs in, or they move to another space, so it
 * isn't shown to, or saved on the device for, the next person or space.
 */
export function forgetOnTeacherChange(queryClient: QueryClient) {
  let who = identity(
    queryClient.getQueryData<Me | null>(meQueryOptions.queryKey),
  )

  return queryClient.getQueryCache().subscribe((event) => {
    if (event.type !== 'updated' || event.query.queryKey[0] !== 'me') return
    const me = event.query.state.data as Me | null | undefined
    if (me === undefined) return

    // A different space counts too: nothing cached says whose space it's
    // from (see workspace.ts).
    const next = identity(me)
    if (next === who) return
    const hadTeacher = who !== undefined
    who = next
    if (hadTeacher) {
      queryClient.removeQueries({ predicate: (q) => q.queryKey[0] !== 'me' })
    }
  })
}

/** Who is signed in, and in whose space; undefined when signed out. */
function identity(me: Me | null | undefined) {
  if (!me) return undefined
  return `${me.teacher.email}|${me.acting_for?.owner_id ?? ''}`
}

/**
 * For pages that only redirect (login): the signed-in teacher if
 * already known (this visit or saved on the device), else a quick check.
 * Never waits on a missing connection, and treats errors as signed out, so
 * those pages always show right away.
 */
export async function signedInTeacher(
  queryClient: QueryClient,
): Promise<Me | null> {
  const cached = queryClient.getQueryData<Me | null>(meQueryOptions.queryKey)
  if (cached !== undefined) return cached
  if (!onlineManager.isOnline()) return null
  return queryClient
    .query({ ...meQueryOptions, retry: false })
    .catch(() => null)
}
