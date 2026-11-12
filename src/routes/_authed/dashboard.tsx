import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery, useSuspenseQuery } from '@tanstack/react-query'
import { DayPicker } from '#/components/day-picker'
import { DashboardInvite } from '#/components/school/dashboard-invite'
import { SchoolBehaviorGrid } from '#/components/school/school-behavior-grid'
import { meQueryOptions } from '#/lib/auth'
import type { Me } from '#/lib/auth'
import { isDateString, useToday } from '#/lib/day'
import { localDate } from '#/lib/marks'
import { schoolBehaviorQueryOptions, schoolQueryOptions } from '#/lib/school'
import { isSchoolAdmin } from '#/lib/workspace'

// /dashboard: a school administrator's home. The join link they first see
// after starting the school (until they hide it), then the day's marks: the
// school's ring, and one per teacher. ?date= picks another day, like a
// student's page; ?welcome says the school was just made.
export const Route = createFileRoute('/_authed/dashboard')({
  staticData: { schoolAdmin: true },
  validateSearch: (
    search: Record<string, unknown>,
  ): { date?: string; welcome?: boolean } => ({
    date: isDateString(search.date) ? search.date : undefined,
    welcome:
      search.welcome === true || search.welcome === 'true' ? true : undefined,
  }),
  loaderDeps: ({ search }) => ({ date: search.date }),
  // Started early, not waited for.
  loader: ({ context: { queryClient }, deps }) => {
    const me = queryClient.getQueryData<Me | null>(meQueryOptions.queryKey)
    if (me !== undefined && !isSchoolAdmin(me)) return
    void queryClient.query(schoolQueryOptions).catch(() => null)
    void queryClient
      .query(schoolBehaviorQueryOptions(deps.date ?? localDate()))
      .catch(() => null)
  },
  component: DashboardPage,
})

function DashboardPage() {
  const { date: picked, welcome } = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  // Already loaded by the login check in _authed.tsx.
  const { data: me } = useSuspenseQuery(meQueryOptions)
  const school = useQuery(schoolQueryOptions)
  const today = useToday()
  const date = picked && picked <= today ? picked : today

  if (!me?.school) return null
  const detail = school.data

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8 sm:py-10">
      <h1 className="text-2xl font-bold max-md:pr-12">Dashboard</h1>

      {detail && (
        <div className="max-w-2xl">
          <DashboardInvite
            detail={detail}
            adminName={me.teacher.name}
            welcome={welcome === true}
          />
        </div>
      )}

      <section aria-label="Marks" className="flex flex-col">
        <SchoolBehaviorGrid
          date={date}
          today={today}
          schoolName={me.school.name}
          dayPicker={
            <DayPicker
              date={date}
              today={today}
              onChange={(next) =>
                void navigate({
                  search: (s) => ({
                    ...s,
                    date: next === today ? undefined : next,
                  }),
                  replace: true,
                })
              }
            />
          }
        />
      </section>
    </main>
  )
}
