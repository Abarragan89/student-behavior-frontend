import { useId, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { BellRing, Send } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import { Switch } from '@/components/ui/switch'
import { InstallAppButton } from '#/components/install/install-app'
import { OfflineNote } from '#/components/offline-note'
import { ApiError } from '#/lib/api'
import {
  markOfferSeen,
  pushKeyQueryOptions,
  pushSupported,
  sendTest,
  turnOff,
  turnOn,
  useNotificationStatus,
} from '#/lib/notifications'
import { useOnline } from '#/lib/online'

/**
 * The Account page's Notifications card: reminders before each subject on
 * today's lesson plan, turned on or off for this device. Shown in every
 * space: a device's reminders are always its teacher's own.
 */
export function NotificationsSection() {
  const headingId = useId()
  const switchId = useId()
  const status = useNotificationStatus()
  const key = useQuery({ ...pushKeyQueryOptions, enabled: pushSupported() })
  const online = useOnline()
  const [busy, setBusy] = useState<'toggle' | 'test' | null>(null)

  // The server doesn't send them: nothing to offer.
  if (status === 'unavailable') return null

  async function toggle(on: boolean) {
    if (busy) return
    setBusy('toggle')
    try {
      if (on) {
        if (!key.data) return
        // Straight from the tap: iPhones only ask for permission inside it.
        const result = await turnOn(key.data)
        markOfferSeen()
        if (result === 'on') {
          toast.success('Notifications are on', {
            description: 'You’ll get an alert 10 minutes before each subject.',
          })
        } else if (result === 'failed') {
          toast.error('Couldn’t turn on notifications', {
            description: 'Check your connection and try again.',
          })
        }
      } else {
        await turnOff()
        toast('Notifications are off on this device')
      }
    } finally {
      setBusy(null)
    }
  }

  async function test() {
    if (busy) return
    setBusy('test')
    try {
      await sendTest()
      toast.success('Test sent', {
        description: 'It should show on this device in a moment.',
      })
    } catch (error) {
      console.error('Test notification failed:', error)
      toast.error('Couldn’t send a test', {
        description:
          error instanceof ApiError && error.status === 404
            ? 'This device isn’t set up for notifications any more. Turn them off and on again.'
            : error instanceof ApiError && error.status === 502
              ? 'Your device’s notification service didn’t take it. Try again in a minute.'
              : 'Check your connection and try again.',
      })
    } finally {
      setBusy(null)
    }
  }

  const on = status === 'on'

  return (
    <section aria-labelledby={headingId}>
      <Card className="gap-5 rounded-lg border-2 border-border shadow-md ring-0 [--card-spacing:--spacing(6)]">
        <CardHeader>
          <h2
            id={headingId}
            className="flex items-center gap-2 text-lg font-bold"
          >
            <BellRing className="size-5" aria-hidden />
            Notifications
          </h2>
          <CardDescription>
            Get an alert 10 minutes before each subject on today’s lesson plan
            begins. Just for this device.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-start gap-3">
          {status === 'loading' ? (
            <p
              role="status"
              className="flex items-center gap-2 text-sm text-muted-foreground"
            >
              <Spinner aria-hidden className="size-4" />
              Checking this device…
            </p>
          ) : status === 'on' || status === 'off' ? (
            <>
              <div className="flex w-full items-center justify-between gap-4">
                <label htmlFor={switchId} className="text-base font-bold">
                  Notifications on this device
                </label>
                <Switch
                  id={switchId}
                  checked={on}
                  onCheckedChange={(next) => void toggle(next)}
                  disabled={busy !== null || !online || !key.data}
                  aria-busy={busy === 'toggle'}
                />
              </div>
              {on && (
                <Button
                  variant="outline"
                  onClick={() => void test()}
                  disabled={busy !== null || !online}
                  className="h-10 rounded-lg border-2 font-bold"
                >
                  {busy === 'test' ? (
                    <Spinner aria-hidden className="size-4" />
                  ) : (
                    <Send aria-hidden />
                  )}
                  Send a test
                </Button>
              )}
              <OfflineNote action="change notifications" />
            </>
          ) : status === 'not-installed' ? (
            <>
              <p className="text-sm">
                Install the app to get notifications on this device.
              </p>
              <InstallAppButton
                variant="outline"
                className="h-10 rounded-lg border-2"
              />
            </>
          ) : status === 'blocked' ? (
            <p className="text-sm">
              Notifications are blocked for TeachForFree on this device. To get
              them, allow notifications for TeachForFree in your device’s
              Settings, then come back here.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              This device can’t get notifications from the app. On iPhone and
              iPad, they need iOS 16.4 or later and the app on your Home Screen.
            </p>
          )}
        </CardContent>
      </Card>
    </section>
  )
}
