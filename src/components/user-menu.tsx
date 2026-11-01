import { useState } from 'react'
import { Link, useMatchRoute } from '@tanstack/react-router'
import { Download, LogOut, Moon, Sun, Tags, UserRound } from 'lucide-react'
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
import { SignOutDialog } from '#/components/sign-out-dialog'
import { TeacherAvatar } from '#/components/teacher-avatar'
import {
  InstallAppDialog,
  useInstallApp,
} from '#/components/install/install-app'

/**
 * The teacher's avatar: in the top bar on wide screens, and as the last tab
 * of the phone bottom bar (placement="bottom-bar", opens upward). Opens their
 * name, Account, Edit marks, Download the app (website only), Dark/Light
 * mode, and Sign out.
 */
export function UserMenu({
  teacher,
  placement = 'header',
}: {
  teacher: Me['teacher']
  placement?: 'header' | 'bottom-bar'
}) {
  const [open, setOpen] = useState(false)
  const [signOutOpen, setSignOutOpen] = useState(false)
  const install = useInstallApp()
  const { resolvedTheme, setTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const inBar = placement === 'bottom-bar'

  // In the bottom bar it's a tab: lit up on the pages its menu leads to, like
  // Classes is on /classes.
  const matchRoute = useMatchRoute()
  const active =
    inBar && !!(matchRoute({ to: '/account' }) || matchRoute({ to: '/marks' }))

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        {inBar ? (
          <PopoverTrigger
            render={
              <button
                type="button"
                // Includes the visible label, for voice control.
                aria-label="Account menu"
                data-active={active || undefined}
                // The same look as the other bottom-bar tabs (BottomLink).
                className="flex h-16 w-full flex-col items-center justify-center gap-1 text-xs font-bold text-muted-foreground outline-none focus-visible:ring-4 focus-visible:ring-ring focus-visible:ring-inset data-active:text-primary"
              />
            }
          >
            <TeacherAvatar
              teacher={teacher}
              className={cn(
                'size-7',
                active && 'ring-2 ring-primary ring-offset-2 ring-offset-card',
              )}
              fallbackClassName="text-[10px]"
            />
            Account
          </PopoverTrigger>
        ) : (
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
            <TeacherAvatar teacher={teacher} className="size-10" />
          </PopoverTrigger>
        )}

        <PopoverContent
          side={inBar ? 'top' : 'bottom'}
          align="end"
          sideOffset={inBar ? 8 : 4}
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
