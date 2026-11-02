import { useId, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { CircleAlert, RefreshCw, Unplug, WifiOff } from 'lucide-react'
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
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'
import { OfflineNote } from '#/components/offline-note'
import { ApiError } from '#/lib/api'
import {
  cacheDisconnected,
  classroomStatusQueryOptions,
  disconnectClassroom,
} from '#/lib/classroom'
import { useOnline } from '#/lib/online'

/**
 * The Account page's Google Classroom card: whether it's connected, and a
 * way to disconnect (the privacy policy promises one). Connecting happens in
 * Add students, where it's needed.
 */
export function ClassroomConnection() {
  const headingId = useId()
  const status = useQuery(classroomStatusQueryOptions)
  const online = useOnline()
  const [confirmOpen, setConfirmOpen] = useState(false)

  return (
    <section aria-labelledby={headingId}>
      <Card className="gap-5 rounded-lg border-2 border-border shadow-md ring-0 [--card-spacing:--spacing(6)]">
        <CardHeader>
          <h2 id={headingId} className="text-lg font-bold">
            Google Classroom
          </h2>
          <CardDescription>
            Lets you import class lists from Google Classroom. TeachForFree can
            only read them, never change them.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-start gap-3">
          {status.data ? (
            status.data.connected ? (
              <>
                <p className="text-sm font-medium">
                  Connected
                  {status.data.connected_at && (
                    <>
                      {' '}
                      <time dateTime={status.data.connected_at}>
                        {formatDate(status.data.connected_at)}
                      </time>
                    </>
                  )}
                  .
                </p>
                <Button
                  variant="outline"
                  onClick={() => setConfirmOpen(true)}
                  disabled={!online}
                  className="h-10 rounded-lg border-2 font-bold"
                >
                  <Unplug />
                  Disconnect
                </Button>
                <OfflineNote action="disconnect Google Classroom" />
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Not connected. To import a class, open Add students on the
                Classes page.
              </p>
            )
          ) : status.fetchStatus === 'paused' ? (
            <p
              role="status"
              className="flex items-center gap-2 text-sm font-medium text-muted-foreground"
            >
              <WifiOff className="size-4 shrink-0" />
              You’re offline. Connect to the internet to see your Google
              Classroom connection.
            </p>
          ) : status.isError ? (
            <div role="alert" className="flex flex-col items-start gap-3">
              {/* Red icon, normal text: small red text is hard to read. */}
              <p className="flex items-center gap-2 text-sm font-medium">
                <CircleAlert className="size-5 shrink-0 text-destructive" />
                Couldn’t check your Google Classroom connection.
              </p>
              <Button
                variant="outline"
                onClick={() => void status.refetch()}
                disabled={status.isFetching}
                className="h-10 rounded-lg border-2 font-bold"
              >
                <RefreshCw
                  className={cn(status.isFetching && 'animate-spin')}
                />
                Try again
              </Button>
            </div>
          ) : (
            <p
              role="status"
              className="flex items-center gap-2 text-sm font-medium text-muted-foreground"
            >
              <Spinner aria-hidden className="size-4" />
              Checking Google Classroom…
            </p>
          )}
        </CardContent>
      </Card>

      <DisconnectDialog open={confirmOpen} onOpenChange={setConfirmOpen} />
    </section>
  )
}

function DisconnectDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const online = useOnline()

  const disconnect = useMutation({
    mutationFn: disconnectClassroom,
    onSuccess: () => {
      cacheDisconnected(queryClient)
      onOpenChange(false)
      toast.success('Google Classroom disconnected', {
        description: 'Your imported classes and students are still here.',
      })
    },
    onError: (error) => {
      console.error('Disconnecting Google Classroom failed:', error)
      toast.error(disconnectErrorMessage(error))
    },
  })
  const disconnecting = disconnect.isPending

  return (
    <AlertDialog
      open={open}
      // Stay open while disconnecting, so it can't be dismissed halfway.
      onOpenChange={(next) => {
        if (!disconnecting) onOpenChange(next)
      }}
    >
      <AlertDialogContent className="rounded-lg border-2 border-border ring-0">
        <AlertDialogHeader>
          <AlertDialogTitle className="font-bold">
            Disconnect Google Classroom?
          </AlertDialogTitle>
          <AlertDialogDescription>
            TeachForFree won’t see your Google Classroom classes anymore.
            Classes and students you’ve imported stay. Google may ask you to
            allow TeachForFree again the next time you sign in.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <OfflineNote action="disconnect Google Classroom" />
        <AlertDialogFooter>
          <AlertDialogCancel disabled={disconnecting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => disconnect.mutate()}
            disabled={disconnecting || !online}
            aria-busy={disconnecting}
            // The label stays (invisible) under the spinner so the size holds.
            className={cn(
              'relative font-bold',
              disconnecting && 'disabled:opacity-100',
            )}
          >
            <span className={cn(disconnecting && 'invisible')}>Disconnect</span>
            {disconnecting && (
              <Spinner
                aria-label="Disconnecting"
                className="absolute inset-0 m-auto size-4"
              />
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

/** "Jun 12, 2026" */
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function disconnectErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 429) {
      return 'Too many tries for now. Please try again later.'
    }
    if (error.status === 401) {
      return 'Your session has ended. Sign in again to disconnect Google Classroom.'
    }
    return 'Couldn’t disconnect Google Classroom. Please try again.'
  }
  // fetch() throws a TypeError when the server can't be reached (and an
  // AbortError when it takes too long).
  return 'Couldn’t reach the server. Check your connection and try again.'
}
