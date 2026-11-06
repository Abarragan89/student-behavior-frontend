import { useState } from 'react'
import { Link, useMatchRoute } from '@tanstack/react-router'
import {
  Building2,
  Check,
  Download,
  LogOut,
  Moon,
  School,
  Sun,
  Tags,
  UserRound,
  UsersRound,
} from 'lucide-react'
import { useTheme } from 'next-themes'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import type { Me } from '#/lib/auth'
import { canEdit, spaceOf, useSwitchSpace } from '#/lib/workspace'
import { SignOutDialog } from '#/components/sign-out-dialog'
import { TeacherAvatar } from '#/components/teacher-avatar'
import {
  InstallAppDialog,
  useInstallApp,
} from '#/components/install/install-app'

/**
 * The teacher's avatar, at the top right: in the top bar on wide screens, and
 * in its own row above the page on phones. Opens their name, the spaces they
 * can switch between (their own classes, and each teacher who made them a
 * co-teacher), Account, their school (if they're in one), Edit marks,
 * Download the app (website only), Dark/Light mode, and Sign out.
 */
export function UserMenu({ me }: { me: Me }) {
  const { teacher } = me
  const spaces = me.coteaching ?? []
  const current = spaceOf(me)
  const { switchTo, switching } = useSwitchSpace()
  const [open, setOpen] = useState(false)
  const [signOutOpen, setSignOutOpen] = useState(false)
  const install = useInstallApp()
  const { resolvedTheme, setTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  // Ringed on the pages its menu leads to, the way the nav links light up on
  // theirs.
  const matchRoute = useMatchRoute()
  const active = Boolean(
    matchRoute({ to: '/account' }) ||
    matchRoute({ to: '/marks' }) ||
    matchRoute({ to: '/school' }),
  )

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              aria-label="Account menu"
              className="size-10 rounded-full p-0 focus-visible:ring-4 focus-visible:ring-ring"
            />
          }
        >
          <TeacherAvatar
            teacher={teacher}
            className={cn(
              'size-10',
              // Phones show it on the page background, the top bar on a card.
              active &&
                'ring-2 ring-primary ring-offset-2 ring-offset-background md:ring-offset-card',
            )}
          />
        </PopoverTrigger>

        <PopoverContent
          side="bottom"
          align="end"
          sideOffset={4}
          className="w-64 gap-2 rounded-lg border-2 border-border p-2 shadow-md ring-0"
        >
          <PopoverHeader className="flex-row items-center gap-3 p-2">
            <TeacherAvatar teacher={teacher} />
            <div className="flex min-w-0 flex-col">
              <PopoverTitle className="truncate font-bold">
                {teacher.name}
              </PopoverTitle>
              <PopoverDescription className="truncate text-xs">
                {teacher.email}
              </PopoverDescription>
            </div>
          </PopoverHeader>

          <Separator />

          {spaces.length > 0 && (
            <>
              <div
                role="group"
                aria-label="Classrooms"
                className="flex flex-col gap-1"
              >
                <SpaceButton
                  label="My classes"
                  icon={School}
                  current={current === null}
                  busy={switching === null}
                  onClick={() => {
                    setOpen(false)
                    void switchTo(null)
                  }}
                />
                {spaces.map((s) => (
                  <SpaceButton
                    key={s.owner_id}
                    label={`${s.name}’s classroom`}
                    icon={UsersRound}
                    current={current === s.owner_id}
                    busy={switching === s.owner_id}
                    onClick={() => {
                      setOpen(false)
                      void switchTo(s.owner_id)
                    }}
                  />
                ))}
              </div>
              <Separator />
            </>
          )}

          <div className="flex flex-col gap-1">
            <Button
              variant="ghost"
              nativeButton={false}
              render={<Link to="/account" />}
              onClick={() => setOpen(false)}
              className="h-10 justify-start rounded-lg font-bold"
            >
              <UserRound />
              Account
            </Button>
            {/* Always your own school, in any classroom. */}
            {me.school && (
              <Button
                variant="ghost"
                nativeButton={false}
                render={<Link to="/school" />}
                onClick={() => setOpen(false)}
                className="h-10 justify-start rounded-lg font-bold"
              >
                <Building2 />
                <span className="min-w-0 flex-1 truncate text-left">
                  {me.school.name}
                </span>
              </Button>
            )}
            {/* Mark types belong to the class's teacher: Classes: Edit. */}
            {canEdit(me, 'classes') && (
              <Button
                variant="ghost"
                nativeButton={false}
                render={<Link to="/marks" />}
                onClick={() => setOpen(false)}
                className="h-10 justify-start rounded-lg font-bold"
              >
                <Tags />
                Edit marks
              </Button>
            )}
            {install.visible && (
              <Button
                variant="ghost"
                onClick={() => {
                  setOpen(false)
                  void install.start()
                }}
                className="h-10 justify-start rounded-lg font-bold"
              >
                <Download />
                Download the app
              </Button>
            )}
            <Button
              variant="ghost"
              // Leaves the menu open, so it's easy to switch back.
              onClick={() => setTheme(isDark ? 'light' : 'dark')}
              className="h-10 justify-start rounded-lg font-bold"
            >
              {isDark ? <Sun /> : <Moon />}
              {isDark ? 'Light mode' : 'Dark mode'}
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setOpen(false)
                setSignOutOpen(true)
              }}
              className="h-10 justify-start rounded-lg font-bold"
            >
              <LogOut />
              Sign out
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      {/* Outside the popover, so it stays open after the popover closes. */}
      <SignOutDialog open={signOutOpen} onOpenChange={setSignOutOpen} />
      <InstallAppDialog {...install.dialogProps} />
    </>
  )
}

/** One space in the menu, checked when it's the one on screen. */
function SpaceButton({
  label,
  icon: Icon,
  current,
  busy,
  onClick,
}: {
  label: string
  icon: typeof School
  current: boolean
  busy: boolean
  onClick: () => void
}) {
  return (
    <Button
      variant="ghost"
      onClick={current ? undefined : onClick}
      aria-current={current || undefined}
      aria-busy={busy || undefined}
      className={cn(
        'h-10 justify-start rounded-lg font-bold',
        current && 'bg-primary/10 hover:bg-primary/10',
      )}
    >
      <Icon />
      <span className="min-w-0 flex-1 truncate text-left">{label}</span>
      {current && <Check aria-label="Open now" />}
    </Button>
  )
}
