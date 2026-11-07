import { createFileRoute } from '@tanstack/react-router'
import { CalendarRange } from 'lucide-react'
import { ComingSoonPage } from '#/components/coming-soon-page'

// /schedules: a school administrator's Schedules tab. Coming soon.
export const Route = createFileRoute('/_authed/schedules')({
  staticData: { schoolAdmin: true },
  component: () => (
    <ComingSoonPage
      icon={CalendarRange}
      title="Schedules"
      text="Conflict-free schedules for teachers and service providers, so nobody is double-booked."
    />
  ),
})
