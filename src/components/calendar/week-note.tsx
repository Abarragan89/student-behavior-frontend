import { useId, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Megaphone, Pencil } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { OfflineNote } from '#/components/offline-note'
import { ApiError } from '#/lib/api'
import { formatWeekRange } from '#/lib/calendar'
import { addDays } from '#/lib/day'
import {
  DEFAULT_WEEK_NOTE,
  MAX_WEEK_NOTE,
  cacheWeekNote,
  saveWeekNote,
} from '#/lib/school-calendar'

/**
 * The week's message under its days: reminders, a theme or goals that
 * aren't events, or "Have a great week!" when there's none. Calendar
 * editors change it in place until the week is over; everyone else reads
 * it. Give it `key={week}` so paging to another week drops an open edit.
 */
export function WeekNote({
  week,
  text,
  today,
  canEdit = false,
  loading = false,
}: {
  /** The week's Monday. */
  week: string
  /** Its message; '' for none. */
  text: string
  today: string
  canEdit?: boolean
  /** Another week's calendar is still loading: faded, and no editing. */
  loading?: boolean
}) {
  const [draft, setDraft] = useState<string | null>(null)
  const editable = canEdit && !loading && addDays(week, 6) >= today
  if (draft !== null && editable) {
    return (
      <WeekNoteForm
        week={week}
        draft={draft}
        onDraft={setDraft}
        onDone={() => setDraft(null)}
        unchanged={draft.trim() === text}
      />
    )
  }
  return (
    <section
      aria-label="The week’s message"
      aria-busy={loading || undefined}
      className={cn(
        'flex items-start gap-3 rounded-lg border-2 border-border bg-card px-4 py-3 shadow-sm transition-opacity motion-reduce:transition-none',
        loading && 'opacity-60',
      )}
    >
      <Megaphone aria-hidden className="mt-0.5 size-5 shrink-0 text-primary" />
      <p className="min-w-0 flex-1 font-semibold whitespace-pre-line wrap-break-word">
        {text || DEFAULT_WEEK_NOTE}
      </p>
      {editable && (
        <Button
          variant="ghost"
          onClick={() => setDraft(text)}
          // The categories have an Edit button too.
          aria-label={text ? 'Edit the week’s message' : undefined}
          className="-my-1.5 -mr-2 h-9 shrink-0 rounded-lg px-2.5 font-bold"
        >
          <Pencil />
          {/* On phones the message keeps the width: just the pencil. */}
          {text ? (
            <span className="max-sm:sr-only">Edit</span>
          ) : (
            'Add a message'
          )}
        </Button>
      )}
    </section>
  )
}

function WeekNoteForm({
  week,
  draft,
  onDraft,
  onDone,
  unchanged,
}: {
  week: string
  draft: string
  onDraft: (text: string) => void
  onDone: () => void
  unchanged: boolean
}) {
  const id = useId()
  const queryClient = useQueryClient()
  const save = useMutation({
    mutationFn: (text: string) => saveWeekNote(week, text.trim()),
    onSuccess: (note) => {
      cacheWeekNote(queryClient, note)
      onDone()
      toast.success(note.text ? 'Message saved' : 'Message removed')
    },
    onError: (error) => {
      console.error('Saving the week’s message failed:', error)
      toast.error(
        error instanceof ApiError && error.reason === 'past'
          ? 'That week is over, so its message can’t change.'
          : 'Couldn’t save the message. Try again.',
      )
    },
  })
  const busy = save.isPending
  const submit = () => {
    if (unchanged) onDone()
    else save.mutate(draft)
  }
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
      className="flex flex-col gap-2 rounded-lg border-2 border-primary bg-card p-3 shadow-sm"
    >
      <label htmlFor={id} className="font-bold">
        Message for {formatWeekRange(week)}
      </label>
      <Textarea
        id={id}
        value={draft}
        onChange={(e) => onDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault()
            submit()
          }
        }}
        maxLength={MAX_WEEK_NOTE}
        rows={3}
        autoFocus
        disabled={busy}
        aria-describedby={`${id}-hint`}
        className="rounded-lg border-2 border-border bg-card text-base"
      />
      <div className="flex flex-wrap items-start gap-x-3 gap-y-1 text-sm text-muted-foreground">
        <p id={`${id}-hint`} className="mr-auto">
          Reminders, a theme or goals for the week. Leave it empty to show “
          {DEFAULT_WEEK_NOTE}”
        </p>
        <span className="tabular-nums">
          {draft.length}/{MAX_WEEK_NOTE}
        </span>
      </div>
      <OfflineNote action="save the message" />
      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={onDone}
          disabled={busy}
          className="h-10 rounded-lg border-2 px-4 font-bold"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={busy}
          className="h-10 rounded-lg px-4 font-bold"
        >
          {busy && <Spinner aria-hidden />}
          Save
        </Button>
      </div>
    </form>
  )
}

/**
 * The week's message on paper, under the printed week: kept whole, so a
 * page that must break breaks before it.
 */
export function PrintWeekNote({ text }: { text: string }) {
  return (
    <div className="mt-2 flex break-inside-avoid items-start gap-2 rounded-md border border-neutral-400 px-2.5 py-1.5 text-sm font-semibold">
      <Megaphone aria-hidden className="mt-0.5 size-4 shrink-0" />
      <p className="min-w-0 whitespace-pre-line wrap-break-word">
        {text || DEFAULT_WEEK_NOTE}
      </p>
    </div>
  )
}
