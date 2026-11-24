import { useId, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Building2, CircleAlert, RefreshCw, User } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import { OfflineNote } from '#/components/offline-note'
import { meQueryOptions } from '#/lib/auth'
import type { Me } from '#/lib/auth'
import { useOnline } from '#/lib/online'
import {
  linkSchoolClasses,
  myClassesQueryOptions,
  schoolQueryOptions,
} from '#/lib/school'
import type { MyClass, SchoolMembership } from '#/lib/school'

/**
 * A teacher's classes and their school, on the School page. Each class is
 * the school's (its administrators can view it, and it stays with the
 * school if the teacher leaves) or their own (private).
 *
 * Until they've answered once (school.ask_classes), it asks "Which of your
 * classes are part of Lincoln?" with nothing ticked. After that it lists
 * each class, and a class of their own can be added to the school. Only an
 * administrator can take a class back out, so adding one is confirmed.
 */
export function SchoolClassesCard({ school }: { school: SchoolMembership }) {
  const headingId = useId()
  const classes = useQuery(myClassesQueryOptions)
  const ask = !!school.ask_classes

  return (
    <section aria-labelledby={headingId}>
      <Card className="gap-4 rounded-lg border-2 border-border shadow-md ring-0 [--card-spacing:--spacing(6)]">
        <CardHeader>
          <h2 id={headingId} className="text-lg font-bold wrap-break-word">
            {ask
              ? `Which of your classes are part of ${school.name}?`
              : 'Your classes'}
          </h2>
          <CardDescription>
            A school class is part of {school.name}’s records. Its
            administrators can view it but can’t change it, and if you leave, it
            stays with the school. Your own classes stay private to you. New
            classes you make are the school’s unless you choose otherwise.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {classes.isPending ? (
            <p
              role="status"
              className="flex items-center gap-2 text-sm text-muted-foreground"
            >
              <Spinner aria-hidden className="size-4" />
              Loading your classes…
            </p>
          ) : classes.error ? (
            <div className="flex flex-col items-start gap-2">
              <p role="alert" className="flex items-center gap-2 text-sm">
                <CircleAlert className="size-4 shrink-0 text-destructive" />
                Couldn’t load your classes.
              </p>
              <Button
                variant="outline"
                onClick={() => void classes.refetch()}
                disabled={classes.isFetching}
                className="h-10 rounded-lg border-2 font-bold"
              >
                <RefreshCw
                  className={classes.isFetching ? 'animate-spin' : undefined}
                />
                Try again
              </Button>
            </div>
          ) : ask ? (
            <ChooseClasses school={school} classes={classes.data} />
          ) : (
            <ClassList school={school} classes={classes.data} />
          )}
        </CardContent>
      </Card>
    </section>
  )
}

/** After linking: the menus, the tabs and this list all know. */
function useLinked() {
  const queryClient = useQueryClient()
  return async () => {
    queryClient.setQueryData<Me | null>(meQueryOptions.queryKey, (me) =>
      me?.school ? { ...me, school: { ...me.school, ask_classes: false } } : me,
    )
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: meQueryOptions.queryKey }),
      queryClient.invalidateQueries({
        queryKey: myClassesQueryOptions.queryKey,
      }),
      queryClient.invalidateQueries({ queryKey: schoolQueryOptions.queryKey }),
    ])
  }
}

/** The one-time question: nothing ticked, so nothing is shared by accident. */
function ChooseClasses({
  school,
  classes,
}: {
  school: SchoolMembership
  classes: Array<MyClass>
}) {
  const online = useOnline()
  const linked = useLinked()
  const own = classes.filter((c) => !c.school_id)
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const save = useMutation({
    mutationFn: () => linkSchoolClasses([...picked]),
    onSuccess: async () => {
      await linked()
      toast.success(
        picked.size === 0
          ? 'Your classes stay your own'
          : picked.size === 1
            ? `1 class added to ${school.name}`
            : `${picked.size} classes added to ${school.name}`,
      )
    },
    onError: (error) => {
      console.error('Adding classes to the school failed:', error)
      toast.error('Couldn’t save your answer. Try again.')
    },
  })
  const busy = save.isPending

  return (
    <>
      <ul className="flex flex-col gap-2">
        {own.map((c) => (
          <li key={c.id}>
            <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border-2 border-border bg-card px-3 py-1.5 font-bold transition-colors has-checked:border-primary has-checked:bg-primary/10 motion-reduce:transition-none">
              <input
                type="checkbox"
                checked={picked.has(c.id)}
                disabled={busy}
                onChange={(e) => {
                  const next = new Set(picked)
                  if (e.target.checked) next.add(c.id)
                  else next.delete(c.id)
                  setPicked(next)
                }}
                className="size-5 shrink-0 accent-primary"
              />
              <span className="min-w-0 flex-1 wrap-break-word">{c.name}</span>
            </label>
          </li>
        ))}
      </ul>
      <p className="text-sm text-muted-foreground">
        Only an administrator can take a class back out of the school. You can
        add more classes later.
      </p>
      <OfflineNote action="answer" />
      <Button
        onClick={() => save.mutate()}
        disabled={busy || !online}
        className="h-11 self-start rounded-lg px-4 font-bold whitespace-normal"
      >
        {busy && <Spinner aria-hidden className="size-4" />}
        {picked.size === 0
          ? 'None of them'
          : picked.size === 1
            ? `Add 1 class to ${school.name}`
            : `Add ${picked.size} classes to ${school.name}`}
      </Button>
    </>
  )
}

/** Each class and whose it is; one of their own can be added. */
function ClassList({
  school,
  classes,
}: {
  school: SchoolMembership
  classes: Array<MyClass>
}) {
  const online = useOnline()
  const [adding, setAdding] = useState<MyClass | null>(null)

  if (classes.length === 0) {
    return <p className="text-sm text-muted-foreground">No classes yet.</p>
  }
  return (
    <>
      <ul className="flex flex-col divide-y-2 divide-border rounded-lg border-2 border-border">
        {classes.map((c) => (
          <li
            key={c.id}
            className="flex min-h-12 flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2"
          >
            <span className="min-w-0 flex-1 font-bold wrap-break-word">
              {c.name}
            </span>
            {c.school_id ? (
              <Badge
                variant="secondary"
                className="h-6 gap-1 rounded-md px-2 text-xs font-bold"
              >
                <Building2 aria-hidden />
                {school.name}
              </Badge>
            ) : (
              <>
                <Badge
                  variant="outline"
                  className="h-6 gap-1 rounded-md border-2 px-2 text-xs font-bold"
                >
                  <User aria-hidden />
                  Yours
                </Badge>
                <Button
                  variant="outline"
                  onClick={() => setAdding(c)}
                  disabled={!online}
                  className="h-9 rounded-lg border-2 px-3 font-bold"
                >
                  Add to school
                </Button>
              </>
            )}
          </li>
        ))}
      </ul>
      <OfflineNote action="add a class to your school" />
      <AddClassDialog
        school={school}
        target={adding}
        onClose={() => setAdding(null)}
      />
    </>
  )
}

function AddClassDialog({
  school,
  target,
  onClose,
}: {
  school: SchoolMembership
  target: MyClass | null
  onClose: () => void
}) {
  const linked = useLinked()
  const add = useMutation({
    mutationFn: (c: MyClass) => linkSchoolClasses([c.id]),
    onSuccess: async (_, c) => {
      await linked()
      onClose()
      toast.success(`${c.name} is part of ${school.name}`)
    },
    onError: (error) => {
      console.error('Adding a class to the school failed:', error)
      toast.error('Couldn’t add the class. Try again.')
    },
  })
  const busy = add.isPending

  return (
    <AlertDialog
      open={target !== null}
      onOpenChange={(next) => {
        if (!next && !busy) onClose()
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="font-bold wrap-break-word">
            Add {target?.name} to {school.name}?
          </AlertDialogTitle>
          <AlertDialogDescription>
            Its students, marks and notes become part of the school’s records.
            Administrators can view them, and if you leave, the class stays with
            the school. Only an administrator can take it back out.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={busy}
            onClick={(e) => {
              // Stay open until it's saved.
              e.preventDefault()
              if (target) add.mutate(target)
            }}
          >
            {busy && <Spinner aria-hidden className="size-4" />}
            Add to school
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
