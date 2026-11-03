// Screenshots: the student page, and the printed report, lesson plan and
// conference notice (rendered as on paper).
import { mkdirSync } from 'node:fs'
import type { Locator, Page } from 'playwright'
import { paper, phone } from '../lib/browser.ts'
import { APP_URL, OUT, nextSchoolDay, schoolDaysBefore } from '../lib/env.ts'
import { FAMILY_STUDENT, FULL_DAY, MARCUS, SHORT_DAY } from '../lib/fixtures.ts'
import { wait } from '../lib/gestures.ts'
import { phoneShot } from '../lib/recorder.ts'
import type { Scene } from '../lib/scene.ts'
import { seedAllMarks, seedPlan, seedTeacher } from '../lib/seed.ts'
import { seedConferenceTeacher } from './conferences.ts'
import { open } from './hero.ts'

const STILLS = `${OUT}stills/`

/** The print-only element, rendered as it would be on paper. */
async function printShot(page: Page, selector: string, name: string) {
  await page.emulateMedia({ media: 'print' })
  await page.evaluate(() => document.fonts.ready)
  await wait(600)
  const file = `${STILLS}${name}.png`
  await page
    .locator(selector)
    .first()
    .screenshot({ path: file, animations: 'disabled' })
  await page.emulateMedia({ media: 'screen' })
  return file
}

/** Scrolls (instantly) so a target sits `offset` px below the top. */
async function scrollTo(target: Locator, offset: number) {
  await target.first().evaluate((el, off) => {
    window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - off)
  }, offset)
  await wait(500)
}

/** The student page has loaded its day (Print report turns on). */
async function reportReady(page: Page) {
  const button = page.getByRole('button', { name: 'Print report' })
  await button.waitFor()
  for (let i = 0; i < 100 && !(await button.isEnabled()); i++) await wait(100)
}

export const stills: Scene = async (ctx) => {
  const { clock, secrets, phoneBrowser, paperBrowser } = ctx
  mkdirSync(STILLS, { recursive: true })
  const made: Array<string> = []
  const t = await seedTeacher(clock, secrets)
  seedAllMarks(t)
  await seedPlan(t, clock.today, FULL_DAY)
  // The month calendar: finished days behind, planned days ahead.
  const past = schoolDaysBefore(clock.today, 8)
  for (const d of past)
    await seedPlan(
      t,
      d,
      SHORT_DAY.map((s) => ({
        ...s,
        lines: s.lines.map((l) => ({ ...l, done: true })),
      })),
    )
  for (let i = 1, d = clock.today; i <= 12; i++) {
    d = nextSchoolDay(d)
    await seedPlan(t, d, SHORT_DAY)
  }
  const marcusId = t.students.get(MARCUS)!
  const yesterday = past[0]

  // Phone: Marcus's page (top, then his day's chart, then his marks), and
  // the lesson plan calendar.
  const p = await phone(phoneBrowser, clock, { token: t.token })
  await open(p, `/students/${marcusId}?date=${yesterday}`, () =>
    reportReady(p.page),
  )
  made.push(await phoneShot(p, 'student-top'))
  await scrollTo(p.page.getByText('Busiest hour'), 24)
  made.push(await phoneShot(p, 'student-day'))
  await scrollTo(p.page.getByRole('heading', { name: 'All marks' }), 300)
  made.push(await phoneShot(p, 'student-marks'))
  await open(p, '/lesson-plans', () =>
    p.page.getByRole('link', { name: 'Presenter view' }).waitFor(),
  )
  await scrollTo(p.page.getByText(/^[A-Z][a-z]+ \d{4}$/).first(), 150)
  made.push(await phoneShot(p, 'calendar'))
  await p.context.close()

  // Paper: the report (and a PDF of it).
  const r = await paper(paperBrowser, clock, t.token)
  await r.page.goto(`${APP_URL}/students/${marcusId}?date=${yesterday}`)
  await reportReady(r.page)
  await wait(900)
  made.push(await printShot(r.page, 'article:visible', 'report'))
  const pdf = `${STILLS}report-sample.pdf`
  await r.page.pdf({ path: pdf, format: 'Letter', printBackground: true })
  made.push(pdf)

  // Paper: today's plan with the substitute QR code.
  await r.page.goto(`${APP_URL}/lesson-plans/${clock.today}`)
  await r.page.getByRole('button', { name: 'Print this plan' }).click()
  await r.page.getByRole('button', { name: 'Print with QR code' }).click()
  await r.page.waitForFunction(() => document.querySelector('article svg'))
  made.push(await printShot(r.page, 'article:visible', 'plan-print-qr'))
  await r.context.close()

  // Paper: a conference notice, English on top, Spanish below.
  const { t: ct, conference } = await seedConferenceTeacher(ctx)
  const c = await paper(paperBrowser, clock, ct.token)
  await c.page.goto(`${APP_URL}/conferences/${conference.id}`)
  await c.page.getByRole('button', { name: 'Print notices' }).click()
  await c.page.getByRole('button', { name: /^Next: \d+ notices$/ }).click()
  await c.page.getByRole('button', { name: /^Print \d+ notices$/ }).click()
  await c.page.locator('.notice-page').first().waitFor({ state: 'attached' })
  made.push(
    await printShot(
      c.page,
      `.notice-page:has-text("${FAMILY_STUDENT}")`,
      'conference-notice',
    ),
  )
  await c.context.close()
  return made
}
