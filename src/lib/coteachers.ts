import { queryOptions } from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'
import { apiDelete, apiGet, apiPatch, apiPost } from './api'

// Co-teachers: a teacher shares their classes, lesson plans and conferences
// with another signed-in teacher, feature by feature. The co-teacher switches
// into that teacher's space (workspace.ts); the server checks every request.

// ---------- What can be shared ----------

/** How much of a feature a co-teacher may use. */
export type Level = 'none' | 'view' | 'edit'

/**
 * Every feature that can be shared, in the order the permission rows show
 * them. Adding one (a seating chart, a to-do list) is one entry here plus the
 * same key in the backend (internal/coteacher/features.go). Co-teachers who
 * already exist start with no access to it.
 */
export const FEATURES = [
  {
    key: 'classes',
    label: 'Classes',
    description: 'Rosters, student pages and giving marks.',
  },
  {
    key: 'lesson_plans',
    label: 'Lesson plans',
    description:
      'Your daily plans. Sharing a day with a sub also needs Classes: Edit.',
  },
  {
    key: 'conferences',
    label: 'Conferences',
    description: 'Parent conference sign-ups and times.',
  },
] as const

export type FeatureKey = (typeof FEATURES)[number]['key']

/** Feature → level. A feature that's left out has no access. */
export type Permissions = Partial<Record<FeatureKey, 'view' | 'edit'>>

export const LEVELS: ReadonlyArray<{ value: Level; label: string }> = [
  { value: 'none', label: 'No access' },
  { value: 'view', label: 'View' },
  { value: 'edit', label: 'Edit' },
]

export function levelOf(p: Permissions | undefined, f: FeatureKey): Level {
  return p?.[f] ?? 'none'
}

/** Sets one feature's level, leaving the others as they were. */
export function withLevel(
  p: Permissions,
  f: FeatureKey,
  level: Level,
): Permissions {
  const next = { ...p }
  if (level === 'none') delete next[f]
  else next[f] = level
  return next
}

/** At least one feature must be shared, or there's nothing to co-teach. */
export function sharesAnything(p: Permissions) {
  return FEATURES.some((f) => levelOf(p, f.key) !== 'none')
}

/** "Classes: Edit · Lesson plans: View" (shared features only). */
export function permissionSummary(p: Permissions) {
  const parts = FEATURES.filter((f) => levelOf(p, f.key) !== 'none').map(
    (f) => `${f.label}: ${levelOf(p, f.key) === 'edit' ? 'Edit' : 'View'}`,
  )
  return parts.length > 0 ? parts.join(' · ') : 'No access'
}

/** True when every feature is at Edit: complete access. */
export function isFullAccess(p: Permissions) {
  return FEATURES.every((f) => levelOf(p, f.key) === 'edit')
}

// ---------- A space shared with you ----------

/** A teacher who made you their co-teacher, as GET /users/me lists them. */
export type Space = {
  owner_id: string
  name: string
  email: string
  permissions: Permissions
}

// ---------- Your own co-teachers (Account page) ----------

export type Coteacher = {
  user_id: string
  name: string
  email: string
  permissions: Permissions
  created_at: string
}

/** A pending invite. `url` holds the secret: only the owner sees it. */
export type Invite = {
  id: string
  url: string
  permissions: Permissions
  created_at: string
  expires_at: string
}

export type CoteachersOverview = {
  coteachers: Array<Coteacher>
  invites: Array<Invite>
}

// Never saved on the device (persist.ts doesn't list it): it holds invite
// links. Always your own: the server ignores the space for these routes.
export const coteachersQueryOptions = queryOptions({
  queryKey: ['coteachers'],
  queryFn: () => apiGet<CoteachersOverview>('/coteachers', { space: null }),
  staleTime: 0,
})

export function createInvite(permissions: Permissions) {
  return apiPost<Invite>('/coteacher-invites', { permissions }, { space: null })
}

export function cancelInvite(id: string) {
  return apiDelete(`/coteacher-invites/${encodeURIComponent(id)}`, {
    space: null,
  })
}

export function updateCoteacher(userId: string, permissions: Permissions) {
  return apiPatch<Coteacher>(
    `/coteachers/${encodeURIComponent(userId)}`,
    { permissions },
    { space: null },
  )
}

export function removeCoteacher(userId: string) {
  return apiDelete(`/coteachers/${encodeURIComponent(userId)}`, {
    space: null,
  })
}

/** You leave a teacher's space. */
export function leaveSpace(ownerId: string) {
  return apiDelete(`/coteaching/${encodeURIComponent(ownerId)}`, {
    space: null,
  })
}

/** Puts a new invite at the top of the Account page's list. */
export function cacheInvite(queryClient: QueryClient, invite: Invite) {
  queryClient.setQueryData(coteachersQueryOptions.queryKey, (o) =>
    o
      ? {
          ...o,
          invites: [invite, ...o.invites.filter((i) => i.id !== invite.id)],
        }
      : o,
  )
  void queryClient.invalidateQueries({
    queryKey: coteachersQueryOptions.queryKey,
  })
}
