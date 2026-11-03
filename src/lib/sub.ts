import { queryOptions, useQuery } from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  ApiError,
  DEFAULT_TIMEOUT_MS,
  apiErrorFrom,
  timeoutSignal,
} from './api'
import type { Student } from './auth'
import { applyOp } from './lesson-plans'
import type { Op, PlanDay, PlanItem } from './lesson-plans'
import type { MarkSource } from './mark-source'
import { LIVE_REFRESH_MS, SHARED_STALE_MS } from './freshness'
import { groupName, withQueuedGroupMarks } from './groups'
import type { ClassGroups } from './groups'
import { enqueue, retryDelay, shouldRetry, unknownTarget } from './mark-queue'
import { withQueuedMarks } from './marks'
import type { MarkBatch, MarkCounts, MarkType, QueuedMark } from './marks'

// A substitute teacher's view of one day, through a link the teacher shared
// (see sub-links.ts for the teacher's side). The link's key is the only
// login: it's sent as a bearer token, never with the teacher's cookies, so a
// teacher opening their own link stays signed in as themselves and nothing
// here can touch their session.
//
// Nothing is saved on the sub's device: these query keys aren't in
// persist.ts's SAVED_QUERIES and these mutation keys aren't in its queue,
// even in the installed app. Marks and checkmarks wait for a bad connection
// only while the tab is open.

const API_URL = import.meta.env.VITE_API_URL

// ---------- The link's key ----------
//
// It comes after the # in the link, which browsers never send to a server
// (or to link previews). On arrival it moves to this tab's sessionStorage and
// off the address bar, so a projected screen doesn't show it, and a reload
// still works.

const TOKEN_KEY = 'tff:sub-link'
let token: string | null = null

/**
 * Keeps the key from the link's # for this tab. True when it's a different
 * link from the one this tab had, whose data must then be dropped.
 */
export function keepSubToken(hash: string) {
  const previous = subToken()
  token = hash.replace(/^#/, '')
  try {
    sessionStorage.setItem(TOKEN_KEY, token)
  } catch {
    // Private mode or storage off: it lasts until a reload.
  }
  return previous !== null && previous !== token
}

/** This tab's key, or null if the link was opened without one. */
export function subToken() {
  if (token) return token
  try {
    token = sessionStorage.getItem(TOKEN_KEY)
  } catch {
    // As above.
  }
  return token
}

// ---------- Talking to the server ----------

async function subFetch(path: string, init: RequestInit = {}) {
  const key = subToken()
  // No key, no way in: the same as a link that doesn't work.
  if (!key) throw new ApiError(404)
  const res = await fetch(`${API_URL}/sub${path}`, {
    ...init,
    // Never the teacher's cookies, if they're signed in in this browser.
    credentials: 'omit',
    cache: 'no-store',
    headers: { ...init.headers, Authorization: `Bearer ${key}` },
    signal: timeoutSignal(DEFAULT_TIMEOUT_MS, init.signal),
  })
  if (!res.ok) throw apiErrorFrom(res)
  return res
}

async function subGet<T>(path: string): Promise<T> {
  return (await subFetch(path)).json() as Promise<T>
}

async function subSend<T>(
  method: 'POST' | 'PUT',
  path: string,
  body: unknown,
): Promise<T> {
  const res = await subFetch(path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return res.json() as Promise<T>
}

/** For deletes: already gone (404) counts as done. */
async function subDelete(path: string) {
  try {
    await subFetch(path, { method: 'DELETE' })
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return
    throw error
  }
}

/** A link that's off or over answers 404: don't keep asking. */
function retryUnlessRefused(failureCount: number, error: Error) {
  return !(error instanceof ApiError && error.status < 500) && failureCount < 2
}

/**
 * Something the link used to open is gone: the teacher turned the link off,
 * took a class off it, or the day is over. The session says which.
 */
function onRefused(queryClient: QueryClient, error: unknown) {
  if (error instanceof ApiError && error.status === 404) {
    void queryClient.invalidateQueries({
      queryKey: subSessionQueryOptions.queryKey,
    })
  }
}

// ---------- What the link opens ----------

export type SubClassroom = { id: string; name: string }

/** GET /sub: whose plan, which day, and (on the day) what it opens. */
export type SubSession = {
  /** Before the day, on it, or after it (the teacher's time zone). */
  status: 'upcoming' | 'open' | 'ended'
  plan_date: string
  starts_at: string
  ends_at: string
  teacher_name: string
  /** On the day only: the classes the teacher picked, in their order. */
  classrooms?: Array<SubClassroom>
  /** On the day only: the teacher's mark buttons. */
  mark_types?: Array<MarkType>
}

const SUB = 'sub'

export const subSessionQueryOptions = queryOptions({
  queryKey: [SUB, 'session'],
  queryFn: async ({ client }) => {
    const session = await subGet<SubSession>('')
    // Shared with the mark buttons, which ask for them on their own.
    client.setQueryData(
      subMarkTypesQueryOptions.queryKey,
      session.mark_types ?? [],
    )
    return session
  },
  // Checked again when the page comes back to the front (the day may have
  // ended, or the teacher changed the classes).
  staleTime: 30_000,
  retry: retryUnlessRefused,
})

export const subMarkTypesQueryOptions = queryOptions({
  queryKey: [SUB, 'mark-types'],
  queryFn: async ({ client }) =>
    (await client.fetchQuery(subSessionQueryOptions)).mark_types ?? [],
  // Kept up to date by the session.
  staleTime: Infinity,
})

/** The day's plan, with checkmarks not sent yet put back on. */
export const subDayQueryOptions = queryOptions({
  queryKey: [SUB, 'day'],
  queryFn: async ({ client }) => {
    try {
      const day = await subGet<PlanDay>('/day')
      return pendingChecks(client).reduce(applyOp, day)
    } catch (error) {
      onRefused(client, error)
      throw error
    }
  },
  staleTime: SHARED_STALE_MS,
  retry: retryUnlessRefused,
})

export function subRosterQueryOptions(classroomId: string) {
  return queryOptions({
    queryKey: [SUB, 'roster', classroomId],
    queryFn: async ({ client }) => {
      try {
        return await subGet<Array<Student>>(
          `/classrooms/${encodeURIComponent(classroomId)}/students`,
        )
      } catch (error) {
        onRefused(client, error)
        throw error
      }
    },
    staleTime: 5 * 60_000,
    retry: retryUnlessRefused,
  })
}

/**
 * The class's groups and team scores, to mark a whole group. The sub can't
 * change them. Unsent group taps are added on top, as for the counts.
 */
export function subGroupsQueryOptions(classroomId: string) {
  return queryOptions({
    queryKey: [SUB, 'groups', classroomId],
    queryFn: async ({ client }) => {
      try {
        const groups = await subGet<ClassGroups>(
          `/classrooms/${encodeURIComponent(classroomId)}/groups`,
        )
        return withQueuedGroupMarks(client, SUB_MARK_KEY, classroomId, groups)
      } catch (error) {
        onRefused(client, error)
        throw error
      }
    },
    staleTime: SHARED_STALE_MS,
    retry: retryUnlessRefused,
  })
}

/** Today's counts. The server knows the day; the device's date isn't sent. */
export function subCountsQueryOptions(classroomId: string) {
  return queryOptions({
    queryKey: [SUB, 'mark-counts', classroomId],
    queryFn: async ({ client }) => {
      try {
        const counts = await subGet<MarkCounts>(
          `/classrooms/${encodeURIComponent(classroomId)}/marks/counts`,
        )
        return withQueuedMarks(
          client,
          SUB_MARK_KEY,
          classroomId,
          counts.date,
          counts,
        )
      } catch (error) {
        onRefused(client, error)
        throw error
      }
    },
    // Like the teacher's: every tap edits it, and it's fetched again once
    // the queue is empty.
    staleTime: SHARED_STALE_MS,
    retry: retryUnlessRefused,
  })
}

/**
 * The sub's marks, for the student grid and mark buttons (mark-source.tsx):
 * counted on the shared day, sent with the link's key.
 */
export function subMarkSource(planDate: string): MarkSource {
  return {
    kind: 'sub',
    dayOf: () => planDate,
    countsKey: (classroomId) => subCountsQueryOptions(classroomId).queryKey,
    useCounts: (classroomId, enabled = true) =>
      useQuery({
        ...subCountsQueryOptions(classroomId),
        enabled,
        // Marks the teacher (or anyone else) gives meanwhile.
        refetchInterval: LIVE_REFRESH_MS,
      }),
    useMarkTypes: () => useQuery(subMarkTypesQueryOptions),
    groupsKey: (classroomId) => subGroupsQueryOptions(classroomId).queryKey,
    useGroups: (classroomId, enabled = true) =>
      useQuery({
        ...subGroupsQueryOptions(classroomId),
        enabled,
        // Team points the teacher gives meanwhile.
        refetchInterval: LIVE_REFRESH_MS,
      }),
    canEditGroups: false,
    enqueue: (queryClient, mark) =>
      enqueue(queryClient, [...SUB_MARK_KEY, mark.kind], mark),
  }
}

// ---------- Marks and checkmarks ----------
//
// The same queue as the teacher's (mark-queue.ts): sent one at a time in
// order, retried through bad Wi-Fi, safe to send twice. Their own scopes, so
// they never wait behind the teacher's queue, and their own keys, so they're
// never saved on the device.

export const SUB_MARK_KEY = ['sub-marks'] as const
export const SUB_PLAN_KEY = ['sub-plan'] as const
/** A note on a mark the sub gave, sent after that mark (see mark-queue.ts). */
export const SUB_MARK_NOTE_KEY = ['sub-mark-notes'] as const

/** How to send the sub's marks and checkmarks. Run once, at start-up. */
export function registerSubMutations(queryClient: QueryClient) {
  const marks = {
    scope: { id: 'sub-marks' },
    retry: shouldRetry,
    retryDelay,
    onError: (error: unknown, mark: QueuedMark) =>
      onMarkFailed(queryClient, error, mark),
  }
  queryClient.setMutationDefaults([...SUB_MARK_KEY, 'give'], {
    ...marks,
    mutationFn: sendGive,
    onSuccess: (result: unknown, mark: QueuedMark) =>
      checkClassRoster(queryClient, result, mark),
  })
  queryClient.setMutationDefaults([...SUB_MARK_KEY, 'undo'], {
    ...marks,
    mutationFn: sendUndo,
  })
  queryClient.setMutationDefaults(SUB_MARK_NOTE_KEY, {
    scope: marks.scope,
    retry: shouldRetry,
    retryDelay,
    mutationFn: ({ markId, note }: { markId: string; note: string }) =>
      subSend<{ id: string; note: string }>(
        'PUT',
        `/marks/${encodeURIComponent(markId)}/note`,
        { note },
      ),
  })
  queryClient.setMutationDefaults([...SUB_PLAN_KEY, 'done'], {
    scope: { id: 'sub-plan' },
    retry: shouldRetry,
    retryDelay,
    mutationFn: (op: Extract<Op, { kind: 'done' }>) =>
      subSend('PUT', `/lesson-plan-items/${encodeURIComponent(op.id)}/done`, {
        done: op.done,
      }),
    onError: (error: unknown) => {
      console.error('Saving a checkmark failed:', error)
      void queryClient.invalidateQueries({
        queryKey: subDayQueryOptions.queryKey,
      })
      onRefused(queryClient, error)
      toast.error('Couldn’t save that checkmark', {
        description: 'The plan shows what’s saved.',
      })
    },
  })

  // Once the marks are all sent, show the server's counts (who a
  // whole-class mark reached, marks the teacher gave meanwhile).
  return queryClient.getMutationCache().subscribe((event) => {
    if (event.mutation?.options.mutationKey?.[0] !== SUB_MARK_KEY[0]) return
    if (
      event.type === 'updated' &&
      (event.action.type === 'success' || event.action.type === 'error') &&
      queryClient.isMutating({ mutationKey: SUB_MARK_KEY }) === 0
    ) {
      void queryClient.invalidateQueries({ queryKey: [SUB, 'mark-counts'] })
      void queryClient.invalidateQueries({ queryKey: [SUB, 'groups'] })
    }
  })
}

/** Checks a line off (or unchecks it): on screen now, sent when it can be. */
export function checkSubItem(
  queryClient: QueryClient,
  date: string,
  item: PlanItem,
) {
  const op: Op = { kind: 'done', date, id: item.id, done: !item.done }
  const { queryKey } = subDayQueryOptions
  void queryClient.cancelQueries({ queryKey, exact: true })
  queryClient.setQueryData(queryKey, (day) => (day ? applyOp(day, op) : day))
  enqueue(queryClient, [...SUB_PLAN_KEY, 'done'], op)
}

function pendingChecks(queryClient: QueryClient) {
  return queryClient
    .getMutationCache()
    .findAll({ mutationKey: SUB_PLAN_KEY, status: 'pending' })
    .sort((a, b) => a.mutationId - b.mutationId)
    .map((m) => m.state.variables as Op | undefined)
    .filter((op): op is Op => !!op)
}

function sendGive(mark: QueuedMark): Promise<unknown> {
  const { classroomId, markTypeId, id, occurredAt } = mark
  const classPath = `/classrooms/${encodeURIComponent(classroomId)}`
  switch (mark.target) {
    case 'student':
      return subSend(
        'POST',
        `${classPath}/students/${encodeURIComponent(mark.studentIds[0])}/marks`,
        { id, mark_type_id: markTypeId, occurred_at: occurredAt },
      )
    case 'selected':
      return subSend('POST', `${classPath}/mark-batches`, {
        batch_id: id,
        mark_type_id: markTypeId,
        student_ids: mark.studentIds,
        occurred_at: occurredAt,
      })
    case 'class':
      return subSend('POST', `${classPath}/mark-batches`, {
        batch_id: id,
        mark_type_id: markTypeId,
        all_students: true,
        occurred_at: occurredAt,
      })
    case 'group':
      return subSend('POST', `${classPath}/mark-batches`, {
        batch_id: id,
        mark_type_id: markTypeId,
        student_ids: mark.studentIds,
        group_id: mark.groupId,
        occurred_at: occurredAt,
      })
    default:
      return unknownTarget(mark.target)
  }
}

function sendUndo(mark: QueuedMark) {
  return mark.target === 'student'
    ? subDelete(`/marks/${encodeURIComponent(mark.id)}`)
    : subDelete(`/mark-batches/${encodeURIComponent(mark.id)}`)
}

/**
 * A whole-class mark reached a different roster, or a group's mark skipped
 * members who left: fetch the roster (and groups) again.
 */
function checkClassRoster(
  queryClient: QueryClient,
  result: unknown,
  mark: QueuedMark,
) {
  if (mark.target !== 'class' && mark.target !== 'group') return
  const reached = new Set((result as MarkBatch).marks.map((m) => m.student_id))
  const shown = new Set(mark.studentIds)
  const same =
    reached.size === shown.size && [...reached].every((id) => shown.has(id))
  if (!same) {
    void queryClient.invalidateQueries({
      queryKey: subRosterQueryOptions(mark.classroomId).queryKey,
    })
    if (mark.target === 'group') {
      void queryClient.invalidateQueries({
        queryKey: subGroupsQueryOptions(mark.classroomId).queryKey,
      })
    }
  }
}

/** A mark the server turned down for good: say which, and resync. */
function onMarkFailed(
  queryClient: QueryClient,
  error: unknown,
  mark: QueuedMark,
) {
  console.error(`Saving a mark (${mark.kind}) failed:`, error)
  void queryClient.invalidateQueries({
    queryKey: subCountsQueryOptions(mark.classroomId).queryKey,
  })
  if (mark.target === 'group') {
    void queryClient.invalidateQueries({
      queryKey: subGroupsQueryOptions(mark.classroomId).queryKey,
    })
  }
  onRefused(queryClient, error)

  const name =
    queryClient
      .getQueryData(subMarkTypesQueryOptions.queryKey)
      ?.find((t) => t.id === mark.markTypeId)?.name ?? 'a mark'
  const who =
    mark.target === 'class'
      ? 'the class'
      : mark.target === 'selected'
        ? `${mark.studentIds.length} students`
        : mark.target === 'group'
          ? groupName(
              queryClient,
              subGroupsQueryOptions(mark.classroomId).queryKey,
              mark.groupId,
            )
          : (queryClient
              .getQueryData(subRosterQueryOptions(mark.classroomId).queryKey)
              ?.find((s) => s.id === mark.studentIds[0])?.first_name ??
            'a student')

  if (mark.kind === 'undo') {
    toast.error(`Couldn’t undo “${name}” for ${who}`, {
      description: 'It’s still on their record.',
    })
    return
  }
  const status = error instanceof ApiError ? error.status : 0
  toast.error(`Couldn’t save “${name}” for ${who}`, {
    description:
      status === 404
        ? 'The link has ended, or the class changed.'
        : status === 400
          ? 'It was given before the shared day started.'
          : 'Something went wrong on our side.',
  })
}
