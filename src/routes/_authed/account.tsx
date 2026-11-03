import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'
import { ArrowLeft, HardDrive, LogOut, UsersRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { meQueryOptions } from '#/lib/auth'
import { usePwaInstall } from '#/lib/pwa-install'
import { ArchivedClasses } from '#/components/archived-classes'
import { ClassroomConnection } from '#/components/classroom-connection'
import { CoteachersSection } from '#/components/coteachers/coteachers-section'
import { CoteachingSection } from '#/components/coteachers/coteaching-section'
import { useSwitchSpace } from '#/lib/workspace'
import { SignOutDialog } from '#/components/sign-out-dialog'
import { TeacherAvatar } from '#/components/teacher-avatar'

export const Route = createFileRoute('/_authed/account')({
  component: AccountPage,
})

function AccountPage() {
  // Already loaded by the login check in _authed.tsx.
  const { data: me } = useSuspenseQuery(meQueryOptions)
  const [signOutOpen, setSignOutOpen] = useState(false)
  const { standalone } = usePwaInstall()
  const { switchTo, switching } = useSwitchSpace()

  // Logged out: the layout is already sending the teacher to /login.
  if (!me) return null
  const { teacher } = me
  // Your account is always your own, even in another teacher's classroom:
  // their co-teachers, Google Classroom and archive stay theirs.
  const owner = me.acting_for

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

      {/* Only the installed app saves anything (see src/lib/persist.ts). */}
      {standalone && (
        <p className="flex gap-3 text-sm text-muted-foreground">
          <HardDrive className="mt-0.5 size-4 shrink-0" />
          So the app opens quickly and works offline, your class list and
          today’s marks are saved on this device. They’re deleted when you sign
          out, or after 7 days without opening the app.
        </p>
      )}

      {owner ? (
        <Card className="gap-3 rounded-lg border-2 border-border shadow-md ring-0 [--card-spacing:--spacing(6)]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg font-bold">
              <UsersRound className="size-5" />
              You’re in {owner.name}’s classroom
            </CardTitle>
            <CardDescription>
              Your co-teachers, Google Classroom and archived classes are in
              your own classes.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              onClick={() => void switchTo(null, { to: '/account' })}
              disabled={switching !== undefined}
              className="h-11 rounded-lg border-2 px-4 font-bold"
            >
              <ArrowLeft />
              Back to my classes
            </Button>
          </CardContent>
        </Card>
      ) : (
        <CoteachersSection ownerName={teacher.name} />
      )}

      <CoteachingSection me={me} />

      {!owner && (
        <>
          <ClassroomConnection />
          <ArchivedClasses />
        </>
      )}

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
