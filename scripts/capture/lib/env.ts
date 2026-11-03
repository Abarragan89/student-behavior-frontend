// Paths, ports and the throwaway secrets for one capture run.
import { randomBytes } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

export const REPO = fileURLToPath(new URL('../../../', import.meta.url))
export const CAPTURE_DIR = fileURLToPath(new URL('../', import.meta.url))
export const OUT = CAPTURE_DIR + '.out/'
export const PUBLISH_DIR = REPO + 'site/src/assets/captures/'

export const API_PORT = 18080
export const APP_PORT = 3100
/** The browser must use `localhost` for both, or the sign-in cookie is dropped. */
export const API_URL = `http://localhost:${API_PORT}`
export const APP_URL = `http://localhost:${APP_PORT}`
/** What printed QR codes and share links show. */
export const PUBLIC_URL = 'https://teachforfree.com'

export type Secrets = { jwtSecret: string }

/** Fresh keys for every run, written where compose reads them. */
export function writeDemoEnv(): Secrets {
  mkdirSync(OUT, { recursive: true })
  const key = () => randomBytes(32).toString('base64')
  const jwtSecret = key()
  const env = {
    DATABASE_URL: 'postgres://demo:demo@db:5432/demo?sslmode=disable',
    PORT: '8080',
    CORS_ALLOWED_ORIGIN: APP_URL,
    FRONTEND_URL: PUBLIC_URL,
    AUTH_GOOGLE_CLIENT_ID: 'capture-demo',
    AUTH_GOOGLE_CLIENT_SECRET: 'capture-demo',
    AUTH_GOOGLE_REDIRECT_URL: `${API_URL}/auth/google/callback`,
    AUTH_GOOGLE_ALLOWED_DOMAINS: '',
    JWT_SECRET: jwtSecret,
    GOOGLE_TOKEN_ENCRYPTION_KEY: key(),
    STUDENT_DATA_ENCRYPTION_KEY: key(),
    IS_PRODUCTION: 'false',
    REDIS_URL: 'redis://redis:6379/0',
    CLIENT_IP_HEADER: '',
  }
  writeFileSync(
    OUT + 'demo.env',
    Object.entries(env)
      .map(([k, v]) => `${k}=${v}`)
      .join('\n') + '\n',
    { mode: 0o600 },
  )
  return { jwtSecret }
}

// ---------- The demo clock ----------
//
// Recordings read like a school morning: the page thinks it's 10:15 on a
// weekday. The page's clock may only run behind the real one (the backend
// turns future mark times into "now"), so we need a time zone where it's
// already past 10:15 today. The student page and report name the zone
// ("Times are in Pacific Time"), so US zones come first.

const US_ZONES = [
  'America/Los_Angeles',
  'America/Denver',
  'America/Chicago',
  'America/New_York',
]
/** Only if no US zone works right now; their names show on reports. */
const OTHER_ZONES = [
  'Pacific/Honolulu',
  'Asia/Tokyo',
  'Asia/Kolkata',
  'Europe/London',
]

export type DemoClock = {
  timeZone: string
  /** Today in that zone, YYYY-MM-DD. */
  today: string
  /** Minutes after midnight the page will show (10:15). */
  demoMinutes: number
}

export function localParts(timeZone: string, at = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
      weekday: 'short',
    })
      .formatToParts(at)
      .map((p) => [p.type, p.value]),
  )
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
    weekday: parts.weekday as string,
  }
}

/** The first zone where it's a weekday between 10:30 and 23:15. */
export function pickDemoClock(): DemoClock {
  const ok = (timeZone: string) => {
    const z = localParts(timeZone)
    return (
      !['Sat', 'Sun'].includes(z.weekday) &&
      z.minutes >= 10 * 60 + 30 &&
      z.minutes <= 23 * 60 + 15
    )
  }
  const timeZone = US_ZONES.find(ok) ?? OTHER_ZONES.find(ok)
  if (!timeZone) {
    throw new Error(
      'No time zone has a school day right now (weekday, 10:30 AM–11:15 PM). Try again later.',
    )
  }
  if (!US_ZONES.includes(timeZone)) {
    console.warn(
      `No US time zone works right now; using ${timeZone}, which the student page and report will name.`,
    )
  }
  return {
    timeZone,
    today: localParts(timeZone).date,
    demoMinutes: 10 * 60 + 15,
  }
}

/** The UTC instant of a local wall-clock time in a zone. */
export function zonedInstant(
  timeZone: string,
  date: string,
  minutes: number,
): Date {
  const [y, m, d] = date.split('-').map(Number)
  const guess = Date.UTC(y, m - 1, d, Math.floor(minutes / 60), minutes % 60)
  // Correct by the zone's offset at that moment (twice, for DST edges).
  let t = guess
  for (let i = 0; i < 2; i++) {
    const p = localParts(timeZone, new Date(t))
    const shown = Date.UTC(
      Number(p.date.slice(0, 4)),
      Number(p.date.slice(5, 7)) - 1,
      Number(p.date.slice(8, 10)),
      Math.floor(p.minutes / 60),
      p.minutes % 60,
    )
    t += guess - shown
  }
  return new Date(t)
}

/** School days (Mon–Fri) before `date`, newest first. */
export function schoolDaysBefore(date: string, count: number): Array<string> {
  const days: Array<string> = []
  const d = new Date(date + 'T12:00:00Z')
  while (days.length < count) {
    d.setUTCDate(d.getUTCDate() - 1)
    const wd = d.getUTCDay()
    if (wd !== 0 && wd !== 6) days.push(d.toISOString().slice(0, 10))
  }
  return days
}

export function addDays(date: string, n: number) {
  const d = new Date(date + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

/** Next school day after `date`. */
export function nextSchoolDay(date: string, skip = 1) {
  let d = date
  let left = skip
  while (left > 0) {
    d = addDays(d, 1)
    const wd = new Date(d + 'T12:00:00Z').getUTCDay()
    if (wd !== 0 && wd !== 6) left--
  }
  return d
}
