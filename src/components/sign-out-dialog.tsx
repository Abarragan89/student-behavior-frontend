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

/** Asks before signing out. Used by the avatar menu and the Account page. */
export function SignOutDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const logout = useLogout()
  const [signingOut, setSigningOut] = useState(false)

  async function signOut() {
    setSigningOut(true)
    try {
      // Clears the session and leaves the signed-in pages.
      await logout()
    } catch (error) {
      console.error('Sign out failed:', error)
      setSigningOut(false)
      toast.error('Couldn’t sign out. Check your connection and try again.')
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
          <AlertDialogTitle className="font-bold">Sign out?</AlertDialogTitle>
          <AlertDialogDescription>
            You’ll need to sign in with Google again to see your classes.
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
            <span className={cn(signingOut && 'invisible')}>Sign out</span>
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
