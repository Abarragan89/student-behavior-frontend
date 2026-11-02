import { queryOptions } from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'
import { ApiError, apiDelete, apiErrorFrom, apiFetch, apiGet } from './api'
import { SHARED_STALE_MS } from './freshness'

// Parent conference sign-ups, the teacher's side (see conference-link.ts for
// the family's page). The teacher sets up times, puts each student in one
// and prints a notice per student with a QR code that lets that student's
// family move to another open time.
//
// Nothing here is saved on the device: 'conferences' isn't in persist.ts's
// SAVED_QUERIES. Notices carry each family's code, so they're only ever kept
// in the print page's state, never in the query cache.

export type ConferenceSummary = {
  id: string
  title: string
  timezone: string
  parent_changes: boolean
  created_at: string
  /** null: no times yet. */
  first_starts_at: string | null
  last_ends_at: string | null
  slot_count: number
  booked_count: number
}

export type ConferenceStudent = {
  id: string
  first_name: string
  last_name: string
  /** False for someone who has a time but has left the conference's classes. */
  in_classes: boolean
}

export type ConferenceSlot = {
  id: string
  starts_at: string
  ends_at: string
  /** null: open. */
  student_id: string | null
  /** Sent back with edits, so a change made meanwhile isn't overwritten. */
  version: number
}

export type NoticeState = {
  student_id: string
  printed_at: string | null
  /** The time the family was last told about (printed, or picked by them). */
  notified_starts_at: string | null
}

/** A family's move, newest first. */
export type ConferenceChange = {
  id: string
  student_id: string
  /** null: they had no time and picked one. */
  from_starts_at: string | null
  to_starts_at: string
  created_at: string
}

export type Conference = {
  id: string
  title: string
  /** How the teacher signs notices ("Ms. Lee"). */
  notice_name: string
  location: string
  /** Times are set and shown in this time zone. */
  timezone: string
  /** Families may move their time online. */
  parent_changes: boolean
  version: number
  created_at: string
  updated_at: string
  classroom_ids: Array<string>
  /** Sorted by last name, then first. */
  students: Array<ConferenceStudent>
  /** In time order. */
  slots: Array<ConferenceSlot>
  notices: Array<NoticeState>
  changes: Array<ConferenceChange>
}

/** What one printed notice needs. */
export type ConferenceNotice = {
  student_id: string
  first_name: string
  last_name: string
  starts_at: string
  ends_at: string
  /** The family's page, in English and in Spanish. */
  url: string
  url_es: string
}

/** Families stop changing their time this close to it. */
export const CUTOFF_HOURS = 24

// ---------- Talking to the server ----------

/** Why the server refused a change that was fine when it was made. */
export type ConflictReason =
  'stale' | 'overlap' | 'too_many' | 'taken' | 'locked' | 'closed'

export class ConferenceConflict extends ApiError {
  constructor(public reason: ConflictReason) {
    super(409)
    this.name = 'ConferenceConflict'
  }
}

/** Like apiPost and friends, but a 409 says why (ConferenceConflict). */
async function send<T>(
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  path: string,
  body?: unknown,
): Promise<T> {
  const res = await apiFetch(
    path,
    body === undefined
      ? { method }
      : {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
  )
  if (res.status === 409) {
    const data = (await res.json().catch(() => null)) as {
      reason?: ConflictReason
    } | null
    throw new ConferenceConflict(data?.reason ?? 'stale')
  }
  if (!res.ok) throw apiErrorFrom(res)
  return res.json() as Promise<T>
}

const CONFERENCES = 'conferences'

export const conferencesQueryOptions = queryOptions({
  queryKey: [CONFERENCES],
  queryFn: () => apiGet<Array<ConferenceSummary>>('/conferences'),
  staleTime: SHARED_STALE_MS,
})

export function conferenceQueryOptions(id: string) {
  return queryOptions({
    queryKey: [CONFERENCES, id],
    queryFn: () => apiGet<Conference>(`/conferences/${id}`),
    // Families change it from their phones: always ask again on the way in.
    staleTime: 0,
    retry: (failureCount, error) =>
      !(error instanceof ApiError && error.status === 404) && failureCount < 2,
  })
}

/** Shows what the server answered and marks the list as changed. */
export function cacheConference(queryClient: QueryClient, c: Conference) {
  queryClient.setQueryData(conferenceQueryOptions(c.id).queryKey, c)
  void queryClient.invalidateQueries({
    queryKey: conferencesQueryOptions.queryKey,
    exact: true,
  })
}

/**
 * A time as the page last heard from the server. Edits send its version, so
 * one sent right after another (which bumped it) uses the new one.
 */
export function latestSlot(
  queryClient: QueryClient,
  conferenceId: string,
  slot: ConferenceSlot,
) {
  return (
    queryClient
      .getQueryData(conferenceQueryOptions(conferenceId).queryKey)
      ?.slots.find((s) => s.id === slot.id) ?? slot
  )
}

export type ConferenceSettings = {
  title: string
  notice_name: string
  location: string
  classroom_ids: Array<string>
}

export function createConference(
  settings: ConferenceSettings & { timezone: string },
) {
  return send<Conference>('POST', '/conferences', settings)
}

export function updateConference(
  id: string,
  patch: Partial<ConferenceSettings> & { parent_changes?: boolean },
) {
  return send<Conference>('PATCH', `/conferences/${id}`, patch)
}

export function deleteConference(id: string) {
  return apiDelete(`/conferences/${id}`)
}

export type NewTimes = {
  /** "2026-11-12", in the conference's time zone. */
  date: string
  /** "15:00" */
  start: string
  end: string
  minutes: number
}

export function addTimes(id: string, times: NewTimes) {
  return send<{ added: number; skipped: number; conference: Conference }>(
    'POST',
    `/conferences/${id}/slots`,
    times,
  )
}

export function editTime(
  id: string,
  slot: ConferenceSlot,
  time: { date: string; start: string; end: string },
) {
  return send<Conference>('PATCH', `/conferences/${id}/slots/${slot.id}`, {
    ...time,
    version: slot.version,
  })
}

/** Gives the time to a student (moving them from any other), or opens it. */
export function assignStudent(
  id: string,
  slot: ConferenceSlot,
  studentId: string | null,
) {
  return send<Conference>(
    'PUT',
    `/conferences/${id}/slots/${slot.id}/student`,
    { student_id: studentId, version: slot.version },
  )
}

export function removeTime(id: string, slot: ConferenceSlot) {
  return send<Conference>(
    'DELETE',
    `/conferences/${id}/slots/${slot.id}?version=${slot.version}`,
  )
}

/** Codes for each student's notice: the same ones as last time, if any. */
export function prepareNotices(id: string, studentIds: Array<string>) {
  return send<{ notices: Array<ConferenceNotice>; skipped: Array<string> }>(
    'POST',
    `/conferences/${id}/notices`,
    { student_ids: studentIds },
  )
}

/** Replaces a student's code: their old notice stops working at once. */
export function newCode(id: string, studentId: string) {
  return send<{ student_id: string; url: string; url_es: string }>(
    'POST',
    `/conferences/${id}/students/${studentId}/link`,
  )
}

// ---------- Times ----------

/** "2026-11-12": the day a moment falls on in the time zone. */
export function dayIn(when: string, timeZone: string) {
  return new Date(when).toLocaleDateString('en-CA', { timeZone })
}

/** "15:05": the 24-hour clock time of a moment in the time zone. */
export function clockIn(when: string, timeZone: string) {
  return new Date(when).toLocaleTimeString('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
}

/** "Thursday, November 12" in the conference's time zone. */
export function formatSlotDay(when: string, timeZone: string) {
  return new Date(when).toLocaleDateString(undefined, {
    timeZone,
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })
}

/** "Thu, Nov 12, 3:15 PM": for the changes list. */
export function formatSlotMoment(when: string, timeZone: string) {
  return new Date(when).toLocaleString(undefined, {
    timeZone,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

/** "3:15 – 3:30 PM" */
export function formatSlotRange(
  start: string,
  end: string,
  timeZone: string,
  locale?: string,
) {
  return new Intl.DateTimeFormat(locale, {
    timeZone,
    hour: 'numeric',
    minute: '2-digit',
  }).formatRange(new Date(start), new Date(end))
}

/** The conference's times grouped by day, in order. */
export function slotsByDay<T extends { starts_at: string }>(
  slots: Array<T>,
  timeZone: string,
) {
  const days: Array<{ day: string; slots: Array<T> }> = []
  for (const s of slots) {
    const day = dayIn(s.starts_at, timeZone)
    const last = days.at(-1)
    if (last?.day === day) last.slots.push(s)
    else days.push({ day, slots: [s] })
  }
  return days
}

/**
 * How many meetings fit in start..end ("15:00".."18:00"), and when the last
 * ends: the same split the server makes. null when they don't make sense.
 */
export function previewTimes(start: string, end: string, minutes: number) {
  const toMin = (t: string) => {
    const [h, m] = t.split(':').map(Number)
    return h * 60 + m
  }
  if (!start || !end || !(minutes >= 5 && minutes <= 120)) return null
  const s = toMin(start)
  const e = toMin(end)
  const count = Math.floor((e - s) / minutes)
  if (count < 1) return null
  const lastEnd = s + count * minutes
  const pad = (n: number) => String(n).padStart(2, '0')
  return {
    count,
    lastEnd: `${pad(Math.floor(lastEnd / 60))}:${pad(lastEnd % 60)}`,
  }
}

/** "Mia L.": short enough for a time row on a phone. */
export function shortName(s: { first_name: string; last_name: string }) {
  const initial = s.last_name.trim().charAt(0)
  return initial ? `${s.first_name} ${initial}.` : s.first_name
}

export function fullName(s: { first_name: string; last_name: string }) {
  return [s.first_name, s.last_name].filter((n) => n.trim()).join(' ')
}

/** Words for a teacher's refused change. */
export function conflictMessage(error: unknown) {
  if (error instanceof ConferenceConflict) {
    switch (error.reason) {
      case 'overlap':
        return 'That overlaps another time.'
      case 'too_many':
        return 'That’s more times (or conferences) than one can hold.'
      default:
        return 'A family changed this meanwhile. Here’s the latest.'
    }
  }
  if (error instanceof ApiError && error.status === 400) {
    return 'Check the date and times. Times can be set from today up to a year ahead.'
  }
  return 'Check your connection and try again.'
}
