// /behavior-tracking's hero: giving marks on the Classes page, then a look
// at the student's day.
import { phone, resetDemoClock } from '../lib/browser.ts'
import { encode } from '../lib/encode.ts'
import { MARCUS, MARCUS_MARKS, TODAY_MARKS } from '../lib/fixtures.ts'
import { flick, tap, wait } from '../lib/gestures.ts'
import { record } from '../lib/recorder.ts'
import type { Scene } from '../lib/scene.ts'
import { insertMarks, seedTeacher } from '../lib/seed.ts'
import { open } from './hero.ts'

export const classes: Scene = async ({ clock, secrets, phoneBrowser }) => {
  const t = await seedTeacher(clock, secrets)
  insertMarks(t, [
    ...TODAY_MARKS,
    ...MARCUS_MARKS,
    { student: MARCUS, daysAgo: 0, time: '08:24', type: 'Unprepared' },
    { student: MARCUS, daysAgo: 0, time: '09:10', type: 'On task' },
    { student: MARCUS, daysAgo: 0, time: '09:52', type: 'Off task' },
  ])
  const p = await phone(phoneBrowser, clock, { token: t.token })
  const { page } = p
  await open(p, `/students/${t.students.get(MARCUS)}`, () =>
    page.getByRole('button', { name: 'Print report' }).waitFor(),
  )
  await resetDemoClock(p)
  await open(p, '/classes', () => page.getByTitle(MARCUS).waitFor())

  const take = await record('class-marks', p, async (step) => {
    step('Tap a student')
    await wait(900)
    await tap(p, page.getByTitle('Ava Chen'))
    await tap(
      p,
      page.getByRole('button', { name: 'Helping others', exact: true }),
      { before: 700 },
    )
    await wait(1300)

    step('Mark a group')
    await tap(p, page.getByRole('button', { name: 'Select', exact: true }))
    for (const name of ['Maya Johnson', 'Lucas Nguyen', 'Nora Haddad']) {
      await tap(p, page.getByTitle(name), { before: 380, after: 150 })
    }
    await tap(p, page.getByRole('button', { name: 'Mark 3 students' }), {
      before: 500,
    })
    await tap(
      p,
      page.getByRole('button', { name: 'Participating', exact: true }),
      { before: 700 },
    )
    await wait(1500)

    step('See their day')
    await tap(p, page.getByTitle(MARCUS))
    await tap(p, page.getByRole('link', { name: 'View student' }), {
      before: 800,
    })
    await page.getByRole('button', { name: 'Print report' }).waitFor()
    await wait(1300)
    await flick(p, { from: 560, to: 330, ms: 260 })
    await wait(2200)
  })
  await p.context.close()
  const clip = encode(take)
  return [clip.mp4, clip.poster, clip.chaptersFile]
}
