// Whose space this tab is working in: null for your own, or the id of a
// teacher who made you their co-teacher. Every API request names it in the
// X-Acting-For header (api.ts), and the server checks it every time.
//
// It lives in this tab's memory, so two tabs can be in different spaces. The
// last choice is remembered on the device (an id, nothing else) so the app
// reopens where you were. No imports: api.ts reads it.

const SPACE_KEY = 'tff:space'

let space: string | null = readStoredSpace()

function readStoredSpace(): string | null {
  try {
    return localStorage.getItem(SPACE_KEY) || null
  } catch {
    return null // storage blocked (private mode)
  }
}

/** The owner whose space this tab is in, or null for your own. */
export function currentSpace(): string | null {
  return space
}

/** Moves this tab into ownerId's space (null: your own). */
export function setSpace(ownerId: string | null) {
  space = ownerId
  try {
    if (ownerId) localStorage.setItem(SPACE_KEY, ownerId)
    else localStorage.removeItem(SPACE_KEY)
  } catch {
    // Storage blocked: this tab still switches; a reload starts at home.
  }
}

/**
 * The space a queued change was made in, from its mutation meta. Changes
 * queued before co-teachers existed have none: your own.
 */
export function spaceFromMeta(meta: Record<string, unknown> | undefined) {
  return typeof meta?.space === 'string' ? meta.space : null
}
