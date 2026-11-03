import { useEffect, useLayoutEffect, useRef } from 'react'

/**
 * Sets the page title while printing: a saved PDF is named after it. The
 * title is read when the print starts, so it can change right before
 * window.print() (in a flushSync) and still be the one used.
 */
export function usePrintTitle(title: string) {
  const current = useRef(title)
  useLayoutEffect(() => {
    current.current = title
  })
  useEffect(() => {
    let saved: string | null = null
    const before = () => {
      saved ??= document.title
      document.title = current.current
    }
    const after = () => {
      if (saved !== null) document.title = saved
      saved = null
    }
    window.addEventListener('beforeprint', before)
    window.addEventListener('afterprint', after)
    return () => {
      window.removeEventListener('beforeprint', before)
      window.removeEventListener('afterprint', after)
      after()
    }
  }, [])
}
