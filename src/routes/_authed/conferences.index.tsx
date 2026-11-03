import { Link, createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import {
  CalendarClock,
  ChevronRight,
  CircleAlert,
  Plus,
  RefreshCw,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'
import { conferencesQueryOptions } from '#/lib/conferences'
import type { ConferenceSummary } from '#/lib/conferences'
import { useOnline } from '#/lib/online'
import { mayLoad, usePermission } from '#/lib/workspace'
import { OfflineNote } from '#/components/offline-note'
import { SettingsDialog } from '#/components/conferences/settings-dialog'

// /conferences: the teacher's parent conferences. ?new=true opens "New
// parent conferences" (from the Add menu).
export const Route = createFileRoute('/_authed/conferences/')({
  // A co-teacher needs at least View on Conferences (_authed.tsx checks).
  staticData: { feature: { key: 'conferences', level: 'view' } },
  validateSearch: (search: Record<string, unknown>): { new?: boolean } => ({
    new: search.new === true || search.new === 'true' ? true : undefined,
  }),
  loader: ({ context: { queryClient } }) => {
    if (!mayLoad(queryClient, 'conferences')) return
    void queryClient.query(conferencesQueryOptions).catch(() => null)
  },
  component: ConferencesPage,
})

function ConferencesPage() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const online = useOnline()
  // A co-teacher with View only sees the conferences, sets none up.
  const editable = usePermission('conferences') === 'edit'
  const list = useQuery(conferencesQueryOptions)
  const creating = search.new === true && editable
  const setCreating = (open: boolean) =>
    void navigate({ search: { new: open || undefined }, replace: true })

  return (
    <main className="mx-auto flex w-full max-w-3xl min-w-0 flex-1 flex-col gap-6 px-4 py-6 sm:py-8">
      {/* Phones: New goes under the title, which shares its row with the
          avatar (see _authed.tsx). */}
      <header className="flex flex-col items-start gap-3 max-md:pr-12 md:flex-row md:items-center md:justify-between">
        <h1 className="text-2xl font-bold">Parent conferences</h1>
        {list.data && list.data.length > 0 && editable && (
          <Button
            onClick={() => setCreating(true)}
            disabled={!online}
            className="h-11 rounded-lg border-2 border-border font-bold shadow-sm"
          >
            <Plus className="size-5" />
            New
          </Button>
        )}
      </header>

      {list.data ? (
        list.data.length === 0 ? (
          <Empty className="rounded-xl border-2 border-dashed border-border px-4 py-10">
            <EmptyHeader>
              <EmptyMedia
                variant="icon"
                className="size-14 rounded-lg border-2 border-border bg-chart-3 text-foreground"
              >
                <CalendarClock className="size-7" />
              </EmptyMedia>
              <EmptyTitle className="text-xl font-bold">
                Schedule parent conferences
              </EmptyTitle>
              <EmptyDescription className="text-base">
                Set up conference times, put each student in one, and print a
                notice for each family in English and Spanish. A QR code on the
                notice lets the family pick another open time.
              </EmptyDescription>
            </EmptyHeader>
            {editable && (
              <EmptyContent>
                <OfflineNote action="set up conferences" />
                <Button
                  onClick={() => setCreating(true)}
                  disabled={!online}
                  className="h-12 rounded-lg border-2 border-border px-6 text-base font-bold shadow-sm"
                >
                  <Plus className="size-5" />
                  Set up conferences
                </Button>
              </EmptyContent>
            )}
          </Empty>
        ) : (
          <ul className="flex flex-col gap-3">
            {list.data.map((c) => (
              <li key={c.id}>
                <ConferenceCard conference={c} />
              </li>
            ))}
          </ul>
        )
      ) : list.isError ? (
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <p className="flex items-center gap-2 font-medium">
            <CircleAlert className="size-5 shrink-0 text-destructive" />
            {online
              ? 'Couldn’t load your conferences.'
              : 'You’re offline. Connect to the internet to see your conferences.'}
          </p>
          <Button
            variant="outline"
            onClick={() => void list.refetch()}
            disabled={list.isFetching}
            className="h-11 rounded-lg border-2 border-border font-bold"
          >
            <RefreshCw className={cn(list.isFetching && 'animate-spin')} />
            Try again
          </Button>
        </div>
      ) : (
        <p
          role="status"
          className="flex items-center justify-center gap-2 py-16 font-medium text-muted-foreground"
        >
          <Spinner aria-hidden className="size-5" />
          Loading…
        </p>
      )}

      <SettingsDialog open={creating} onOpenChange={setCreating} />
    </main>
  )
}

function ConferenceCard({ conference: c }: { conference: ConferenceSummary }) {
  return (
    <Link
      to="/conferences/$conferenceId"
      params={{ conferenceId: c.id }}
      className="flex items-center gap-3 rounded-xl border-2 border-border bg-card p-4 shadow-md transition-colors hover:bg-muted focus-visible:ring-4 focus-visible:ring-ring focus-visible:outline-none motion-reduce:transition-none"
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <h2 className="truncate text-lg font-bold">{c.title}</h2>
        <p className="text-sm text-muted-foreground">
          {c.first_starts_at && c.last_ends_at
            ? dateSpan(c.first_starts_at, c.last_ends_at, c.timezone)
            : 'No times yet'}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium">
            {c.booked_count} of {c.slot_count}{' '}
            {c.slot_count === 1 ? 'time' : 'times'} taken
          </span>
          {!c.parent_changes && (
            <Badge variant="secondary">Family changes off</Badge>
          )}
          {c.last_ends_at && Date.parse(c.last_ends_at) < Date.now() && (
            <Badge variant="outline">Over</Badge>
          )}
        </div>
      </div>
      <ChevronRight aria-hidden className="size-5 shrink-0" />
    </Link>
  )
}

/** "Nov 12 – 14", in the conference's time zone. */
function dateSpan(first: string, last: string, timeZone: string) {
  return new Intl.DateTimeFormat(undefined, {
    timeZone,
    month: 'short',
    day: 'numeric',
  }).formatRange(new Date(first), new Date(last))
}
