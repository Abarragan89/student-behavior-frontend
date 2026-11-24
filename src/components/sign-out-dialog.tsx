import { useState } from 'react'
import { toast } from 'sonner'
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
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'
import { useLogout } from '#/lib/auth'
import { describeUnsent, useUnsentChanges } from '#/hooks/useUnsentChanges'

/**
 * Asks before signing out. Used by the avatar menu and the Account page.
 * `everywhere`: signs out on every device at once (Account page).
 */
export function SignOutDialog({
  open,
  onOpenChange,
  everywhere = false,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  everywhere?: boolean
}) {
  const logout = useLogout()
  const [signingOut, setSigningOut] = useState(false)
  // Marks and checkmarks made offline (or still on their way) are deleted by
  // signing out.
  const changes = useUnsentChanges()
  const unsent = changes.total

  async function signOut() {
    setSigningOut(true)
    try {
      // Clears the session and leaves the signed-in pages.
      await logout({ everywhere })
    } catch (error) {
      console.error('Sign out failed:', error)
      setSigningOut(false)
      toast.error(
        everywhere
          ? 'Couldn’t sign out your other devices. Check your connection and try again.'
          : 'Couldn’t sign out. Check your connection and try again.',
      )
    }
  }

  return (
    <AlertDialog
      open={open}
      // Stay open while signing out, so it can't be dismissed halfway.
      onOpenChange={(next) => {
        if (!signingOut) onOpenChange(next)
      }}
    >
      <AlertDialogContent className="rounded-lg border-2 border-border ring-0">
        <AlertDialogHeader>
          <AlertDialogTitle className="font-bold">
            {everywhere ? 'Sign out everywhere?' : 'Sign out?'}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {everywhere &&
              'This signs you out right away on every phone, tablet and computer, this one included, and stops reminders on all of them. A device that saved your class list erases it the next time it goes online. '}
            {unsent > 0
              ? `${describeUnsent(changes)} ${unsent === 1 ? 'hasn’t' : 'haven’t'} been saved yet. Signing out now deletes ${unsent === 1 ? 'it' : 'them'}. To keep ${unsent === 1 ? 'it' : 'them'}, connect to the internet and wait a moment first.`
              : 'You’ll need to sign in with Google again to see your classes.'}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={signingOut}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => void signOut()}
            disabled={signingOut}
            aria-busy={signingOut}
            // Solid red: this is the one button that ends the session. The
            // label stays (invisible) under the spinner so the size holds.
            className="relative bg-destructive font-bold text-destructive-foreground hover:bg-destructive/90 disabled:opacity-100"
          >
            <span className={cn(signingOut && 'invisible')}>
              {everywhere
                ? 'Sign out everywhere'
                : unsent > 0
                  ? 'Sign out anyway'
                  : 'Sign out'}
            </span>
            {signingOut && (
              <Spinner
                aria-label="Signing out"
                className="absolute inset-0 m-auto size-4"
              />
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
