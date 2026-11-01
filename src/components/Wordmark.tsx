/**
 * The TeachForFree logo. Shows the dark version when the `dark` class is on
 * <html> (src/components/theme-provider.tsx). That class is set before the
 * first paint, so the right logo shows without a flash.
 */
export function Wordmark() {
  return (
    <span className="inline-flex shrink-0">
      <img
        src="/branding/teachforfree-apple-light.png"
        alt="TeachForFree"
        width={804}
        height={192}
        className="h-9 w-auto dark:hidden"
      />
      <img
        src="/branding/teachforfree-apple-dark.png"
        alt="TeachForFree"
        width={804}
        height={192}
        className="hidden h-9 w-auto dark:block"
      />
    </span>
  )
}
