import { useEffect, useState } from 'react'

/**
 * The time (Date.now()), refreshed every everyMs, and at once when the tab
 * comes back into view (background tabs' timers are slowed down).
 */
export function useNow(everyMs: number) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const tick = () => setNow(Date.now())
    const id = window.setInterval(tick, everyMs)
    document.addEventListener('visibilitychange', tick)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [everyMs])
  return now
}
