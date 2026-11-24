import { queryOptions } from '@tanstack/react-query'
import { apiGet } from './api'

// A student's record of access: who opened or changed their records, and
// when, over the last year (the backend's internal/accesslog). One row per
// person, action, class and day. For the teacher whose student it is, and
// their school's administrators (only the school's classes). Never saved on
// the device.

export type AccessKind =
  'owner' | 'coteacher' | 'school_admin' | 'substitute' | 'family' | 'provider'

export type AccessRecord = {
  day: string // YYYY-MM-DD, UTC
  first_at: string
  last_at: string
  count: number
  kind: AccessKind
  /** The person's name; "" for a link, TeachForFree, or a deleted account. */
  actor_name: string
  is_you: boolean
  /** A substitute link's day. */
  sub_day: string | null
  action: string
  /** "" when it wasn't about one class (or the class was deleted). */
  class_name: string
  /** The student themself, or their whole class. */
  about: 'student' | 'class'
}

export function accessLogQueryOptions(studentId: string) {
  return queryOptions({
    queryKey: ['access-log', studentId],
    queryFn: () =>
      apiGet<Array<AccessRecord>>(
        `/students/${encodeURIComponent(studentId)}/access-log`,
      ),
    staleTime: 0,
  })
}

export const ROLE_LABELS: Record<AccessKind, string> = {
  owner: 'Teacher',
  coteacher: 'Co-teacher',
  school_admin: 'School administrator',
  substitute: 'Substitute',
  family: 'Family',
  provider: 'TeachForFree',
}

/** What each logged action means, as a phrase after the person's name. */
const ACTION_WORDS: Record<string, string> = {
  view_class: 'viewed the class',
  print_reports: 'printed reports',
  view_student: 'opened this student’s page',
  view_access_record: 'checked this record',
  add_students: 'added students',
  remove_student: 'removed them from a class',
  rename_student: 'changed their name',
  change_groups: 'changed groups',
  delete_class: 'deleted a class',
  import_class: 'imported from Google Classroom',
  give_mark: 'gave a mark',
  give_marks: 'gave marks to several students',
  delete_mark: 'deleted a mark',
  restore_mark: 'restored a mark',
  change_note: 'changed a note',
  delete_marks: 'undid marks',
  view_conference: 'viewed conferences',
  delete_conference: 'deleted a conference',
  set_conference_time: 'set a conference time',
  print_notices: 'printed a conference notice',
  make_family_code: 'made a family code',
  change_conference_note: 'changed a conference note',
  family_view: 'opened their conference page',
  family_move: 'changed their conference time',
  sub_open_day: 'opened the substitute plan for the day',
  add_to_school: 'added a class to the school',
  release_class: 'gave a class back to its teacher',
  delete_held_class: 'deleted a class kept after its teacher left',
}

export function actionWords(action: string) {
  return ACTION_WORDS[action] ?? action.replaceAll('_', ' ')
}

/** Who, in words. */
export function actorLabel(r: AccessRecord) {
  if (r.is_you) return 'You'
  if (r.actor_name) return r.actor_name
  switch (r.kind) {
    case 'substitute':
      return r.sub_day
        ? `Substitute link for ${formatDay(r.sub_day)}`
        : 'A substitute link'
    case 'family':
      return 'Their family, with their conference code'
    case 'provider':
      return 'TeachForFree support'
  }
  return 'A deleted account'
}

/** "Nov 14" for a YYYY-MM-DD day. */
export function formatDay(day: string) {
  return new Date(`${day}T12:00:00Z`).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year:
      day.slice(0, 4) === String(new Date().getFullYear())
        ? undefined
        : 'numeric',
  })
}

/** One person's access, folded from their rows. */
export type AccessByPerson = {
  key: string
  label: string
  role: string
  last: string // ISO
  firstDay: string
  days: Array<{ day: string; actions: Array<string>; classes: Array<string> }>
  actions: Array<string>
  classes: Array<string>
}

/** Folds the rows into one entry per person, most recent first. */
export function byPerson(records: Array<AccessRecord>): Array<AccessByPerson> {
  const people = new Map<string, AccessByPerson>()
  for (const r of records) {
    const key = `${r.kind}|${r.is_you}|${r.actor_name}|${r.sub_day ?? ''}`
    let p = people.get(key)
    if (!p) {
      p = {
        key,
        label: actorLabel(r),
        role: ROLE_LABELS[r.kind],
        last: r.last_at,
        firstDay: r.day,
        days: [],
        actions: [],
        classes: [],
      }
      people.set(key, p)
    }
    if (r.last_at > p.last) p.last = r.last_at
    if (r.day < p.firstDay) p.firstDay = r.day
    const words = actionWords(r.action)
    if (!p.actions.includes(words)) p.actions.push(words)
    if (r.class_name && !p.classes.includes(r.class_name)) {
      p.classes.push(r.class_name)
    }
    let d = p.days.find((x) => x.day === r.day)
    if (!d) {
      d = { day: r.day, actions: [], classes: [] }
      p.days.push(d)
    }
    if (!d.actions.includes(words)) d.actions.push(words)
    if (r.class_name && !d.classes.includes(r.class_name)) {
      d.classes.push(r.class_name)
    }
  }
  const out = [...people.values()]
  for (const p of out) p.days.sort((a, b) => (a.day < b.day ? 1 : -1))
  return out.sort((a, b) => (a.last < b.last ? 1 : -1))
}
