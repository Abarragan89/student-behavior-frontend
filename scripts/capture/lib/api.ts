// Talking to the demo backend: SQL for what isn't encrypted, the API for the
// rest (student names and lesson plan text are encrypted per row by the API).
import { createHmac } from 'node:crypto'
import { API_PORT } from './env.ts'
import { compose, flushRedis } from './stack.ts'

/** A SQL string literal. Only ever used with this script's own data. */
export function lit(value: string | number | boolean | null) {
  if (value === null) return 'NULL'
  if (typeof value !== 'string') return String(value)
  return `'${value.replaceAll("'", "''")}'`
}

/** Runs SQL in the demo database; returns rows as arrays of strings. */
export function sql(query: string): Array<Array<string>> {
  const out = compose(
    [
      'exec',
      '-T',
      'db',
      'psql',
      '-U',
      'demo',
      '-d',
      'demo',
      '-v',
      'ON_ERROR_STOP=1',
      '-At',
      '-F',
      '\t',
      '-q',
      '-f',
      '-',
    ],
    { input: query, quiet: true },
  )
  return out
    .split('\n')
    .filter(Boolean)
    .map((line) => line.split('\t'))
}

/** An access token like the one the backend sets at Google sign-in. */
export function mintAccessToken(jwtSecret: string, userId: string) {
  const b64 = (v: object | Buffer) =>
    (Buffer.isBuffer(v) ? v : Buffer.from(JSON.stringify(v))).toString(
      'base64url',
    )
  const now = Math.floor(Date.now() / 1000)
  const head = b64({ alg: 'HS256', typ: 'JWT' })
  const body = b64({
    sub: userId,
    iss: 'student-behavior',
    aud: ['student-behavior-api'],
    iat: now - 5,
    exp: now + 6 * 3600,
  })
  const sig = createHmac('sha256', Buffer.from(jwtSecret, 'base64'))
    .update(`${head}.${body}`)
    .digest()
  return `${head}.${body}.${b64(sig)}`
}

export class Api {
  token: string
  constructor(token: string) {
    this.token = token
  }

  async call<T = any>(
    method: string,
    path: string,
    body?: unknown,
    retries = 3,
  ): Promise<T> {
    const res = await fetch(`http://127.0.0.1:${API_PORT}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${this.token}`,
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    const text = await res.text()
    // Seeding is faster than any teacher; reset the demo's rate limits.
    if (res.status === 429 && retries > 0) {
      flushRedis()
      return this.call<T>(method, path, body, retries - 1)
    }
    if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${text}`)
    return (text ? JSON.parse(text) : undefined) as T
  }

  get<T = any>(path: string) {
    return this.call<T>('GET', path)
  }
  post<T = any>(path: string, body: unknown) {
    return this.call<T>('POST', path, body)
  }
  put<T = any>(path: string, body: unknown) {
    return this.call<T>('PUT', path, body)
  }
}
