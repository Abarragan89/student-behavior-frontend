// Records the marketing videos and screenshots from the real app.
//
//   npm run capture                      all scenes, results in scripts/capture/.out/
//   npm run capture -- --publish         …and copy them into site/src/assets/captures/
//   npm run capture -- --scene hero      one scene (repeatable)
//   npm run capture -- --keep-up         leave the demo backend running afterwards
//   npm run capture -- --reuse           use a backend left running by --keep-up
//   npm run capture -- --headed          watch the phone browser
//   npm run capture -- --scene guide     the teacher guide PDF (.out/guide/)
//
// Needs Docker, ffmpeg and the Go backend repo next to this one (or set
// BACKEND_DIR). See scripts/capture/README.md.
import { readFileSync } from 'node:fs'
import { parseArgs } from 'node:util'
import { launchPaperBrowser, launchPhoneBrowser } from './lib/browser.ts'
import { publish } from './lib/encode.ts'
import {
  APP_URL,
  OUT,
  PUBLISH_DIR,
  pickDemoClock,
  writeDemoEnv,
} from './lib/env.ts'
import type { Secrets } from './lib/env.ts'
import type { Scene } from './lib/scene.ts'
import { buildApp, stackDown, stackUp, startPreview } from './lib/stack.ts'
import { EXTRA_SCENES, SCENES } from './scenes/index.ts'

const { values } = parseArgs({
  options: {
    scene: { type: 'string', multiple: true },
    publish: { type: 'boolean' },
    'keep-up': { type: 'boolean' },
    reuse: { type: 'boolean' },
    headed: { type: 'boolean' },
  },
})

const ALL: Record<string, Scene> = { ...SCENES, ...EXTRA_SCENES }
const names = values.scene?.length ? values.scene : Object.keys(SCENES)
for (const n of names) {
  if (!(n in ALL))
    throw new Error(
      `Unknown scene "${n}". Scenes: ${Object.keys(ALL).join(', ')}`,
    )
}

const clock = pickDemoClock()
console.log(`Demo day: ${clock.today} in ${clock.timeZone}, shown at 10:15`)

let secrets: Secrets
if (values.reuse) {
  const env = readFileSync(OUT + 'demo.env', 'utf8')
  secrets = { jwtSecret: /^JWT_SECRET=(.*)$/m.exec(env)![1] }
} else {
  secrets = writeDemoEnv()
  await stackUp()
}

// --reuse also keeps an app preview that's already running (while iterating).
const running =
  values.reuse &&
  (await fetch(`${APP_URL}/classes`, { headers: { accept: 'text/html' } }).then(
    (r) => r.ok,
    () => false,
  ))
if (!running) buildApp()
const preview = running ? null : await startPreview()
const phoneBrowser = await launchPhoneBrowser(values.headed)
const paperBrowser = await launchPaperBrowser()

let failed = false
const made: Array<string> = []
try {
  for (const name of names) {
    console.log(`Scene: ${name}`)
    const scene = ALL[name]
    try {
      made.push(
        ...(await scene({ clock, secrets, phoneBrowser, paperBrowser })),
      )
    } catch (e) {
      failed = true
      console.error(`  ${name} failed:`, e)
    }
  }
} finally {
  await phoneBrowser.close()
  await paperBrowser.close()
  preview?.kill()
  if (!values['keep-up']) stackDown()
}

if (values.publish && !failed) {
  publish(made, PUBLISH_DIR)
  console.log(`Published ${made.length} files to site/src/assets/captures/`)
} else {
  console.log(`Made ${made.length} files in scripts/capture/.out/`)
}
if (failed) process.exitCode = 1
