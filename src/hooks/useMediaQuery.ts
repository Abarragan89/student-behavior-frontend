import { useCallback, useSyncExternalStore } from 'react'

/**
 * True while the CSS media query matches, e.g. useMediaQuery('(min-width: 768px)').
 * Re-renders when it starts or stops matching (resizing, rotating a tablet).
 *
 * Uses useSyncExternalStore, so the first render already has the right value
 * (no flash of the wrong layout).
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const mql = window.matchMedia(query)
      mql.addEventListener('change', onChange)
      return () => mql.removeEventListener('change', onChange)
    },
    [query],
  )

  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false, // no window (server render): assume the small screen
  )
}
