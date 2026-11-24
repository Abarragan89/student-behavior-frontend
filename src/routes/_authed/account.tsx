import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'
import {
  ArrowLeft,
  Eye,
  HardDrive,
  LogOut,
  MonitorSmartphone,
  UsersRound,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { meQueryOptions } from '#/lib/auth'
import { useOnline } from '#/lib/online'
import { OfflineNote } from '#/components/offline-note'
import { usePwaInstall } from '#/lib/pwa-install'
import { ArchivedClasses } from '#/components/archived-classes'
import { ClassroomConnection } from '#/components/classroom-connection'
import { CoteachersSection } from '#/components/coteachers/coteachers-section'
import { CoteachingSection } from '#/components/coteachers/coteaching-section'
import { NotificationsSection } from '#/components/notifications/notifications-section'
import { SchoolCard } from '#/components/school/school-card'
import { isSchoolAdmin, useSwitchSpace, viewingAsAdmin } from '#/lib/workspace'
import { SignOutDialog } from '#/components/sign-out-dialog'
import { TeacherAvatar } from '#/components/teacher-avatar'

export const Route = createFileRoute('/_authed/account')({
  component: AccountPage,
})

function AccountPage() {
  // Already loaded by the login check in _authed.tsx.
  const { data: me } = useSuspenseQuery(meQueryOptions)
  const [signOutOpen, setSignOutOpen] = useState(false)
  const [everywhereOpen, setEverywhereOpen] = useState(false)
  const online = useOnline()
  const { standalone } = usePwaInstall()
  const { switchTo, switching } = useSwitchSpace()

  // Logged out: the layout is already sending the teacher to /login.
  if (!me) return null
  const { teacher } = me
  // A school's administrator has no classes of their own: no co-teachers,
  // Google Classroom, archive or lesson-plan reminders to manage here.
  const admin = me.school?.role === 'admin'
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
      {standalone && !isSchoolAdmin(me) && (
        <p className="flex gap-3 text-sm text-muted-foreground">
          <HardDrive className="mt-0.5 size-4 shrink-0" />
          So the app opens quickly and works offline, your class list and
          today’s marks are saved on this device. They’re deleted when you sign
          out, or after 7 days without opening the app.
        </p>
      )}

      {/* This device's reminders: always yours, in any classroom. */}
      {!admin && <NotificationsSection />}

      {/* Your school: also always yours. */}
      <SchoolCard me={me} />

      {owner && viewingAsAdmin(me) ? (
        <Card className="gap-3 rounded-lg border-2 border-border shadow-md ring-0 [--card-spacing:--spacing(6)]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg font-bold">
              <Eye className="size-5" />
              You’re viewing {owner.name}’s classes
            </CardTitle>
            <CardDescription>
              View only, as your school’s administrator.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              onClick={() => void switchTo(null, { to: '/dashboard' })}
              disabled={switching !== undefined}
              className="h-11 rounded-lg border-2 px-4 font-bold"
            >
              <ArrowLeft />
              Back to dashboard
            </Button>
          </CardContent>
        </Card>
      ) : owner ? (
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
        !admin && <CoteachersSection ownerName={teacher.name} />
      )}

      <CoteachingSection me={me} />

      {!owner && !admin && (
        <>
          <ClassroomConnection />
          <ArchivedClasses />
        </>
      )}

      <div className="flex flex-col items-start gap-3">
        <div className="flex flex-wrap gap-3">
          <Button
            variant="outline"
            onClick={() => setSignOutOpen(true)}
            className="h-11 rounded-lg border-2 px-4 font-bold"
          >
            <LogOut />
            Sign out
          </Button>
          <Button
            variant="outline"
            onClick={() => setEverywhereOpen(true)}
            disabled={!online}
            className="h-11 rounded-lg border-2 px-4 font-bold"
          >
            <MonitorSmartphone />
            Sign out everywhere
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          Lost a phone, or stayed signed in on a shared computer? Sign out
          everywhere ends every session at once, this one included.
        </p>
        <OfflineNote action="sign out everywhere" />
      </div>

      <SignOutDialog open={signOutOpen} onOpenChange={setSignOutOpen} />
      <SignOutDialog
        open={everywhereOpen}
        onOpenChange={setEverywhereOpen}
        everywhere
      />
    </main>
  )
}
