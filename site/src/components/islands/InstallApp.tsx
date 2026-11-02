// The app's "Download the app" button on the marketing pages. It needs the
// browser (the install offer, which phone this is), so it's rendered there
// only: <InstallApp client:only="react" />.
import { Toaster } from '@/components/ui/sonner'
import { InstallAppButton } from '#/components/install/install-app'

export default function InstallApp({
  placement,
}: {
  placement: 'header' | 'hero'
}) {
  if (placement === 'hero') {
    // Phones only: the header has room for just an icon there.
    return (
      <InstallAppButton
        variant="outline"
        className="h-12 rounded-lg border-2 border-border bg-card px-6 text-base text-card-foreground shadow-md sm:hidden"
      />
    )
  }

  const dark = document.documentElement.classList.contains('dark')
  return (
    <>
      <InstallAppButton
        compact
        className="h-10 rounded-lg border-2 border-border px-3 text-sm"
      />
      {/* For the install code's messages ("TeachForFree is installed",
          "Link copied"). One is enough: the islands share the same toast(). */}
      <Toaster position="top-center" theme={dark ? 'dark' : 'light'} />
    </>
  )
}
