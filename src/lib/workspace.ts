import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { toast } from 'sonner'
import { ApiError, apiGet } from './api'
import { meQueryOptions } from './auth'
import type { Me } from './auth'
import { levelOf } from './coteachers'
import type { FeatureKey, Level, Space } from './coteachers'
import { flushDrafts } from './lesson-plan-queue'
import { useOnline } from './online'
import { currentSpace, setSpace } from './space-state'

// Spaces: your own classes, or the classes of a teacher who made you their
// co-teacher, or (for a school's administrator) a teacher's classes, view
// only. A tab is in one space at a time (space-state.ts), and every request
// says which. Cached data doesn't say whose space it's from, so switching
// drops it all (and auth.ts drops it again if `me` ever comes back for
// another space). Queued marks and checkmarks keep the space they were made
// in (their mutation meta), so they're still sent there.
//
// A school's administrator has no classes, lesson plans or conferences of
// their own: their home is the dashboard (/dashboard), and every teacher
// feature is closed to them in their own space.

export { currentSpace } from './space-state'

/** The owner whose space `me` is for, or null for your own. */
export function spaceOf(me: Me | null | undefined): string | null {
  return me?.acting_for?.owner_id ?? null
}

/** A school's administrator, in their own space (their dashboard). */
export function isSchoolAdmin(me: Me | null | undefined): boolean {
  return !!me && !me.acting_for && me.school?.role === 'admin'
}

/**
 * Whether you may change your school's calendar: its administrators, and
 * teachers an administrator let edit it. Always your own school (calendar
 * calls send no space), so the space on screen doesn't matter.
 */
export function canEditCalendar(me: Me | null | undefined): boolean {
  return me?.school?.role === 'admin' || !!me?.school?.can_edit_calendar
}

/** A school's administrator viewing one of their teachers' classes. */
export function viewingAsAdmin(me: Me | null | undefined): boolean {
  return me?.acting_for?.kind === 'school_admin'
}

/**
 * What you may do with a feature in this space. Your own: everything, unless
 * you run a school (then none: no classes, lesson plans or conferences of
 * your own). Someone else's: what they, or your school, allow.
 */
export function permissionIn(me: Me | null | undefined, f: FeatureKey): Level {
  if (!me?.acting_for) return isSchoolAdmin(me) ? 'none' : 'edit'
  return levelOf(me.acting_for.permissions, f)
}

export function canView(me: Me | null | undefined, f: FeatureKey) {
  return permissionIn(me, f) !== 'none'
}

export function canEdit(me: Me | null | undefined, f: FeatureKey) {
  return permissionIn(me, f) === 'edit'
}

/**
 * A sub link shows rosters and lets the sub give marks, so a co-teacher
 * needs Edit on both (the server checks the same).
 */
export function canShareWithSub(me: Me | null | undefined) {
  return canEdit(me, 'lesson_plans') && canEdit(me, 'classes')
}

/**
 * For route loaders, which start fetching before the layout checks the
 * page: whether this space lets you see the feature, as far as is known.
 * Not known yet counts as yes; the layout decides.
 */
export function mayLoad(queryClient: QueryClient, f: FeatureKey) {
  const me = queryClient.getQueryData<Me | null>(meQueryOptions.queryKey)
  return me === undefined || canView(me, f)
}

/** What you may do with a feature in the space on screen. */
export function usePermission(f: FeatureKey): Level {
  const { data: me } = useQuery(meQueryOptions)
  return permissionIn(me, f)
}

/**
 * Whether a change to a feature can be saved right now: online, and allowed
 * in this space. For buttons that were only turned off while offline.
 */
export function useCanSave(f: FeatureKey): boolean {
  const online = useOnline()
  return usePermission(f) === 'edit' && online
}

/** The first page this space lets you open. */
export function homeOf(
  me: Me | null | undefined,
): '/dashboard' | '/classes' | '/lesson-plans' | '/conferences' | '/account' {
  if (isSchoolAdmin(me)) return '/dashboard'
  if (canView(me, 'classes')) return '/classes'
  if (canView(me, 'lesson_plans')) return '/lesson-plans'
  if (canView(me, 'conferences')) return '/conferences'
  return '/account'
}

/** That space isn't open to you any more (shared, or in your school). */
export class LostAccessError extends Error {
  constructor() {
    super('No longer allowed in that space')
    this.name = 'LostAccessError'
  }
}

/** What to say when a space you were in, or tried to open, closed to you. */
function lostText(kind: Space['kind']) {
  return kind === 'school_admin'
    ? 'That teacher is no longer in your school.'
    : 'That teacher no longer shares their classroom with you.'
}

/**
 * Moves this tab into ownerId's space (null: your own) and resolves to its
 * `me`. Asks the server first, so nothing changes if that fails. No page
 * reload: marks still waiting to be sent stay in memory and are sent to the
 * space they were given in.
 */
export async function switchSpace(
  queryClient: QueryClient,
  ownerId: string | null,
): Promise<Me> {
  // Typing that hasn't been saved goes to the space it was typed in.
  flushDrafts()
  const me = await apiGet<Me>('/users/me', { space: ownerId })
  if (ownerId && me.acting_for?.owner_id !== ownerId) {
    throw new LostAccessError()
  }
  await queryClient.cancelQueries()
  setSpace(ownerId)
  queryClient.removeQueries({ predicate: (q) => q.queryKey[0] !== 'me' })
  queryClient.setQueryData(meQueryOptions.queryKey, me)
  return me
}

/**
 * switchSpace for a button: then opens the space's first page (or `to`),
 * and says what went wrong if it didn't work.
 */
export function useSwitchSpace() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [switching, setSwitching] = useState<string | null | undefined>()

  const switchTo = async (
    ownerId: string | null,
    options: {
      to?: string
      quiet?: boolean
      /** Opening a teacher's classes as their school's administrator. */
      asAdmin?: boolean
    } = {},
  ) => {
    if (switching !== undefined) return false
    setSwitching(ownerId)
    try {
      const me = await switchSpace(queryClient, ownerId)
      await navigate({ to: options.to ?? homeOf(me) })
      if (!options.quiet) {
        toast.success(switchedText(me), {
          description: viewingAsAdmin(me) ? 'View only' : undefined,
        })
      }
      return true
    } catch (error) {
      console.error('Switching space failed:', error)
      if (error instanceof LostAccessError) {
        toast.error(
          lostText(options.asAdmin ? 'school_admin' : 'coteacher').replace(
            /\.$/,
            '',
          ),
        )
        void queryClient.invalidateQueries({
          queryKey: meQueryOptions.queryKey,
        })
        if (options.asAdmin) {
          void queryClient.invalidateQueries({ queryKey: ['school-behavior'] })
        }
      } else if (!navigator.onLine) {
        toast.error('Switching needs a connection')
      } else {
        toast.error('Couldn’t switch. Try again.')
      }
      return false
    } finally {
      setSwitching(undefined)
    }
  }

  return { switchTo, switching }
}

/** The toast after switching into `me`'s space. */
function switchedText(me: Me) {
  if (me.acting_for) {
    return viewingAsAdmin(me)
      ? `Viewing ${me.acting_for.name}’s classes`
      : `You’re in ${me.acting_for.name}’s classroom`
  }
  return isSchoolAdmin(me)
    ? 'Back to your dashboard'
    : 'You’re back in your own classes'
}

/**
 * Keeps the tab's space in step with what the server says: if the owner
 * removed you, `me` comes back for your own space, so go back there and say
 * why. A `me` for another space than the tab's (an old copy) is asked for
 * again.
 */
export function watchSpace(queryClient: QueryClient) {
  // How the last space was open to you, to say why it closed.
  let lastKind: Space['kind']
  return queryClient.getQueryCache().subscribe((event) => {
    if (event.type !== 'updated' || event.query.queryKey[0] !== 'me') return
    const me = event.query.state.data as Me | null | undefined
    if (!me) return
    if (me.acting_for) lastKind = me.acting_for.kind
    const space = currentSpace()
    if (space && !me.acting_for) {
      // The server answered for your own space: the membership is gone.
      setSpace(null)
      queryClient.removeQueries({ predicate: (q) => q.queryKey[0] !== 'me' })
      toast(
        isSchoolAdmin(me)
          ? 'Back to your dashboard'
          : 'You’re back in your own classes',
        {
          id: 'lost-space',
          // After a reload nothing says how the space was open; an
          // administrator in their own space was almost surely viewing a
          // teacher of theirs.
          description: lostText(
            lastKind ?? (isSchoolAdmin(me) ? 'school_admin' : 'coteacher'),
          ),
        },
      )
      return
    }
    if (spaceOf(me) !== space) {
      void queryClient.invalidateQueries({ queryKey: meQueryOptions.queryKey })
    }
  })
}

/**
 * After the installed app loads its saved data: if it was saved in another
 * space than the one the app reopens in, throw it all away (it's fetched
 * again).
 */
export function dropCacheIfOtherSpace(queryClient: QueryClient) {
  const me = queryClient.getQueryData<Me | null>(meQueryOptions.queryKey)
  if (me && spaceOf(me) !== currentSpace()) queryClient.removeQueries()
}

/**
 * A 403 while in someone's space means your permissions changed: fetch `me`
 * again so the screens match what you may do now.
 */
export function onForbidden(queryClient: QueryClient, error: unknown) {
  if (error instanceof ApiError && error.status === 403 && currentSpace()) {
    void queryClient.invalidateQueries({ queryKey: meQueryOptions.queryKey })
  }
}
