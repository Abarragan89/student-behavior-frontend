// All calls to the Go backend go through here.
//
// The backend keeps the login in httpOnly cookies on its own origin, so every
// request needs `credentials: 'include'` or the browser leaves the cookies off
// and the backend answers 401.

import { currentSpace } from './space-state'

export const API_URL = import.meta.env.VITE_API_URL

export const loginUrl = `${API_URL}/auth/google/login`

/** Signs in, then comes back to the co-teacher invite page (/invite). */
export const inviteLoginUrl = `${loginUrl}?next=invite`

/** Signs in, then comes back to a school's join link (/join). */
export const joinLoginUrl = `${loginUrl}?next=join`

/** Signs in, then comes back to starting a school (/school/start). */
export const schoolStartLoginUrl = `${loginUrl}?next=school-start`

/** The header naming the owner whose space a co-teacher is working in. */
export const ACTING_FOR_HEADER = 'X-Acting-For'

/**
 * Options for every call. `space` is whose space it's for: left out, the
 * tab's current space (space-state.ts); null, your own. Queued changes pass
 * the space they were made in, so switching spaces never re-aims them.
 */
export type ApiOptions = { timeoutMs?: number; space?: string | null }

// Starts "Connect Google Classroom". Like loginUrl, the browser goes here
// (it's a page navigation to Google and back, not a fetch).
export const classroomConnectUrl = `${API_URL}/auth/google/classroom/connect`

// Without a limit, a request on bad Wi-Fi can hang for minutes. Calls that
// wait on Google (course list, import) pass a longer one.
export const DEFAULT_TIMEOUT_MS = 15_000
export const GOOGLE_TIMEOUT_MS = 75_000

export class ApiError extends Error {
  constructor(
    public status: number,
    /** How long the server asked us to wait before trying again (429, 503). */
    public retryAfterMs?: number,
    /**
     * Why a 403 or 409 was refused, when the server says (e.g.
     * "other_school"), so a page can explain it.
     */
    public reason?: string,
  ) {
    super(`Request failed with status ${status}`)
    this.name = 'ApiError'
  }
}

/** An ApiError for a failed response, including any Retry-After. */
export function apiErrorFrom(res: Response) {
  return new ApiError(
    res.status,
    parseRetryAfter(res.headers.get('Retry-After')),
  )
}

/**
 * apiErrorFrom, plus the reason a 403 or 409 sends in its body
 * ({"error": …, "reason": …}). Other statuses' bodies aren't read.
 */
async function apiErrorWithReason(res: Response) {
  const error = apiErrorFrom(res)
  if (res.status === 403 || res.status === 409) {
    const body: unknown = await res.json().catch(() => null)
    if (
      body &&
      typeof body === 'object' &&
      'reason' in body &&
      typeof body.reason === 'string'
    ) {
      error.reason = body.reason
    }
  }
  return error
}

// Retry-After is either a number of seconds or an HTTP date.
function parseRetryAfter(value: string | null): number | undefined {
  if (!value) return undefined
  const seconds = Number(value)
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000)
  const date = Date.parse(value)
  return Number.isNaN(date) ? undefined : Math.max(0, date - Date.now())
}

/** Aborts after timeoutMs, or when signal does. */
export function timeoutSignal(timeoutMs: number, signal?: AbortSignal | null) {
  const timeout = AbortSignal.timeout(timeoutMs)
  return signal && 'any' in AbortSignal
    ? AbortSignal.any([signal, timeout])
    : timeout
}

// The access token expires after 15 minutes; the refresh token gets a new one.
// Each refresh token works only once, and the backend logs the user out if one
// is reused. So refreshes must never overlap: requests in this tab share one
// refresh, and a Web Lock makes other tabs wait their turn (the next one then
// sends the new token, which the browser has already stored).
type RefreshResult = 'refreshed' | 'signed-out'
let refreshing: Promise<RefreshResult> | null = null

/**
 * Gets a new access token. 'signed-out' means the session is over. Throws if
 * the server couldn't be reached or had a problem: that says nothing about
 * the session, so the teacher must not be signed out for it.
 */
export function refreshSession(): Promise<RefreshResult> {
  refreshing ??= withRefreshLock(async (): Promise<RefreshResult> => {
    const res = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      signal: timeoutSignal(DEFAULT_TIMEOUT_MS),
    })
    if (res.ok) return 'refreshed'
    if (res.status === 401) return 'signed-out'
    throw apiErrorFrom(res)
  }).finally(() => {
    refreshing = null
  })
  return refreshing
}

function withRefreshLock<T>(refresh: () => Promise<T>): Promise<T> {
  // Older browsers without Web Locks: no cross-tab protection, as before.
  if (!('locks' in navigator)) return refresh()
  return navigator.locks.request('tff-refresh', refresh)
}

export async function apiFetch(
  path: string,
  init: RequestInit = {},
  { timeoutMs = DEFAULT_TIMEOUT_MS, space = currentSpace() }: ApiOptions = {},
): Promise<Response> {
  const headers = new Headers(init.headers)
  if (space) headers.set(ACTING_FOR_HEADER, space)
  const send = () =>
    fetch(`${API_URL}${path}`, {
      ...init,
      headers,
      credentials: 'include',
      signal: timeoutSignal(timeoutMs, init.signal),
    })

  const res = await send()
  if (res.status !== 401) return res

  // Access token missing or expired: refresh once, then retry.
  return (await refreshSession()) === 'refreshed' ? send() : res
}

export async function apiGet<T>(
  path: string,
  options?: ApiOptions,
): Promise<T> {
  const res = await apiFetch(path, {}, options)
  if (!res.ok) throw await apiErrorWithReason(res)
  return res.json() as Promise<T>
}

// Sends body (if any) as JSON and resolves to the JSON response.
async function apiSend<T>(
  method: 'POST' | 'PUT' | 'PATCH',
  path: string,
  body?: unknown,
  options?: ApiOptions,
): Promise<T> {
  const res = await apiFetch(
    path,
    body === undefined
      ? { method }
      : {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
    options,
  )
  if (!res.ok) throw await apiErrorWithReason(res)
  return res.json() as Promise<T>
}

export function apiPost<T>(
  path: string,
  body?: unknown,
  options?: ApiOptions,
): Promise<T> {
  return apiSend<T>('POST', path, body, options)
}

export function apiPut<T>(
  path: string,
  body?: unknown,
  options?: ApiOptions,
): Promise<T> {
  return apiSend<T>('PUT', path, body, options)
}

export function apiPatch<T>(
  path: string,
  body?: unknown,
  options?: ApiOptions,
): Promise<T> {
  return apiSend<T>('PATCH', path, body, options)
}

// For routes that answer 204 with no body.
export async function apiDelete(
  path: string,
  options?: ApiOptions,
): Promise<void> {
  const res = await apiFetch(path, { method: 'DELETE' }, options)
  if (!res.ok) throw await apiErrorWithReason(res)
}
