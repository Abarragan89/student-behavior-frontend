// Creates a demo teacher and their data. Each scene gets a fresh teacher, so
// nothing one scene does (marks, checkmarks, moves) shows up in another.
import { randomUUID } from 'node:crypto'
import { Api, lit, mintAccessToken, sql } from './api.ts'
import type { DemoClock, Secrets } from './env.ts'
import { APP_URL, PUBLIC_URL, schoolDaysBefore, zonedInstant } from './env.ts'
import {
  BACKGROUND_MARKS,
  CLASS_NAME,
  MARCUS_MARKS,
  OTHER_CLASS_NAME,
  OTHER_STUDENTS,
  STUDENTS,
  TEACHER_NAME,
  TODAY_MARKS,
} from './fixtures.ts'
import type { MarkSpec, Section } from './fixtures.ts'
import { flushRedis } from './stack.ts'

export type Teacher = {
  userId: string
  classroomId: string
  otherClassroomId: string
  token: string
  api: Api
  /** Full name → student id (main class). */
  students: Map<string, string>
  markTypes: Map<string, string>
  clock: DemoClock
}

export async function seedTeacher(
  clock: DemoClock,
  secrets: Secrets,
): Promise<Teacher> {
  flushRedis()
  const tag = randomUUID().slice(0, 8)
  // What SetUpTeacher does at a first Google sign-in, plus a second class.
  const [[userId, classroomId, otherClassroomId]] = sql(`
    WITH u AS (
      INSERT INTO users (google_sub, email, name)
      VALUES (${lit('capture-' + tag)}, ${lit(`ms.lee+${tag}@example.com`)}, ${lit(TEACHER_NAME)})
      RETURNING id),
    c AS (INSERT INTO classrooms (teacher_id, name, is_default) SELECT id, ${lit(CLASS_NAME)}, true FROM u RETURNING id),
    c2 AS (INSERT INTO classrooms (teacher_id, name, is_default) SELECT id, ${lit(OTHER_CLASS_NAME)}, false FROM u RETURNING id),
    m AS (
      INSERT INTO mark_types (teacher_id, name, is_positive)
      SELECT u.id, t.n, t.p FROM u, (VALUES
        (1, 'On task', true), (2, 'Helping others', true), (3, 'Participating', true),
        (4, 'Off task', false), (5, 'Disruptive', false), (6, 'Unprepared', false)) t(o, n, p)
      ORDER BY t.o RETURNING 1)
    SELECT u.id, c.id, c2.id FROM u, c, c2 WHERE (SELECT count(*) FROM m) = 6;
  `)
  const token = mintAccessToken(secrets.jwtSecret, userId)
  const api = new Api(token)

  await api.post(`/classrooms/${classroomId}/students/bulk`, {
    names: STUDENTS,
  })
  await api.post(`/classrooms/${otherClassroomId}/students/bulk`, {
    names: OTHER_STUDENTS,
  })
  const list = await api.get<
    Array<{ id: string; first_name: string; last_name: string }>
  >(`/classrooms/${classroomId}/students`)
  const students = new Map(
    list.map((s) => [`${s.first_name} ${s.last_name}`, s.id]),
  )
  const markTypes = new Map(
    sql(
      `SELECT name, id FROM mark_types WHERE teacher_id = ${lit(userId)}`,
    ).map(([n, id]) => [n, id]),
  )
  return {
    userId,
    classroomId,
    otherClassroomId,
    token,
    api,
    students,
    markTypes,
    clock,
  }
}

/** Inserts marks directly (they hold no names, so no encryption). */
export function insertMarks(t: Teacher, marks: Array<MarkSpec>) {
  if (!marks.length) return
  const past = schoolDaysBefore(t.clock.today, 12)
  const rows = marks.map((m) => {
    const date = m.daysAgo === 0 ? t.clock.today : past[m.daysAgo - 1]
    const [h, min] = m.time.split(':').map(Number)
    const at = zonedInstant(t.clock.timeZone, date, h * 60 + min).toISOString()
    const student = t.students.get(m.student)
    const type = t.markTypes.get(m.type)
    if (!student || !type)
      throw new Error(`Unknown student or mark: ${m.student} / ${m.type}`)
    return `(${lit(t.userId)}, ${lit(t.classroomId)}, ${lit(student)}, ${lit(type)}, ${lit(at)}, ${lit(at)})`
  })
  sql(`INSERT INTO student_marks (teacher_id, classroom_id, student_id, mark_type_id, occurred_at, created_at)
       VALUES ${rows.join(',\n')};`)
}

export function seedAllMarks(t: Teacher) {
  insertMarks(t, [...MARCUS_MARKS, ...TODAY_MARKS, ...BACKGROUND_MARKS])
}

/** Writes a day's plan through the API (its text is encrypted). */
export async function seedPlan(
  t: Teacher,
  date: string,
  sections: Array<Section>,
) {
  for (const s of sections) {
    const section = await t.api.post<{ id: string }>(
      `/lesson-plans/${date}/sections`,
      {
        title: s.title,
        start_time: s.start ?? null,
        end_time: s.end ?? null,
      },
    )
    for (const line of s.lines) {
      const item = await t.api.post<{ id: string }>(
        `/lesson-plan-sections/${section.id}/items`,
        {
          text: line.text,
          indent: line.indent ?? 0,
        },
      )
      if (line.done)
        await t.api.put(`/lesson-plan-items/${item.id}/done`, { done: true })
    }
  }
}

export async function copyPlan(t: Teacher, from: string, to: string) {
  await t.api.post(`/lesson-plans/${to}/copy-from`, { from })
}

/** A sub link for a day; returns the URL to open locally. */
export async function makeSubLink(t: Teacher, date: string) {
  const link = await t.api.post<{ url: string }>(
    `/lesson-plans/${date}/sub-link`,
    {
      timezone: t.clock.timeZone,
      classroom_ids: [t.classroomId],
    },
  )
  return localUrl(link.url)
}

/** Links the backend makes point at the real site; open them on the demo app. */
export function localUrl(url: string) {
  return url.replace(PUBLIC_URL, APP_URL)
}

// ---------- Parent conferences ----------

type Slot = {
  id: string
  starts_at: string
  ends_at: string
  student_id: string | null
  version: number
}
type ConferenceDetail = { id: string; version: number; slots: Array<Slot> }

export type SeededConference = {
  id: string
  /** Student name → their family's link (opened on the demo app). */
  links: Map<string, string>
}

/**
 * Two afternoons of 15-minute times. Most students have a time, a few are
 * left without one, and a couple of families have already moved.
 */
export async function seedConference(
  t: Teacher,
  opts: {
    dates: [string, string]
    noTimeYet: Array<string>
    moved: Array<string>
  },
): Promise<SeededConference> {
  const { CONFERENCE } = await import('./fixtures.ts')
  let detail = await t.api.post<ConferenceDetail>('/conferences', {
    ...CONFERENCE,
    timezone: t.clock.timeZone,
    classroom_ids: [t.classroomId],
  })
  for (const date of opts.dates) {
    const r = await t.api.post<{ conference: ConferenceDetail }>(
      `/conferences/${detail.id}/slots`,
      {
        date,
        start: '15:00',
        end: '18:30',
        minutes: 15,
      },
    )
    detail = r.conference
  }
  const slots = [...detail.slots].sort((a, b) =>
    a.starts_at.localeCompare(b.starts_at),
  )
  // Open times scattered through both days.
  const open = new Set([3, 7, 10, 16, 20, 25])
  const people = [...t.students.keys()].filter(
    (n) => !opts.noTimeYet.includes(n),
  )
  const placed = new Map<string, Slot>()
  let next = 0
  for (const [i, slot] of slots.entries()) {
    if (open.has(i) || next >= people.length) continue
    const name = people[next++]
    detail = await t.api.put<ConferenceDetail>(
      `/conferences/${detail.id}/slots/${slot.id}/student`,
      {
        student_id: t.students.get(name),
        version: slot.version,
      },
    )
    placed.set(name, slot)
  }
  const notices = await t.api.post<{
    notices: Array<{ student_id: string; url: string }>
  }>(`/conferences/${detail.id}/notices`, {
    student_ids: [...placed.keys()].map((n) => t.students.get(n)),
  })
  const byId = new Map([...t.students].map(([name, id]) => [id, name]))
  const links = new Map(
    notices.notices.map((n) => [byId.get(n.student_id)!, localUrl(n.url)]),
  )

  // A couple of families pick another open time from their notice.
  const free = slots.filter((_, i) => open.has(i))
  for (const name of opts.moved) {
    const code = new URL(links.get(name)!).hash.slice(1)
    const to = free.shift()!
    await new Api(code).post('/conference-link/move', {
      slot_id: to.id,
      from_slot_id: placed.get(name)!.id,
    })
  }
  return { id: detail.id, links }
}
