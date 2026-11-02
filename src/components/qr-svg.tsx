import { useMemo } from 'react'
import { encode } from 'uqr'

/**
 * A QR code drawn as one inline SVG path: on the page the moment it renders
 * (nothing to load before printing), and sharp at any size on paper. Leave a
 * light margin around it (the quiet zone) so phones can find its edges.
 */
export function QrSvg({
  value,
  label,
  className,
}: {
  value: string
  /** What it opens, for screen readers. */
  label: string
  className?: string
}) {
  const { size, path } = useMemo(() => {
    const qr = encode(value, { ecc: 'M', border: 0 })
    // One rectangle per run of dark modules in a row, not one per module:
    // a page of notices has dozens of codes.
    let d = ''
    qr.data.forEach((row, y) => {
      let x = 0
      while (x < row.length) {
        if (!row[x]) {
          x++
          continue
        }
        const start = x
        while (x < row.length && row[x]) x++
        d += `M${start} ${y}h${x - start}v1h-${x - start}z`
      }
    })
    return { size: qr.size, path: d }
  }, [value])

  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${size} ${size}`}
      shapeRendering="crispEdges"
      className={className}
    >
      <path d={path} fill="#000" />
    </svg>
  )
}
