import { queryOptions } from '@tanstack/react-query'
import type { MutationKey, QueryClient, QueryKey } from '@tanstack/react-query'
import { ApiError, apiGet, apiPut } from './api'
import { SHARED_STALE_MS } from './freshness'
import { MARK_MUTATION_KEY } from './marks'
import type { QueuedMark } from './marks'
import { uuidv7 } from './uuid'

// Groups of students in a class ("Table 1", "Sharks"). A student is in at
// most one group per class; some can be in none. The teacher edits a draft
// of the whole layout and saves it at once (see GroupDraft and saveGroups).
//
// A mark given to a group goes to every member as usual (a mark batch), and
// also adds one point to the group's own team score. Only those taps count
// toward the score, whatever the group's size, until the teacher resets it.

export type GroupScore = { positive: number; negative: number }

export type StudentGroup = {
  id: string
  name: string
  /** One of GROUP_COLORS, by index. */
  color: number
  /** Members by id. Names come from the roster, which is also their order. */
  student_ids: Array<string>
  /** Marks given to the whole group since the last reset. */
  score: GroupScore
}

export type ClassGroups = {
  /** Bumped by every save; a save from an older copy is refused (409). */
  version: number
  /** When the team scores were last reset (UTC), or null if never. */
  scores_since: string | null
  groups: Array<StudentGroup>
}

// The backend's limits.
export const MAX_GROUPS = 40
export const MAX_GROUP_NAME_LENGTH = 30

/**
 * The 8 group colors, by the index the server keeps. Never red or green:
 * those are the mark ring's colors. Dark text on the light ones.
 */
export const GROUP_COLORS = [
  { name: 'Indigo', className: 'bg-indigo-600 text-white' },
  { name: 'Sky', className: 'bg-sky-500 text-black' },
  { name: 'Teal', className: 'bg-teal-700 text-white' },
  { name: 'Amber', className: 'bg-amber-400 text-black' },
  { name: 'Pink', className: 'bg-pink-600 text-white' },
  { name: 'Orange', className: 'bg-orange-500 text-black' },
  { name: 'Violet', className: 'bg-violet-600 text-white' },
  { name: 'Stone', className: 'bg-stone-500 text-white' },
] as const

/** A group color's classes; a color from a newer app falls back to the first. */
export function groupColorClass(color: number) {
  return (GROUP_COLORS[color] ?? GROUP_COLORS[0]).className
}

// ---------- Reading ----------

/** A class's groups and their team scores, with unsent group taps added. */
export function groupsQueryOptions(classroomId: string) {
  return queryOptions({
    queryKey: ['groups', classroomId],
    queryFn: async ({ client }) =>
      withQueuedGroupMarks(
        client,
        MARK_MUTATION_KEY,
        classroomId,
        await apiGet<ClassGroups>(
          `/classrooms/${encodeURIComponent(classroomId)}/groups`,
        ),
      ),
    // Groups change on other devices too (a co-teacher, the teacher's
    // laptop), and team scores whenever a sub or another device marks one.
    staleTime: SHARED_STALE_MS,
    // A failing route (an older server) just means no groups yet.
    retry: (failureCount, error) =>
      !(error instanceof ApiError && error.status < 500) && failureCount < 1,
  })
}

/**
 * Adds group taps still waiting to be sent onto the server's scores, as
 * withQueuedMarks does for counts (an undo still queued takes its point back
 * off). Scores aren't per day, so every pending tap for the class counts.
 * mutationKey is the teacher's queue or the substitute's.
 */
export function withQueuedGroupMarks(
  queryClient: QueryClient,
  mutationKey: MutationKey,
  classroomId: string,
  data: ClassGroups,
) {
  const pending = queryClient
    .getMutationCache()
    .findAll({ mutationKey, status: 'pending' })
  let result = data
  for (const mutation of pending) {
    const tap = mutation.state.variables as QueuedMark | undefined
    if (tap?.classroomId !== classroomId || !tap.groupId) continue
    result = applyScoreDelta(
      result,
      tap.groupId,
      tap.isPositive,
      tap.kind === 'give' ? 1 : -1,
    )
  }
  return result
}

/** Adds 1 to (or takes 1 off) a group's + or − points. Never below 0. */
export function applyScoreDelta(
  data: ClassGroups,
  groupId: string,
  isPositive: boolean,
  delta: 1 | -1,
): ClassGroups {
  const key = isPositive ? 'positive' : 'negative'
  return {
    ...data,
    groups: data.groups.map((g) =>
      g.id === groupId
        ? {
            ...g,
            score: { ...g.score, [key]: Math.max(0, g.score[key] + delta) },
          }
        : g,
    ),
  }
}

/**
 * A tap (or its Undo) on a group changes its score at once, before the
 * server has it. queryKey is the teacher's or the substitute's groups.
 */
export function bumpGroupScore(
  queryClient: QueryClient,
  queryKey: QueryKey,
  groupId: string,
  isPositive: boolean,
  delta: 1 | -1,
) {
  const state = queryClient.getQueryState(queryKey)
  // A refetch already on its way was asked before this tap; its answer could
  // undo it. Stop it; the cache keeps what it had.
  void queryClient.cancelQueries({ queryKey, exact: true })
  queryClient.setQueryData<ClassGroups>(
    queryKey,
    (data) => data && applyScoreDelta(data, groupId, isPositive, delta),
    // A bump doesn't make the copy any fresher.
    { updatedAt: state?.dataUpdatedAt ?? 0 },
  )
}

/**
 * Puts the groups a save answered with in the cache, so the tab shows them
 * at once without refetching. Unsent group taps are added back on top.
 */
export function cacheGroups(
  queryClient: QueryClient,
  classroomId: string,
  data: ClassGroups,
) {
  const { queryKey } = groupsQueryOptions(classroomId)
  // A refetch already on its way was asked before the save.
  void queryClient.cancelQueries({ queryKey, exact: true })
  queryClient.setQueryData(
    queryKey,
    withQueuedGroupMarks(queryClient, MARK_MUTATION_KEY, classroomId, data),
  )
}

/** A group's name from a cached copy of its class's groups, for messages. */
export function groupName(
  queryClient: QueryClient,
  queryKey: QueryKey,
  groupId: string | undefined,
) {
  return (
    queryClient
      .getQueryData<ClassGroups>(queryKey)
      ?.groups.find((g) => g.id === groupId)?.name ?? 'a group'
  )
}

/** A group's members in roster order, leaving out anyone not on it. */
export function groupMembers<TStudent extends { id: string }>(
  group: Pick<StudentGroup, 'student_ids'>,
  roster: Array<TStudent>,
) {
  const ids = new Set(group.student_ids)
  return roster.filter((s) => ids.has(s.id))
}

/** Students on the roster who aren't in any group, in roster order. */
export function ungrouped<TStudent extends { id: string }>(
  groups: Array<Pick<StudentGroup, 'student_ids'>>,
  roster: Array<TStudent>,
) {
  const grouped = new Set(groups.flatMap((g) => g.student_ids))
  return roster.filter((s) => !grouped.has(s.id))
}

/** "+7", "−2" (a real minus sign), "0". */
export function formatNet({ positive, negative }: GroupScore) {
  const net = positive - negative
  return net > 0 ? `+${net}` : net < 0 ? `−${-net}` : '0'
}

// ---------- Editing ----------

/** One group in the editor, before it's saved. */
export type GroupDraft = {
  id: string
  name: string
  color: number
  studentIds: Array<string>
  /** Points so far (0 for a new group), shown while editing. */
  score: GroupScore
}

export function draftsFrom(data: ClassGroups): Array<GroupDraft> {
  return data.groups.map((g) => ({
    id: g.id,
    name: g.name,
    color: g.color,
    studentIds: g.student_ids,
    score: g.score,
  }))
}

/**
 * The next "Group N": one more than the number of groups or the highest
 * "Group N" so far, whichever is bigger, so new groups count up even after
 * some were renamed ("Sharks, Group 2, Group 3" → "Group 4").
 */
export function nextGroupName(drafts: Array<Pick<GroupDraft, 'name'>>) {
  let highest = drafts.length
  for (const d of drafts) {
    const match = /^group (\d+)$/i.exec(d.name.trim())
    if (match) highest = Math.max(highest, Number(match[1]))
  }
  return `Group ${highest + 1}`
}

/** The first color no group has yet, or the next in turn once all are used. */
export function nextColor(drafts: Array<Pick<GroupDraft, 'color'>>) {
  const used = new Set(drafts.map((d) => d.color))
  const free = GROUP_COLORS.findIndex((_, i) => !used.has(i))
  return free === -1 ? drafts.length % GROUP_COLORS.length : free
}

/** A new, empty group with the next free name and color. */
export function newGroupDraft(drafts: Array<GroupDraft>): GroupDraft {
  return {
    id: uuidv7(),
    name: nextGroupName(drafts),
    color: nextColor(drafts),
    studentIds: [],
    score: { positive: 0, negative: 0 },
  }
}

/** How the Shuffle sheet splits the class. */
export type ShufflePlan = { by: 'count' | 'size'; n: number }

/** How many groups a plan makes from `students` students. */
export function groupCountFor(students: number, { by, n }: ShufflePlan) {
  if (students === 0) return 0
  const count = by === 'count' ? n : Math.ceil(students / Math.max(1, n))
  return Math.max(1, Math.min(count, students, MAX_GROUPS))
}

/**
 * "26 students → 7 groups: 5 of 4, 2 of 3", "12 students → 3 groups of 4".
 * Dealt round-robin, so sizes differ by at most 1.
 */
export function describeSplit(students: number, groups: number) {
  if (groups === 0) return 'No students to put in groups'
  const small = Math.floor(students / groups)
  const big = students % groups
  const lead = `${students} ${students === 1 ? 'student' : 'students'} → `
  const count = `${groups} ${groups === 1 ? 'group' : 'groups'}`
  if (big === 0) return `${lead}${count} of ${small}`
  return `${lead}${count}: ${big} of ${small + 1}, ${groups - big} of ${small}`
}

/** A random whole number from 0 up to (not including) max, from crypto. */
function randomBelow(max: number) {
  const [n] = crypto.getRandomValues(new Uint32Array(1))
  return n % max
}

/**
 * Deals the whole class into groups at random, evenly (sizes differ by at
 * most 1). Keeps the current groups' ids, names and colors in order, adds
 * groups as needed and drops the extra ones. Pure apart from the shuffle.
 */
export function makeRandomGroups(
  roster: Array<{ id: string }>,
  plan: ShufflePlan,
  current: Array<GroupDraft>,
  random: (max: number) => number = randomBelow,
): Array<GroupDraft> {
  const count = groupCountFor(roster.length, plan)
  const groups: Array<GroupDraft> = []
  for (let i = 0; i < count; i++) {
    const kept = current.at(i)
    groups.push(kept ? { ...kept, studentIds: [] } : newGroupDraft(groups))
  }

  // Fisher–Yates, then deal one at a time like cards.
  const ids = roster.map((s) => s.id)
  for (let i = ids.length - 1; i > 0; i--) {
    const j = random(i + 1)
    ;[ids[i], ids[j]] = [ids[j], ids[i]]
  }
  ids.forEach((id, i) => groups[i % count].studentIds.push(id))
  return groups
}

/** The draft as PUT /classrooms/{id}/groups takes it. */
export type SaveGroupsBody = {
  version: number
  reset_scores: boolean
  groups: Array<{
    id: string
    name: string
    color: number
    student_ids: Array<string>
  }>
}

export function saveBody(
  version: number,
  drafts: Array<GroupDraft>,
  resetScores: boolean,
): SaveGroupsBody {
  return {
    version,
    reset_scores: resetScores,
    groups: drafts.map((d) => ({
      id: d.id,
      // A cleared name falls back to the default rather than failing.
      name: d.name.trim() || `Group ${drafts.indexOf(d) + 1}`,
      color: d.color,
      student_ids: d.studentIds,
    })),
  }
}

/**
 * Replaces the class's groups. Answers with them as saved. A 409 means
 * another device saved first (see isGroupsConflict).
 */
export function saveGroups(classroomId: string, body: SaveGroupsBody) {
  return apiPut<ClassGroups>(
    `/classrooms/${encodeURIComponent(classroomId)}/groups`,
    body,
  )
}

/** The groups were changed somewhere else since this copy was read. */
export function isGroupsConflict(error: unknown) {
  return error instanceof ApiError && error.status === 409
}

/**
 * Whether the saved groups already match a draft (same groups, names,
 * colors and members, in order): a save whose answer was lost still went
 * through.
 */
export function sameLayout(data: ClassGroups, drafts: Array<GroupDraft>) {
  if (data.groups.length !== drafts.length) return false
  return data.groups.every((g, i) => {
    const d = drafts[i]
    const members = new Set(d.studentIds)
    return (
      g.id === d.id &&
      g.name === (d.name.trim() || g.name) &&
      g.color === d.color &&
      g.student_ids.length === members.size &&
      g.student_ids.every((id) => members.has(id))
    )
  })
}
