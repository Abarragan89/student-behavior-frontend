import { queryOptions } from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'
import {
  ApiError,
  DEFAULT_TIMEOUT_MS,
  apiErrorFrom,
  timeoutSignal,
} from './api'
import type { Lang } from './conference-i18n'

// A family's page for their child's parent conference (/conference), opened
// from the QR code on the notice the teacher printed (see conferences.ts for
// the teacher's side). The code is the only key: it's sent as a bearer
// token, never with anyone's cookies, so a teacher scanning a notice stays
// signed in as themselves and nothing here can touch their session.
//
// Nothing is saved on the family's device: 'conference-link' isn't in
// persist.ts's SAVED_QUERIES. The code and the language choice live in this
// tab's sessionStorage only.

const API_URL = import.meta.env.VITE_API_URL

// ---------- The code ----------
//
// It comes after the # in the link, which browsers never send to a server
// (or to link previews). On arrival it moves to this tab's sessionStorage and
// off the address bar, so it isn't in a screenshot or a copied link, and a
// reload still works.

const TOKEN_KEY = 'tff:conference-link'
const LANG_KEY = 'tff:conference-lang'
let token: string | null = null

/**
 * Keeps the code from the link's # for this tab. True when it's a different
 * code from the one this tab had, whose data must then be dropped.
 */
export function keepConferenceToken(hash: string) {
  const previous = conferenceToken()
  token = hash.replace(/^#/, '')
  try {
    sessionStorage.setItem(TOKEN_KEY, token)
  } catch {
    // Private mode or storage off: it lasts until a reload.
  }
  return previous !== null && previous !== token
}

/** This tab's code, or null if the link was opened without one. */
export function conferenceToken() {
  if (token) return token
  try {
    token = sessionStorage.getItem(TOKEN_KEY)
  } catch {
    // As above.
  }
  return token
}

let lang: Lang | null = null

/** The language picked on this tab (the notice's Spanish code picks es). */
export function storedLanguage(): Lang | null {
  if (lang) return lang
  try {
    const saved = sessionStorage.getItem(LANG_KEY)
    if (saved === 'en' || saved === 'es') lang = saved
  } catch {
    // As above.
  }
  return lang
}

export function keepLanguage(next: Lang) {
  lang = next
  try {
    sessionStorage.setItem(LANG_KEY, next)
  } catch {
    // As above.
  }
}

// ---------- What the code opens ----------

/** GET /conference-link: the family's page. Names no other student. */
export type FamilyView = {
  /** Newer views have higher versions (see acceptView). */
  version: number
  /** 'ended': every time is over. */
  status: 'open' | 'ended'
  server_time: string
  /** Their child's first name ("" once ended). */
  first_name: string
  teacher_name: string
  location: string
  /** Times are shown in this time zone. */
  timezone: string
  /** The teacher lets families change times online. */
  changes_open: boolean
  /** This family can move now. */
  can_change: boolean
  cutoff_hours: number
  mine: {
    id: string
    starts_at: string
    ends_at: string
    /** Too close to change online. */
    locked: boolean
  } | null
  /** Times still to come, only when can_change. */
  slots: Array<{
    id: string
    starts_at: string
    ends_at: string
    state: 'mine' | 'open' | 'unavailable'
  }>
}

export type MoveReason = 'taken' | 'locked' | 'closed' | 'stale'

/** The server refused a move; view is the family's page as it is now. */
export class MoveConflict extends Error {
  constructor(
    public reason: MoveReason,
    public view: FamilyView | null,
  ) {
    super(`Move refused: ${reason}`)
    this.name = 'MoveConflict'
  }
}

/** Fetches /conference-link{path} with the code. */
export function linkFetch(path: string, init: RequestInit = {}) {
  const key = conferenceToken()
  // No code, no way in: the same as a code that doesn't work.
  if (!key) return Promise.reject(new ApiError(404))
  return fetch(`${API_URL}/conference-link${path}`, {
    ...init,
    // Never anyone's cookies, if a teacher is signed in in this browser.
    credentials: 'omit',
    cache: 'no-store',
    headers: { ...init.headers, Authorization: `Bearer ${key}` },
  })
}

/** A code that was replaced answers 404: don't keep asking. */
export function retryUnlessRefused(failureCount: number, error: Error) {
  return !(error instanceof ApiError && error.status < 500) && failureCount < 2
}

const VIEW_KEY = ['conference-link', 'view'] as const

export const familyViewQueryOptions = queryOptions({
  queryKey: VIEW_KEY,
  queryFn: async ({ signal }) => {
    const res = await linkFetch('', {
      signal: timeoutSignal(DEFAULT_TIMEOUT_MS, signal),
    })
    if (!res.ok) throw apiErrorFrom(res)
    return (await res.json()) as FamilyView
  },
  retry: retryUnlessRefused,
  // Kept current by the live stream (conference-stream.ts).
  staleTime: Infinity,
})

/**
 * Shows a view unless the page already has a newer one: the answer to a
 * move and the live stream can arrive in either order. Equal versions are
 * taken, since some changes (a student removed by the teacher) don't bump
 * it.
 */
export function acceptView(queryClient: QueryClient, next: FamilyView) {
  queryClient.setQueryData<FamilyView>(VIEW_KEY, (current) =>
    current && current.version > next.version ? current : next,
  )
}

/** Moves the family to an open time. from is the time their page shows as theirs. */
export async function moveTo(slotId: string, fromSlotId: string | null) {
  const res = await linkFetch('/move', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ slot_id: slotId, from_slot_id: fromSlotId }),
    signal: timeoutSignal(DEFAULT_TIMEOUT_MS),
  })
  if (res.status === 409) {
    const data = (await res.json().catch(() => null)) as {
      reason?: MoveReason
      view?: FamilyView
    } | null
    throw new MoveConflict(data?.reason ?? 'stale', data?.view ?? null)
  }
  if (!res.ok) throw apiErrorFrom(res)
  return (await res.json()) as FamilyView
}
