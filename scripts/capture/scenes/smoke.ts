// Checks the demo stack works: a seeded teacher can open their class.
import { mkdirSync } from 'node:fs'
import { assertSignedIn, phone } from '../lib/browser.ts'
import { APP_URL, OUT } from '../lib/env.ts'
import { FULL_DAY } from '../lib/fixtures.ts'
import type { Scene } from '../lib/scene.ts'
import { seedAllMarks, seedPlan, seedTeacher } from '../lib/seed.ts'

export const smoke: Scene = async ({ clock, secrets, phoneBrowser }) => {
  const t = await seedTeacher(clock, secrets)
  seedAllMarks(t)
  await seedPlan(t, clock.today, FULL_DAY)
  const p = await phone(phoneBrowser, clock, { token: t.token })
  mkdirSync(OUT + 'smoke', { recursive: true })
  await p.page.goto(`${APP_URL}/classes`)
  await p.page.getByTitle('Marcus Bell').waitFor()
  assertSignedIn(p.page)
  await p.page.waitForTimeout(800)
  const shot = async (name: string) => {
    const r = await p.cdp.send('Page.captureScreenshot', { format: 'png' })
    const { writeFileSync } = await import('node:fs')
    writeFileSync(`${OUT}smoke/${name}.png`, Buffer.from(r.data, 'base64'))
  }
  await shot('classes')
  await p.page.goto(`${APP_URL}/lesson-plans/${clock.today}/present`)
  await p.page.getByRole('checkbox').first().waitFor()
  await p.page.waitForTimeout(1200)
  await shot('present')
  await p.page.goto(`${APP_URL}/lesson-plans/${clock.today}`)
  await p.page.getByRole('link', { name: 'Presenter view' }).waitFor()
  await p.page.waitForTimeout(800)
  await shot('day')
  await p.context.close()
  return []
}
