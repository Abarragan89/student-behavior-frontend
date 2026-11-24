import { useQuery } from '@tanstack/react-query'
import { CircleAlert, RefreshCw } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { ResponsiveDialog } from '#/components/responsive-dialogue'
import { accessLogQueryOptions, byPerson, formatDay } from '#/lib/access-log'

/**
 * A student's record of access: everyone who opened or changed their records
 * in the last year, one line per person, with the days underneath. For the
 * teacher and their school's administrators; it answers a family's "who has
 * seen my child's records?".
 */
export function AccessRecordDialog({
  studentId,
  firstName,
  open,
  onOpenChange,
}: {
  studentId: string
  firstName: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const log = useQuery({ ...accessLogQueryOptions(studentId), enabled: open })
  const people = log.data ? byPerson(log.data) : []

  return (
    <ResponsiveDialog
      isOpen={open}
      setIsOpen={onOpenChange}
      title="Record of access"
      description={`Who opened or changed ${firstName}’s records in the last year. Opening their class counts too, since it shows them.`}
      showDescription
      className="sm:max-w-xl"
    >
      {log.isPending ? (
        <p
          role="status"
          className="flex items-center gap-2 py-6 text-sm text-muted-foreground"
        >
          <Spinner aria-hidden className="size-4" />
          Loading the record…
        </p>
      ) : log.error ? (
        <div className="flex flex-col items-start gap-2 py-4">
          <p role="alert" className="flex items-center gap-2 text-sm">
            <CircleAlert className="size-4 shrink-0 text-destructive" />
            Couldn’t load the record.
          </p>
          <Button
            variant="outline"
            onClick={() => void log.refetch()}
            disabled={log.isFetching}
            className="h-10 rounded-lg border-2 font-bold"
          >
            <RefreshCw
              className={log.isFetching ? 'animate-spin' : undefined}
            />
            Try again
          </Button>
        </div>
      ) : people.length === 0 ? (
        <p className="py-6 text-sm text-muted-foreground">
          Nothing recorded yet. The record starts from when this feature was
          turned on.
        </p>
      ) : (
        <ul className="flex flex-col gap-3 pb-2">
          {people.map((p) => (
            <li
              key={p.key}
              className="rounded-lg border-2 border-border bg-card px-3 py-2.5"
            >
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="font-bold wrap-break-word">{p.label}</span>
                <Badge
                  variant="secondary"
                  className="h-5 rounded-md px-1.5 text-xs font-bold"
                >
                  {p.role}
                </Badge>
              </div>
              <p className="mt-1 text-sm">
                {capitalize(p.actions.join(', '))}
                {p.classes.length > 0 && ` · ${p.classes.join(', ')}`}
              </p>
              <p className="text-sm text-muted-foreground">
                Last{' '}
                {new Date(p.last).toLocaleString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                })}
                {p.days.length > 1 &&
                  ` · on ${p.days.length} days since ${formatDay(p.firstDay)}`}
              </p>
              {p.days.length > 1 && (
                <details className="mt-1 text-sm">
                  <summary className="cursor-pointer font-bold text-primary">
                    Each day
                  </summary>
                  <ul className="mt-1 flex flex-col gap-0.5 text-muted-foreground">
                    {p.days.map((d) => (
                      <li key={d.day}>
                        <span className="font-medium text-foreground">
                          {formatDay(d.day)}
                        </span>
                        : {d.actions.join(', ')}
                        {d.classes.length > 0 && ` (${d.classes.join(', ')})`}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </li>
          ))}
        </ul>
      )}
    </ResponsiveDialog>
  )
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
