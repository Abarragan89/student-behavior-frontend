import { MutationObserver } from '@tanstack/react-query'
import type { MutationKey, QueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ApiError } from './api'
import { meQueryOptions } from './auth'
import type { Me } from './auth'
import {
  MARK_MUTATION_KEY,
  giveMark,
  giveMarkToClass,
  giveMarkToStudents,
  markCountsQueryOptions,
  markTypesQueryOptions,
  undoMark,
  undoMarkBatch,
} from './marks'
import type { MarkBatch, QueuedMark } from './marks'
import { currentSpace, spaceFromMeta } from './space-state'

// Giving and undoing marks, as a queue that survives bad Wi-Fi.
//
// Each tap is a React Query mutation. Offline, React Query pauses it and sends
// it when the connection is back; the installed app also saves the queue on
// the device (persist.ts), so taps survive the app being closed. All marks
// share one scope, so they're sent one at a time in the order they were
// tapped, and an Undo always goes after the mark it takes back.
//
// Sending one twice is safe: the device picks each mark's id (uuidv7) and the
// server answers a repeat with the mark it already has.

const MARK_SCOPE = { id: 'marks' }

/**
 * How to send queued marks, by mutation key. Must run before the saved queue
 * is loaded: restored mutations only have their key and variables, and get
 * these functions from here.
 */
export function registerMarkMutations(queryClient: QueryClient) {
  const common = {
    scope: MARK_SCOPE,
    retry: shouldRetry,
    retryDelay,
    onError: (error: unknown, mark: QueuedMark) =>
      onMarkFailed(queryClient, error, mark),
  }
  queryClient.setMutationDefaults([...MARK_MUTATION_KEY, 'give'], {
    ...common,
    // Sent to the space it was given in, even after switching spaces.
    mutationFn: (mark: QueuedMark, { meta }) =>
      waitIfSignedOut(queryClient, () => sendGive(mark, spaceFromMeta(meta))),
    onSuccess: (result: unknown, mark: QueuedMark) =>
      checkClassRoster(queryClient, result, mark),
  })
  queryClient.setMutationDefaults([...MARK_MUTATION_KEY, 'undo'], {
    ...common,
    mutationFn: (mark: QueuedMark, { meta }) =>
      waitIfSignedOut(queryClient, () => sendUndo(mark, spaceFromMeta(meta))),
  })
}

/** Adds a tap (or an Undo) to the queue. It's sent as soon as it can be. */
export function enqueueMark(queryClient: QueryClient, mark: QueuedMark) {
  enqueue(queryClient, [...MARK_MUTATION_KEY, mark.kind], mark)
}

/**
 * Adds a change to a queue: a mutation whose functions come from
 * setMutationDefaults for its key. Also used by lesson-plan-queue.ts.
 */
export function enqueue<T>(
  queryClient: QueryClient,
  mutationKey: MutationKey,
  variables: T,
) {
  const me = queryClient.getQueryData(meQueryOptions.queryKey)
  const observer = new MutationObserver<unknown, unknown, T>(queryClient, {
    mutationKey,
    // Whose it is, so a saved queue is only ever sent for the same teacher,
    // and the space it was made in (null: their own), which it's sent to.
    meta: { owner: me?.teacher.email, space: currentSpace() },
  })
  void observer
    .mutate(variables)
    .catch(() => {}) // failures are handled by each key's onError
    .finally(() => observer.reset()) // lets the finished mutation be cleared
}

/**
 * Sends a restored queue once the signed-in teacher is known. Marks saved
 * for a different teacher are dropped, never sent.
 */
export function resumeMarkQueue(queryClient: QueryClient) {
  resumeQueue(queryClient, MARK_MUTATION_KEY)
}

/** resumeMarkQueue for any queue, by its mutation key. */
export function resumeQueue(
  queryClient: QueryClient,
  mutationKey: MutationKey,
) {
  const restored = queryClient
    .getMutationCache()
    .findAll({ mutationKey, status: 'pending' })
  if (restored.length === 0) return

  const resume = (me: Me) => {
    const mine = restored.filter((m) => m.meta?.owner === me.teacher.email)
    if (mine.length < restored.length) {
      for (const m of restored) {
        if (!mine.includes(m)) queryClient.getMutationCache().remove(m)
      }
    }
    // Only the first in the scope runs; the rest wait their turn.
    for (const m of mine) void m.continue().catch(() => {})
  }

  const me = queryClient.getQueryData(meQueryOptions.queryKey)
  if (me) {
    resume(me)
    return
  }
  // Not known yet (or signed out): wait for a teacher to sign in.
  const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
    if (event.type !== 'updated' || event.query.queryKey[0] !== 'me') return
    const next = event.query.state.data as Me | null | undefined
    if (!next) return
    unsubscribe()
    resume(next)
  })
}

/**
 * Once the queue is empty, fetches the counts and marks again, so they show
 * exactly what the server has (e.g. who a whole-class mark reached).
 * `persist` saves the queue on the device after every change.
 */
export function watchMarkQueue(queryClient: QueryClient, persist?: () => void) {
  return queryClient.getMutationCache().subscribe((event) => {
    const key = event.mutation?.options.mutationKey
    if (key?.[0] !== MARK_MUTATION_KEY[0]) return
    persist?.()

    if (
      event.type === 'updated' &&
      (event.action.type === 'success' || event.action.type === 'error') &&
      queryClient.isMutating({ mutationKey: MARK_MUTATION_KEY }) === 0
    ) {
      void queryClient.invalidateQueries({ queryKey: ['mark-counts'] })
      void queryClient.invalidateQueries({ queryKey: ['student-marks'] })
    }
  })
}

/** How many students' marks are still waiting to be sent. */
export function countUnsent(mutations: Array<QueuedMark>) {
  const undone = new Set(
    mutations.filter((m) => m.kind === 'undo').map((m) => m.id),
  )
  return mutations
    .filter((m) => m.kind === 'give' && !undone.has(m.id))
    .reduce((sum, m) => sum + m.studentIds.length, 0)
}

// ---------- Sending ----------

async function sendGive(
  mark: QueuedMark,
  space: string | null,
): Promise<unknown> {
  const { classroomId, markTypeId, id, occurredAt } = mark
  switch (mark.target) {
    case 'student':
      return giveMark(classroomId, mark.studentIds[0], markTypeId, {
        id,
        occurredAt,
        space,
      })
    case 'selected':
      return giveMarkToStudents(classroomId, mark.studentIds, markTypeId, {
        batchId: id,
        occurredAt,
        space,
      })
    case 'class':
      return giveMarkToClass(classroomId, markTypeId, {
        batchId: id,
        occurredAt,
        space,
      })
  }
}

function sendUndo(mark: QueuedMark, space: string | null) {
  return mark.target === 'student'
    ? undoMark(mark.id, space)
    : undoMarkBatch(mark.id, space)
}

/**
 * The session ended (the refresh failed too). Keep the change queued instead
 * of failing it: the app goes to sign-in, and the saved queue is sent once
 * the same teacher is back.
 */
export async function waitIfSignedOut<T>(
  queryClient: QueryClient,
  send: () => Promise<T>,
): Promise<T> {
  try {
    return await send()
  } catch (error) {
    if (!(error instanceof ApiError && error.status === 401)) throw error
    void queryClient.invalidateQueries({ queryKey: meQueryOptions.queryKey })
    return new Promise<T>(() => {})
  }
}

/**
 * Network trouble and busy servers: keep trying until it gets through.
 * Answers that won't change (400, 403, 404, 409): give up and say so.
 */
export function shouldRetry(failureCount: number, error: unknown) {
  if (!(error instanceof ApiError)) return true // offline, timeout, dropped
  const { status } = error
  if (status === 408 || status === 429 || status >= 502) return true
  if (status === 500) return failureCount < 8
  return false
}

/** What the server asked for (429), else 1s, 2s, 4s… up to a minute. */
export function retryDelay(failureCount: number, error: unknown) {
  if (error instanceof ApiError && error.retryAfterMs !== undefined) {
    return error.retryAfterMs
  }
  const backoff = Math.min(1000 * 2 ** failureCount, 60_000)
  return backoff * (0.5 + Math.random() / 2) // spread out retries
}

// ---------- After the server answers ----------

/**
 * A whole-class mark reaches whoever is enrolled when it arrives. If that's
 * not who was on screen, the roster changed elsewhere: fetch it again.
 */
function checkClassRoster(
  queryClient: QueryClient,
  result: unknown,
  mark: QueuedMark,
) {
  if (mark.target !== 'class') return
  const reached = new Set((result as MarkBatch).marks.map((m) => m.student_id))
  const shown = new Set(mark.studentIds)
  const same =
    reached.size === shown.size && [...reached].every((id) => shown.has(id))
  if (!same) {
    void queryClient.invalidateQueries({ queryKey: meQueryOptions.queryKey })
  }
}

/** A mark the server turned down for good: say which, and resync. */
function onMarkFailed(
  queryClient: QueryClient,
  error: unknown,
  mark: QueuedMark,
) {
  console.error(`Saving a queued mark (${mark.kind}) failed:`, error)
  const notFound = error instanceof ApiError && error.status === 404

  // The cards counted it. Show the server's numbers (plus anything still
  // queued) instead.
  void queryClient.invalidateQueries({
    queryKey: markCountsQueryOptions(mark.classroomId, mark.date).queryKey,
  })
  if (notFound) {
    // A student, the class or the mark type changed somewhere else.
    void queryClient.invalidateQueries({ queryKey: meQueryOptions.queryKey })
    void queryClient.invalidateQueries({
      queryKey: markTypesQueryOptions.queryKey,
    })
  }

  const what = `“${markTypeName(queryClient, mark.markTypeId)}”`
  const who = describeStudents(queryClient, mark)
  if (mark.kind === 'undo') {
    toast.error(`Couldn’t undo ${what} for ${who}`, {
      description: 'It’s still on their record.',
    })
    return
  }
  toast.error(`Couldn’t save ${what} for ${who}`, {
    description: notFound
      ? 'The student, class or mark type has changed since.'
      : error instanceof ApiError && error.status === 403
        ? 'You can no longer give marks in that classroom.'
        : error instanceof ApiError && error.status === 400
          ? 'It was given too long ago to save.'
          : 'Something went wrong on our side.',
  })
}

function markTypeName(queryClient: QueryClient, markTypeId: string) {
  return (
    queryClient
      .getQueryData(markTypesQueryOptions.queryKey)
      ?.find((t) => t.id === markTypeId)?.name ?? 'a mark'
  )
}

// Names come from the cached roster: the queue itself holds only ids.
function describeStudents(queryClient: QueryClient, mark: QueuedMark) {
  if (mark.target === 'class') return 'the class'
  if (mark.target === 'selected') return `${mark.studentIds.length} students`
  const student = queryClient
    .getQueryData(meQueryOptions.queryKey)
    ?.classroom?.students.find((s) => s.id === mark.studentIds[0])
  return student?.first_name ?? 'a student'
}
