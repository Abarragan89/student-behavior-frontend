// Parent conferences: a family moving to a new time from their notice's QR
// code, and the teacher's list of times.
import { phone } from '../lib/browser.ts'
import { encode } from '../lib/encode.ts'
import { nextSchoolDay } from '../lib/env.ts'
import {
  FAMILIES_WHO_MOVED,
  FAMILY_STUDENT,
  NO_TIME_YET,
} from '../lib/fixtures.ts'
import { flick, scrollIntoView, swipe, tap, wait } from '../lib/gestures.ts'
import { record } from '../lib/recorder.ts'
import type { Scene, SceneContext } from '../lib/scene.ts'
import { seedConference, seedTeacher } from '../lib/seed.ts'
import { open } from './hero.ts'

export async function seedConferenceTeacher({ clock, secrets }: SceneContext) {
  const t = await seedTeacher(clock, secrets)
  // A week or so out, so the 24-hour lock never applies.
  const first = nextSchoolDay(clock.today, 6)
  const conference = await seedConference(t, {
    dates: [first, nextSchoolDay(first)],
    noTimeYet: NO_TIME_YET,
    moved: FAMILIES_WHO_MOVED,
  })
  return { t, conference }
}

export const family: Scene = async (ctx) => {
  const { conference } = await seedConferenceTeacher(ctx)
  const url = new URL(conference.links.get(FAMILY_STUDENT)!)
  // Families see real times ("changed 5 min ago"), so no demo clock here.
  const p = await phone(ctx.phoneBrowser, ctx.clock, { demoTime: false })
  const { page } = p
  await open(p, url.pathname + url.search + url.hash, () =>
    page.getByText('Live', { exact: true }).waitFor(),
  )

  const take = await record('conference-family', p, async (step) => {
    step('Scan the QR code')
    await wait(1500)
    step('English or Spanish')
    await tap(p, page.getByRole('button', { name: 'Ver en español' }))
    await wait(1700)
    await tap(p, page.getByRole('button', { name: 'View in English' }))
    await wait(700)
    step('Pick another open time')
    const openTime = page.getByRole('button', { name: /, Open$/ }).nth(2)
    await scrollIntoView(p, openTime, 220)
    await tap(p, openTime, { before: 600 })
    await tap(p, page.getByRole('button', { name: 'Yes, switch' }), {
      before: 900,
    })
    await wait(2400)
  })
  await p.context.close()
  const clip = encode(take)
  return [clip.mp4, clip.poster, clip.chaptersFile]
}

export const teacherConference: Scene = async (ctx) => {
  const { t, conference } = await seedConferenceTeacher(ctx)
  const p = await phone(ctx.phoneBrowser, ctx.clock, {
    token: t.token,
    demoTime: false,
  })
  const { page } = p
  await open(p, `/conferences/${conference.id}`, () =>
    page.getByText('Changes by families').waitFor(),
  )

  const take = await record('conference-teacher', p, async (step) => {
    step('Every family’s time')
    await wait(1400)
    await swipe(p, { x: 10, from: 560, to: 300, ms: 700 })
    await wait(700)
    step('Fill an open time')
    const add = page.getByRole('button', { name: /Add a student$/ }).first()
    await scrollIntoView(p, add, 200)
    await tap(p, add, { before: 500 })
    await tap(p, page.getByRole('button', { name: NO_TIME_YET[0] }), {
      before: 900,
    })
    await wait(1400)
    step('What families changed')
    for (let i = 0; i < 6; i++) {
      const box = await page.getByText('Changes by families').boundingBox()
      if (box && box.y < 360) break
      await flick(p, { x: 10, from: 600, to: 300 })
      await wait(500)
    }
    await wait(2400)
  })
  await p.context.close()
  const clip = encode(take)
  return [clip.mp4, clip.poster, clip.chaptersFile]
}
