// Starts and stops the demo backend (Docker) and the app (vite preview).
import { spawn, spawnSync } from 'node:child_process'
import type { ChildProcess } from 'node:child_process'
import { readdirSync, readFileSync } from 'node:fs'
import {
  API_PORT,
  API_URL,
  APP_PORT,
  APP_URL,
  CAPTURE_DIR,
  OUT,
  REPO,
} from './env.ts'

const COMPOSE = [
  'compose',
  '-p',
  'tff-capture',
  '-f',
  CAPTURE_DIR + 'compose.yml',
]

export function compose(
  args: Array<string>,
  opts: { input?: string; quiet?: boolean } = {},
) {
  const r = spawnSync('docker', [...COMPOSE, ...args], {
    input: opts.input,
    encoding: 'utf8',
    stdio: [opts.input === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe'],
    maxBuffer: 64 * 1024 * 1024,
  })
  if (r.status !== 0) {
    throw new Error(
      `docker compose ${args.join(' ')} failed:\n${r.stderr || r.stdout}`,
    )
  }
  if (!opts.quiet && r.stderr.trim()) process.stderr.write(r.stderr)
  return r.stdout
}

export function stackDown() {
  try {
    compose(['down', '-v', '--remove-orphans'], { quiet: true })
  } catch (e) {
    console.warn(String(e))
  }
}

export async function stackUp() {
  stackDown()
  console.log('Starting the demo backend (first run builds the Go image)…')
  const r = spawnSync(
    'docker',
    [...COMPOSE, 'up', '-d', '--build', '--wait', 'db', 'redis'],
    {
      stdio: 'inherit',
    },
  )
  if (r.status !== 0) throw new Error('docker compose up (db, redis) failed')
  const api = spawnSync('docker', [...COMPOSE, 'up', '-d', '--build', 'api'], {
    stdio: 'inherit',
  })
  if (api.status !== 0) throw new Error('docker compose up (api) failed')
  await waitForApi()
}

/** The API is ready once GET /users/me answers 401 (signed out). */
async function waitForApi() {
  const deadline = Date.now() + 120_000
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://127.0.0.1:${API_PORT}/users/me`)
      if (res.status === 401) return
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  console.error(compose(['logs', 'api'], { quiet: true }))
  throw new Error(`The demo API didn't start on ${API_URL}`)
}

const APP_OUT = OUT + 'app'

/** Builds the app pointed at the demo API. */
export function buildApp() {
  console.log('Building the app for the demo API…')
  const r = spawnSync(
    'npx',
    [
      'vite',
      'build',
      '--outDir',
      APP_OUT,
      '--emptyOutDir',
      '--logLevel',
      'warn',
    ],
    {
      cwd: REPO,
      stdio: 'inherit',
      env: { ...process.env, VITE_API_URL: API_URL },
    },
  )
  if (r.status !== 0) throw new Error('vite build failed')
  // An exported VITE_API_URL beats .env; make sure it did.
  const js = readdirSync(APP_OUT + '/assets').filter((f) => f.endsWith('.js'))
  if (
    !js.some((f) =>
      readFileSync(`${APP_OUT}/assets/${f}`, 'utf8').includes(API_URL),
    )
  ) {
    throw new Error(`The app build doesn't use ${API_URL}`)
  }
}

export async function startPreview(): Promise<ChildProcess> {
  const child = spawn(
    'npx',
    [
      'vite',
      'preview',
      '--outDir',
      APP_OUT,
      '--port',
      String(APP_PORT),
      '--strictPort',
    ],
    {
      cwd: REPO,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, VITE_API_URL: API_URL },
    },
  )
  let log = ''
  child.stdout?.on('data', (d) => (log += d))
  child.stderr?.on('data', (d) => (log += d))
  const deadline = Date.now() + 30_000
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error('vite preview exited:\n' + log)
    try {
      const res = await fetch(`${APP_URL}/classes`, {
        headers: { accept: 'text/html' },
      })
      if (res.ok) return child
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 300))
  }
  child.kill()
  throw new Error('vite preview did not start:\n' + log)
}

export function flushRedis() {
  compose(['exec', '-T', 'redis', 'redis-cli', 'FLUSHDB'], { quiet: true })
}
