import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import type { RefObject } from 'react'
import { clearDraft, setDraft } from '#/lib/lesson-plan-queue'

// Text fields of the lesson plan editor: typing that saves itself, and moving
// the cursor between lines (Enter makes a line below; Backspace joins one to
// the line above).

// ---------- Moving the cursor ----------

/** Ids for focusField: a section's title, and its "Add a line" box. */
export const titleField = (sectionId: string) => `title:${sectionId}`
export const addLineField = (sectionId: string) => `add:${sectionId}`

type Field = {
  focus: (caret: number) => void
  /** Shows text that's already been saved (e.g. two lines joined). */
  replace: (text: string) => void
}

const fields = new Map<string, Field>()
let pending: { id: string; caret: number } | null = null

/**
 * Puts the cursor in a line or title, at caret. A line just added isn't on
 * screen yet (React Query shows it a moment later), so it's focused when it
 * appears. text, if given, replaces what the field shows first.
 */
export function focusField(id: string, caret: number, text?: string) {
  const field = fields.get(id)
  if (!field) {
    pending = { id, caret }
    return
  }
  if (text !== undefined) field.replace(text)
  field.focus(caret)
}

/**
 * Registers a text field so focusField can reach it, and focuses it on
 * arrival if it was asked for before it appeared.
 */
export function useFocusTarget(
  id: string,
  ref: RefObject<HTMLTextAreaElement | null>,
  replace: (text: string) => void,
) {
  const replaceRef = useRef(replace)
  replaceRef.current = replace

  useLayoutEffect(() => {
    const focus = (caret: number) => focusAt(ref.current, caret)
    fields.set(id, { focus, replace: (text) => replaceRef.current(text) })
    if (pending?.id === id) {
      focus(pending.caret)
      pending = null
    }
    return () => {
      fields.delete(id)
    }
  }, [id, ref])
}

function focusAt(el: HTMLTextAreaElement | null, caret: number) {
  if (!el) return
  // Focused now, in the same tap or key press, so a phone keeps its keyboard
  // up. The caret is set again after React has put new text in.
  el.focus({ preventScroll: true })
  el.setSelectionRange(caret, caret)
  requestAnimationFrame(() => {
    el.setSelectionRange(caret, caret)
    el.scrollIntoView({ block: 'nearest' })
  })
}

// ---------- Typing that saves itself ----------

/**
 * A text field's draft. Saved a moment after the teacher stops typing, when
 * the field loses focus, and before anything moves lines around (flushDrafts
 * in lesson-plan-queue.ts). While focused it ignores the cache, so a refetch
 * can't wipe what's being typed.
 */
export function useDraftText({
  id,
  value,
  onSave,
  delay = 800,
}: {
  id: string
  /** What the cache has. */
  value: string
  onSave: (text: string) => void
  delay?: number
}) {
  const [text, setText] = useState(value)
  const latest = useRef(value) // what's in the field
  const saved = useRef(value) // what was last saved or loaded
  const focused = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const onSaveRef = useRef(onSave)
  onSaveRef.current = onSave

  const flush = useCallback(() => {
    clearTimeout(timer.current)
    clearDraft(id)
    if (latest.current === saved.current) return
    saved.current = latest.current
    onSaveRef.current(latest.current)
  }, [id])

  // Show the cache's text (another device, a copy) unless it's being typed in.
  useEffect(() => {
    if (focused.current || latest.current !== saved.current) return
    latest.current = value
    saved.current = value
    setText(value)
  }, [value])

  // Leaving the page (or the line disappearing) saves what's left.
  useEffect(() => () => flush(), [flush])

  return {
    text,
    /** The teacher typed. */
    change(next: string) {
      latest.current = next
      setText(next)
      setDraft(id, flush)
      clearTimeout(timer.current)
      timer.current = setTimeout(flush, delay)
    },
    /** Sets the text and saves it now, e.g. the first half of a split line. */
    commit(next: string) {
      latest.current = next
      setText(next)
      flush()
    },
    /** Shows text that's already been saved elsewhere. */
    replace(next: string) {
      clearTimeout(timer.current)
      clearDraft(id)
      latest.current = next
      saved.current = next
      setText(next)
    },
    /** The line is being deleted: throw the draft away. */
    drop() {
      clearTimeout(timer.current)
      clearDraft(id)
      saved.current = latest.current
    },
    onFocus() {
      focused.current = true
    },
    onBlur() {
      focused.current = false
      flush()
    },
  }
}

// ---------- "Add a …" boxes ----------

/**
 * A box at the end of a list that adds what's typed when the teacher presses
 * Enter or taps away. Until then it's a draft, so anything that moves lines
 * around (and leaving the page) adds it first instead of losing it.
 * onAdd returns the new thing's id.
 */
export function useAddBox({
  id,
  onAdd,
}: {
  id: string
  onAdd: (text: string) => string | undefined
}) {
  const [value, setValue] = useState('')
  const latest = useRef('')
  const onAddRef = useRef(onAdd)
  onAddRef.current = onAdd

  const commit = useCallback(() => {
    clearDraft(id)
    const text = latest.current
    latest.current = ''
    setValue('')
    return text.trim() === '' ? undefined : onAddRef.current(text)
  }, [id])

  useEffect(() => () => clearDraft(id), [id])

  return {
    value,
    commit,
    set(next: string) {
      latest.current = next
      setValue(next)
      if (next.trim() === '') clearDraft(id)
      else setDraft(id, commit)
    },
  }
}

// ---------- Height ----------

/**
 * Grows a textarea with its text. CSS field-sizing does this where it's
 * supported; this covers browsers without it.
 */
export function useAutoGrow(
  ref: RefObject<HTMLTextAreaElement | null>,
  text: string,
) {
  useLayoutEffect(() => {
    const el = ref.current
    if (!el || CSS.supports('field-sizing', 'content')) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [ref, text])
}
