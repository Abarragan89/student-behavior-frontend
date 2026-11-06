import type { ReactNode } from 'react'
import { CircleAlert } from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'
import { GoogleIcon } from '#/components/GoogleIcon'
import { Wordmark } from '#/components/Wordmark'
import { useLogout } from '#/lib/auth'
import { useOnline } from '#/lib/online'

// The pages someone opens from a link before they may have an account: a
// co-teacher invite (/invite), a school's join link (/join), and starting a
// school (/school/start). The logo, one card, and what goes in it.

export const googleButtonClass = cn(
  buttonVariants({ variant: 'outline' }),
  'h-12 w-full gap-3 rounded-lg border-2 border-border bg-card text-base font-bold text-card-foreground shadow-md',
)

/** The logo above one centered card. */
export function LinkPage({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-8 bg-background px-4 py-12 text-foreground">
      <a href="/" aria-label="TeachForFree home">
        <Wordmark className="h-24" />
      </a>
      <Card className="w-full max-w-sm rounded-lg border-2 border-border shadow-md ring-0 [--card-spacing:--spacing(6)]">
        {children}
      </Card>
    </main>
  )
}

/** The card's heading: an icon, a title and a sentence or two. */
export function LinkPageHeader({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof CircleAlert
  title: ReactNode
  children?: ReactNode
}) {
  return (
    <CardHeader className="gap-2 text-center">
      <span
        aria-hidden
        className="mx-auto grid size-14 place-items-center rounded-lg border-2 border-border bg-secondary"
      >
        <Icon className="size-7" />
      </span>
      {/* The page's only heading: the card is the whole page. */}
      <CardTitle className="text-2xl font-bold wrap-break-word">
        <h1>{title}</h1>
      </CardTitle>
      {children && (
        <CardDescription className="text-base">{children}</CardDescription>
      )}
    </CardHeader>
  )
}

/**
 * Signed out: the usual Google button. `href` is a login link that comes back
 * to this page; `onClick` runs just before leaving (e.g. "join on return").
 */
export function SignInWithGoogle({
  href,
  onClick,
  note = 'Use your school Google account. New to TeachForFree? Signing in creates your free account.',
}: {
  href: string
  onClick?: () => void
  note?: ReactNode
}) {
  const online = useOnline()
  return (
    <div className="flex flex-col gap-3">
      {online ? (
        <a href={href} onClick={onClick} className={googleButtonClass}>
          <GoogleIcon />
          Continue with Google
        </a>
      ) : (
        <>
          <Button variant="outline" disabled className={googleButtonClass}>
            <GoogleIcon />
            Continue with Google
          </Button>
          <OfflineSignIn />
        </>
      )}
      {note && (
        <p className="text-center text-sm text-muted-foreground">{note}</p>
      )}
    </div>
  )
}

export function OfflineSignIn() {
  return (
    <p role="status" className="text-center text-sm text-muted-foreground">
      You’re offline. Connect to the internet to sign in.
    </p>
  )
}

/** "Not you? Sign out and use another Google account." */
export function NotYou() {
  const logout = useLogout()
  return (
    <p className="text-center text-sm text-muted-foreground">
      Not you?{' '}
      <button
        type="button"
        // What this tab is holding stays: signing in again comes back here.
        onClick={() => void logout()}
        className="font-bold underline underline-offset-2"
      >
        Sign out
      </button>{' '}
      and use another Google account.
    </p>
  )
}

export function Loading({ text }: { text: string }) {
  return (
    <CardContent>
      <p
        role="status"
        className="flex items-center justify-center gap-2 py-8 font-medium text-muted-foreground"
      >
        <Spinner aria-hidden className="size-5" />
        {text}
      </p>
    </CardContent>
  )
}

/** The whole card is about one problem, with an optional way forward. */
export function Problem({
  icon: Icon,
  title,
  text,
  action,
}: {
  icon: typeof CircleAlert
  title: string
  text: string
  action?: ReactNode
}) {
  return (
    <>
      <CardHeader className="gap-2 text-center">
        <span
          aria-hidden
          className="mx-auto grid size-14 place-items-center rounded-lg border-2 border-border bg-secondary"
        >
          <Icon className="size-7" />
        </span>
        <CardTitle className="text-xl font-bold wrap-break-word">
          <h1>{title}</h1>
        </CardTitle>
        <CardDescription className="text-base">{text}</CardDescription>
      </CardHeader>
      {action && (
        <CardContent className="flex justify-center">{action}</CardContent>
      )}
    </>
  )
}

/** A problem under the card's heading, in place of its buttons. */
export function ProblemText({
  title,
  text,
  action,
}: {
  title: string
  text: string
  action?: ReactNode
}) {
  return (
    <div role="alert" className="flex flex-col gap-3 text-center">
      <p className="flex items-center justify-center gap-2 font-bold">
        <CircleAlert className="size-5 shrink-0 text-destructive" />
        {title}
      </p>
      <p className="text-sm text-muted-foreground">{text}</p>
      {action}
    </div>
  )
}
