import { cn } from '#/lib/utils'

/**
 * The TeachForFree chalkboard logo. It has its own colors, so the same image
 * works in light and dark mode. Defaults to header size; pass a height class
 * (e.g. `h-24`) to make it bigger.
 */
export function Wordmark({ className }: { className?: string }) {
  return (
    <img
      src="/branding/chalkboard.png"
      alt="TeachForFree"
      width={1024}
      height={749}
      className={cn('h-12 w-auto shrink-0', className)}
    />
  )
}
