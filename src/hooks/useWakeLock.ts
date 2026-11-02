import { useEffect } from 'react'

/**
 * Keeps the screen from dimming and locking while the page is open (a phone
 * held while teaching). The browser drops the lock whenever the page is
 * hidden, so it's asked for again when the page comes back. Does nothing
 * where the browser can't do it.
 */
export function useWakeLock() {
  useEffect(() => {
    if (!('wakeLock' in navigator)) return
    let lock: WakeLockSentinel | null = null
    let stopped = false

    const request = async () => {
      if (document.visibilityState !== 'visible') return
      if (lock && !lock.released) return
      try {
        const next = await navigator.wakeLock.request('screen')
        if (stopped) void next.release().catch(() => {})
        else lock = next
      } catch {
        // Refused (low battery, a setting): the screen just sleeps as usual.
      }
    }
    const onVisible = () => void request()

    void request()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      stopped = true
      document.removeEventListener('visibilitychange', onVisible)
      void lock?.release().catch(() => {})
    }
  }, [])
}
