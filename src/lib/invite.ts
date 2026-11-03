import { queryOptions } from '@tanstack/react-query'
import {
  ApiError,
  DEFAULT_TIMEOUT_MS,
  apiErrorFrom,
  apiPost,
  timeoutSignal,
} from './api'
import type { Permissions, Space } from './coteachers'

// A co-teacher invite: /invite#<code>, from a link or QR code a teacher made
// (+ → Add co-teacher). The code is a one-time secret. Like a sub link's key
// (sub.ts), it's after the #, so browsers never send it to a server or a
// link preview; on arrival it moves to this tab's sessionStorage and off the
// address bar. It survives the trip to Google and back, since that happens in
// the same tab, and then the page accepts it.

const API_URL = import.meta.env.VITE_API_URL
const INVITE_KEY = 'tff:coteach-invite'
/** Long enough to sign in, short enough not to linger on a shared computer. */
const KEEP_MS = 30 * 60 * 1000

type Saved = {
  code: string
  savedAt: number
  /** Set just before going to Google: accept without asking on return. */
  autoAccept: boolean
}

function read(): Saved | null {
  try {
    const raw = sessionStorage.getItem(INVITE_KEY)
    if (!raw) return null
    const saved = JSON.parse(raw) as Saved
    if (
      typeof saved.code !== 'string' ||
      Date.now() - saved.savedAt > KEEP_MS
    ) {
      sessionStorage.removeItem(INVITE_KEY)
      return null
    }
    return saved
  } catch {
    return null
  }
}

function write(saved: Saved) {
  try {
    sessionStorage.setItem(INVITE_KEY, JSON.stringify(saved))
  } catch {
    // Storage off: the page still works until a reload.
  }
}

/** Keeps the code from the link's #. */
export function keepInviteCode(hash: string) {
  write({
    code: hash.replace(/^#/, ''),
    savedAt: Date.now(),
    autoAccept: false,
  })
}

/** The invite this tab is holding, if any. */
export function pendingInvite(): Saved | null {
  return read()
}

/** About to sign in with Google: accept as soon as they're back. */
export function acceptAfterSignIn() {
  const saved = read()
  if (saved) write({ ...saved, autoAccept: true, savedAt: Date.now() })
}

/** Accepted, or no good: forget it. */
export function forgetInvite() {
  try {
    sessionStorage.removeItem(INVITE_KEY)
  } catch {
    // Nothing saved.
  }
}

export type InviteStatus = 'pending' | 'used' | 'expired' | 'cancelled'

/** What the link shows before anyone signs in. */
export type InvitePreview = {
  owner_name: string
  permissions: Permissions
  expires_at: string
  status: InviteStatus
}

/**
 * Who sent the invite and what it gives; null when the code isn't one (or
 * was deleted). Sent with the code as a bearer token and without cookies,
 * so it works signed out and never touches a session. In memory only.
 */
export function invitePreviewQueryOptions(code: string) {
  return queryOptions({
    queryKey: ['coteacher-invite', code],
    queryFn: async (): Promise<InvitePreview | null> => {
      const res = await fetch(`${API_URL}/coteacher-invite`, {
        credentials: 'omit',
        cache: 'no-store',
        headers: { Authorization: `Bearer ${code}` },
        signal: timeoutSignal(DEFAULT_TIMEOUT_MS),
      })
      if (res.status === 404) return null
      if (!res.ok) throw apiErrorFrom(res)
      return res.json() as Promise<InvitePreview>
    },
    staleTime: 0,
    retry: (count, error) =>
      !(error instanceof ApiError && error.status < 500) && count < 2,
  })
}

/**
 * Makes the signed-in teacher a co-teacher in the inviter's classroom.
 * 404: used by someone else, cancelled or expired. 409: their own invite.
 */
export function acceptInvite(code: string) {
  return apiPost<Space>(
    '/coteacher-invites/accept',
    { token: code },
    { space: null },
  )
}
