import { useEffect } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import {
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query'
import { Building2, CircleAlert, RefreshCw, WifiOff } from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
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
import { SchoolAdminHub } from '#/components/school/school-admin-hub'
import { SchoolMemberView } from '#/components/school/school-member-view'
import { meQueryOptions } from '#/lib/auth'
import { schoolQueryOptions, setMySchool } from '#/lib/school'

// /school: your school. The administrator gets the join link first, then
// the staff list; a teacher sees the school and can leave. Always the
// signed-in person's own school, even in a classroom they co-teach, so it
// declares no co-teacher feature.
export const Route = createFileRoute('/_authed/school/')({
  validateSearch: (search: Record<string, unknown>): { welcome?: boolean } => ({
    welcome:
      search.welcome === true || search.welcome === 'true' ? true : undefined,
  }),
  loader: ({ context: { queryClient } }) => {
    void queryClient.query(schoolQueryOptions).catch(() => null)
  },
  component: SchoolPage,
})

function SchoolPage() {
  const { welcome } = Route.useSearch()
  // Already loaded by the login check in _authed.tsx.
  const { data: me } = useSuspenseQuery(meQueryOptions)
  const school = useQuery(schoolQueryOptions)
  const queryClient = useQueryClient()
  const detail = school.data

  // Joined or left on another device: bring the menus up to date.
  const meSchool = me?.school?.id ?? null
  const actual = detail === undefined ? undefined : (detail?.school.id ?? null)
  useEffect(() => {
    if (actual !== undefined && actual !== meSchool) {
      setMySchool(
        queryClient,
        detail
          ? {
              id: detail.school.id,
              name: detail.school.name,
              role: detail.role,
            }
          : null,
      )
    }
  }, [actual, meSchool, detail, queryClient])

  if (!me) return null

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 py-10">
      <h1 className="text-2xl font-bold">School</h1>
      {detail ? (
        detail.role === 'admin' ? (
          <SchoolAdminHub
            detail={detail}
            adminName={me.teacher.name}
            welcome={welcome === true}
          />
        ) : (
          <SchoolMemberView detail={detail} />
        )
      ) : detail === null ? (
        <NoSchool />
      ) : school.fetchStatus === 'paused' ? (
        <p
          role="status"
          className="flex items-center gap-2 text-sm font-medium text-muted-foreground"
        >
          <WifiOff className="size-4 shrink-0" />
          You’re offline. Connect to the internet to see your school.
        </p>
      ) : school.isError ? (
        <div role="alert" className="flex flex-col items-start gap-3">
          <p className="flex items-center gap-2 font-medium">
            <CircleAlert className="size-5 shrink-0 text-destructive" />
            Couldn’t load your school.
          </p>
          <Button
            variant="outline"
            onClick={() => void school.refetch()}
            disabled={school.isFetching}
            className="h-10 rounded-lg border-2 font-bold"
          >
            <RefreshCw className={cn(school.isFetching && 'animate-spin')} />
            Try again
          </Button>
        </div>
      ) : (
        <p
          role="status"
          className="flex items-center gap-2 font-medium text-muted-foreground"
        >
          <Spinner aria-hidden className="size-5" />
          Loading your school…
        </p>
      )}
    </main>
  )
}

function NoSchool() {
  return (
    <Empty className="rounded-xl border-2 border-dashed border-border">
      <EmptyHeader>
        <EmptyMedia
          variant="icon"
          className="size-12 rounded-lg bg-chart-3 text-foreground"
        >
          <Building2 className="size-6" />
        </EmptyMedia>
        <EmptyTitle className="text-lg font-bold">
          You’re not in a school
        </EmptyTitle>
        <EmptyDescription>
          Part of a school? Ask your administrator for the join link.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Link
          to="/school/start"
          className={cn(buttonVariants(), 'h-11 rounded-lg px-5 font-bold')}
        >
          Start a school
        </Link>
      </EmptyContent>
    </Empty>
  )
}
