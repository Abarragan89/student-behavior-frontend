import { CircleAlert, Info, X } from 'lucide-react'
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import type { ClassroomResult } from '#/lib/classroom'

export type ConnectNotice = {
  tone: 'info' | 'error'
  title: string
  message: string
}

/**
 * What to tell the teacher after "Connect Google Classroom" sends them back
 * with ?classroom_error=<code>. Null when there was no error.
 */
export function connectNotice(
  { classroom_error }: ClassroomResult,
  email: string,
): ConnectNotice | null {
  if (!classroom_error) return null

  // Cancelling on Google's page was the teacher's choice, not an error.
  if (classroom_error === 'denied') {
    return {
      tone: 'info',
      title: 'Google Classroom wasn’t connected',
      message: 'You cancelled on Google’s page. Connect whenever you’re ready.',
    }
  }

  const messages: Record<string, string> = {
    wrong_account: `That was a different Google account. Choose ${email}, the account you sign in with.`,
    missing_permissions:
      'TeachForFree needs to see your classes and rosters. Try again and keep those boxes checked on Google’s page.',
    signed_out: 'Your session ended partway through. Please try again.',
    server_error: 'Something went wrong on our side. Please try again.',
  }
  return {
    tone: 'error',
    title: 'Couldn’t connect Google Classroom',
    message:
      messages[classroom_error] ?? 'Something went wrong. Please try again.',
  }
}

export function ConnectNoticeAlert({
  notice,
  onDismiss,
}: {
  notice: ConnectNotice
  onDismiss: () => void
}) {
  const isError = notice.tone === 'error'
  const Icon = isError ? CircleAlert : Info
  return (
    <Alert
      variant={isError ? 'destructive' : 'default'}
      // The explanation stays black, since small red text on white is hard
      // to read.
      className="rounded-lg border-2 *:data-[slot=alert-description]:text-foreground"
    >
      <Icon />
      <AlertTitle className="font-bold">{notice.title}</AlertTitle>
      <AlertDescription>{notice.message}</AlertDescription>
      <AlertAction>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Dismiss"
          onClick={onDismiss}
        >
          <X />
        </Button>
      </AlertAction>
    </Alert>
  )
}
