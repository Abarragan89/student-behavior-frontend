import { Link } from '@tanstack/react-router'
import { NotebookPen, School } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { CreateMenu } from '#/components/create-menu'

type NavLink = {
  to: '/classes' | '/lesson-plans'
  label: string
  icon: LucideIcon
}

const CLASSES: NavLink = { to: '/classes', label: 'Classes', icon: School }
const LESSON_PLANS: NavLink = {
  to: '/lesson-plans',
  label: 'Lesson Plans',
  icon: NotebookPen,
}

/**
 * The main links in the top bar, for wide screens. Phones get BottomNav
 * instead (below 768px, where dialogs become drawers).
 */
export function HeaderNav({ className }: { className?: string }) {
  return (
    <nav aria-label="Main" className={cn('items-center gap-1', className)}>
      {[CLASSES, LESSON_PLANS].map(({ to, label, icon: Icon }) => (
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
 * The phone menu, fixed to the bottom of the screen: Classes, the + menu, and
 * Lesson Plans. The page leaves room for it (see _authed.tsx).
 */
export function BottomNav({ className }: { className?: string }) {
  return (
    <nav
      aria-label="Main"
      className={cn(
        // Extra bottom padding keeps it above the home bar on newer phones.
        'fixed inset-x-0 bottom-0 z-40 grid grid-cols-3 items-center border-t-2 border-border bg-card pb-[env(safe-area-inset-bottom)]',
        className,
      )}
    >
      <BottomLink link={CLASSES} />
      <div className="flex justify-center">
        <CreateMenu side="top" />
      </div>
      <BottomLink link={LESSON_PLANS} />
    </nav>
  )
}

function BottomLink({ link: { to, label, icon: Icon } }: { link: NavLink }) {
  return (
    <Link
      to={to}
      className="flex h-16 flex-col items-center justify-center gap-1 text-xs font-bold text-muted-foreground outline-none focus-visible:ring-4 focus-visible:ring-ring focus-visible:ring-inset data-[status=active]:text-primary"
    >
      <Icon className="size-6" />
      {label}
    </Link>
  )
}
