import { useId, useRef, useState } from 'react'
import type { RefObject } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
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
import {
  MAX_CONFERENCE_NOTE_LENGTH,
  cacheConference,
  conferenceQueryOptions,
  formatSlotDay,
  formatSlotRange,
  fullName,
  saveNote,
} from '#/lib/conferences'
import type { Conference, ConferenceStudent } from '#/lib/conferences'
import { useOnline } from '#/lib/online'
import { usePermission } from '#/lib/workspace'

/** The counter shows up this close to the limit. */
const COUNT_FROM = MAX_CONFERENCE_NOTE_LENGTH - 40

/**
 * The teacher's note on a student's meeting ("Virtual", something to talk
 * about), opened from a time's ⋯ menu or its note icon. Open while student
 * is set. A co-teacher who can only view conferences can read it here.
 */
export function ConferenceNoteDialog({
  conference,
  student,
  onClose,
}: {
  conference: Conference
  student: ConferenceStudent | null
  onClose: () => void
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const slot = student
    ? conference.slots.find((s) => s.student_id === student.id)
    : undefined
  const tz = conference.timezone
  return (
    <ResponsiveDialog
      isOpen={student !== null}
      setIsOpen={(open: boolean) => {
        if (!open) onClose()
      }}
      title={student ? `Note for ${fullName(student)}` : 'Note'}
      description={
        slot
          ? `${formatSlotDay(slot.starts_at, tz)}, ${formatSlotRange(slot.starts_at, slot.ends_at, tz)}`
          : undefined
      }
      showDescription
      initialFocus={textareaRef}
      keyboardAware
    >
      {student && (
        // Mounted on each opening, so it starts from the saved note.
        <NoteForm
          key={student.id}
          conference={conference}
          student={student}
          textareaRef={textareaRef}
          onDone={onClose}
        />
      )}
    </ResponsiveDialog>
  )
}

function NoteForm({
  conference,
  student,
  textareaRef,
  onDone,
}: {
  conference: Conference
  student: ConferenceStudent
  textareaRef: RefObject<HTMLTextAreaElement | null>
  onDone: () => void
}) {
  const queryClient = useQueryClient()
  const fieldId = useId()
  const hintId = useId()
  const online = useOnline()
  // A co-teacher with View only reads the note.
  const editable = usePermission('conferences') === 'edit'
  const saved = student.note
  const [text, setText] = useState(saved)
  const [error, setError] = useState<string | null>(null)
  useAutoGrow(textareaRef, text)

  const save = useMutation({
    mutationFn: (note: string) => saveNote(conference.id, student.id, note),
    // In turn with the teacher's other changes to this conference.
    scope: { id: `conference:${conference.id}` },
    onSuccess: (page) => cacheConference(queryClient, page),
  })
  const saving = save.isPending
  const removing = text.trim() === '' && saved !== ''

  function submit() {
    if (saving || !online || !editable) return
    const note = text.trim()
    if (note === saved) {
      onDone()
      return
    }
    setError(null)
    save.mutate(note, {
      onSuccess: () => {
        toast.success(note ? 'Note saved' : 'Note removed')
        onDone()
      },
      onError: (err) => {
        console.error('Saving a conference note failed:', err)
        setError(saveErrorMessage(err, student.first_name))
        // Gone from the conference: show the page as it is now.
        if (err instanceof ApiError && err.status === 404) {
          void queryClient.invalidateQueries({
            queryKey: conferenceQueryOptions(conference.id).queryKey,
          })
        }
      },
    })
  }

  const { length } = text
  return (
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
          // One line: a pasted line break or tab becomes a space, as the
          // server takes no control characters.
          setText(e.target.value.replace(/\p{Cc}+/gu, ' '))
          setError(null)
        }}
        onKeyDown={(e) => {
          // Enter saves; the keyboard's key says Done. Not while an IME is
          // still composing a character.
          if (e.key !== 'Enter') return
          if (e.nativeEvent.isComposing || e.keyCode === 229) return
          e.preventDefault()
          submit()
        }}
        readOnly={saving || !editable}
        maxLength={MAX_CONFERENCE_NOTE_LENGTH}
        enterKeyHint="done"
        placeholder="Virtual, or something to talk about"
        aria-describedby={hintId}
        aria-invalid={error ? true : undefined}
        className="min-h-20 rounded-lg border-2 border-border bg-card px-3 py-2.5 text-base"
      />
      <div className="flex items-start justify-between gap-3 text-xs text-muted-foreground">
        <p id={hintId}>
          {editable
            ? 'Families never see this. It prints on your schedule.'
            : 'You can read this note but not change it.'}
        </p>
        {editable && length >= COUNT_FROM && (
          <p
            aria-live="polite"
            className={cn(
              'shrink-0 tabular-nums',
              length >= MAX_CONFERENCE_NOTE_LENGTH &&
                'font-bold text-foreground',
            )}
          >
            {length}/{MAX_CONFERENCE_NOTE_LENGTH}
          </p>
        )}
      </div>

      {error && (
        <p role="alert" className="flex items-center gap-2 text-sm font-medium">
          <CircleAlert className="size-4 shrink-0 text-destructive" />
          {error}
        </p>
      )}

      {editable && (
        <>
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
                aria-label="Saving"
                className="absolute inset-0 m-auto size-5"
              />
            )}
          </Button>
        </>
      )}
    </form>
  )
}

function saveErrorMessage(error: unknown, firstName: string) {
  if (error instanceof ApiError) {
    switch (error.status) {
      case 400:
        return `That note can’t be saved. Keep it to one line under ${MAX_CONFERENCE_NOTE_LENGTH} characters.`
      case 401:
        return 'Your session has ended. Sign in again to save the note.'
      case 403:
        return 'You can no longer change these conferences.'
      case 404:
        return `${firstName} is no longer in this conference, so the note can’t be saved.`
      case 429:
        return 'Too many changes for now. Wait a minute, then try again.'
    }
    return 'Couldn’t save the note. Please try again.'
  }
  // fetch() throws a TypeError when the server can't be reached.
  return 'Couldn’t reach the server. Check your connection and try again.'
}
