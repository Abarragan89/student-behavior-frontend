import { useSyncExternalStore } from 'react'
import { onlineManager } from '@tanstack/react-query'

// Whether the device has a connection, as React Query sees it (it pauses
// requests while offline and resumes them when the connection is back).

function subscribe(onChange: () => void) {
  return onlineManager.subscribe(onChange)
}

export function isOnline() {
  return onlineManager.isOnline()
}

export function useOnline() {
  return useSyncExternalStore(subscribe, isOnline)
}

/**
 * Calls onBack each time the connection comes back: on the change itself,
 * not right away when already online. Returns the unsubscribe.
 */
export function onReconnect(onBack: () => void) {
  return onlineManager.subscribe((online) => {
    if (online) onBack()
  })
}

/** Thrown when a page needs data that isn't saved and there's no connection. */
export class OfflineError extends Error {
  constructor() {
    super('Offline, and nothing saved to show')
    this.name = 'OfflineError'
  }
}
