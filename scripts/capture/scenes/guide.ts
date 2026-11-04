// The teacher quick-start guide: a PDF that walks through behavior marks,
// lesson plans and parent conferences, with numbered arrows on screenshots
// of the real app. Not run by default, and never published to the site:
//
//   npm run capture -- --scene guide
//
// The PDF lands in scripts/capture/.out/guide/. The guide's words live here,
// next to the clicks that make each picture, so they change together.
import { randomUUID } from 'node:crypto'
import type { Locator, Page } from 'playwright'
import {
  DESKTOP,
  assertSignedIn,
  desktop,
  paper,
  phone,
} from '../lib/browser.ts'
import { APP_URL, nextSchoolDay, schoolDaysBefore } from '../lib/env.ts'
import {
  FAMILIES_WHO_MOVED,
  FAMILY_STUDENT,
  FULL_DAY,
  HERO_TICKS,
  MARCUS,
  NO_TIME_YET,
  SHORT_DAY,
} from '../lib/fixtures.ts'
import type { Section } from '../lib/fixtures.ts'
import { wait } from '../lib/gestures.ts'
import {
  LOGO_URL,
  figure,
  icon,
  renderGuide,
  resetGuideDir,
  row,
  shoot,
  steps,
  tip,
  ui,
} from '../lib/guide.ts'
import type { GuidePage } from '../lib/guide.ts'
import { lit, sql } from '../lib/api.ts'
import type { Scene } from '../lib/scene.ts'
import {
  seedAllMarks,
  seedConference,
  seedPlan,
  seedTeacher,
} from '../lib/seed.ts'
import type { Teacher } from '../lib/seed.ts'
import { scrollTo } from '../lib/recorder.ts'
import { reportReady } from './stills.ts'

const PDF_NAME = 'TeachForFree-Teacher-Guide.pdf'
const EMAIL = 'ms.lee@example.com'
/** The text column's width on the page, in px. */
const FULL = 704

/** Tomorrow, for the editor: one subject without a time. */
const TOMORROW: Array<Section> = [
  {
    title: 'Period 1 — English 7',
    start: '08:15',
    end: '09:00',
    lines: [
      { text: 'Warm-up: journal prompt' },
      { text: 'Read aloud, chapter 7' },
      { text: 'Stop at p. 131 for questions', indent: 1 },
    ],
  },
  {
    title: 'Book club',
    lines: [{ text: 'Bring the poster supplies' }],
  },
]

/** A template's subjects (Quiz Friday). */
const QUIZ_DAY: Array<Section> = [
  {
    title: 'Period 1 — English 7',
    start: '08:15',
    end: '09:00',
    lines: [{ text: 'Vocabulary quiz' }, { text: 'Partner reading' }],
  },
]

const asTemplate = (s: Section) => ({
  title: s.title,
  start_time: s.start ?? null,
  end_time: s.end ?? null,
  items: s.lines.map((l) => ({ text: l.text, indent: l.indent ?? 0 })),
})

async function seed(t: Teacher) {
  const { today } = t.clock
  // A plain address for the account menu (taken back from any earlier run's
  // teacher; emails are unique).
  sql(`UPDATE users SET email = google_sub || '@example.com' WHERE email = ${lit(EMAIL)};
       UPDATE users SET email = ${lit(EMAIL)} WHERE id = ${lit(t.userId)};`)
  seedAllMarks(t)
  await seedPlan(t, today, FULL_DAY)
  // The month calendar: finished days behind, planned days ahead.
  for (const d of schoolDaysBefore(today, 8))
    await seedPlan(
      t,
      d,
      SHORT_DAY.map((s) => ({
        ...s,
        lines: s.lines.map((l) => ({ ...l, done: true })),
      })),
    )
  const tomorrow = nextSchoolDay(today)
  await seedPlan(t, tomorrow, TOMORROW)
  for (let i = 1, d = tomorrow; i <= 10; i++) {
    d = nextSchoolDay(d)
    await seedPlan(t, d, SHORT_DAY)
  }
  for (const [name, sections] of [
    ['Regular Monday', FULL_DAY.slice(0, 4)],
    ['Quiz Friday', QUIZ_DAY],
  ] as const) {
    await t.api.post('/lesson-plan-templates', {
      id: randomUUID(),
      name,
      sections: sections.map(asTemplate),
    })
  }
  // A week or so out, so the 24-hour lock never applies.
  const first = nextSchoolDay(today, 6)
  const conference = await seedConference(t, {
    dates: [first, nextSchoolDay(first)],
    noTimeYet: NO_TIME_YET,
    moved: FAMILIES_WHO_MOVED,
  })
  return { tomorrow, conference }
}

/** Opens an app page and waits until it has settled. */
async function go(page: Page, path: string, ready: () => Promise<unknown>) {
  await page.goto(APP_URL + path)
  await ready()
  assertSignedIn(page)
  await page.evaluate(() => document.fonts.ready)
  await wait(700)
}

/** "Thursday, November 5", as the calendar's labels say it. */
const longDate = (date: string) =>
  new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(date + 'T12:00:00Z'))

const exactly = (s: string) =>
  new RegExp(`^${s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`)

export const guide: Scene = async (ctx) => {
  const { clock, secrets, paperBrowser, phoneBrowser } = ctx
  resetGuideDir()
  const t = await seedTeacher(clock, secrets)
  const { tomorrow, conference } = await seed(t)
  const marcusId = t.students.get(MARCUS)!
  const yesterday = schoolDaysBefore(clock.today, 1)[0]
  const pages: Array<GuidePage> = []

  const { context, page: d } = await desktop(paperBrowser, clock, {
    token: t.token,
  })
  const card = (name: string) => d.getByTitle(name, { exact: true })
  const button = (name: string | RegExp, scope: Page | Locator = d) =>
    scope.getByRole('button', {
      name,
      exact: typeof name === 'string' ? true : undefined,
    })

  // ---------- Getting started ----------

  const anon = await desktop(paperBrowser, clock)
  await anon.page.goto(APP_URL + '/login')
  const google = anon.page.getByRole('link', { name: 'Continue with Google' })
  await google.waitFor()
  const login = await shoot(
    anon.page,
    'login',
    [{ target: google, from: 'bottom' }],
    {
      clip: anon.page.locator('[data-slot="card"]'),
      margin: 24,
    },
  )
  await anon.context.close()

  await go(d, '/classes', () => card(MARCUS).waitFor())
  const coverShot = await shoot(d, 'cover-classes', [], {
    area: { x: 0, y: 0, width: DESKTOP.width, height: 600 },
  })
  const header = await shoot(
    d,
    'start-header',
    [
      { target: d.getByRole('navigation', { name: 'Main' }), from: 'bottom' },
      { target: button('Add'), from: 'bottom' },
      { target: button('Account menu'), from: 'bottom' },
    ],
    { area: { x: 0, y: 0, width: DESKTOP.width, height: 150 }, first: 2 },
  )
  await button('Add').click()
  const createClass = button('Create class')
  await createClass.waitFor()
  const addMenu = await shoot(
    d,
    'start-menu',
    [
      { target: button('Add students'), from: 'left' },
      { target: createClass, from: 'left' },
    ],
    {
      around: [button('Add'), button('Add co-teacher')],
      margin: [16, 20, 20, 90],
      first: 5,
    },
  )
  await d.keyboard.press('Escape')

  pages.push({
    section: 'start',
    title: 'Sign in and find your way around',
    intro:
      'TeachForFree runs in any web browser on a laptop, tablet or phone. There’s nothing to install and nothing to pay.',
    body:
      row(
        '250px 1fr',
        figure(login, { width: 250, frame: 'plain' }),
        `<h2>Sign in</h2>` +
          steps([
            `Go to <b>teachforfree.com</b> and click ${ui('Continue with Google')}. Use your school Google account. The first sign-in creates your free account and your first class.`,
          ]),
      ) +
      `<h2>Find your way around</h2>` +
      figure(header, { width: FULL }) +
      steps(
        [
          `The three big parts of the app are always at the top: ${ui('Classes')} for behavior, ${ui('Lesson Plans')} and ${ui('Conferences')}.`,
          `The ${ui('+')} button makes something new.`,
          `Your picture opens your account, the mark buttons (${ui('Edit marks')}) and ${ui('Sign out')}.`,
        ],
        2,
      ) +
      row(
        '330px 1fr',
        figure(addMenu, { width: 330, frame: 'plain' }),
        `<h2>Set up your class</h2>` +
          steps(
            [
              `${ui('Add students')} lets you type or paste your roster, or import it from Google Classroom.`,
              `${ui('Create class')} adds another class, like a different period. Switch between classes with ${ui('Switch')} next to the class name.`,
            ],
            5,
          ),
      ),
  })

  // ---------- Behavior: give a mark ----------

  await go(d, '/classes', () => card(MARCUS).waitFor())
  const roster = await shoot(
    d,
    'roster',
    [{ target: card(MARCUS), from: 'bottom-right' }],
    { area: { x: 0, y: 60, width: DESKTOP.width, height: 380 } },
  )
  await card(MARCUS).click()
  const markDialog = d.getByRole('dialog', { name: MARCUS })
  await markDialog.waitFor()
  const dialog = await shoot(
    d,
    'mark-dialog',
    [
      { target: button('Participating', markDialog), from: 'left' },
      { target: button('Off task', markDialog), from: 'right' },
      { target: markDialog.getByText('View student'), from: 'bottom' },
    ],
    { clip: markDialog, margin: 30, first: 2 },
  )
  await button('Off task', markDialog).click()
  const toastEl = d.locator('[data-sonner-toast]').first()
  await toastEl.waitFor()
  const toast = await shoot(
    d,
    'mark-toast',
    [
      { target: button('Add note', toastEl), from: 'bottom' },
      { target: button('Undo', toastEl), from: 'bottom' },
    ],
    { clip: toastEl, margin: 22, first: 5 },
  )
  await wait(5500)

  pages.push({
    section: 'behavior',
    title: 'Give a student a mark',
    intro:
      'Marks are quick notes on behavior: positive ones like “On task” and negative ones like “Off task.” Each card shows a student’s marks for today.',
    body:
      figure(roster, { width: FULL }) +
      row(
        '360px 1fr',
        figure(dialog, { width: 360, frame: 'plain' }),
        `<div class="stack">` +
          steps([
            `Open ${ui('Classes')} and click a student’s card.`,
            `Click a green button to give a positive mark…`,
            `…or a red one for a negative mark. That’s it: the mark is saved and the card’s count goes up.`,
            `${ui('View student')} opens their full report.`,
          ]) +
          figure(toast, { width: 300, frame: 'plain' }) +
          steps(
            [
              `${ui('Add note')} explains a negative mark. Notes print on the student’s report.`,
              `Clicked the wrong one? ${ui('Undo')} works for 5 seconds.`,
            ],
            5,
          ) +
          `</div>`,
      ),
  })

  // ---------- Behavior: many students, random picker ----------

  await button('Select').click()
  for (const name of ['Ethan Brooks', 'Ava Chen', 'Chloe Dubois'])
    await card(name).click()
  const markThree = button('Mark 3 students')
  await markThree.waitFor()
  const select = await shoot(
    d,
    'select',
    [
      { target: card('Ava Chen'), from: 'top' },
      {
        target: d.getByRole('checkbox', { name: 'Select all' }),
        from: 'right',
      },
      { target: markThree, from: 'top' },
      { target: button('Print reports'), from: 'top' },
    ],
    { area: { x: 0, y: 60, width: DESKTOP.width, height: 360 } },
  )
  await button('Cancel').click()
  await button('Pick a random student').click()
  const pickDialog = d.getByRole('dialog', { name: 'Random student' })
  await button('Pick again', pickDialog).waitFor()
  await wait(2200)
  const pick = await shoot(
    d,
    'random',
    [
      { target: button('Give a mark', pickDialog), from: 'bottom' },
      { target: button('Pick again', pickDialog), from: 'bottom' },
    ],
    { clip: pickDialog, margin: 30, first: 5 },
  )
  await d.keyboard.press('Escape')

  pages.push({
    section: 'behavior',
    title: 'Mark a few students, or the whole class',
    intro:
      'When a table works well together, or the whole class lines up quietly, give everyone the same mark in one go.',
    body:
      figure(select, { width: FULL }) +
      row(
        '1fr 1fr',
        steps([
          `Click ${ui('Select')}, then click each student you want. Picked cards are outlined.`,
          `Or tick ${ui('Select all')} for the whole class.`,
          `Click ${ui('Mark 3 students')} and choose a mark. Everyone you picked gets it.`,
          `The printer prints a one-page report for each picked student, ready to send home.`,
        ]),
        `<div class="stack">` +
          steps(
            [
              `${ui('Random')} picks a student to call on. Everyone gets a turn before anyone is picked twice. ${ui('Give a mark')} marks the student it picked…`,
              `…and ${ui('Pick again')} draws the next name.`,
            ],
            5,
          ) +
          figure(pick, { width: 300, frame: 'plain' }) +
          `</div>`,
      ) +
      tip(
        `The ${ui('Groups')} tab puts students into table groups. Clicking a group gives every member the mark and adds a point to the group’s team score.`,
      ),
  })

  // ---------- Behavior: the student's report ----------

  await d.setViewportSize({ width: DESKTOP.width, height: 1000 })
  await go(d, `/students/${marcusId}?date=${yesterday}`, () => reportReady(d))
  const main = d.getByRole('main')
  const busiest = main
    .getByText('Busiest hour', { exact: true })
    .locator('xpath=../..')
  const report = await shoot(
    d,
    'student',
    [
      { target: d.getByRole('group', { name: 'Day' }), from: 'right' },
      { target: button('Print report'), from: 'bottom-left' },
      { target: d.locator('button[aria-current]').first(), from: 'top' },
      { target: busiest, from: 'bottom' },
    ],
    {
      around: [
        main.getByRole('link', { name: 'Classes' }),
        button('Print report'),
        busiest,
      ],
      margin: [22, 22, 70, 22],
    },
  )
  await d.setViewportSize(DESKTOP)

  pages.push({
    section: 'behavior',
    title: 'See how a student is doing',
    intro:
      'Every student has a report page with their last ten school days and a timeline of each day. Open it from a card with “View student.”',
    body: row(
      '440px 1fr',
      figure(report, { width: 440 }),
      `<div class="stack">` +
        steps([
          `Pick the day to look at. The arrows step one school day at a time.`,
          `${ui('Print report')} prints a one-page report for families, with notes, a chart and a place for signatures.`,
          `Each bar is one school day: positive marks up, negative marks down. Click a bar to see that day.`,
          `The day’s totals and its busiest hour. Below it, a timeline shows when each mark happened, and a list lets you add a note or delete a mark.`,
        ]) +
        tip(
          `Want different mark buttons? Click your picture, then ${ui('Edit marks')} to add, rename or remove them. Changes apply to all your classes.`,
        ) +
        `</div>`,
    ),
  })

  // ---------- Lesson plans: plan a day ----------

  await go(d, '/lesson-plans', () =>
    d.getByRole('link', { name: 'Presenter view' }).waitFor(),
  )
  // Today's week of the month calendar (today is always in this month).
  // The Templates button's label, as the page says it today.
  const templatesLabel = (
    await d
      .getByRole('link', { name: /templates/i })
      .first()
      .innerText()
  ).trim()
  const todayLink = d.getByRole('link', {
    name: exactly(longDate(clock.today)),
  })
  const calendar = await shoot(
    d,
    'calendar',
    [{ target: todayLink, from: 'right', reach: 30 }],
    { clip: todayLink, margin: [40, 200, 20, 200] },
  )

  await d.setViewportSize({ width: DESKTOP.width, height: 1300 })
  await go(d, `/lesson-plans/${tomorrow}`, () =>
    d
      .getByRole('textbox', { name: `Add a line to “${TOMORROW[0].title}”` })
      .waitFor(),
  )
  const club = d.getByRole('region', { name: TOMORROW[1].title })
  const editor = await shoot(
    d,
    'editor',
    [
      {
        target: d.getByRole('textbox', {
          name: `Add a line to “${TOMORROW[0].title}”`,
        }),
        from: 'right',
      },
      { target: button('Add a time', club), from: 'right' },
      {
        target: button(`Add a subject before “${TOMORROW[1].title}”`),
        from: 'left',
      },
      { target: button(`Move section “${TOMORROW[1].title}”`), from: 'left' },
      { target: button(`More for “${TOMORROW[1].title}”`), from: 'left' },
    ],
    {
      around: [d.getByRole('region', { name: TOMORROW[0].title }), club],
      margin: 40,
      first: 2,
    },
  )
  await d.setViewportSize(DESKTOP)

  pages.push({
    section: 'plans',
    title: 'Plan your day',
    intro:
      'Write each day’s plan as a simple checklist: one card per subject or period, with the steps underneath. Everything saves as you type.',
    body:
      row(
        '320px 1fr',
        figure(calendar, { width: 320 }),
        steps([
          `Open ${ui('Lesson Plans')} and click any day on the calendar. A dot means it has a plan; a green check means everything got done.`,
        ]),
      ) +
      figure(editor, { width: 640 }) +
      steps(
        [
          `Type a line and press <b>Enter</b> for the next one. Press <b>Tab</b> to tuck a line under the one above it.`,
          `${ui('Add a time')} sets when the subject happens. You can turn on a reminder 10 minutes before it starts.`,
          `The thin <b>+</b> rows add a subject between two others.`,
          `Drag the handle to move a subject. Lines move the same way.`,
          `The <b>⋯</b> menu copies a subject to another day, moves it, or deletes it.`,
        ],
        2,
      ),
  })

  // ---------- Lesson plans: teach from it, templates ----------

  // Narrower, so the day reads as one column (as on a classroom screen).
  await d.setViewportSize({ width: 740, height: 720 })
  await go(d, `/lesson-plans/${clock.today}/present`, () =>
    d.getByRole('checkbox').first().waitFor(),
  )
  const now = d.getByRole('region', { name: FULL_DAY[3].title })
  for (const line of HERO_TICKS.slice(0, 2))
    await now.getByRole('checkbox', { name: line }).click()
  // The page scrolls the subject happening now to the top; show a little
  // of the one before, so its "Now" tag has room for a number.
  await d.evaluate(() => window.scrollBy(0, -70))
  await wait(600)
  const present = await shoot(d, 'present', [
    {
      target: now.getByRole('checkbox', { name: HERO_TICKS[2] }),
      from: 'left',
    },
    { target: now.getByText('Now', { exact: true }), from: 'top' },
    { target: button('Show class'), from: 'left' },
  ])
  await d.setViewportSize(DESKTOP)

  await go(d, `/lesson-plans/${clock.today}`, () =>
    d.getByRole('link', { name: 'Presenter view' }).waitFor(),
  )
  const useTemplate = button('Use a template')
  const saveTemplate = d.getByRole('link', { name: 'Save as template' })
  const toolbar = await shoot(
    d,
    'day-toolbar',
    [
      { target: useTemplate, from: 'bottom', reach: 24 },
      { target: saveTemplate, from: 'bottom', reach: 24 },
    ],
    {
      around: [d.getByRole('link', { name: 'Presenter view' }), saveTemplate],
      margin: [16, 16, 70, 16],
      first: 4,
    },
  )
  await useTemplate.click()
  const picker = d.getByRole('dialog', { name: 'Use a template' })
  await picker.getByRole('radio', { name: /Regular Monday/ }).click()
  const pickerShot = await shoot(
    d,
    'template-picker',
    [
      {
        target: picker.getByRole('radio', { name: /Regular Monday/ }),
        from: 'left',
      },
      { target: button(/^Replace/, picker), from: 'left' },
    ],
    { clip: picker, margin: 16, first: 6 },
  )
  await d.keyboard.press('Escape')

  pages.push({
    section: 'plans',
    title: 'Teach from your plan',
    intro:
      'Presenter view shows the day big and clear, for your desk or the classroom screen. Check lines off as you go.',
    body:
      row(
        '420px 1fr',
        figure(present, { width: 420, gutter: 36 }),
        steps([
          `Open ${ui('Presenter view')} from the day’s plan or the Lesson Plans page. Click a line to check it off; click again to undo. The top shows how much of the day is done.`,
          `${ui('Now')} marks the subject happening right now, by its time.`,
          `This button opens your class, so you can give marks without leaving the plan.`,
        ]),
      ) +
      row(
        '1fr 280px',
        `<h2>Reuse a good day with templates</h2>` +
          figure(toolbar, { width: 400, frame: 'plain', gutter: 0 }) +
          `<div style="height:14px"></div>` +
          steps(
            [
              `${ui('Use a template')} fills the day from a saved template.`,
              `${ui('Save as template')} saves this day to reuse, like “Regular Monday.” Find them all under ${ui(templatesLabel)} on the Lesson Plans page.`,
              `Pick a template to see its subjects…`,
              `…then use it. If the day already has a plan, the template replaces it, and the button warns you.`,
            ],
            4,
          ),
        figure(pickerShot, { width: 280, frame: 'plain' }),
      ),
  })

  // ---------- Lesson plans: substitutes ----------

  await button('Share with a substitute').click()
  const share = d.getByRole('dialog', { name: 'Share with a substitute' })
  const makeLink = button('Make a link', share)
  await makeLink.waitFor()
  const shareBefore = await shoot(
    d,
    'share-before',
    [
      {
        target: share.getByRole('group', { name: 'Classes they can open' }),
        from: 'left',
        reach: 30,
      },
      { target: makeLink, from: 'bottom' },
    ],
    { clip: share, margin: 20 },
  )
  await makeLink.click()
  const linkBox = share.getByRole('textbox', {
    name: 'Link for the substitute',
  })
  await linkBox.waitFor()
  const shareAfter = await shoot(
    d,
    'share-after',
    [
      { target: linkBox, from: 'top', reach: 26 },
      { target: button('Copy link', share), from: 'bottom' },
      { target: button('Turn off link', share), from: 'bottom' },
    ],
    { clip: share, margin: 20, first: 3 },
  )
  await d.keyboard.press('Escape')

  const pp = await paper(paperBrowser, clock, t.token)
  await go(pp.page, `/lesson-plans/${clock.today}`, () =>
    pp.page.getByRole('button', { name: 'Print this plan' }).waitFor(),
  )
  await pp.page.getByRole('button', { name: 'Print this plan' }).click()
  await pp.page.getByRole('button', { name: 'Print with QR code' }).click()
  await pp.page.waitForFunction(() => document.querySelector('article svg'))
  // The printed plan's corner with the QR code for the sub.
  const planPrint = await shoot(
    pp.page,
    'plan-print',
    [
      {
        target: pp.page.getByRole('img', {
          name: /QR code for the substitute/,
        }),
        from: 'left',
      },
    ],
    {
      clip: pp.page.locator('article:visible aside').first(),
      margin: 14,
      print: true,
      first: 6,
    },
  )

  pages.push({
    section: 'plans',
    title: 'Share a day with a substitute',
    intro:
      'Out sick? Send your sub a link to the day’s plan. They can check it off and give marks, with no account and no access to anything else.',
    body:
      row(
        '1fr 1fr',
        figure(shareBefore, { width: 340, frame: 'plain' }),
        figure(shareAfter, { width: 340, frame: 'plain' }),
      ) +
      row(
        '1fr 1fr',
        steps([
          `On the day’s plan, click the share button. Choose which classes the sub can give marks in.`,
          `Click ${ui('Make a link')}. It works for that one day only.`,
          `Send the link by email or text.`,
          `${ui('Copy link')} copies it to paste anywhere.`,
          `${ui('Turn off link')} stops it right away.`,
        ]),
        `<div class="stack">` +
          figure(planPrint, { width: 300, frame: 'paper' }) +
          steps(
            [
              `Or click the printer and choose ${ui('Print with QR code')}. The sub scans the code with their phone to open the same link.`,
            ],
            6,
          ) +
          `</div>`,
      ) +
      tip(
        `Reminders: in the installed app, ${ui('Account')} → ${ui('Notifications')} sends a nudge 10 minutes before each subject that has a time.`,
      ),
  })

  // ---------- Conferences: set up ----------

  const dc = await desktop(paperBrowser, clock, {
    token: t.token,
    demoTime: false,
  })
  const c = dc.page
  const cButton = (name: string | RegExp, scope: Page | Locator = c) =>
    scope.getByRole('button', {
      name,
      exact: typeof name === 'string' ? true : undefined,
    })
  await go(c, '/conferences?new=true', () =>
    c.getByRole('dialog', { name: 'New parent conferences' }).waitFor(),
  )
  const setup = c.getByRole('dialog', { name: 'New parent conferences' })
  await setup.getByLabel('Where (optional)').fill('Room 12')
  const setupShot = await shoot(
    c,
    'conference-new',
    [
      { target: setup.getByLabel('Name', { exact: true }), from: 'left' },
      {
        target: setup.getByRole('group', { name: 'Classes to schedule' }),
        from: 'left',
      },
      { target: cButton('Create', setup), from: 'left' },
    ],
    { clip: setup, margin: 20 },
  )
  await c.keyboard.press('Escape')

  await go(c, `/conferences/${conference.id}`, () =>
    c.getByText('Changes by families').waitFor(),
  )
  await cButton('Add times').click()
  const addTimes = c.getByRole('dialog', { name: 'Add times' })
  await cButton('15 min', addTimes).click()
  const addLabel = await cButton(/^Add \d+ times$/, addTimes).innerText()
  const addTimesShot = await shoot(
    c,
    'conference-times',
    [
      { target: addTimes.getByLabel('Day'), from: 'left' },
      { target: cButton('15 min', addTimes), from: 'top' },
      { target: cButton(/^Add \d+ times$/, addTimes), from: 'left' },
    ],
    { clip: addTimes, margin: 20, first: 4 },
  )
  await c.keyboard.press('Escape')

  pages.push({
    section: 'conferences',
    title: 'Set up parent conferences',
    intro:
      'Make your conference times once. Every family gets a printed notice with a QR code to see their time, or pick one.',
    body: row(
      '1fr 1fr',
      `<div class="stack">` +
        figure(setupShot, { width: 340, frame: 'plain' }) +
        steps([
          `Open ${ui('Conferences')} and click ${ui('New')}. Name the conferences and say where they are. The name on notices is how families know you.`,
          `Choose the classes to schedule.`,
          `Click ${ui('Create')}.`,
        ]) +
        `</div>`,
      `<div class="stack">` +
        figure(addTimesShot, { width: 340, frame: 'plain' }) +
        steps(
          [
            `Click ${ui('Add times')}, then pick the day and the hours you’re free.`,
            `Choose how long each meeting is.`,
            `Click ${ui(addLabel.trim())}. Do it again for each conference day.`,
          ],
          4,
        ) +
        `</div>`,
    ),
  })

  // ---------- Conferences: the schedule ----------

  const cMain = c.getByRole('main')
  const noTime = cMain
    .locator('section')
    .filter({ hasText: /^No time yet/ })
    .last()
  const schedule = await shoot(
    c,
    'conference-page',
    [
      { target: c.getByText(/students have a time/), from: 'right' },
      { target: cButton('Print'), from: 'bottom' },
      { target: cButton('Refresh'), from: 'bottom' },
      { target: noTime.getByRole('button').first(), from: 'right' },
    ],
    {
      around: [cMain.getByRole('link', { name: 'Conferences' }), noTime],
      margin: 20,
    },
  )

  // The first day's first few times.
  const dayMenu = cButton(/^More for [A-Z][a-z]+day/).first()
  const pickedBadge = c.getByText('Picked by family').first()
  await scrollTo(dayMenu, 40)
  const times = await shoot(
    c,
    'conference-times-list',
    [
      { target: c.getByTitle('Mark complete').first(), from: 'left' },
      { target: pickedBadge, from: 'right' },
      { target: cButton(/^More for \d/).first(), from: 'left' },
    ],
    {
      around: [dayMenu, pickedBadge.locator('xpath=ancestor::li[1]')],
      margin: 20,
      first: 5,
    },
  )

  const changes = c.getByRole('region', { name: 'Changes by families' })
  await scrollTo(changes, 40)
  const changesShot = await shoot(
    c,
    'conference-changes',
    [
      {
        target: changes.getByRole('listitem').first(),
        from: 'right',
        reach: 24,
      },
    ],
    { clip: changes, margin: 20, first: 8 },
  )
  await c.evaluate(() => window.scrollTo(0, 0))

  pages.push({
    section: 'conferences',
    title: 'Fill and follow the schedule',
    intro:
      'Your conference page shows every time and who has it. Changes families make show up here too.',
    body:
      row(
        '470px 1fr',
        figure(schedule, { width: 470, gutter: 28 }),
        steps([
          `How many students have a time so far.`,
          `${ui('Print')} prints notices for families, or your schedule to keep at your desk.`,
          `${ui('Refresh')} brings in the latest changes families made.`,
          `Students without a time. Click a name to give them an open time, or print them a sign-up notice so their family can choose one.`,
        ]),
      ) +
      row(
        '470px 1fr',
        figure(times, { width: 470, frame: 'plain' }),
        steps(
          [
            `Click the circle when a meeting is done.`,
            `${ui('Picked by family')} means the family chose this time with their QR code.`,
            `The <b>⋮</b> menu changes a time, clears it, or makes a new QR code if a notice gets lost. Open times say ${ui('Add a student')}.`,
          ],
          5,
        ),
      ) +
      row(
        '470px 1fr',
        figure(changesShot, { width: 470, frame: 'plain' }),
        steps(
          [
            `Every time a family picked or moved, with the old time crossed out. Click ${ui('Refresh')} to check for new ones.`,
          ],
          8,
        ),
      ),
  })

  // ---------- Conferences: notices and the family's page ----------

  await c.evaluate(() => window.scrollTo(0, 0))
  await cButton('Print').click()
  await c.getByRole('menuitem', { name: /Notices for families/ }).click()
  const notices = c.getByRole('dialog', { name: 'Print notices' })
  const noticesShot = await shoot(
    c,
    'conference-notices',
    [
      { target: cButton(/^Everyone/, notices), from: 'left' },
      { target: notices.getByRole('checkbox').first(), from: 'left' },
    ],
    { clip: notices, margin: 20, maxHeight: 420 },
  )
  await c.keyboard.press('Escape')

  const np = await paper(paperBrowser, clock, t.token)
  await go(np.page, `/conferences/${conference.id}`, () =>
    np.page.getByText('Changes by families').waitFor(),
  )
  await np.page.getByRole('button', { name: 'Print', exact: true }).click()
  await np.page.getByRole('menuitem', { name: /Notices for families/ }).click()
  await np.page.getByRole('button', { name: /^Next: \d+ notices$/ }).click()
  await np.page.getByRole('button', { name: /^Print \d+ notices$/ }).click()
  const notice = np.page
    .locator(`.notice-page:has-text("${FAMILY_STUDENT}")`)
    .first()
  await notice.waitFor({ state: 'attached' })
  const noticeShot = await shoot(
    np.page,
    'conference-notice',
    [{ target: notice.locator('svg').first(), from: 'left' }],
    { clip: notice, margin: 0, maxHeight: 440, print: true, first: 3 },
  )

  const fp = await phone(phoneBrowser, clock, { demoTime: false })
  const familyUrl = new URL(conference.links.get(FAMILY_STUDENT)!)
  await go(
    fp.page,
    familyUrl.pathname + familyUrl.search + familyUrl.hash,
    () => fp.page.getByText('Live', { exact: true }).waitFor(),
  )
  const family = await shoot(
    fp.page,
    'family',
    [
      {
        target: fp.page.getByRole('heading', { name: 'Your time' }).first(),
        from: 'left',
      },
      {
        target: fp.page.getByRole('button', { name: 'Ver en español' }),
        from: 'right',
      },
    ],
    { maxHeight: 560, first: 4, path: '/conference' },
  )
  const openTime = fp.page.getByRole('button', { name: /, Open$/ }).first()
  await scrollTo(openTime, 300)
  const familyPick = await shoot(
    fp.page,
    'family-pick',
    [{ target: openTime, from: 'left' }],
    { maxHeight: 560, first: 6, path: '/conference' },
  )

  pages.push({
    section: 'conferences',
    title: 'Send notices home',
    intro:
      'Print one notice per family. Each has a QR code that opens that family’s own page, in English or Spanish.',
    body:
      row(
        '1fr 1fr',
        `<div class="stack">` +
          figure(noticesShot, { width: 340, frame: 'plain' }) +
          steps([
            `Click ${ui('Print')}, then ${ui('Notices for families…')}. Choose who gets one: everyone, only new or changed times, or students without a time yet.`,
            `Tick or untick single students. Then click ${ui('Next')} and print. Send the notices home in backpacks.`,
          ]) +
          `</div>`,
        `<div class="stack">` +
          figure(noticeShot, { width: 340, frame: 'paper' }) +
          steps(
            [
              `Families scan the QR code with their phone camera. No app or account needed. The bottom half of each notice is in Spanish.`,
            ],
            3,
          ) +
          `</div>`,
      ) +
      row(
        '210px 210px 1fr',
        figure(family, { width: 210, frame: 'phone', gutter: 20 }),
        figure(familyPick, { width: 210, frame: 'phone', gutter: 20 }),
        `<h2>What families see</h2>` +
          steps(
            [
              `Their conference time, and where.`,
              `A button to show the page in Spanish.`,
              `Open times they can switch to. Times other families took just say “Unavailable,” so names stay private.`,
            ],
            4,
          ) +
          `<div style="height:12px"></div>` +
          tip(
            `Families can change their time until 24 hours before it. After that, it’s locked. To stop all changes, use the conference’s settings (the gear button).`,
          ),
      ),
  })

  // ---------- Good to know ----------

  await go(d, '/classes', () => card(MARCUS).waitFor())
  await button('Account menu').click()
  const editMarks = d
    .getByRole('button', { name: 'Edit marks' })
    .or(d.getByRole('link', { name: 'Edit marks' }))
  await editMarks.first().waitFor()
  const menu = await shoot(
    d,
    'account-menu',
    [
      { target: editMarks.first(), from: 'left' },
      { target: d.getByText('Dark mode', { exact: true }), from: 'left' },
    ],
    {
      around: [
        button('Account menu'),
        d.getByText('Sign out', { exact: true }),
      ],
      margin: [20, 20, 20, 70],
    },
  )

  const extra = (name: string, title: string, text: string) =>
    `<div class="card"><div class="icon-wrap">${icon(name, 20)}</div><div><h2>${title}</h2><p>${text}</p></div></div>`
  pages.push({
    section: 'extras',
    title: 'Good to know',
    body:
      `<div class="cards">` +
      extra(
        'smartphone',
        'Install it on your phone',
        `On your phone, open your picture menu and choose ${ui('Download the app')}. It opens with one tap, like any app.`,
      ) +
      extra(
        'wifi-off',
        'Works with spotty Wi-Fi',
        'In the installed app, marks and checkmarks you give offline are saved and sent when you’re back online.',
      ) +
      extra(
        'users',
        'Co-teachers',
        `Share your classes, plans or conferences with another teacher: ${ui('+')} then ${ui('Add co-teacher')}. Choose view or edit for each.`,
      ) +
      extra(
        'graduation-cap',
        'Google Classroom',
        `Import your roster from Google Classroom in ${ui('Add students')}. Run it again later to pick up new students.`,
      ) +
      extra(
        'bell',
        'Subject reminders',
        `In the installed app, turn on notifications to get a nudge 10 minutes before each subject with a time.`,
      ) +
      extra(
        'printer',
        'Print anything',
        'Student reports, a whole class’s reports, lesson plans and conference schedules all print cleanly.',
      ) +
      `</div>` +
      row(
        '330px 1fr',
        figure(menu, { width: 330, frame: 'plain' }),
        `<h2>Your account menu</h2>` +
          steps([
            `${ui('Edit marks')} changes the mark buttons for all your classes.`,
            `${ui('Dark mode')} is easier on the eyes at night.`,
          ]) +
          `<p style="margin-top:12px">${ui('Account')} has your co-teachers, Google Classroom connection, notifications and archived classes.</p>`,
      ),
  })

  await context.close()
  await dc.context.close()
  await pp.context.close()
  await np.context.close()
  await fp.context.close()

  const cover = coverHtml(figure(coverShot, { width: FULL }))
  const pdf = await renderGuide(paperBrowser, cover, pages, PDF_NAME)
  console.log(`  Guide: ${pdf}`)
  return []
}

function coverHtml(picture: string) {
  const tile = (
    color: string,
    iconName: string,
    title: string,
    text: string,
    pagesText: string,
  ) => `<div class="tile">
    <div class="icon-wrap" style="background:${color}">${icon(iconName)}</div>
    <h2>${title}</h2><p>${text}</p><div class="pages">${pagesText}</div>
  </div>`
  return `<section class="page cover">
  <img class="logo" src="${LOGO_URL}" alt="TeachForFree">
  <h1>Teacher quick-start guide</h1>
  <p class="intro">Everything you need to start using TeachForFree in your classroom, one step at a time.</p>
  <div class="tiles">
    ${tile('var(--primary)', 'thumbs-up', 'Behavior monitoring', 'Give positive and negative marks in one click, and print reports for families.', 'Pages 3–5')}
    ${tile('var(--teal)', 'notebook-pen', 'Lesson plans', 'Plan each day as a checklist, teach from it, and share it with a sub.', 'Pages 6–8')}
    ${tile('var(--amber)', 'calendar-clock', 'Parent conferences', 'Set your times, print QR notices, and let families pick their time.', 'Pages 9–11')}
  </div>
  <div class="legend"><span class="badge">1</span> Numbered arrows on each picture match the numbered steps next to it.</div>
  <div style="margin-top:auto">${picture}</div>
</section>`
}
