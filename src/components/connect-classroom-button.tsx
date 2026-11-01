import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'
import { GoogleIcon } from '#/components/GoogleIcon'
import { connectClassroom } from '#/lib/classroom'
import { useOnline } from '#/lib/online'

/** Sends the teacher to Google to allow access to their Classroom classes. */
export function ConnectClassroomButton({ className }: { className?: string }) {
  const [connecting, setConnecting] = useState(false)
  // It's a trip to Google and back. Nearby, the Add Students form says why
  // it's off.
  const online = useOnline()

  // Pressing Back on Google's page can restore this page from the browser's
  // cache with the spinner still showing. Reset it when that happens.
  useEffect(() => {
    function onPageShow(e: PageTransitionEvent) {
      if (e.persisted) setConnecting(false)
    }
    window.addEventListener('pageshow', onPageShow)
    return () => window.removeEventListener('pageshow', onPageShow)
  }, [])

  return (
    <Button
      variant="outline"
      disabled={connecting || !online}
      onClick={() => {
        setConnecting(true)
        void connectClassroom()
      }}
      // The label stays in place (invisible) under the spinner, so the button
      // keeps its exact size while the page heads to Google.
      className={cn(
        'relative h-12 rounded-lg border-2 border-border bg-card px-6 text-base font-bold text-card-foreground shadow-md',
        connecting && 'disabled:opacity-100',
        className,
      )}
    >
      <span
        className={cn(
          'inline-flex items-center gap-3',
          connecting && 'invisible',
        )}
      >
        <GoogleIcon />
        Connect Google Classroom
      </span>
      {connecting && (
        <Spinner
          aria-label="Opening Google"
          className="absolute inset-0 m-auto size-5"
        />
      )}
    </Button>
  )
}
