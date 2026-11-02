import { queryOptions } from '@tanstack/react-query'
import { ApiError, apiDelete, apiGet, apiPatch, apiPost } from './api'
import { timeZone } from './marks'

// The teacher's side of sharing a day with a substitute (sub.ts is the
// sub's): one link per date, opening that day's plan and the classes the
// teacher picks, on that day only. The link holds a secret key, so this is
// never saved on the device (not in persist.ts's SAVED_QUERIES).

export type SubLink = {
  /** The link to send. Null once the day is over (it can't open anymore). */
  url: string | null
  plan_date: string
  /** When it works: the day, midnight to midnight in the teacher's time zone. */
  starts_at: string
  ends_at: string
  created_at: string
  /** The last time the sub opened it, or null if they haven't yet. */
  last_used_at: string | null
  /** The classes it opens, in no set order. */
  classroom_ids: Array<string>
}

const path = (date: string) =>
  `/lesson-plans/${encodeURIComponent(date)}/sub-link`

/** The date's link, or null when there isn't one (or it was turned off). */
export function subLinkQueryOptions(date: string) {
  return queryOptions({
    queryKey: ['sub-link', date],
    queryFn: async () => {
      try {
        return await apiGet<SubLink>(path(date))
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) return null
        throw error
      }
    },
    // Fresh each time the share box opens: "Opened at…" changes.
    staleTime: 0,
    gcTime: 5 * 60_000,
    retry: (failureCount, error) =>
      !(error instanceof ApiError && error.status < 500) && failureCount < 2,
  })
}

/**
 * Makes the date's link. If there already is one, the server answers with
 * it unchanged (classes are changed with updateSubLinkClasses).
 */
export function createSubLink(date: string, classroomIds: Array<string>) {
  return apiPost<SubLink>(path(date), {
    // Midnight to midnight here.
    timezone: timeZone(),
    classroom_ids: classroomIds,
  })
}

/** The classes the link opens, all at once. */
export function updateSubLinkClasses(
  date: string,
  classroomIds: Array<string>,
) {
  return apiPatch<SubLink>(path(date), { classroom_ids: classroomIds })
}

/** Turns the link off for good. Already off (404) counts as done. */
export async function turnOffSubLink(date: string) {
  try {
    await apiDelete(path(date))
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return
    throw error
  }
}
