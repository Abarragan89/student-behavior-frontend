/**
 * A UUID v7: the time in its first 48 bits, then random bits. Made on the
 * device for each mark, so a mark has its id before it reaches the server and
 * sending it twice (offline queue, lost response) saves it only once. Time
 * first keeps new ids next to each other in the database's index, like the
 * server's own uuidv7().
 */
export function uuidv7(ms: number = Date.now()): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16))

  // Milliseconds since 1970, big-endian, in bytes 0–5.
  let time = ms
  for (let i = 5; i >= 0; i--) {
    bytes[i] = time % 256
    time = Math.floor(time / 256)
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x70 // version 7
  bytes[8] = (bytes[8] & 0x3f) | 0x80 // RFC 9562 variant

  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join('-')
}
