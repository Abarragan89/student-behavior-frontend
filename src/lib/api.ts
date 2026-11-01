// All calls to the Go backend go through here.
//
// The backend keeps the login in httpOnly cookies on its own origin, so every
// request needs `credentials: 'include'` or the browser leaves the cookies off
// and the backend answers 401.

const API_URL = import.meta.env.VITE_API_URL

export const loginUrl = `${API_URL}/auth/google/login`

// Starts "Connect Google Classroom". Like loginUrl, the browser goes here
// (it's a page navigation to Google and back, not a fetch).
export const classroomConnectUrl = `${API_URL}/auth/google/classroom/connect`

export class ApiError extends Error {
  constructor(public status: number) {
    super(`Request failed with status ${status}`)
    this.name = 'ApiError'
  }
}

// The access token expires after 15 minutes; the refresh token gets a new one.
// Each refresh token works only once, and the backend logs the user out if one
// is reused, so requests that hit 401 at the same time must share one refresh.
let refreshing: Promise<boolean> | null = null

export function refreshSession(): Promise<boolean> {
  refreshing ??= fetch(`${API_URL}/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
  })
    .then((res) => res.ok)
    .catch(() => false)
    .finally(() => {
      refreshing = null
    })
  return refreshing
}

export async function apiFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const send = () =>
    fetch(`${API_URL}${path}`, { ...init, credentials: 'include' })

  const res = await send()
  if (res.status !== 401) return res

  // Access token missing or expired: refresh once, then retry.
  return (await refreshSession()) ? send() : res
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await apiFetch(path)
  if (!res.ok) throw new ApiError(res.status)
  return res.json() as Promise<T>
}

// Sends body (if any) as JSON and resolves to the JSON response.
async function apiSend<T>(
  method: 'POST' | 'PUT',
  path: string,
  body?: unknown,
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
  )
  if (!res.ok) throw new ApiError(res.status)
  return res.json() as Promise<T>
}

export function apiPost<T>(path: string, body?: unknown): Promise<T> {
  return apiSend<T>('POST', path, body)
}

export function apiPut<T>(path: string, body?: unknown): Promise<T> {
  return apiSend<T>('PUT', path, body)
}

// For routes that answer 204 with no body.
export async function apiDelete(path: string): Promise<void> {
  const res = await apiFetch(path, { method: 'DELETE' })
  if (!res.ok) throw new ApiError(res.status)
}
