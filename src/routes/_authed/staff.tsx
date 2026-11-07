import { useMemo, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useSuspenseQuery } from '@tanstack/react-query'
import {
  CircleAlert,
  EllipsisVertical,
  FileUp,
  Pencil,
  RefreshCw,
  Search,
  UserMinus,
  UserPlus,
  UsersRound,
  WifiOff,
} from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import { GroupDialog } from '#/components/staff/group-dialog'
import { ImportDialog } from '#/components/staff/import-dialog'
import { matchesSearch } from '#/components/staff/people-checklist'
import {
  PersonDialog,
  RemovePersonDialog,
} from '#/components/staff/person-dialog'
import { meQueryOptions } from '#/lib/auth'
import type { Me } from '#/lib/auth'
import { useEnsureSchoolTimezone } from '#/lib/school'
import { displayName, staffInitials, staffQueryOptions } from '#/lib/staff'
import type { StaffDirectory, StaffGroup, StaffPerson } from '#/lib/staff'
import { useOnline } from '#/lib/online'
import { isSchoolAdmin } from '#/lib/workspace'

// /staff: a school administrator's staff list and groups. Everyone they
// manage, by email, whether or not they use TeachForFree: imported from
// Google, pasted, or added one at a time. Events and reminders use it.
export const Route = createFileRoute('/_authed/staff')({
  staticData: { schoolAdmin: true },
  loader: ({ context: { queryClient } }) => {
    const me = queryClient.getQueryData<Me | null>(meQueryOptions.queryKey)
    if (me !== undefined && !isSchoolAdmin(me)) return
    void queryClient.query(staffQueryOptions).catch(() => null)
  },
  component: StaffPage,
})

// The Students | Groups segmented control on the Classes page.
const tabsListClass =
  'gap-0.5 rounded-lg border-2 border-border bg-card p-0.5 group-data-horizontal/tabs:h-10'
const tabClass = cn(
  'rounded-md px-3 text-base font-bold text-foreground transition-colors not-data-active:hover:bg-muted focus-visible:ring-4 focus-visible:ring-ring focus-visible:outline-none motion-reduce:transition-none dark:text-foreground',
  'data-active:bg-primary data-active:text-primary-foreground dark:data-active:bg-primary dark:data-active:text-primary-foreground',
)

function StaffPage() {
  const { data: me } = useSuspenseQuery(meQueryOptions)
  const staff = useQuery(staffQueryOptions)
  const online = useOnline()
  useEnsureSchoolTimezone()
  const [tab, setTab] = useState<'people' | 'groups'>('people')
  const [importOpen, setImportOpen] = useState(false)
  const [editing, setEditing] = useState<StaffPerson | null | 'new'>(null)
  const [removing, setRemoving] = useState<StaffPerson | null>(null)
  const [group, setGroup] = useState<StaffGroup | null | 'new'>(null)

  if (!me?.school) return null
  const d = staff.data

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-5 px-4 py-8 sm:py-10">
      <div className="flex flex-wrap items-center justify-between gap-3 max-md:pr-12">
        <h1 className="text-2xl font-bold">Staff</h1>
        {d && d.people.length > 1 && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setEditing('new')}
              disabled={!online}
              className="h-10 rounded-lg border-2 px-3 font-bold"
            >
              <UserPlus />
              Add person
            </Button>
            <Button
              onClick={() => setImportOpen(true)}
              disabled={!online}
              className="h-10 rounded-lg px-3 font-bold"
            >
              <FileUp />
              Import
            </Button>
          </div>
        )}
      </div>

      {!d ? (
        <LoadState staff={staff} />
      ) : d.people.length <= 1 ? (
        <GetStarted
          onImport={() => setImportOpen(true)}
          onAdd={() => setEditing('new')}
          online={online}
        />
      ) : (
        <Tabs
          value={tab}
          onValueChange={(v: 'people' | 'groups') => setTab(v)}
          className="gap-4"
        >
          <TabsList aria-label="Show" activateOnFocus className={tabsListClass}>
            <TabsTrigger value="people" className={tabClass}>
              People ({d.people.length})
            </TabsTrigger>
            <TabsTrigger value="groups" className={tabClass}>
              Groups ({d.groups.length})
            </TabsTrigger>
          </TabsList>
          <TabsContent value="people" tabIndex={-1}>
            <PeopleTab
              directory={d}
              onEdit={setEditing}
              onRemove={setRemoving}
            />
          </TabsContent>
          <TabsContent value="groups" tabIndex={-1}>
            <GroupsTab directory={d} onOpen={setGroup} />
          </TabsContent>
        </Tabs>
      )}

      {d && (
        <>
          <ImportDialog
            open={importOpen}
            onOpenChange={setImportOpen}
            directory={d}
          />
          <PersonDialog
            open={editing !== null}
            onOpenChange={(open) => !open && setEditing(null)}
            person={editing === 'new' ? null : editing}
            groups={d.groups}
          />
          <GroupDialog
            open={group !== null}
            onOpenChange={(open) => !open && setGroup(null)}
            group={group === 'new' ? null : group}
            people={d.people}
          />
        </>
      )}
      <RemovePersonDialog
        person={removing}
        schoolName={me.school.name}
        onClose={() => setRemoving(null)}
      />
    </main>
  )
}

function LoadState({
  staff,
}: {
  staff: ReturnType<typeof useQuery<StaffDirectory>>
}) {
  if (staff.fetchStatus === 'paused') {
    return (
      <p
        role="status"
        className="flex items-center gap-2 text-sm font-medium text-muted-foreground"
      >
        <WifiOff className="size-4 shrink-0" />
        You’re offline. Connect to the internet to see your staff.
      </p>
    )
  }
  if (staff.isError) {
    return (
      <div role="alert" className="flex flex-col items-start gap-3">
        <p className="flex items-center gap-2 font-medium">
          <CircleAlert className="size-5 shrink-0 text-destructive" />
          Couldn’t load your staff.
        </p>
        <Button
          variant="outline"
          onClick={() => void staff.refetch()}
          disabled={staff.isFetching}
          className="h-10 rounded-lg border-2 font-bold"
        >
          <RefreshCw className={cn(staff.isFetching && 'animate-spin')} />
          Try again
        </Button>
      </div>
    )
  }
  return (
    <p
      role="status"
      className="flex items-center gap-2 font-medium text-muted-foreground"
    >
      <Spinner aria-hidden className="size-5" />
      Loading your staff…
    </p>
  )
}

/** Only the administrator on the list so far: how to bring everyone in. */
function GetStarted({
  onImport,
  onAdd,
  online,
}: {
  onImport: () => void
  onAdd: () => void
  online: boolean
}) {
  return (
    <Empty className="rounded-xl border-2 border-dashed border-border">
      <EmptyHeader>
        <EmptyMedia
          variant="icon"
          className="size-12 rounded-lg bg-chart-3 text-foreground"
        >
          <UsersRound className="size-6" />
        </EmptyMedia>
        <EmptyTitle className="text-lg font-bold">
          Bring in your staff
        </EmptyTitle>
        <EmptyDescription>
          Import everyone from Google Admin, or paste their emails. They don’t
          need to use TeachForFree: you’ll invite them to events, and they’ll
          get email reminders.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent className="flex-row flex-wrap justify-center gap-2">
        <Button
          onClick={onImport}
          disabled={!online}
          className="h-11 rounded-lg px-4 font-bold"
        >
          <FileUp />
          Import from Google
        </Button>
        <Button
          variant="outline"
          onClick={onAdd}
          disabled={!online}
          className="h-11 rounded-lg border-2 px-4 font-bold"
        >
          <UserPlus />
          Add one person
        </Button>
      </EmptyContent>
    </Empty>
  )
}

/** How many rows show at once; search narrows the rest. */
const SHOWN = 200

function PeopleTab({
  directory,
  onEdit,
  onRemove,
}: {
  directory: StaffDirectory
  onEdit: (p: StaffPerson) => void
  onRemove: (p: StaffPerson) => void
}) {
  const [query, setQuery] = useState('')
  const online = useOnline()
  const groupsOf = useMemo(() => {
    const map = new Map<string, Array<string>>()
    for (const g of directory.groups) {
      for (const id of g.staff_ids)
        map.set(id, [...(map.get(id) ?? []), g.name])
    }
    return map
  }, [directory.groups])
  const matches = useMemo(
    () => directory.people.filter((p) => matchesSearch(p, query.trim())),
    [directory.people, query],
  )
  const shown = matches.slice(0, SHOWN)

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <Search
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          type="search"
          aria-label="Search staff"
          placeholder="Search by name, email, title or department"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="h-11 rounded-lg border-2 border-border bg-card pl-9 text-base"
        />
      </div>
      <ul className="flex flex-col divide-y-2 divide-border rounded-xl border-2 border-border bg-card">
        {shown.length === 0 && (
          <li className="px-4 py-6 text-sm text-muted-foreground">
            Nobody matches that search.
          </li>
        )}
        {shown.map((p) => {
          const groups = groupsOf.get(p.id) ?? []
          return (
            <li
              key={p.id}
              className="flex items-center gap-3 px-3 py-2.5 sm:px-4"
            >
              <Avatar aria-hidden className="size-10 shrink-0 after:hidden">
                <AvatarFallback className="bg-muted text-sm font-bold text-foreground">
                  {staffInitials(p)}
                </AvatarFallback>
              </Avatar>
              <div className="flex min-w-0 flex-1 flex-col">
                <p className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
                  <span className="truncate font-bold">{displayName(p)}</span>
                  {p.is_admin && (
                    <Badge variant="secondary">Administrator</Badge>
                  )}
                  {p.uses_app && !p.is_admin && (
                    <Badge variant="secondary">Uses TeachForFree</Badge>
                  )}
                  {p.opted_out && <Badge variant="outline">Unsubscribed</Badge>}
                </p>
                <p className="truncate text-sm text-muted-foreground">
                  {[
                    p.email !== displayName(p) && p.email,
                    p.title,
                    p.department,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
                {groups.length > 0 && (
                  <p className="truncate text-xs text-muted-foreground">
                    {groups.join(', ')}
                  </p>
                )}
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger
                  aria-label={`More for ${displayName(p)}`}
                  className="flex size-10 shrink-0 items-center justify-center rounded-lg text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-4 focus-visible:ring-ring"
                >
                  <EllipsisVertical className="size-5" />
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="w-48 rounded-lg border-2 border-border p-1 shadow-md ring-0"
                >
                  <DropdownMenuItem
                    className="h-10 rounded-md font-bold"
                    disabled={!online}
                    onClick={() => onEdit(p)}
                  >
                    <Pencil />
                    Edit
                  </DropdownMenuItem>
                  {!p.is_admin && (
                    <DropdownMenuItem
                      className="h-10 rounded-md font-bold text-destructive"
                      disabled={!online}
                      onClick={() => onRemove(p)}
                    >
                      <UserMinus />
                      Remove
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </li>
          )
        })}
      </ul>
      {matches.length > shown.length && (
        <p className="text-sm text-muted-foreground">
          Showing {shown.length} of {matches.length}. Search to find someone
          else.
        </p>
      )}
    </div>
  )
}

function GroupsTab({
  directory,
  onOpen,
}: {
  directory: StaffDirectory
  onOpen: (g: StaffGroup | 'new') => void
}) {
  const online = useOnline()
  const byId = useMemo(
    () => new Map(directory.people.map((p) => [p.id, p])),
    [directory.people],
  )
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        Invite a whole group to an event at once. Someone can be in any number
        of groups.
      </p>
      <ul className="grid gap-3 sm:grid-cols-2">
        {directory.groups.map((g) => {
          const names = g.staff_ids
            .map((id) => byId.get(id))
            .filter((p): p is StaffPerson => !!p)
            .map(displayName)
          return (
            <li key={g.id} className="flex">
              <button
                type="button"
                onClick={() => onOpen(g)}
                disabled={!online}
                className="flex w-full flex-col items-start gap-1 rounded-xl border-2 border-border bg-card p-4 text-left shadow-md transition-colors outline-none hover:bg-muted focus-visible:ring-4 focus-visible:ring-ring disabled:cursor-not-allowed motion-reduce:transition-none"
              >
                <span className="font-bold">{g.name}</span>
                <span className="text-sm text-muted-foreground">
                  {names.length} {names.length === 1 ? 'person' : 'people'}
                </span>
                {names.length > 0 && (
                  <span className="line-clamp-2 text-sm">
                    {names.slice(0, 6).join(', ')}
                    {names.length > 6 && ` and ${names.length - 6} more`}
                  </span>
                )}
              </button>
            </li>
          )
        })}
        <li className="flex">
          <button
            type="button"
            onClick={() => onOpen('new')}
            disabled={!online}
            className="flex min-h-24 w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border p-4 font-bold text-muted-foreground transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-4 focus-visible:ring-ring disabled:cursor-not-allowed motion-reduce:transition-none"
          >
            <UsersRound className="size-5" />
            New group
          </button>
        </li>
      </ul>
    </div>
  )
}
