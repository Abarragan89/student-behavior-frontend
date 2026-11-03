// /lesson-planner's hero: writing tomorrow's plan.
import { phone } from '../lib/browser.ts'
import { encode } from '../lib/encode.ts'
import { nextSchoolDay } from '../lib/env.ts'
import { tap, type, wait } from '../lib/gestures.ts'
import { record } from '../lib/recorder.ts'
import type { Scene } from '../lib/scene.ts'
import { seedTeacher } from '../lib/seed.ts'
import { open } from './hero.ts'

export const editor: Scene = async ({ clock, secrets, phoneBrowser }) => {
  const t = await seedTeacher(clock, secrets)
  const tomorrow = nextSchoolDay(clock.today)
  const p = await phone(phoneBrowser, clock, { token: t.token })
  const { page } = p
  const addSection = page.getByRole('textbox', { name: 'Add a section' })
  await open(p, `/lesson-plans/${tomorrow}`, () => addSection.waitFor())

  const title = 'Period 3 — English 7'
  const take = await record('plan-editor', p, async (step) => {
    step('Name a section')
    await wait(900)
    await tap(p, addSection)
    await type(p, title)
    await wait(300)
    await page.keyboard.press('Enter')

    step('Add a time')
    await tap(p, page.getByRole('button', { name: 'Add a time' }), {
      before: 600,
    })
    await tap(p, page.getByLabel('Starts'), { before: 600 })
    await type(p, '1000A')
    await tap(p, page.getByLabel('Ends'), { before: 400 })
    await type(p, '1045A')
    await tap(p, page.getByRole('button', { name: 'Save', exact: true }), {
      before: 500,
    })

    step('Jot down the lesson')
    const addLine = page.getByRole('textbox', {
      name: `Add a line to “${title}”`,
    })
    await tap(p, addLine, { before: 600 })
    for (const line of [
      'Warm-up: journal prompt',
      'Read aloud, chapter 7',
      'Stop at p. 131 for questions',
    ]) {
      await type(p, line)
      await wait(250)
      await page.keyboard.press('Enter')
      await wait(200)
    }
    // Indent the last line under "Read aloud".
    await tap(
      p,
      page.getByRole('textbox', { name: 'Line', exact: true }).nth(2),
      { before: 500 },
    )
    await tap(p, page.getByRole('button', { name: 'Move line in' }), {
      before: 400,
    })
    await tap(p, addLine, { before: 500 })
    await type(p, 'Exit ticket')
    await page.keyboard.press('Enter')
    await wait(400)
    await page.evaluate(() =>
      (document.activeElement as HTMLElement | null)?.blur(),
    )
    await wait(1800)
  })
  await p.context.close()
  const clip = encode(take)
  return [clip.mp4, clip.poster, clip.chaptersFile]
}
