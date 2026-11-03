// What a substitute sees from the link (/substitute-plans' hero), and the
// teacher's share drawer.
import { phone, resetDemoClock } from '../lib/browser.ts'
import { encode } from '../lib/encode.ts'
import { FULL_DAY, HERO_TICKS, TODAY_MARKS } from '../lib/fixtures.ts'
import { tap, wait } from '../lib/gestures.ts'
import { phoneShot, record } from '../lib/recorder.ts'
import type { Scene } from '../lib/scene.ts'
import { insertMarks, makeSubLink, seedPlan, seedTeacher } from '../lib/seed.ts'
import { open } from './hero.ts'

export const sub: Scene = async ({ clock, secrets, phoneBrowser }) => {
  const t = await seedTeacher(clock, secrets)
  insertMarks(t, TODAY_MARKS)
  await seedPlan(t, clock.today, FULL_DAY)

  // The teacher's share drawer, before any link exists.
  const teacher = await phone(phoneBrowser, clock, { token: t.token })
  await open(teacher, `/lesson-plans/${clock.today}`, () =>
    teacher.page.getByRole('link', { name: 'Presenter view' }).waitFor(),
  )
  await teacher.page
    .getByRole('button', { name: 'Share with a substitute' })
    .click()
  await teacher.page.getByRole('button', { name: 'Make a link' }).click()
  await teacher.page.getByText('Link for the substitute').waitFor()
  await wait(900)
  const share = await phoneShot(teacher, 'share-dialog')
  await teacher.context.close()

  const url = await makeSubLink(t, clock.today)
  const p = await phone(phoneBrowser, clock)
  const { page } = p
  const now = page.getByRole('region', { name: FULL_DAY[3].title })
  await open(p, new URL(url).pathname + new URL(url).hash, () => now.waitFor())
  await resetDemoClock(p)
  await page.goto('about:blank')
  await open(p, new URL(url).pathname + new URL(url).hash, () =>
    now.getByRole('checkbox').first().waitFor(),
  )

  const take = await record('sub-view', p, async (step) => {
    step('No account needed')
    await wait(1600)
    step('Check off the plan')
    for (const line of HERO_TICKS.slice(0, 2)) {
      await tap(p, now.getByRole('checkbox', { name: line }), {
        before: 600,
        after: 250,
      })
    }
    await wait(600)
    step('Give marks')
    await tap(p, page.getByRole('button', { name: 'Show class' }))
    await wait(500)
    await tap(p, page.getByTitle('Ava Chen'))
    await tap(p, page.getByRole('button', { name: 'On task', exact: true }), {
      before: 700,
    })
    await wait(2000)
  })
  await p.context.close()
  const clip = encode(take)
  return [clip.mp4, clip.poster, clip.chaptersFile, share]
}
