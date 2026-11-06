import { useId, useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { CircleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { useAutoGrow } from '#/components/lesson-plans/editor-text'
import { OfflineNote } from '#/components/offline-note'
import { ResponsiveDialog } from '#/components/responsive-dialogue'
import { ApiError } from '#/lib/api'
import { MARK_NOTE_MUTATION_KEY } from '#/lib/mark-queue'
import type { MarkNoteChange } from '#/lib/mark-queue'
import { closeMarkNote, useMarkNote } from '#/lib/mark-note'
import type { MarkNoteRequest } from '#/lib/mark-note'
import { MAX_MARK_NOTE_LENGTH } from '#/lib/marks'
import { useOnline } from '#/lib/online'
import { SUB_MARK_NOTE_KEY } from '#/lib/sub'

/** The counter shows up this close to the limit. */
const COUNT_FROM = MAX_MARK_NOTE_LENGTH - 40

/**
 * The note sheet, opened with openMarkNote (mark-note.ts) from the give-mark
 * toast or a student's page. Rendered once, at the app's root.
 */
export function MarkNoteHost() {
  const { request, open, seq } = useMarkNote()
  if (!request) return null
  // Keyed by opening: each starts from the mark's saved note.
  return <MarkNoteDialog key={seq} request={request} open={open} />
}

function MarkNoteDialog({
  request,
  open,
}: {
  request: MarkNoteRequest
  open: boolean
}) {
  const fieldId = useId()
  const hintId = useId()
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const online = useOnline()
  const [text, setText] = useState(request.note)
  const [error, setError] = useState<string | null>(null)
  useAutoGrow(textareaRef, text)

  // The send itself, and its place in the queue, come from the mutation
  // defaults (mark-queue.ts, sub.ts): sent after the mark it's for.
  const save = useMutation<unknown, unknown, MarkNoteChange>({
    mutationKey:
      request.kind === 'sub' ? SUB_MARK_NOTE_KEY : MARK_NOTE_MUTATION_KEY,
  })
  const saving = save.isPending
  const removing = text.trim() === '' && request.note !== ''

  function submit() {
    if (saving || !online) return
    const note = text.trim()
    if (note === request.note) {
      closeMarkNote()
      return
    }
    setError(null)
    save.mutate(
      { markId: request.markId, note, space: request.space },
      {
        onSuccess: () => {
          toast.success(note ? 'Note saved' : 'Note removed')
          closeMarkNote()
        },
        onError: (err) => {
          console.error('Saving a mark note failed:', err)
          setError(saveErrorMessage(err))
        },
      },
    )
  }

  const { length } = text
  return (
    <ResponsiveDialog
      isOpen={open}
      setIsOpen={(next: boolean) => {
        if (!next) closeMarkNote()
      }}
      title={`${request.markName} · ${request.studentName}`}
      description={`A note about this mark for ${request.studentName}.`}
      initialFocus={textareaRef}
      keyboardAware
    >
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
        className="flex flex-col gap-3"
      >
        <label htmlFor={fieldId} className="sr-only">
          Note
        </label>
        <Textarea
          ref={textareaRef}
          id={fieldId}
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            setError(null)
          }}
          onKeyDown={(e) => {
            // Enter saves; the keyboard's key says Done. Not while an IME is
            // still composing a character.
            if (e.key !== 'Enter' || e.shiftKey) return
            if (e.nativeEvent.isComposing || e.keyCode === 229) return
            e.preventDefault()
            submit()
          }}
          readOnly={saving}
          maxLength={MAX_MARK_NOTE_LENGTH}
          enterKeyHint="done"
          placeholder="Add a detail..."
          aria-describedby={hintId}
          aria-invalid={error ? true : undefined}
          className="min-h-20 rounded-lg border-2 border-border bg-card px-3 py-2.5 text-base placeholder:text-muted-foreground/70"
        />
        <div className="flex items-start justify-between gap-3 text-xs text-muted-foreground">
          <p id={hintId}>
            Shows on {request.studentName}’s printed report. Leave out other
            students’ names.
          </p>
          {length >= COUNT_FROM && (
            <p
              aria-live="polite"
              className={cn(
                'shrink-0 tabular-nums',
                length >= MAX_MARK_NOTE_LENGTH && 'font-bold text-foreground',
              )}
            >
              {length}/{MAX_MARK_NOTE_LENGTH}
            </p>
          )}
        </div>

        {error && (
          <p
            role="alert"
            className="flex items-center gap-2 text-sm font-medium"
          >
            <CircleAlert className="size-4 shrink-0 text-destructive" />
            {error}
          </p>
        )}
        <OfflineNote action="save notes" />

        <Button
          type="submit"
          disabled={saving || !online}
          aria-busy={saving}
          // The label stays (invisible) under the spinner, so the button
          // keeps its size.
          className={cn('relative mt-1', saving && 'disabled:opacity-100')}
        >
          <span className={cn(saving && 'invisible')}>
            {removing ? 'Remove note' : 'Save'}
          </span>
          {saving && (
            <Spinner
              // Paused: waiting for its mark to reach the server first.
              aria-label={save.isPaused ? 'Waiting to send' : 'Saving'}
              className="absolute inset-0 m-auto size-5"
            />
          )}
        </Button>
      </form>
    </ResponsiveDialog>
  )
}

function saveErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    switch (error.status) {
      case 400:
        return `That note can’t be saved. Keep it under ${MAX_MARK_NOTE_LENGTH} characters.`
      case 401:
        return 'Your session has ended. Sign in again to save the note.'
      case 403:
        return 'You can no longer change marks in this class.'
      case 404:
        return 'That mark is no longer saved, so it can’t have a note.'
      case 429:
        return 'Too many changes for now. Wait a minute, then try again.'
    }
    return 'Couldn’t save the note. Please try again.'
  }
  // fetch() throws a TypeError when the server can't be reached.
  return 'Couldn’t reach the server. Check your connection and try again.'
}
