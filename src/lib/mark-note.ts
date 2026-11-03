import { useSyncExternalStore } from 'react'

// Which mark's note is being written, if any. The note sheet is opened from
// the give-mark toast, which outlives the roster that showed it (switching
// classes remounts the roster, and the teacher can leave the page), so it
// lives at the app's root (MarkNoteHost) and is opened from anywhere through
// here.

export type MarkNoteRequest = {
  /** Saved as the teacher, or through the substitute's link. */
  kind: 'teacher' | 'sub'
  markId: string
  studentId: string
  /** First name, for the sheet's title and hint. */
  studentName: string
  /** The mark's name, "Off task". */
  markName: string
  /** The note it has now, "" for none. */
  note: string
  /** The space the mark is in (null: the teacher's own). */
  space: string | null
}

type State = {
  request: MarkNoteRequest | null
  open: boolean
  /** Counts openings, so each one starts with the mark's saved note. */
  seq: number
}

let state: State = { request: null, open: false, seq: 0 }
const listeners = new Set<() => void>()

function set(next: State) {
  state = next
  for (const listener of listeners) listener()
}

/** Opens the note sheet for a mark. */
export function openMarkNote(request: MarkNoteRequest) {
  set({ request, open: true, seq: state.seq + 1 })
}

/** Closes it. The request stays, so the sheet keeps its text as it slides away. */
export function closeMarkNote() {
  if (state.open) set({ ...state, open: false })
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useMarkNote() {
  return useSyncExternalStore(subscribe, () => state)
}
