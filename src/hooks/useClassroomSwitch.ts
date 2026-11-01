import { useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ApiError } from '#/lib/api'
import { meQueryOptions } from '#/lib/auth'
import type { ClassroomTab } from '#/lib/auth'
import { switchClassroom } from '#/lib/classroom'

/**
 * Switching the open classroom tab (PUT /users/me/default-classroom).
 *
 * The clicked tab shows as open right away while the request runs, and tabs
 * stay clickable. Only one request runs at a time: clicks made meanwhile are
 * collapsed into the latest one, which is sent when the running request
 * returns. So the last click always wins.
 *
 * openId is the tab the server has open: GET /users/me's classroom.id.
 */
export function useClassroomSwitch(openId: string) {
  const queryClient = useQueryClient()
  // The tab the teacher picked that the server hasn't confirmed yet.
  const [target, setTarget] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const inFlight = useRef(false)
  const queued = useRef<ClassroomTab | null>(null)

  async function send(tab: ClassroomTab) {
    inFlight.current = true
    let failed = false
    let failure: unknown
    try {
      // The answer is the whole dashboard, already opened on the new class.
      const me = await switchClassroom(tab.id)
      queryClient.setQueryData(meQueryOptions.queryKey, me)
    } catch (err) {
      console.error('Switching classroom failed:', err)
      failed = true
      failure = err
      if (err instanceof ApiError && err.status === 404) {
        // Not one of this teacher's classes anymore: resync the tabs.
        void queryClient.invalidateQueries({
          queryKey: meQueryOptions.queryKey,
        })
      }
    }
    inFlight.current = false

    const next = queued.current
    queued.current = null
    const serverOpenId = queryClient.getQueryData(meQueryOptions.queryKey)
      ?.classroom.id
    if (next && next.id !== serverOpenId) {
      // A newer click came in meanwhile. It wins, so this result is moot.
      void send(next)
      return
    }
    // Show whatever the server has open. After a failure that's the tab from
    // before the click.
    setTarget(null)
    if (failed && !next) setError(openErrorMessage(failure, tab.name))
  }

  const shownId = target ?? openId

  function select(tab: ClassroomTab) {
    if (tab.id === shownId) return
    setError(null)
    setTarget(tab.id)
    if (inFlight.current) queued.current = tab
    else void send(tab)
  }

  return {
    /** The tab to show as open: the latest click, or the server's. */
    shownId,
    /** The shown tab's class hasn't loaded yet. */
    isLoading: target !== null && target !== openId,
    error,
    select,
  }
}

function openErrorMessage(error: unknown, name: string) {
  if (error instanceof ApiError) {
    if (error.status === 404) {
      return `${name} isn’t available anymore. Your classes have been refreshed.`
    }
    if (error.status === 401) {
      return 'Your session has ended. Sign in again to switch classes.'
    }
    return `Couldn’t open ${name}. Please try again.`
  }
  // fetch() throws a TypeError when the server can't be reached.
  return 'Couldn’t reach the server. Check your connection and try again.'
}
