import type { Browser } from 'playwright'
import type { DemoClock, Secrets } from './env.ts'

export type SceneContext = {
  clock: DemoClock
  secrets: Secrets
  phoneBrowser: Browser
  paperBrowser: Browser
}

/** A scene returns the files it made, for --publish. */
export type Scene = (ctx: SceneContext) => Promise<Array<string>>
