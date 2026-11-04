import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { BellRing } from 'lucide-react'
import { toast } from 'sonner'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'
import {
  markOfferSeen,
  pushKeyQueryOptions,
  pushSupported,
  turnOn,
  useNotificationStatus,
  useOfferSeen,
} from '#/lib/notifications'

/**
 * The one-time offer, in the installed app: "Get notified 10 minutes before
 * a subject begins…", with Turn on notifications and No thanks. Shown on the
 * first page after installing, until the teacher answers either way. No
 * thanks says where to find it later (the Account page).
 */
export function NotificationsBanner({ className }: { className?: string }) {
  const status = useNotificationStatus()
  const seen = useOfferSeen()
  const key = useQuery({ ...pushKeyQueryOptions, enabled: pushSupported() })
  const [turningOn, setTurningOn] = useState(false)
  const [noThanksOpen, setNoThanksOpen] = useState(false)

  // 'off' already means: installed, can receive push, the server sends
  // them, not blocked, and not on yet.
  const show = status === 'off' && !seen && !!key.data

  async function onTurnOn() {
    if (!key.data || turningOn) return
    setTurningOn(true)
    // Straight from the tap: iPhones only ask for permission inside it.
    const result = await turnOn(key.data)
    setTurningOn(false)
    if (result === 'on') {
      markOfferSeen()
      toast.success('Notifications are on', {
        description: 'You’ll get an alert 10 minutes before each subject.',
      })
    } else if (result === 'blocked') {
      markOfferSeen()
      toast.error('Notifications are blocked', {
        description: 'You can allow them in your device’s Settings.',
      })
    } else if (result === 'failed') {
      toast.error('Couldn’t turn on notifications', {
        description: 'Check your connection and try again.',
      })
    }
    // 'dismissed': the question was closed unanswered. The offer stays.
  }

  function onNoThanks() {
    markOfferSeen()
    setNoThanksOpen(true)
  }

  return (
    <>
      {show && (
        <aside
          aria-label="Notifications"
          className={cn(
            'flex flex-wrap items-center gap-x-3 gap-y-2 border-b-2 border-border bg-accent/30 px-4 py-2.5',
            className,
          )}
        >
          <span
            aria-hidden
            className="grid size-8 shrink-0 place-items-center rounded-md border-2 border-border bg-primary text-primary-foreground"
          >
            <BellRing className="size-4" strokeWidth={3} />
          </span>
          <p className="min-w-0 flex-1 basis-48 text-sm leading-tight font-bold">
            Get notified 10 minutes before a subject begins to keep you on track
          </p>
          <div className="flex shrink-0 items-center gap-1 max-sm:w-full max-sm:justify-end">
            <Button
              variant="link"
              onClick={onNoThanks}
              disabled={turningOn}
              className="h-9 px-2 text-sm font-bold"
            >
              No thanks
            </Button>
            <Button
              onClick={() => void onTurnOn()}
              disabled={turningOn}
              aria-busy={turningOn}
              className="relative h-9 rounded-lg border-2 border-border px-3 font-bold"
            >
              <span className={cn(turningOn && 'invisible')}>
                Turn on notifications
              </span>
              {turningOn && (
                <Spinner
                  aria-label="Turning on notifications"
                  className="absolute inset-0 m-auto size-4"
                />
              )}
            </Button>
          </div>
        </aside>
      )}

      <AlertDialog open={noThanksOpen} onOpenChange={setNoThanksOpen}>
        <AlertDialogContent className="rounded-lg border-2 border-border ring-0">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-bold">
              Notifications are off
            </AlertDialogTitle>
            <AlertDialogDescription>
              You can always turn notifications on from your Account page.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="font-bold">OK</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
