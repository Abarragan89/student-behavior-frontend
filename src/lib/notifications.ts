import { useEffect, useState, useSyncExternalStore } from 'react'
import { queryOptions, useQuery, useQueryClient } from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { apiFetch, apiGet, apiPost, apiPut } from './api'
import { meQueryOptions } from './auth'
import type { Me } from './auth'
import { isStandalone } from './pwa-install'
import { currentSpace, setSpace } from './space-state'
import { switchSpace } from './workspace'

// Reminders before lesson-plan subjects: "Alert: Math starts in 10 minutes",
// sent by the server as Web Push (internal/push in the Go backend) and shown
// by the service worker (public/push-sw.js). A tap opens that day's plan in
// Presenter view.
//
// They're per device: each phone or computer asks its own permission and is
// turned on or off on the Account page. New ones need the installed app
// (iPhones only allow push there, and the website may be a shared school
// computer). On Android and desktop the installed app and the browser tab
// share one subscription, so a tab still shows the switch if it's on.

/** Where a device is with reminders. */
export type NotificationStatus =
  | 'loading'
  // This browser can't receive push (an iPhone outside the installed app,
  // older iOS, private windows), or this is a dev build with no worker.
  | 'unsupported'
  // The server isn't set up to send them.
  | 'unavailable'
  // Only the installed app can turn them on.
  | 'not-installed'
  // The teacher said no to the browser's question; only Settings can undo it.
  | 'blocked'
  | 'on'
  | 'off'

/** Whether this browser could receive reminders at all. */
export function pushSupported() {
  return (
    !import.meta.env.DEV &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  )
}

// ---------- The server's key ----------

type KeyResponse = { public_key: string | null }

/**
 * The key devices subscribe with, or null when push is off on the server.
 * Always the teacher's own (never a co-teacher space's), and not saved on the
 * device.
 */
export const pushKeyQueryOptions = queryOptions({
  queryKey: ['push-key'],
  queryFn: async () =>
    (await apiGet<KeyResponse>('/push/key', { space: null })).public_key,
  staleTime: Infinity,
})

// ---------- This device's subscription ----------

/** The service worker, or null if it isn't ready in time. */
async function registration(timeoutMs = 8000) {
  if (!pushSupported()) return null
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
  ])
}

async function currentSubscription() {
  const reg = await registration(3000)
  return reg ? reg.pushManager.getSubscription() : null
}

// Status listeners, so the banner and the Account page agree after a change.
const listeners = new Set<() => void>()
let version = 0
function changed() {
  version++
  for (const l of listeners) l()
}
function subscribeChanges(l: () => void) {
  listeners.add(l)
  return () => listeners.delete(l)
}

/** This device's status. Re-checked after turnOn/turnOff and on app open. */
export function useNotificationStatus(): NotificationStatus {
  const key = useQuery({ ...pushKeyQueryOptions, enabled: pushSupported() })
  const tick = useSyncExternalStore(subscribeChanges, () => version)
  const [status, setStatus] = useState<NotificationStatus>('loading')

  useEffect(() => {
    let cancelled = false
    const set = (s: NotificationStatus) => {
      if (!cancelled) setStatus(s)
    }
    if (!pushSupported()) {
      set('unsupported')
      return
    }
    if (key.isPending) return
    if (key.isError || !key.data) {
      set('unavailable')
      return
    }
    void currentSubscription().then((sub) => {
      if (sub) return set('on')
      if (Notification.permission === 'denied') return set('blocked')
      set(isStandalone() ? 'off' : 'not-installed')
    })
    return () => {
      cancelled = true
    }
  }, [key.isPending, key.isError, key.data, tick])

  return status
}

/** What turnOn can end with. */
export type TurnOnResult = 'on' | 'blocked' | 'dismissed' | 'failed'

/**
 * Turns reminders on for this device. Call it straight from the tap: on
 * iPhones the permission question must be the first thing a tap does, so
 * the server's key has to be loaded already (pushKeyQueryOptions).
 */
export async function turnOn(publicKey: string): Promise<TurnOnResult> {
  // First, before any await: iOS only asks inside the tap itself.
  const permission = await Notification.requestPermission()
  if (permission === 'denied') {
    changed()
    return 'blocked'
  }
  if (permission !== 'granted') return 'dismissed'
  try {
    // On the installed app's first launch the worker may still be
    // installing (saving the app for offline use).
    const reg = await registration(20_000)
    if (!reg) return 'failed'
    const sub =
      (await reg.pushManager.getSubscription()) ??
      (await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: base64UrlToBytes(publicKey),
      }))
    await sendSubscription(sub)
    return 'on'
  } catch (error) {
    console.error('Turning on notifications failed:', error)
    return 'failed'
  } finally {
    changed()
  }
}

/** Turns reminders off for this device: on the server and in the browser. */
export async function turnOff() {
  try {
    const sub = await currentSubscription()
    if (!sub) return
    // Either half is enough: a device that has unsubscribed answers the
    // server's next push with "gone", and the server forgets it.
    await Promise.allSettled([
      apiFetch(
        '/push/subscription',
        {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        },
        { space: null },
      ),
      sub.unsubscribe(),
    ])
  } finally {
    changed()
  }
}

/** Shows what a reminder looks like on this device. */
export async function sendTest() {
  const sub = await currentSubscription()
  if (!sub) throw new Error('Not subscribed')
  await apiPost('/push/test', { endpoint: sub.endpoint }, { space: null })
}

function sendSubscription(sub: PushSubscription) {
  return apiPut(
    '/push/subscription',
    {
      ...sub.toJSON(),
      // The server sends at 9:50 for a 10:00 subject in this zone.
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
    { space: null },
  )
}

/**
 * When the app opens with reminders on: tell the server again (the device's
 * time zone may have changed, and it forgets devices not seen for 30 days),
 * and subscribe again if the server's key has changed.
 */
export async function syncOnOpen(queryClient: QueryClient) {
  if (!pushSupported()) return
  try {
    const sub = await currentSubscription()
    if (!sub) return
    const key = await queryClient.fetchQuery(pushKeyQueryOptions)
    if (!key) return
    const subscribedWith = sub.options.applicationServerKey
    if (subscribedWith && !sameBytes(subscribedWith, base64UrlToBytes(key))) {
      // New server keys: the old subscription can't be sent to any more.
      await sub.unsubscribe()
      const reg = await registration()
      if (!reg || Notification.permission !== 'granted') return
      const fresh = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: base64UrlToBytes(key),
      })
      await sendSubscription(fresh)
    } else {
      await sendSubscription(sub)
    }
  } catch (error) {
    // Offline, or signed out: next time.
    console.warn('Couldn’t refresh notifications:', error)
  } finally {
    changed()
  }
}

/**
 * Stops reminders on this device when its teacher is signed out (the session
 * ended) or a different teacher signs in. A switch between spaces isn't a
 * change: reminders are always the signed-in teacher's own.
 */
export function stopOnTeacherChange(queryClient: QueryClient) {
  let email = queryClient.getQueryData<Me | null>(meQueryOptions.queryKey)
    ?.teacher.email
  return queryClient.getQueryCache().subscribe((event) => {
    if (event.type !== 'updated' || event.query.queryKey[0] !== 'me') return
    const me = event.query.state.data as Me | null | undefined
    if (me === undefined) return
    const next = me?.teacher.email
    if (next === email) return
    const had = email !== undefined
    email = next
    if (had) {
      // The server may not take a request now; unsubscribing is enough.
      void currentSubscription()
        .then((sub) => sub?.unsubscribe())
        .finally(changed)
    }
  })
}

// ---------- Opening a reminder ----------

/** Set on a reminder's link, so a cold start opens the teacher's own plan. */
const REMINDER_PARAM = 'reminder'

/**
 * Before the app starts: opened from a reminder (`?reminder=1`), so go to
 * the teacher's own space, since the plan is theirs. The param is dropped
 * so a reload doesn't repeat it. Saved data from another space is then
 * cleared by dropCacheIfOtherSpace as usual.
 */
export function takeReminderLaunch() {
  const url = new URL(window.location.href)
  if (!url.searchParams.has(REMINDER_PARAM)) return
  setSpace(null)
  url.searchParams.delete(REMINDER_PARAM)
  history.replaceState(history.state, '', url.pathname + url.search + url.hash)
}

/**
 * A reminder tapped while the app is open: the service worker focuses it and
 * says where to go. The plan is the teacher's own, so leave a co-teacher
 * space first; if that can't happen (offline), stay put rather than show
 * another teacher's plan for that day.
 */
export function listenForReminderTaps(
  queryClient: QueryClient,
  navigate: ReturnType<typeof useNavigate>,
) {
  if (!('serviceWorker' in navigator)) return () => {}
  const onMessage = async (event: MessageEvent) => {
    const data = event.data as { type?: string; url?: string } | null
    if (data?.type !== 'tff:open-reminder' || !data.url) return
    const url = new URL(data.url, window.location.origin)
    if (url.origin !== window.location.origin) return
    url.searchParams.delete(REMINDER_PARAM)
    if (currentSpace()) {
      try {
        await switchSpace(queryClient, null)
      } catch {
        toast.error('Opening your plan needs a connection', {
          description: 'You’re in another teacher’s classroom.',
        })
        return
      }
    }
    await navigate({ href: url.pathname + url.search })
  }
  navigator.serviceWorker.addEventListener('message', onMessage)
  return () => navigator.serviceWorker.removeEventListener('message', onMessage)
}

// Once per app load: the subscription is sent again then.
let syncedThisLoad = false

/**
 * For the signed-in layout (routes/_authed.tsx): opens reminders tapped
 * while the app is open, and once per launch refreshes this device's
 * subscription (syncOnOpen).
 */
export function useReminders(signedIn: boolean) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  useEffect(
    () => listenForReminderTaps(queryClient, navigate),
    [queryClient, navigate],
  )
  useEffect(() => {
    if (!signedIn || syncedThisLoad) return
    syncedThisLoad = true
    void syncOnOpen(queryClient)
  }, [signedIn, queryClient])
}

// ---------- The one-time offer ----------

/** Set once the teacher answered the banner (on, blocked, or no thanks). */
const OFFER_KEY = 'tff:notify-offer-seen'

export function offerSeen() {
  try {
    return localStorage.getItem(OFFER_KEY) === '1'
  } catch {
    return true // storage blocked: don't keep asking
  }
}

export function markOfferSeen() {
  try {
    localStorage.setItem(OFFER_KEY, '1')
  } catch {
    // Storage blocked: the banner just comes back next time.
  }
  changed()
}

/** Re-renders when the offer is answered. */
export function useOfferSeen() {
  useSyncExternalStore(subscribeChanges, () => version)
  return offerSeen()
}

// ---------- Helpers ----------

function base64UrlToBytes(s: string) {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4))
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}

function sameBytes(a: ArrayBuffer, b: Uint8Array) {
  const x = new Uint8Array(a)
  return x.length === b.length && x.every((v, i) => v === b[i])
}
