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
    let d = ''
    qr.data.forEach((row, y) =>
      row.forEach((dark, x) => {
        if (dark) d += `M${x} ${y}h1v1h-1z`
      }),
    )
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
