import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'
import { LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { meQueryOptions } from '#/lib/auth'
import { SignOutDialog } from '#/components/sign-out-dialog'
import { TeacherAvatar } from '#/components/teacher-avatar'

export const Route = createFileRoute('/_authed/account')({
  component: AccountPage,
})

function AccountPage() {
  // Already loaded by the login check in _authed.tsx.
  const { data: me } = useSuspenseQuery(meQueryOptions)
  const [signOutOpen, setSignOutOpen] = useState(false)

  // Logged out: the layout is already sending the teacher to /login.
  if (!me) return null
  const { teacher } = me

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 py-10">
      <h1 className="text-2xl font-bold">Account</h1>

      <Card className="rounded-lg border-2 border-border shadow-md ring-0 [--card-spacing:--spacing(6)]">
        <CardHeader className="flex items-center gap-4">
          <TeacherAvatar
            teacher={teacher}
            className="size-16"
            fallbackClassName="text-xl"
          />
          <div className="flex min-w-0 flex-col gap-0.5">
            <CardTitle className="truncate text-lg font-bold">
              {teacher.name}
            </CardTitle>
            <CardDescription className="truncate text-base">
              {teacher.email}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          You sign in with this Google account. Your name and photo come from
          Google.
        </CardContent>
      </Card>

      <Button
        variant="outline"
        onClick={() => setSignOutOpen(true)}
        className="h-11 self-start rounded-lg border-2 px-4 font-bold"
      >
        <LogOut />
        Sign out
      </Button>

      <SignOutDialog open={signOutOpen} onOpenChange={setSignOutOpen} />
    </main>
  )
}
