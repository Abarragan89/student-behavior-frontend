import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ApiError, apiErrorFrom } from './api'
import {
  acceptView,
  familyViewQueryOptions,
  linkFetch,
} from './conference-link'
import type { FamilyView } from './conference-link'

// Live updates for a family's conference page: the server sends the page
// again whenever another family (or the teacher) changes a time, so a time
// grays out the moment someone takes it.
//
// It's Server-Sent Events read with fetch(), not EventSource: EventSource
// can't send the code in a header, and the code must never be in a URL
// (servers and proxies log those). If the stream can't get through, the
// page falls back to asking every 30 seconds (see family-page.tsx), and a
// move is checked by the server either way: live updates only save families
// a refused tap.

export type StreamStatus =
  | 'connecting'
  | 'live'
  | 'reconnecting'
  /** The stream keeps failing; the page is asking every 30 seconds. */
  | 'polling'
  /** The tab is in the background. */
  | 'paused'
  /** The code was replaced, or the student or conference removed. */
  | 'gone'
  /** Every time is over: nothing left to watch. */
  | 'ended'

/** Read through a function, so TypeScript doesn't assume it stays the same. */
const isHidden = () => document.visibilityState === 'hidden'

/** No bytes for this long (heartbeats come every 20s): the stream is stuck. */
const WATCHDOG_MS = 45_000
/** Failures in a row before the page starts asking on its own. */
const POLL_AFTER = 3

/** 1s, 2s, 4s… up to 30s, spread out so a school's phones don't retry at once. */
function backoff(failures: number) {
  const cap = Math.min(30_000, 1000 * 2 ** Math.max(0, failures - 1))
  return 500 + Math.random() * cap
}

export type SseEvent = { event: string; data: string }

/**
 * Splits a Server-Sent Events stream into events. Text arrives in arbitrary
 * pieces; push each piece and get back the events it completed. Comment
 * lines (heartbeats) produce nothing.
 */
export class SseParser {
  private buffer = ''
  private event = ''
  private data: Array<string> = []

  push(chunk: string): Array<SseEvent> {
    this.buffer += chunk
    const lines = this.buffer.split(/\r\n|\r|\n/)
    // The last piece may be half a line.
    this.buffer = lines.pop() ?? ''
    const out: Array<SseEvent> = []
    for (const line of lines) {
      if (line === '') {
        if (this.data.length > 0 || this.event) {
          out.push({
            event: this.event || 'message',
            data: this.data.join('\n'),
          })
        }
        this.event = ''
        this.data = []
        continue
      }
      if (line.startsWith(':')) continue
      const colon = line.indexOf(':')
      const field = colon === -1 ? line : line.slice(0, colon)
      const value = colon === -1 ? '' : line.slice(colon + 1).replace(/^ /, '')
      if (field === 'event') this.event = value
      else if (field === 'data') this.data.push(value)
    }
    return out
  }
}

/**
 * Keeps the family's page current while it's on screen. enabled: the page
 * has loaded and the conference isn't over.
 */
export function useConferenceStream(enabled: boolean): StreamStatus {
  const queryClient = useQueryClient()
  const [status, setStatus] = useState<StreamStatus>('connecting')

  useEffect(() => {
    if (!enabled) return
    let stopped = false
    let running = false
    let controller: AbortController | null = null
    let retryTimer: ReturnType<typeof setTimeout> | undefined
    let failures = 0

    // Through a function: stop() changes it from inside callbacks, which
    // TypeScript's narrowing doesn't see.
    const isStopped = () => stopped
    const refetchView = () =>
      void queryClient.invalidateQueries({
        queryKey: familyViewQueryOptions.queryKey,
      })
    const stop = (final: StreamStatus) => {
      stopped = true
      setStatus(final)
    }

    async function connect() {
      if (stopped || running) return
      if (isHidden()) {
        setStatus('paused')
        return
      }
      running = true
      const ctrl = new AbortController()
      controller = ctrl
      let watchdog: ReturnType<typeof setTimeout> | undefined
      const feed = () => {
        clearTimeout(watchdog)
        watchdog = setTimeout(() => ctrl.abort(), WATCHDOG_MS)
      }
      // When to try again, in ms; null: don't.
      let next: number | null = null
      try {
        feed()
        const res = await linkFetch('/stream', {
          signal: ctrl.signal,
          headers: { Accept: 'text/event-stream' },
        })
        if (res.status === 404) {
          stop('gone')
          refetchView()
          return
        }
        if (!res.ok || !res.body) {
          failures++
          next = apiErrorFrom(res).retryAfterMs ?? backoff(failures)
          return
        }
        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        const parser = new SseParser()
        let delivered = false
        for (;;) {
          const { value, done } = await reader.read()
          if (done) break
          feed()
          for (const ev of parser.push(
            decoder.decode(value, { stream: true }),
          )) {
            if (ev.event === 'view') {
              const view = JSON.parse(ev.data) as FamilyView
              acceptView(queryClient, view)
              delivered = true
              failures = 0
              if (view.status === 'ended') {
                stop('ended')
                ctrl.abort()
                return
              }
              setStatus('live')
            } else if (ev.event === 'gone') {
              stop('gone')
              refetchView()
              ctrl.abort()
              return
            } else if (ev.event === 'bye') {
              // The server is ending the stream (a restart, or its regular
              // limit): come straight back.
              next = 0
            }
          }
        }
        // Ended without a bye: a proxy cut it.
        if (next === null) {
          if (delivered) next = 1000
          else next = backoff(++failures)
        }
      } catch (error) {
        if (isStopped()) return
        if (error instanceof ApiError && error.status === 404) {
          stop('gone')
          return
        }
        next = backoff(++failures)
      } finally {
        clearTimeout(watchdog)
        running = false
        controller = null
        if (!isStopped() && next !== null && !isHidden()) {
          setStatus(failures >= POLL_AFTER ? 'polling' : 'reconnecting')
          clearTimeout(retryTimer)
          retryTimer = setTimeout(() => void connect(), next)
        }
      }
    }

    // In the background, phones cut connections anyway: let go, and catch
    // up on the way back.
    const onVisibility = () => {
      if (stopped) return
      if (isHidden()) {
        clearTimeout(retryTimer)
        controller?.abort()
        setStatus('paused')
      } else {
        failures = 0
        refetchView()
        if (!running) void connect()
      }
    }
    const onOnline = () => {
      if (stopped || running) return
      clearTimeout(retryTimer)
      void connect()
    }
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('online', onOnline)
    void connect()

    return () => {
      stopped = true
      clearTimeout(retryTimer)
      controller?.abort()
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('online', onOnline)
    }
  }, [enabled, queryClient])

  return status
}
