import { createFileRoute } from '@tanstack/react-router'
import { Handshake } from 'lucide-react'
import { ComingSoonPage } from '#/components/coming-soon-page'

// /staff-conferences: a school administrator's Conferences tab. Coming soon.
export const Route = createFileRoute('/_authed/staff-conferences')({
  staticData: { schoolAdmin: true },
  component: () => (
    <ComingSoonPage
      icon={Handshake}
      title="Conferences"
      text="Meetings with your teachers: set your open times, and teachers pick one. Separate from parent conferences."
    />
  ),
})
