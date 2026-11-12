import { Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import {
  CalendarClock,
  CalendarDays,
  CalendarRange,
  Handshake,
  LayoutDashboard,
  NotebookPen,
  School,
  UsersRound,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { bottomTabClass } from '#/components/bottom-tab'
import { ConnectionStatus } from '#/components/connection-status'
import { CreateMenu, useCreateItems } from '#/components/create-menu'
import { meQueryOptions } from '#/lib/auth'
import type { FeatureKey } from '#/lib/coteachers'
import { canView, isSchoolAdmin } from '#/lib/workspace'

type NavLink = {
  to:
    | '/classes'
    | '/lesson-plans'
    | '/conferences'
    | '/dashboard'
    | '/calendar'
    | '/schedules'
    | '/staff-conferences'
    | '/staff'
  label: string
  icon: LucideIcon
  /** A teacher feature, hidden where this space doesn't open it. */
  feature?: FeatureKey
}

const CLASSES: NavLink = {
  to: '/classes',
  label: 'Classes',
  icon: School,
  feature: 'classes',
}
const LESSON_PLANS: NavLink = {
  to: '/lesson-plans',
  label: 'Lesson Plans',
  icon: NotebookPen,
  feature: 'lesson_plans',
}
const CONFERENCES: NavLink = {
  to: '/conferences',
  label: 'Conferences',
  icon: CalendarClock,
  feature: 'conferences',
}

// A school administrator's tabs, in their own space.
const DASHBOARD: NavLink = {
  to: '/dashboard',
  label: 'Dashboard',
  icon: LayoutDashboard,
}
const CALENDAR: NavLink = {
  to: '/calendar',
  label: 'Calendar',
  icon: CalendarDays,
}
const SCHEDULES: NavLink = {
  to: '/schedules',
  label: 'Schedules',
  icon: CalendarRange,
}
// Meetings with teachers: not the teachers' parent conferences.
const STAFF_CONFERENCES: NavLink = {
  to: '/staff-conferences',
  label: 'Conferences',
  icon: Handshake,
}
// The staff list and groups.
const STAFF: NavLink = {
  to: '/staff',
  label: 'Staff',
  icon: UsersRound,
}

/**
 * The teacher's links in this order, less any this space can't open; or a
 * school administrator's own tabs, in theirs.
 */
function useLinks(teacherOrder: Array<NavLink>, adminOrder: Array<NavLink>) {
  const { data: me } = useQuery(meQueryOptions)
  if (isSchoolAdmin(me)) return adminOrder
  return teacherOrder.filter(
    (link) => !link.feature || canView(me, link.feature),
  )
}

// Spelled out so Tailwind sees each class.
const GRID_COLS = [
  '',
  'grid-cols-1',
  'grid-cols-2',
  'grid-cols-3',
  'grid-cols-4',
  'grid-cols-5',
]

/**
 * The main links in the top bar, for wide screens, next to the + and the
 * avatar. Phones get BottomNav instead (below 768px, where dialogs become
 * drawers).
 */
export function HeaderNav({ className }: { className?: string }) {
  const links = useLinks(
    [CLASSES, LESSON_PLANS, CONFERENCES],
    [DASHBOARD, CALENDAR, SCHEDULES, STAFF_CONFERENCES, STAFF],
  )
  return (
    <nav aria-label="Main" className={cn('flex items-center gap-1', className)}>
      {links.map(({ to, label, icon: Icon }) => (
        <Link
          key={to}
          to={to}
          className={cn(
            buttonVariants({ variant: 'ghost' }),
            // The open page is highlighted (TanStack marks it with
            // data-status="active" and aria-current="page").
            'h-10 rounded-lg px-3 font-bold focus-visible:ring-4 focus-visible:ring-ring data-[status=active]:bg-primary data-[status=active]:text-primary-foreground data-[status=active]:hover:bg-primary/90',
          )}
        >
          <Icon />
          {label}
        </Link>
      ))}
    </nav>
  )
}

/**
 * The phone menu, fixed to the bottom of the screen: the Add menu,
 * Conferences, Lesson Plans, and Classes (a school administrator: their four
 * tabs, no Add menu). The avatar floats at the top right
 * of the page (see _authed.tsx). Phones have no top bar, so the offline
 * pill sits on this bar's top edge. The page leaves room for it.
 */
export function BottomNav({ className }: { className?: string }) {
  const { data: me } = useQuery(meQueryOptions)
  const links = useLinks(
    [CONFERENCES, LESSON_PLANS, CLASSES],
    // Home at the right edge, like Classes for a teacher.
    [STAFF, STAFF_CONFERENCES, SCHEDULES, CALENDAR, DASHBOARD],
  )
  // The + is left out when a co-teacher here has nothing to add.
  const hasAdd = useCreateItems(me).length > 0
  const columns = links.length + (hasAdd ? 1 : 0)
  return (
    <nav
      aria-label="Main"
      className={cn(
        // Extra bottom padding keeps it above the home bar on newer phones.
        'fixed inset-x-0 bottom-0 z-40 grid items-center border-t-2 border-border bg-card pb-[env(safe-area-inset-bottom)]',
        GRID_COLS[Math.max(1, columns)],
        className,
      )}
    >
      {/* Half over the bar's top border. It floats, so the student cards
          don't move (and get mis-tapped) when it appears. Empty while
          online. */}
      <div className="pointer-events-none absolute inset-x-0 -top-3.5 flex justify-center">
        <ConnectionStatus />
      </div>
      <CreateMenu placement="bottom-bar" />
      {links.map((link) => (
        <BottomLink key={link.to} link={link} />
      ))}
    </nav>
  )
}

function BottomLink({ link: { to, label, icon: Icon } }: { link: NavLink }) {
  return (
    <Link
      to={to}
      className={`${bottomTabClass} data-[status=active]:text-primary`}
    >
      <Icon className="size-6" />
      {label}
    </Link>
  )
}
