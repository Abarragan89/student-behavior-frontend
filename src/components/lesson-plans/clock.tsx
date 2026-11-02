import { useEffect, useState } from 'react'

/** The time on the wall clock, for glancing at mid-lesson. */
export function Clock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    const tick = () => {
      setNow(new Date())
      // Right after the next minute starts.
      timer = setTimeout(tick, 60_000 - (Date.now() % 60_000) + 50)
    }
    timer = setTimeout(tick, 60_000 - (Date.now() % 60_000) + 50)
    return () => clearTimeout(timer)
  }, [])
  return (
    <time
      dateTime={now.toISOString()}
      className="shrink-0 text-lg font-bold tabular-nums"
    >
      {now.toLocaleTimeString(undefined, {
        hour: 'numeric',
        minute: '2-digit',
      })}
    </time>
  )
}
