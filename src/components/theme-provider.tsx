import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { ThemeProvider as NextThemesProvider, useTheme } from 'next-themes'

/**
 * Light or dark mode, saved on this device. Dark adds the `dark` class to
 * <html>, which switches the colors in styles.css. index.html applies the
 * saved choice before the first paint, so dark mode doesn't flash light.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="light"
      enableSystem={false}
      // Swap colors at once instead of animating every button and card.
      disableTransitionOnChange
      // next-themes' early script never runs in an app rendered in the
      // browser (index.html does that job). Marked as data so React doesn't
      // warn about it.
      scriptProps={{ type: 'application/json' }}
    >
      <BrowserBarColor />
      {children}
    </NextThemesProvider>
  )
}

/** --background in styles.css (:root and .dark). Also used in index.html. */
const BAR_COLORS = { light: '#f7f9f3', dark: '#000000' }

/** Keeps the phone's status bar and browser bar the page's color. */
function BrowserBarColor() {
  const { resolvedTheme } = useTheme()

  useEffect(() => {
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute(
        'content',
        resolvedTheme === 'dark' ? BAR_COLORS.dark : BAR_COLORS.light,
      )
  }, [resolvedTheme])

  return null
}
