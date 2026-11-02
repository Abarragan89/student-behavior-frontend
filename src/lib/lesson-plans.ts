import { queryOptions } from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'
import { ApiError, apiDelete, apiGet, apiPatch, apiPost, apiPut } from './api'
import { monthGrid } from './calendar'

// Lesson plans: for each date, an ordered list of sections ("Period 3 —
// Fractions", "Lunch duty"), each with checklist lines. A date has a plan when
// it has sections; there's nothing to create first.
//
// Every change is an Op: applied to the cached day at once (applyOp), then
// sent through one ordered queue (lesson-plan-queue.ts). The device picks the
// id of everything it adds, so nothing waits for the server to learn an id,
// and sending a change twice is harmless.

export type PlanItem = {
  id: string
  section_id: string
  text: string
  /** 1 is a sub-step of the line above. */
  indent: 0 | 1
  done: boolean
}

export type PlanSection = {
  id: string
  date: string
  title: string
  /** "08:15", or null. */
  start_time: string | null
  end_time: string | null
  items: Array<PlanItem>
}

export type PlanDay = {
  date: string
  sections: Array<PlanSection>
}

/** How much is planned on one date, for the calendar's dots. */
export type DaySummary = {
  date: string
  sections: number
  items: number
  done: number
}

// The backend's limits, in characters.
export const MAX_TITLE_LENGTH = 200
export const MAX_LINE_LENGTH = 1000

// ---------- Changes ----------

/** One change to a day's plan, as kept in the queue until the server has it. */
export type Op =
  | {
      kind: 'section-add'
      date: string
      id: string
      title: string
      start_time: string | null
      end_time: string | null
      position: number
    }
  | {
      kind: 'section-edit'
      date: string
      id: string
      title: string
      start_time: string | null
      end_time: string | null
    }
  | { kind: 'section-delete'; date: string; id: string }
  | { kind: 'section-order'; date: string; ids: Array<string> }
  | {
      kind: 'item-add'
      date: string
      sectionId: string
      id: string
      text: string
      indent: 0 | 1
      position: number
    }
  | {
      kind: 'item-edit'
      date: string
      id: string
      text?: string
      indent?: 0 | 1
    }
  | { kind: 'item-delete'; date: string; id: string }
  | {
      kind: 'item-order'
      date: string
      sectionId: string
      ids: Array<string>
    }
  // Checking a line off. Ids and true/false only, so it's the one change
  // saved on the device while offline (see persist.ts).
  | { kind: 'done'; date: string; id: string; done: boolean }

export type OpKind = Op['kind']

export const OP_KINDS: Array<OpKind> = [
  'section-add',
  'section-edit',
  'section-delete',
  'section-order',
  'item-add',
  'item-edit',
  'item-delete',
  'item-order',
  'done',
]

/** The mutation key every queued lesson plan change shares. */
export const LESSON_PLAN_MUTATION_KEY = ['lesson-plans'] as const

/**
 * The day after op. Safe to apply twice (a change the server already has is
 * applied again on top of a refetch): adds skip ids already there, edits and
 * deletes of missing ids do nothing, and orders only move ids that exist.
 */
export function applyOp(day: PlanDay, op: Op): PlanDay {
  const mapSections = (fn: (s: PlanSection) => PlanSection) => ({
    ...day,
    sections: day.sections.map(fn),
  })
  const mapItem = (id: string, fn: (i: PlanItem) => PlanItem) =>
    mapSections((s) =>
      s.items.some((i) => i.id === id)
        ? { ...s, items: s.items.map((i) => (i.id === id ? fn(i) : i)) }
        : s,
    )

  switch (op.kind) {
    case 'section-add': {
      if (day.sections.some((s) => s.id === op.id)) return day
      const section: PlanSection = {
        id: op.id,
        date: op.date,
        title: op.title,
        start_time: op.start_time,
        end_time: op.end_time,
        items: [],
      }
      return { ...day, sections: insertAt(day.sections, section, op.position) }
    }
    case 'section-edit':
      return mapSections((s) =>
        s.id === op.id
          ? {
              ...s,
              title: op.title,
              start_time: op.start_time,
              end_time: op.end_time,
            }
          : s,
      )
    case 'section-delete':
      return {
        ...day,
        sections: day.sections.filter((s) => s.id !== op.id),
      }
    case 'section-order':
      return { ...day, sections: reorder(day.sections, op.ids) }
    case 'item-add':
      return mapSections((s) =>
        s.id === op.sectionId && !s.items.some((i) => i.id === op.id)
          ? {
              ...s,
              items: insertAt(
                s.items,
                {
                  id: op.id,
                  section_id: s.id,
                  text: op.text,
                  indent: op.indent,
                  done: false,
                },
                op.position,
              ),
            }
          : s,
      )
    case 'item-edit':
      return mapItem(op.id, (i) => ({
        ...i,
        text: op.text ?? i.text,
        indent: op.indent ?? i.indent,
      }))
    case 'item-delete':
      return mapSections((s) =>
        s.items.some((i) => i.id === op.id)
          ? { ...s, items: s.items.filter((i) => i.id !== op.id) }
          : s,
      )
    case 'item-order':
      return mapSections((s) =>
        s.id === op.sectionId ? { ...s, items: reorder(s.items, op.ids) } : s,
      )
    case 'done':
      return mapItem(op.id, (i) => ({ ...i, done: op.done }))
  }
}

function insertAt<T>(list: Array<T>, value: T, position: number) {
  const at = Math.max(0, Math.min(position, list.length))
  return [...list.slice(0, at), value, ...list.slice(at)]
}

/**
 * The listed ids first, in that order, then the rest as they were: the same
 * rule the server uses, so both agree when the list is out of date.
 */
function reorder<T extends { id: string }>(list: Array<T>, ids: Array<string>) {
  const rank = new Map<string, number>()
  ids.forEach((id, i) => {
    if (!rank.has(id)) rank.set(id, i)
  })
  return list
    .map((value, index) => ({ value, index }))
    .sort((a, b) => {
      const ra = rank.get(a.value.id) ?? Infinity
      const rb = rank.get(b.value.id) ?? Infinity
      return ra === rb ? a.index - b.index : ra - rb
    })
    .map(({ value }) => value)
}

/** Changes for date still waiting to be sent (or on their way), in order. */
export function pendingOps(queryClient: QueryClient, date?: string) {
  return queryClient
    .getMutationCache()
    .findAll({ mutationKey: LESSON_PLAN_MUTATION_KEY, status: 'pending' })
    .sort((a, b) => a.mutationId - b.mutationId)
    .map((m) => m.state.variables as Op | undefined)
    .filter((op): op is Op => !!op && (date === undefined || op.date === date))
}

/**
 * The server's plan plus the changes not sent yet, so a refetch never undoes
 * what's on screen.
 */
function withPendingOps(queryClient: QueryClient, day: PlanDay) {
  return pendingOps(queryClient, day.date).reduce(applyOp, day)
}

// ---------- Reading ----------

export function lessonPlanDayKey(date: string) {
  return ['lesson-plan', date] as const
}

export function lessonPlanDayQueryOptions(date: string) {
  return queryOptions({
    queryKey: lessonPlanDayKey(date),
    queryFn: async ({ client }) =>
      withPendingOps(client, await apiGet<PlanDay>(`/lesson-plans/${date}`)),
    // Every change here edits this cache directly. Refetched when old, for
    // changes made on another device.
    staleTime: 60 * 1000,
  })
}

/**
 * A section as the cache has it right now, which can be newer than what a
 * component last rendered (changes show a moment after they're made).
 */
export function cachedSection(
  queryClient: QueryClient,
  date: string,
  sectionId: string,
) {
  return queryClient
    .getQueryData(lessonPlanDayQueryOptions(date).queryKey)
    ?.sections.find((s) => s.id === sectionId)
}

/** What's planned on each date the month's calendar shows (six weeks). */
export function lessonPlanCalendarQueryOptions(month: string) {
  return queryOptions({
    queryKey: ['lesson-plan-calendar', month] as const,
    queryFn: () => {
      const dates = monthGrid(month)
      const params = new URLSearchParams({
        from: dates[0],
        to: dates[dates.length - 1],
      })
      return apiGet<Array<DaySummary>>(`/lesson-plans?${params}`)
    },
    staleTime: 60 * 1000,
  })
}

/**
 * An empty line, like one Enter just made. The checklist hides them and they
 * don't count, so a forgotten one never keeps a day from being done. (The
 * server's calendar counts leave them out too.)
 */
export function isBlank(item: PlanItem) {
  return item.text.trim() === ''
}

/** Lines checked off and lines in all, across a day or a section. */
export function progress(sections: Array<PlanSection>) {
  let done = 0
  let total = 0
  for (const s of sections) {
    for (const i of s.items) {
      if (isBlank(i)) continue
      total++
      if (i.done) done++
    }
  }
  return { done, total }
}

// ---------- Sending ----------

/**
 * Sends one change. A change to something already deleted (on another
 * device, or by a later change in the queue) is done: nothing left to change.
 */
export async function sendOp(op: Op): Promise<unknown> {
  try {
    return await send(op)
  } catch (error) {
    const gone = error instanceof ApiError && error.status === 404
    if (gone && op.kind !== 'section-add' && op.kind !== 'item-add') return null
    throw error
  }
}

function send(op: Op) {
  switch (op.kind) {
    case 'section-add':
      return apiPost(`/lesson-plans/${op.date}/sections`, {
        id: op.id,
        title: op.title,
        start_time: op.start_time,
        end_time: op.end_time,
        position: op.position,
      })
    case 'section-edit':
      return apiPut(`/lesson-plan-sections/${op.id}`, {
        title: op.title,
        start_time: op.start_time,
        end_time: op.end_time,
      })
    case 'section-delete':
      return apiDelete(`/lesson-plan-sections/${op.id}`)
    case 'section-order':
      return apiPut(`/lesson-plans/${op.date}/section-order`, { ids: op.ids })
    case 'item-add':
      return apiPost(`/lesson-plan-sections/${op.sectionId}/items`, {
        id: op.id,
        text: op.text,
        indent: op.indent,
        position: op.position,
      })
    case 'item-edit':
      return apiPatch(`/lesson-plan-items/${op.id}`, {
        text: op.text,
        indent: op.indent,
      })
    case 'item-delete':
      return apiDelete(`/lesson-plan-items/${op.id}`)
    case 'item-order':
      return apiPut(`/lesson-plan-sections/${op.sectionId}/item-order`, {
        ids: op.ids,
      })
    case 'done':
      return apiPut(`/lesson-plan-items/${op.id}/done`, { done: op.done })
  }
}

/**
 * Copies another day's plan onto date, unchecked. The server refuses (409)
 * if date already has a plan, so it never overwrites.
 */
export function copyDay(date: string, from: string) {
  return apiPost<PlanDay>(`/lesson-plans/${date}/copy-from`, { from })
}

/** Copies a section, unchecked, to the end of another date's plan. */
export function copySection(sectionId: string, id: string, date: string) {
  return apiPost<PlanSection>(`/lesson-plan-sections/${sectionId}/copy`, {
    id,
    date,
  })
}
