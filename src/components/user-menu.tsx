import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Download, LogOut, UserRound } from 'lucide-react'
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
import type { Me } from '#/lib/auth'
import { SignOutDialog } from '#/components/sign-out-dialog'
import { TeacherAvatar } from '#/components/teacher-avatar'
import {
  InstallAppDialog,
  useInstallApp,
} from '#/components/install/install-app'

/**
 * The teacher's avatar in the top bar. Opens their name, Account, Download
 * the app (website only), and Sign out.
 */
export function UserMenu({ teacher }: { teacher: Me['teacher'] }) {
  const [open, setOpen] = useState(false)
  const [signOutOpen, setSignOutOpen] = useState(false)
  const install = useInstallApp()

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
          <TeacherAvatar teacher={teacher} className="size-10" />
        </PopoverTrigger>

        <PopoverContent
          align="end"
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
