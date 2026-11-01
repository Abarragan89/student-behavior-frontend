import { Link, createFileRoute, redirect } from '@tanstack/react-router'
import { ArrowLeft, CircleAlert } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { buttonVariants } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { GoogleIcon } from '#/components/GoogleIcon'
import { Wordmark } from '#/components/Wordmark'
import { loginUrl } from '#/lib/api'
import { meQueryOptions } from '#/lib/auth'

// Codes the Go backend puts in /login?error=… when Google sign-in fails.
const errorMessages: Record<string, string> = {
  google_denied: 'Google sign-in was cancelled. Try again when you’re ready.',
  login_failed:
    'Something went wrong signing in with Google. Please try again.',
  account_conflict:
    'That email is already linked to a different account. Try another Google account.',
  server_error: 'Something went wrong on our side. Please try again.',
}

export const Route = createFileRoute('/login')({
  validateSearch: (search: Record<string, unknown>): { error?: string } => ({
    error: typeof search.error === 'string' ? search.error : undefined,
  }),
  // Already signed in: go to Classes. No retries and errors ignored, so
  // the page still shows right away if the backend is down.
  beforeLoad: async ({ context }) => {
    const user = await context.queryClient
      .query({ ...meQueryOptions, retry: false })
      .catch(() => null)
    if (user) throw redirect({ to: '/classes' })
  },
  component: LoginPage,
})

function LoginPage() {
  const { error } = Route.useSearch()

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-8 bg-background px-4 py-12 text-foreground">
      <Link to="/" aria-label="TeachForFree home">
        <Wordmark />
      </Link>

      <Card className="w-full max-w-sm rounded-lg border-2 border-border shadow-md ring-0 [--card-spacing:--spacing(6)]">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Sign in</CardTitle>
          <CardDescription className="text-base">
            New to TeachForFree? Signing in creates your free account.
          </CardDescription>
        </CardHeader>

        <CardContent className="flex flex-col gap-4">
          {error && (
            <Alert
              variant="destructive"
              // Red title and icon; the explanation stays black, since small
              // red text on white is hard to read.
              className="rounded-lg border-2 *:data-[slot=alert-description]:text-foreground"
            >
              <CircleAlert />
              <AlertTitle>Couldn’t sign you in</AlertTitle>
              <AlertDescription>
                {errorMessages[error] ?? errorMessages.login_failed}
              </AlertDescription>
            </Alert>
          )}

          <a
            href={loginUrl}
            className={cn(
              buttonVariants({ variant: 'outline' }),
              'h-12 w-full gap-3 rounded-lg border-2 border-border bg-card text-base font-bold text-card-foreground shadow-md',
            )}
          >
            <GoogleIcon />
            Continue with Google
          </a>
        </CardContent>
      </Card>

      <Link
        to="/"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to home
      </Link>
    </main>
  )
}
