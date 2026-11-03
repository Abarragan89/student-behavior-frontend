// The homepage's hero: a teacher looks over the day's plan, opens Presenter
// view, checks off a few lines, then gives marks without leaving the plan.
import { assertSignedIn, phone, resetDemoClock } from '../lib/browser.ts'
import type { Phone } from '../lib/browser.ts'
import { encode } from '../lib/encode.ts'
import { APP_URL } from '../lib/env.ts'
import { FULL_DAY, HERO_TICKS } from '../lib/fixtures.ts'
import { flickToEnd, tap, wait } from '../lib/gestures.ts'
import { record } from '../lib/recorder.ts'
import type { Scene } from '../lib/scene.ts'
import { insertMarks, seedPlan, seedTeacher } from '../lib/seed.ts'
import { TODAY_MARKS } from '../lib/fixtures.ts'

/** Opens a page and waits until it's settled (data, fonts, animations). */
export async function open(
  p: Phone,
  path: string,
  ready: () => Promise<unknown>,
) {
  await p.page.goto(APP_URL + path)
  await ready()
  assertSignedIn(p.page)
  await p.page.evaluate(() => document.fonts.ready)
  await wait(700)
}

export const hero: Scene = async ({ clock, secrets, phoneBrowser }) => {
  const t = await seedTeacher(clock, secrets)
  insertMarks(t, TODAY_MARKS)
  await seedPlan(t, clock.today, FULL_DAY)
  const p = await phone(phoneBrowser, clock, { token: t.token })
  const { page } = p
  const dayPath = `/lesson-plans/${clock.today}`
  const presenterLink = page.getByRole('link', { name: 'Presenter view' })

  // Load every screen once, so the take doesn't wait on code downloads.
  await open(p, `${dayPath}/present`, () =>
    page.getByRole('checkbox').first().waitFor(),
  )
  await open(p, '/classes', () => page.getByTitle('Marcus Bell').waitFor())
  await resetDemoClock(p)
  await open(p, dayPath, () => presenterLink.waitFor())

  const take = await record('plan-and-marks', p, async (step) => {
    step('Your whole day')
    await wait(900)
    // Down through the day, and back to the top.
    await flickToEnd(p, 1, { pause: 480 })
    await wait(650)
    await flickToEnd(p, -1, { pause: 380 })
    await wait(450)

    step('Present')
    await tap(p, presenterLink)
    const now = page.getByRole('region', { name: FULL_DAY[3].title })
    await now.getByRole('checkbox', { name: HERO_TICKS[0] }).waitFor()
    await wait(1400)

    step('Check off as you teach')
    for (const line of HERO_TICKS) {
      await tap(p, now.getByRole('checkbox', { name: line }), {
        before: 550,
        after: 250,
      })
    }
    await wait(700)

    step('Mark a student')
    await tap(p, page.getByRole('button', { name: 'Show class' }))
    await wait(500)
    await tap(p, page.getByTitle('Marcus Bell'))
    await tap(
      p,
      page.getByRole('button', { name: 'Participating', exact: true }),
      { before: 700 },
    )
    await wait(1500)

    step('Mark the class')
    await tap(p, page.getByRole('button', { name: 'Select all', exact: true }))
    for (const name of ['Jayden Carter', 'Owen Fischer', 'Noah Kim']) {
      await tap(p, page.getByTitle(name), { before: 380, after: 150 })
    }
    await tap(
      p,
      page.getByRole('button', { name: /^Give mark to \d+ students$/ }),
      { before: 500 },
    )
    await tap(p, page.getByRole('button', { name: 'On task', exact: true }), {
      before: 700,
    })
    await wait(2200)
  })
  await p.context.close()
  const clip = encode(take)
  return [clip.mp4, clip.poster, clip.chaptersFile]
}
