import { useId, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { OfflineNote } from '#/components/offline-note'
import { ResponsiveDialog } from '#/components/responsive-dialogue'
import { ApiError } from '#/lib/api'
import { useOnline } from '#/lib/online'
import {
  LINK_DAYS,
  MAX_STAFF,
  createSchoolInvite,
  schoolQueryOptions,
} from '#/lib/school'
import type { LinkDays, SchoolDetail } from '#/lib/school'

/**
 * "Make a new link": how long it works and how many teachers may join with
 * it. The old link stops working.
 */
export function NewLinkDialog({
  open,
  onOpenChange,
  staffEstimate,
  replacing,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  staffEstimate: number | null
  /** A link that still works will stop working. */
  replacing: boolean
}) {
  return (
    <ResponsiveDialog
      isOpen={open}
      setIsOpen={onOpenChange}
      title="Make a new link"
      description={
        replacing
          ? 'Your current link stops working. Teachers who joined stay.'
          : 'Send it to the teachers who haven’t joined yet.'
      }
      showDescription
    >
      {/* Remounted each time it opens, so it starts from the defaults. */}
      {open && (
        <NewLinkForm
          staffEstimate={staffEstimate}
          onDone={() => onOpenChange(false)}
        />
      )}
    </ResponsiveDialog>
  )
}

function NewLinkForm({
  staffEstimate,
  onDone,
}: {
  staffEstimate: number | null
  onDone: () => void
}) {
  const id = useId()
  const online = useOnline()
  const queryClient = useQueryClient()
  const [days, setDays] = useState<LinkDays>(30)
  const [max, setMax] = useState(staffEstimate ? String(staffEstimate) : '')

  const maxNumber = max.trim() === '' ? null : Number(max)
  const maxValid =
    maxNumber === null ||
    (Number.isInteger(maxNumber) && maxNumber >= 1 && maxNumber <= MAX_STAFF)

  const make = useMutation({
    mutationFn: () =>
      createSchoolInvite({ expires_in_days: days, max_uses: maxNumber }),
    onSuccess: (invite) => {
      queryClient.setQueryData<SchoolDetail | null>(
        schoolQueryOptions.queryKey,
        (d) => d && { ...d, invite },
      )
      onDone()
      toast.success('New link ready', {
        description: 'Copy it and send it to your staff.',
      })
    },
    onError: (error) => {
      console.error('Making a join link failed:', error)
      toast.error(
        error instanceof ApiError && error.status === 429
          ? 'Too many new links. Wait a little and try again.'
          : 'Couldn’t make the link. Try again.',
      )
    },
  })
  const busy = make.isPending

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        if (maxValid && !busy) make.mutate()
      }}
      className="flex flex-col gap-6"
    >
      <fieldset disabled={busy} className="flex flex-col gap-2">
        <legend className="text-base font-bold">How long it works</legend>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {LINK_DAYS.map((d) => (
            <label
              key={d}
              className="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-border bg-card px-2 py-2 text-sm font-bold transition-colors has-checked:border-primary has-checked:bg-primary/10 has-focus-visible:ring-4 has-focus-visible:ring-ring has-disabled:cursor-not-allowed has-disabled:opacity-50 motion-reduce:transition-none"
            >
              <input
                type="radio"
                name={`${id}-days`}
                value={d}
                checked={days === d}
                onChange={() => setDays(d)}
                className="size-4 shrink-0 accent-primary"
              />
              {d} days
            </label>
          ))}
        </div>
      </fieldset>

      <div className="flex flex-col gap-2">
        <label htmlFor={`${id}-max`} className="text-base font-bold">
          How many teachers can join with it
        </label>
        <Input
          id={`${id}-max`}
          type="number"
          inputMode="numeric"
          min={1}
          max={MAX_STAFF}
          value={max}
          onChange={(e) => setMax(e.target.value)}
          placeholder="No limit"
          disabled={busy}
          aria-describedby={`${id}-max-about`}
          aria-invalid={!maxValid || undefined}
          className="h-11 rounded-lg border-2 border-border bg-card text-base"
        />
        <p id={`${id}-max-about`} className="text-sm text-muted-foreground">
          {maxValid
            ? 'Leave it empty for no limit.'
            : `Enter a whole number from 1 to ${MAX_STAFF}, or leave it empty.`}
        </p>
      </div>

      <OfflineNote action="make a link" />
      <Button
        type="submit"
        disabled={!online || busy || !maxValid}
        aria-busy={busy}
        className="h-12 rounded-lg text-base font-bold"
      >
        {busy && <Spinner aria-hidden className="size-4" />}
        Make link
      </Button>
    </form>
  )
}
