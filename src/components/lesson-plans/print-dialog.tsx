import {
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query'
import { toast } from 'sonner'
import { Printer, QrCode, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { ApiError } from '#/lib/api'
import { meQueryOptions } from '#/lib/auth'
import type { ClassroomTab } from '#/lib/auth'
import { formatLongDate } from '#/lib/day'
import { useOnline } from '#/lib/online'
import { createSubLink, subLinkQueryOptions } from '#/lib/sub-links'
import type { SubLink } from '#/lib/sub-links'
import { OfflineNote } from '#/components/offline-note'
import { ResponsiveDialog } from '#/components/responsive-dialogue'

/**
 * Asked when printing a plan for today or later: add a QR code for a
 * substitute at the top of the printout? It uses the day's sub link (the
 * one from Share, unchanged), or makes one for all the teacher's classes.
 * onPrint gets the link to print, or null for a plain printout.
 */
export function PrintDialog({
  date,
  open,
  onOpenChange,
  onPrint,
}: {
  date: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onPrint: (subLink: string | null) => void
}) {
  return (
    <ResponsiveDialog
      isOpen={open}
      setIsOpen={onOpenChange}
      title="Add a QR code for a sub?"
      description={`For ${formatLongDate(date)}`}
      showDescription
    >
      {open && <PrintChoice date={date} onPrint={onPrint} />}
    </ResponsiveDialog>
  )
}

function PrintChoice({
  date,
  onPrint,
}: {
  date: string
  onPrint: (subLink: string | null) => void
}) {
  const queryClient = useQueryClient()
  const online = useOnline()
  // Already loaded by the login check (see _authed.tsx).
  const { data: me } = useSuspenseQuery(meQueryOptions)
  const classrooms = me?.classrooms ?? []
  const link = useQuery(subLinkQueryOptions(date))
  const existing = link.data?.url ? link.data : null

  const create = useMutation({
    // Every class: a sub covering the whole day needs them all. If a link
    // was made meanwhile, the server answers with that one, unchanged.
    mutationFn: () =>
      createSubLink(
        date,
        classrooms.map((c) => c.id),
      ),
    onSuccess: (made) => {
      queryClient.setQueryData(subLinkQueryOptions(date).queryKey, made)
      if (made.url) onPrint(made.url)
    },
    onError: (error) => {
      console.error('Making the sub link for printing failed:', error)
      toast.error('Couldn’t make the QR code', {
        description:
          error instanceof ApiError && error.status === 400
            ? 'Sub links can be made for today and up to 60 days ahead.'
            : 'Check your connection and try again, or print without it.',
      })
    },
  })

  function printWithQr() {
    // Straight away when the link is known, so it's still part of the tap
    // (browsers can refuse to print later).
    if (existing?.url) onPrint(existing.url)
    else create.mutate()
  }

  const busy = create.isPending
  const canMake = online || existing !== null

  return (
    <div className="flex flex-col gap-4">
      <p>
        If someone’s covering for you, a QR code at the top of the printout
        opens this plan on their phone, so they can check off lines and give
        behavior marks to your classes. No account needed.
      </p>
      {existing && (
        <p className="text-sm text-muted-foreground">
          It uses the sub link you already made for this day, which opens{' '}
          {linkedClasses(existing, classrooms)}.
        </p>
      )}

      {/* Paper gets left around: say plainly who else could use it. */}
      <p className="flex items-start gap-2 rounded-lg border-2 border-border bg-chart-3/25 p-3 text-sm">
        <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
        <span>
          Anyone who scans this code can see your plan and class lists, and give
          marks, until midnight. Keep the printout with your sub, not out on
          your desk. You can turn the link off anytime with Share.
        </span>
      </p>

      <div className="flex flex-col gap-2">
        {!canMake && <OfflineNote action="add a QR code" />}
        <Button
          onClick={printWithQr}
          disabled={!canMake || busy}
          aria-busy={busy}
          className="h-12 rounded-lg border-2 border-border text-base font-bold shadow-sm"
        >
          {busy ? (
            <Spinner aria-hidden className="size-5" />
          ) : (
            <QrCode className="size-5" />
          )}
          {busy ? 'Making the link…' : 'Print with QR code'}
        </Button>
        <Button
          variant="outline"
          onClick={() => onPrint(null)}
          disabled={busy}
          className="h-12 rounded-lg border-2 border-border bg-card text-base font-bold"
        >
          <Printer className="size-5" />
          Print without
        </Button>
      </div>
    </div>
  )
}

/** "Period 3 Math and Advisory", or "just the plan". */
function linkedClasses(link: SubLink, classrooms: Array<ClassroomTab>) {
  const names = classrooms
    .filter((c) => link.classroom_ids.includes(c.id))
    .map((c) => c.name)
  if (names.length === 0) return 'just the plan'
  return new Intl.ListFormat(undefined, { type: 'conjunction' }).format(names)
}
