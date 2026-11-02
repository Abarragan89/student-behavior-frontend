import { useId, useState } from 'react'
import {
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Check,
  CircleAlert,
  Copy,
  Link2,
  RefreshCw,
  Share,
  X,
} from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'
import { ApiError } from '#/lib/api'
import { meQueryOptions } from '#/lib/auth'
import type { ClassroomTab } from '#/lib/auth'
import { formatShortDate } from '#/lib/calendar'
import { formatLongDate } from '#/lib/day'
import { localDate } from '#/lib/marks'
import { useOnline } from '#/lib/online'
import {
  createSubLink,
  subLinkQueryOptions,
  turnOffSubLink,
  updateSubLinkClasses,
} from '#/lib/sub-links'
import type { SubLink } from '#/lib/sub-links'
import { OfflineNote } from '#/components/offline-note'
import { ResponsiveDialog } from '#/components/responsive-dialogue'

/**
 * "Share with a substitute", from the day page: a link to this day's plan
 * and the classes the teacher picks, for a sub to open on that day only (no
 * account; see src/lib/sub.ts). One link per day: opening this again shows
 * the same one, to send again, change its classes, or turn it off.
 */
export function ShareDayDialog({
  date,
  open,
  onOpenChange,
}: {
  date: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <ResponsiveDialog
      isOpen={open}
      setIsOpen={onOpenChange}
      title="Share with a substitute"
      description={`A link for ${formatLongDate(date)} only.`}
      showDescription
    >
      {open && <ShareBody date={date} />}
    </ResponsiveDialog>
  )
}

function ShareBody({ date }: { date: string }) {
  // Already loaded by the login check (see _authed.tsx).
  const { data: me } = useSuspenseQuery(meQueryOptions)
  const link = useQuery(subLinkQueryOptions(date))
  if (!me) return null

  if (link.isPending) {
    return (
      <p
        role="status"
        className="flex items-center justify-center gap-2 py-8 font-medium text-muted-foreground"
      >
        <Spinner aria-hidden className="size-5" />
        Checking for a link…
      </p>
    )
  }
  if (link.isError) {
    return (
      <div className="flex flex-col items-center gap-3 py-6 text-center">
        <p className="flex items-center gap-2 font-medium">
          <CircleAlert className="size-5 shrink-0 text-destructive" />
          Couldn’t check for a link.
        </p>
        <OfflineNote action="share this plan" className="justify-center" />
        <Button
          variant="outline"
          onClick={() => void link.refetch()}
          disabled={link.isFetching}
          className="h-11 rounded-lg border-2 border-border font-bold"
        >
          <RefreshCw className={cn(link.isFetching && 'animate-spin')} />
          Try again
        </Button>
      </div>
    )
  }
  return link.data ? (
    <ActiveLink date={date} link={link.data} classrooms={me.classrooms} />
  ) : (
    <NewLink date={date} classrooms={me.classrooms} />
  )
}

/** No link yet: what it opens, which classes, and the button to make it. */
function NewLink({
  date,
  classrooms,
}: {
  date: string
  classrooms: Array<ClassroomTab>
}) {
  const queryClient = useQueryClient()
  const online = useOnline()
  // Subs usually cover the whole day, so every class to start.
  const [picked, setPicked] = useState<ReadonlyArray<string>>(() =>
    classrooms.map((c) => c.id),
  )

  const create = useMutation({
    mutationFn: () => createSubLink(date, inOrder(classrooms, picked)),
    onSuccess: (link) => {
      queryClient.setQueryData(subLinkQueryOptions(date).queryKey, link)
    },
    onError: (error) => {
      console.error('Making the sub link failed:', error)
      toast.error('Couldn’t make the link', {
        description:
          error instanceof ApiError && error.status === 400
            ? 'Links can be made for today and up to 60 days ahead.'
            : 'Check your connection and try again.',
      })
    },
  })

  return (
    <div className="flex flex-col gap-5">
      <WhatTheyGet />
      <ClassPicker
        classrooms={classrooms}
        picked={picked}
        onChange={setPicked}
        disabled={create.isPending}
      />
      <PrivacyNote date={date} />
      <div className="flex flex-col gap-2">
        <OfflineNote action="make a link" />
        <Button
          onClick={() => create.mutate()}
          disabled={!online || create.isPending}
          aria-busy={create.isPending}
          className="h-12 rounded-lg border-2 border-border text-base font-bold shadow-sm"
        >
          {create.isPending ? (
            <Spinner aria-hidden className="size-5" />
          ) : (
            <Link2 className="size-5" />
          )}
          {picked.length === 0 ? 'Make a link (plan only)' : 'Make a link'}
        </Button>
      </div>
    </div>
  )
}

/** The day's link: send it, see if it's been used, change it, turn it off. */
function ActiveLink({
  date,
  link,
  classrooms,
}: {
  date: string
  link: SubLink
  classrooms: Array<ClassroomTab>
}) {
  const queryClient = useQueryClient()
  const online = useOnline()
  const { queryKey } = subLinkQueryOptions(date)
  const fieldId = useId()
  const [confirmOff, setConfirmOff] = useState(false)

  // Saved in the order they're tapped (one scope), showing the newest pick
  // while it's on its way.
  const saveClasses = useMutation({
    mutationFn: (ids: Array<string>) => updateSubLinkClasses(date, ids),
    scope: { id: `sub-link-classes:${date}` },
    onSuccess: (updated) => queryClient.setQueryData(queryKey, updated),
    onError: (error) => {
      console.error('Changing the sub link’s classes failed:', error)
      void queryClient.invalidateQueries({ queryKey })
      toast.error('Couldn’t change the classes', {
        description: 'Check your connection and try again.',
      })
    },
  })
  const picked = saveClasses.isPending
    ? saveClasses.variables
    : link.classroom_ids

  const turnOff = useMutation({
    mutationFn: () => turnOffSubLink(date),
    onSuccess: () => {
      queryClient.setQueryData(queryKey, null)
      setConfirmOff(false)
      toast.success('Link turned off', {
        description: 'It won’t open anymore.',
      })
    },
    onError: (error) => {
      console.error('Turning off the sub link failed:', error)
      toast.error('Couldn’t turn off the link', {
        description: 'Check your connection and try again.',
      })
    },
  })

  // The day is over: there's nothing left to send.
  if (!link.url) {
    return (
      <div className="flex flex-col gap-2 py-2">
        <p className="font-bold">This link has ended.</p>
        <p className="text-sm text-muted-foreground">
          {link.last_used_at
            ? lastUsedText(link.last_used_at)
            : 'It was never opened.'}
        </p>
      </div>
    )
  }
  const url = link.url

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <label htmlFor={fieldId} className="text-sm font-bold">
          Link for the substitute
        </label>
        <Input
          id={fieldId}
          readOnly
          value={url}
          onFocus={(e) => e.currentTarget.select()}
          className="h-11 rounded-lg border-2 border-border bg-card font-mono text-sm md:text-sm"
        />
        <SendButtons url={url} date={date} />
        <p className="text-sm text-muted-foreground">
          {link.last_used_at
            ? lastUsedText(link.last_used_at)
            : 'Not opened yet.'}
        </p>
      </div>

      <ClassPicker
        classrooms={classrooms}
        picked={picked}
        onChange={(ids) => saveClasses.mutate(inOrder(classrooms, ids))}
        disabled={!online}
      />
      <PrivacyNote date={date} />

      <div className="flex flex-col items-start gap-1 border-t border-foreground/10 pt-3">
        <OfflineNote action="change or turn off this link" />
        <Button
          variant="link"
          onClick={() => setConfirmOff(true)}
          disabled={!online}
          className="h-auto px-0 text-base font-bold text-destructive"
        >
          <X className="size-5" />
          Turn off link
        </Button>
      </div>

      <AlertDialog
        open={confirmOff}
        onOpenChange={(next) => {
          if (!turnOff.isPending) setConfirmOff(next)
        }}
      >
        <AlertDialogContent className="rounded-lg border-2 border-border ring-0">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-bold">
              Turn off this link?
            </AlertDialogTitle>
            <AlertDialogDescription>
              The substitute won’t be able to open it anymore. Marks and
              checkmarks they’ve already given stay. You can make a new link
              after.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={turnOff.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => turnOff.mutate()}
              disabled={turnOff.isPending || !online}
              aria-busy={turnOff.isPending}
              // Solid red, like deleting a class: it can't be turned back on.
              // The label stays (invisible) under the spinner so the size
              // holds.
              className={cn(
                'relative bg-destructive font-bold text-destructive-foreground hover:bg-destructive/90',
                turnOff.isPending && 'disabled:opacity-100',
              )}
            >
              <span className={cn(turnOff.isPending && 'invisible')}>
                Turn off
              </span>
              {turnOff.isPending && (
                <Spinner
                  aria-label="Turning off the link"
                  className="absolute inset-0 m-auto size-4"
                />
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

/** The phone's share sheet where there is one, and always Copy. */
function SendButtons({ url, date }: { url: string; date: string }) {
  const canShare = typeof navigator.share === 'function'

  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
      toast.success('Link copied', {
        description: 'Paste it in a text or email to the substitute.',
      })
    } catch {
      toast('Copy this link', { description: url })
    }
  }

  async function share() {
    try {
      await navigator.share({
        title: 'Sub plan',
        text: `My sub plan for ${formatLongDate(date)}. The link works that day only.`,
        url,
      })
    } catch (error) {
      // Closed without sharing.
      if (error instanceof DOMException && error.name === 'AbortError') return
      void copy()
    }
  }

  const buttonClass =
    'h-12 flex-1 rounded-lg border-2 border-border text-base font-bold'
  return (
    <div className="flex gap-2">
      {canShare && (
        <Button
          onClick={() => void share()}
          className={cn(buttonClass, 'shadow-sm')}
        >
          <Share className="size-5" />
          Share…
        </Button>
      )}
      <Button
        variant={canShare ? 'outline' : 'default'}
        onClick={() => void copy()}
        className={cn(buttonClass, canShare ? 'bg-card' : 'shadow-sm')}
      >
        <Copy className="size-5" />
        Copy link
      </Button>
    </div>
  )
}

/** What a sub can and can't do with the link. */
function WhatTheyGet() {
  const can = [
    'See this day’s plan and check off lines',
    'Give marks in the classes you pick',
  ]
  return (
    <ul className="flex flex-col gap-1.5 text-sm">
      {can.map((text) => (
        <li key={text} className="flex items-start gap-2">
          <Check
            aria-hidden
            className="mt-0.5 size-4 shrink-0 text-chart-5"
            strokeWidth={3}
          />
          {text}
        </li>
      ))}
      <li className="flex items-start gap-2 text-muted-foreground">
        <X aria-hidden className="mt-0.5 size-4 shrink-0" strokeWidth={3} />
        No past marks, student pages or other days
      </li>
    </ul>
  )
}

function PrivacyNote({ date }: { date: string }) {
  return (
    <p className="text-sm text-muted-foreground">
      Anyone with the link can see this plan and these class lists on{' '}
      {formatShortDate(date)}. You can turn it off anytime.
    </p>
  )
}

/** The classes the link opens, as checkboxes. */
function ClassPicker({
  classrooms,
  picked,
  onChange,
  disabled,
}: {
  classrooms: Array<ClassroomTab>
  picked: ReadonlyArray<string>
  onChange: (ids: Array<string>) => void
  disabled: boolean
}) {
  return (
    <fieldset className="flex flex-col gap-2" disabled={disabled}>
      <legend className="mb-2 text-sm font-bold">Classes they can open</legend>
      <ul className="flex flex-col gap-2">
        {classrooms.map((c) => (
          <li key={c.id}>
            <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border-2 border-border bg-card px-4 py-2 font-bold transition-colors has-checked:border-primary has-checked:bg-primary/10 has-disabled:cursor-not-allowed has-disabled:opacity-50 motion-reduce:transition-none">
              <input
                type="checkbox"
                checked={picked.includes(c.id)}
                onChange={(e) =>
                  onChange(
                    e.target.checked
                      ? [...picked, c.id]
                      : picked.filter((id) => id !== c.id),
                  )
                }
                className="size-5 shrink-0 accent-primary"
              />
              <span className="min-w-0 flex-1 truncate">{c.name}</span>
            </label>
          </li>
        ))}
      </ul>
    </fieldset>
  )
}

/** The picked ids in the class list's order (the order the sub sees). */
function inOrder(classrooms: Array<ClassroomTab>, ids: ReadonlyArray<string>) {
  return classrooms.filter((c) => ids.includes(c.id)).map((c) => c.id)
}

/** "Last used at 9:41 AM", or with the day when it wasn't today. */
function lastUsedText(at: string) {
  const d = new Date(at)
  const time = d.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  })
  if (localDate(d) === localDate()) return `Last used at ${time}.`
  const day = d.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
  return `Last used ${day}, ${time}.`
}
