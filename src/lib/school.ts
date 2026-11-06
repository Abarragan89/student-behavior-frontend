import { queryOptions } from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'
import {
  ApiError,
  DEFAULT_TIMEOUT_MS,
  apiDelete,
  apiErrorFrom,
  apiGet,
  apiPatch,
  apiPost,
  timeoutSignal,
} from './api'
import { meQueryOptions } from './auth'
import type { Me } from './auth'

// Schools: an administrator starts one (/school/start), then sends the staff
// one join link (/join#<code>). Teachers keep their own accounts; the school
// is a staff list for now. Every call is the signed-in user's own
// ({ space: null }), never a co-teacher's owner's.

const API_URL = import.meta.env.VITE_API_URL

export type SchoolRole = 'admin' | 'teacher'

/** Your school, as GET /users/me sends it. */
export type SchoolMembership = { id: string; name: string; role: SchoolRole }

export type SchoolInfo = {
  id: string
  name: string
  staff_estimate: number | null
  plan: 'pilot'
  /** When the free founding-school pilot ends. */
  pilot_ends_at: string | null
}

export type SchoolInviteStatus = 'open' | 'expired' | 'full' | 'revoked'

/** The school's join link. `url` is "" once it can't be used. */
export type SchoolInvite = {
  id: string
  url: string
  created_at: string
  expires_at: string
  /** null: no limit. */
  max_uses: number | null
  uses: number
  status: SchoolInviteStatus
}

export type SchoolMember = {
  user_id: string
  name: string
  email: string
  role: SchoolRole
  joined_at: string
  /** The administrator's own row. */
  is_you: boolean
}

/**
 * The School page. Members and the link come only to the administrator; a
 * teacher gets the school and who runs it.
 */
export type SchoolDetail = {
  school: SchoolInfo
  role: SchoolRole
  admin_name: string
  members?: Array<SchoolMember>
  /** null after the administrator turned the link off. */
  invite: SchoolInvite | null
}

/** What a join link shows before anyone signs in. */
export type JoinPreview = {
  school_name: string
  admin_name: string
  status: SchoolInviteStatus
  expires_at: string
}

/** How long a new link works, in days. */
export const LINK_DAYS = [7, 30, 90] as const
export type LinkDays = (typeof LINK_DAYS)[number]

/** Matches the server's limits. */
export const MAX_NAME_LENGTH = 120
export const MAX_STAFF = 5000

/**
 * Your School page; null when you aren't in a school. Never saved on the
 * device (persist.ts): it holds the join link and the staff's emails.
 */
export const schoolQueryOptions = queryOptions({
  queryKey: ['school'],
  queryFn: async (): Promise<SchoolDetail | null> => {
    try {
      return await apiGet<SchoolDetail>('/schools/mine', { space: null })
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) return null
      throw error
    }
  },
  staleTime: 0,
})

/** Starts a school with you as its administrator. 409 already_member. */
export function createSchool(input: {
  name: string
  staff_estimate: number | null
}) {
  return apiPost<SchoolDetail>('/schools', input, { space: null })
}

export function renameSchool(name: string) {
  return apiPatch<SchoolInfo>('/schools/mine', { name }, { space: null })
}

export function removeSchoolMember(userId: string) {
  return apiDelete(`/schools/mine/members/${encodeURIComponent(userId)}`, {
    space: null,
  })
}

/** A teacher leaves their school. The administrator can't (409 last_admin). */
export function leaveSchool() {
  return apiDelete('/schools/mine/membership', { space: null })
}

/** A new join link; the old one stops working. */
export function createSchoolInvite(input: {
  expires_in_days: LinkDays
  max_uses: number | null
}) {
  return apiPost<SchoolInvite>('/schools/mine/invites', input, { space: null })
}

export function revokeSchoolInvite(id: string) {
  return apiDelete(`/schools/mine/invites/${encodeURIComponent(id)}`, {
    space: null,
  })
}

/**
 * Joins the link's school as a teacher. 404: not a link. 409 with a reason:
 * other_school, expired, full or revoked.
 */
export function acceptSchoolInvite(code: string) {
  return apiPost<SchoolMembership>(
    '/school-invites/accept',
    { token: code },
    { space: null },
  )
}

/**
 * Which school a join link is for; null when the code isn't one. Sent with
 * the code as a bearer token and without cookies, so it works signed out
 * and never touches a session. In memory only.
 */
export function joinPreviewQueryOptions(code: string) {
  return queryOptions({
    queryKey: ['school-invite', code],
    queryFn: async (): Promise<JoinPreview | null> => {
      const res = await fetch(`${API_URL}/school-invite`, {
        credentials: 'omit',
        cache: 'no-store',
        headers: { Authorization: `Bearer ${code}` },
        signal: timeoutSignal(DEFAULT_TIMEOUT_MS),
      })
      if (res.status === 404) return null
      if (!res.ok) throw apiErrorFrom(res)
      return res.json() as Promise<JoinPreview>
    },
    staleTime: 0,
    retry: (count, error) =>
      !(error instanceof ApiError && error.status < 500) && count < 2,
  })
}

/** Updates the school in `me` (menus, Account) right away, then checks. */
export function setMySchool(
  queryClient: QueryClient,
  school: SchoolMembership | null,
) {
  queryClient.setQueryData<Me | null>(
    meQueryOptions.queryKey,
    (me) => me && { ...me, school },
  )
  void queryClient.invalidateQueries({ queryKey: meQueryOptions.queryKey })
}

// ---------- Kept in this tab while signing in ----------
//
// Both survive the trip to Google and back (the same tab) and nothing else:
// sessionStorage, 30 minutes, like a co-teacher invite (invite.ts). The join
// code is a secret, so it's moved off the address bar on arrival.

/** Long enough to sign in, short enough not to linger on a shared computer. */
const KEEP_MS = 30 * 60 * 1000

function readKept<T extends { savedAt: number }>(
  key: string,
  valid: (v: T) => boolean,
): T | null {
  try {
    const raw = sessionStorage.getItem(key)
    if (!raw) return null
    const saved = JSON.parse(raw) as T
    if (
      typeof saved.savedAt !== 'number' ||
      Date.now() - saved.savedAt > KEEP_MS ||
      !valid(saved)
    ) {
      sessionStorage.removeItem(key)
      return null
    }
    return saved
  } catch {
    return null
  }
}

function keep(key: string, value: object) {
  try {
    sessionStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Storage off: the page still works until a reload.
  }
}

function forget(key: string) {
  try {
    sessionStorage.removeItem(key)
  } catch {
    // Nothing saved.
  }
}

const JOIN_KEY = 'tff:school-join'

type KeptJoin = {
  code: string
  savedAt: number
  /** Set just before going to Google: join without asking on return. */
  autoAccept: boolean
}

/** Keeps the code from the join link's #. */
export function keepJoinCode(hash: string) {
  keep(JOIN_KEY, {
    code: hash.replace(/^#/, ''),
    savedAt: Date.now(),
    autoAccept: false,
  } satisfies KeptJoin)
}

/** The join link this tab is holding, if any. */
export function pendingJoin() {
  return readKept<KeptJoin>(JOIN_KEY, (v) => typeof v.code === 'string')
}

/** About to sign in with Google: join as soon as they're back. */
export function joinAfterSignIn() {
  const saved = pendingJoin()
  if (saved) keep(JOIN_KEY, { ...saved, autoAccept: true, savedAt: Date.now() })
}

/** Joined, or no good: forget it. */
export function forgetJoin() {
  forget(JOIN_KEY)
}

const START_KEY = 'tff:school-start'

export type SchoolDraft = {
  name: string
  staff_estimate: number | null
  savedAt: number
}

/** Keeps the school's name while the administrator signs in. */
export function keepSchoolDraft(draft: Omit<SchoolDraft, 'savedAt'>) {
  keep(START_KEY, { ...draft, savedAt: Date.now() } satisfies SchoolDraft)
}

/** The school this tab is about to start, if any. */
export function pendingSchoolDraft() {
  return readKept<SchoolDraft>(
    START_KEY,
    (v) =>
      typeof v.name === 'string' &&
      (v.staff_estimate === null || typeof v.staff_estimate === 'number'),
  )
}

export function forgetSchoolDraft() {
  forget(START_KEY)
}

// ---------- Sending the link ----------

/** "Friday, December 5" */
export function formatLongDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })
}

/** "June 2027" */
export function formatMonthYear(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  })
}

/**
 * The email the administrator copies and sends from their own email account.
 * The app never sends it.
 */
export function staffMessage({
  schoolName,
  adminName,
  url,
  expiresAt,
}: {
  schoolName: string
  adminName: string
  url: string
  expiresAt: string
}) {
  const subject = `Join ${schoolName} on TeachForFree`
  const body = [
    'Hi everyone,',
    '',
    `I set up ${schoolName} on TeachForFree, a free app for behavior tracking, lesson plans and parent conferences. Please join our school:`,
    '',
    `1. Open this link: ${url}`,
    '2. Sign in with your school Google account.',
    '',
    'Already using TeachForFree? Sign in with the same account. Your classes stay yours.',
    '',
    `The link works until ${formatLongDate(expiresAt)}.`,
    '',
    adminName,
  ].join('\n')
  return { subject, body }
}
