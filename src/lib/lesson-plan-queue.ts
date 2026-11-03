import type { QueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ApiError } from './api'
import { meQueryOptions } from './auth'
import type { Me } from './auth'
import { stepSchoolDay } from './calendar'
import {
  LESSON_PLAN_MUTATION_KEY,
  OP_KINDS,
  applyOp,
  lessonPlanDayQueryOptions,
  pendingOps,
  sendOp,
} from './lesson-plans'
import type { Op, OpKind } from './lesson-plans'
import {
  enqueue,
  resumeQueue,
  retryDelay,
  shouldRetry,
  waitIfSignedOut,
} from './mark-queue'
import { localDate } from './marks'
import { spaceFromMeta } from './space-state'

// Saving lesson plan changes, in order, through bad Wi-Fi.
//
// Like marks (mark-queue.ts), each change is a React Query mutation, applied
// to the cached day the moment it's made. They all share one scope, so the
// server gets them in the order they were made: a line is always added before
// it's checked off or edited. Lesson plans have their own scope, so a mark
// that's stuck retrying never holds up a checkmark, or the other way round.
//
// Only checkmarks are saved on the device while offline (persist.ts): they
// hold ids and true/false, no text. Editing text needs a connection.

const SCOPE = { id: 'lesson-plans' }

/**
 * How to send each kind of change. Must run before the saved queue is
 * loaded, like registerMarkMutations.
 */
export function registerLessonPlanMutations(queryClient: QueryClient) {
  for (const kind of OP_KINDS) {
    queryClient.setMutationDefaults([...LESSON_PLAN_MUTATION_KEY, kind], {
      scope: SCOPE,
      retry: shouldRetry,
      retryDelay,
      // Sent to the space it was made in, even after switching spaces.
      mutationFn: (op: Op, { meta }) =>
        waitIfSignedOut(queryClient, () => sendOp(op, spaceFromMeta(meta))),
      onSuccess: (_result: unknown, op: Op) => refetchIfRacing(queryClient, op),
      onError: (error: unknown, op: Op) => onOpFailed(queryClient, error, op),
    })
  }
}

// Changes that move things around. Typing that hasn't been saved yet is
// saved first, so the queue keeps the order the teacher did things in.
const STRUCTURAL = new Set<OpKind>(
  OP_KINDS.filter(
    (k) => k !== 'item-edit' && k !== 'section-edit' && k !== 'done',
  ),
)

/** Makes a change: on screen now, and to the server as soon as it can be. */
export function runOp(queryClient: QueryClient, op: Op) {
  if (STRUCTURAL.has(op.kind)) flushDrafts()
  const { queryKey } = lessonPlanDayQueryOptions(op.date)
  // A refetch already on its way was asked before this change, and its
  // answer could undo it. Stop it; the cache keeps what it had.
  void queryClient.cancelQueries({ queryKey, exact: true })
  queryClient.setQueryData(queryKey, (day) => (day ? applyOp(day, op) : day))
  enqueue(queryClient, [...LESSON_PLAN_MUTATION_KEY, op.kind], op)
}

// ---------- Typing not saved yet ----------
//
// A line saves a moment after the teacher stops typing. Until then its text
// is a draft, registered here, so anything that moves lines around (and
// leaving the page) can save it first.

const drafts = new Map<string, () => void>()

/** A line or title has unsaved typing; flush saves it. */
export function setDraft(id: string, flush: () => void) {
  drafts.set(id, flush)
}

/** Its typing was saved, or thrown away (the line was deleted). */
export function clearDraft(id: string) {
  drafts.delete(id)
}

/** Saves every draft now. */
export function flushDrafts() {
  for (const flush of [...drafts.values()]) flush()
}

// ---------- The queue ----------

/**
 * A refetch that started before this change reached the server can answer
 * with the plan as it was, after the change has left the queue (so it isn't
 * re-applied on top). Ask again in that case.
 */
function refetchIfRacing(queryClient: QueryClient, op: Op) {
  const { queryKey } = lessonPlanDayQueryOptions(op.date)
  if (queryClient.isFetching({ queryKey, exact: true }) > 0) {
    void queryClient.invalidateQueries({ queryKey, exact: true })
  }
}

/** A change the server turned down for good: say so, and show its plan. */
function onOpFailed(queryClient: QueryClient, error: unknown, op: Op) {
  console.error(`Saving a lesson plan change (${op.kind}) failed:`, error)
  void queryClient.invalidateQueries({
    queryKey: lessonPlanDayQueryOptions(op.date).queryKey,
    exact: true,
  })
  const status = error instanceof ApiError ? error.status : undefined
  const title =
    op.kind === 'done'
      ? 'Couldn’t save a checkmark'
      : op.kind === 'section-add'
        ? 'Couldn’t add the section'
        : op.kind === 'item-add'
          ? 'Couldn’t add the line'
          : 'Couldn’t save a change to your plan'
  toast.error(title, {
    // One toast, however many changes failed together.
    id: 'lesson-plan-failed',
    description:
      status === 409
        ? op.kind === 'section-add'
          ? 'A day can hold up to 40 sections.'
          : 'A section can hold up to 150 lines.'
        : status === 404
          ? 'It was deleted on another device.'
          : status === 403
            ? 'You can no longer change this plan.'
            : 'Your plan now shows what was saved.',
  })
}

/**
 * Keeps the saved queue up to date (installed app), and refreshes the
 * calendar's dots once everything is sent.
 */
export function watchLessonPlanQueue(
  queryClient: QueryClient,
  persist?: () => void,
) {
  return queryClient.getMutationCache().subscribe((event) => {
    const key = event.mutation?.options.mutationKey
    if (key?.[0] !== LESSON_PLAN_MUTATION_KEY[0]) return
    // Only checkmarks are saved (persist.ts), so only they need a save.
    if (key[1] === 'done') persist?.()

    if (
      event.type === 'updated' &&
      (event.action.type === 'success' || event.action.type === 'error') &&
      queryClient.isMutating({ mutationKey: LESSON_PLAN_MUTATION_KEY }) === 0
    ) {
      void queryClient.invalidateQueries({ queryKey: ['lesson-plan-calendar'] })
    }
  })
}

/** Sends checkmarks saved on the device, for the same teacher only. */
export function resumeLessonPlanQueue(queryClient: QueryClient) {
  resumeQueue(queryClient, LESSON_PLAN_MUTATION_KEY)
}

/**
 * Puts checkmarks still in the queue on the saved days. The queue is saved
 * at every tap, the days only now and then, so a day can be a tap behind.
 */
export function reapplyPendingOps(queryClient: QueryClient) {
  for (const op of pendingOps(queryClient)) {
    queryClient.setQueryData(
      lessonPlanDayQueryOptions(op.date).queryKey,
      (day) => (day ? applyOp(day, op) : day),
    )
  }
}

/**
 * Resolves once every change has reached the server (true), or after
 * timeoutMs (false). For actions the server does from what it has, like
 * copying a section.
 */
export function whenSaved(queryClient: QueryClient, timeoutMs = 15_000) {
  flushDrafts()
  const saved = () =>
    queryClient.isMutating({ mutationKey: LESSON_PLAN_MUTATION_KEY }) === 0
  return new Promise<boolean>((resolve) => {
    if (saved()) {
      resolve(true)
      return
    }
    const finish = (result: boolean) => {
      unsubscribe()
      clearTimeout(timer)
      resolve(result)
    }
    const unsubscribe = queryClient.getMutationCache().subscribe(() => {
      if (saved()) finish(true)
    })
    const timer = setTimeout(() => finish(false), timeoutMs)
  })
}

/**
 * Installed app: once a teacher is signed in, loads today's plan and the
 * next school day's, so a plan written on a laptop last night is on the
 * phone before the classroom Wi-Fi drops.
 */
export function prefetchLessonPlans(queryClient: QueryClient) {
  const prefetch = (me: Me) => {
    // A co-teacher who can't see this space's plans.
    if (me.acting_for && !me.acting_for.permissions.lesson_plans) return
    const today = localDate()
    for (const date of [today, stepSchoolDay(today, 1)]) {
      void queryClient.prefetchQuery(lessonPlanDayQueryOptions(date))
    }
  }
  const known = queryClient.getQueryData(meQueryOptions.queryKey)
  if (known) {
    prefetch(known)
    return
  }
  const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
    if (event.type !== 'updated' || event.query.queryKey[0] !== 'me') return
    const me = event.query.state.data as Me | null | undefined
    if (!me) return
    unsubscribe()
    prefetch(me)
  })
}
