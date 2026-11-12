import { useId } from 'react'
import {
  CalendarDays,
  CalendarRange,
  ClipboardList,
  Clock,
  UsersRound,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from '@/components/ui/card'

/** What's planned for schools. None of it is built yet; each says so. */
const COMING = [
  {
    icon: CalendarDays,
    title: 'Staff events',
    text: 'Meetings, trainings and duty days on one calendar your staff can see.',
  },
  {
    icon: CalendarRange,
    title: 'Conflict-free schedules',
    text: 'Schedules for teachers and service providers that never double-book anyone.',
  },
  {
    icon: Clock,
    title: 'Meeting slots with teachers',
    text: 'Set your open times. Teachers pick one, like families do for conferences.',
  },
  {
    icon: ClipboardList,
    title: 'Custom progress reports',
    text: 'Your school’s own report layout, filled in from what teachers already track.',
  },
  {
    icon: UsersRound,
    title: 'One place for your staff',
    text: 'Your school’s events, schedules and meetings in the app teachers already use.',
  },
] as const

export function SchoolComingCard({ forAdmin }: { forAdmin: boolean }) {
  const headingId = useId()
  return (
    <section aria-labelledby={headingId}>
      <Card className="gap-4 rounded-lg border-2 border-border shadow-md ring-0 [--card-spacing:--spacing(6)]">
        <CardHeader>
          <h2 id={headingId} className="text-lg font-bold">
            Coming for schools
          </h2>
          <CardDescription>
            {forAdmin
              ? 'Founding schools get these first.'
              : 'What your administrator will be able to share with you.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-3 sm:grid-cols-2">
            {/* A teacher has the calendar on this page already. */}
            {COMING.filter((c) => forAdmin || c.title !== 'Staff events').map(
              ({ icon: Icon, title, text }) => (
                <li
                  key={title}
                  className="flex flex-col gap-1.5 rounded-lg border-2 border-dashed border-border p-3"
                >
                  <p className="flex items-center gap-2 font-bold">
                    <Icon className="size-4 shrink-0" />
                    <span className="min-w-0 flex-1">{title}</span>
                    <Badge variant="outline">Coming</Badge>
                  </p>
                  <p className="text-sm text-muted-foreground">{text}</p>
                </li>
              ),
            )}
          </ul>
        </CardContent>
      </Card>
    </section>
  )
}
