import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister'
import {
  persistQueryClientRestore,
  persistQueryClientSave,
  persistQueryClientSubscribe,
} from '@tanstack/react-query-persist-client'
import type { PersistQueryClientOptions } from '@tanstack/react-query-persist-client'
import type { Mutation, Query, QueryClient } from '@tanstack/react-query'
import { del, get, set } from 'idb-keyval'

// Saves the app's data on the device, so the installed app opens instantly
// and still shows the class when offline.
//
// Student names are school records, so this is deliberately narrow:
// - Only in the installed app (the teacher's own phone), never the website,
//   which may be open on a shared school computer.
// - Only what the class page needs: the roster, mark types, the day's counts.
// - Deleted on sign-out, when the session can't be renewed (me → null), and
//   after 7 days without opening the app.

const DAY = 24 * 60 * 60 * 1000

/** Saved data older than this is thrown away instead of shown. */
export const QUERY_MAX_AGE = 7 * DAY

// Bump when the shape of a saved query changes, so old saves are dropped.
// Not the build hash: that would throw the cache away on every deploy.
const CACHE_VERSION = '1'

const QUERIES_KEY = 'tff:queries'
/** The offline mark queue (src/lib/mark-queue.ts). */
export const MARK_QUEUE_KEY = 'tff:mark-queue'

/** First part of the query keys worth saving. */
const SAVED_QUERIES = new Set(['me', 'mark-types', 'mark-counts', 'student'])

/** IndexedDB through idb-keyval, in the shape the persisters expect. */
export const idbStorage = {
  getItem: (key: string) => get<string>(key),
  setItem: (key: string, value: string) => set(key, value),
  removeItem: (key: string) => del(key),
}

const queryPersister = createAsyncStoragePersister({
  storage: idbStorage,
  key: QUERIES_KEY,
})

function queryPersistOptions(
  queryClient: QueryClient,
): PersistQueryClientOptions {
  return {
    queryClient,
    persister: queryPersister,
    maxAge: QUERY_MAX_AGE,
    // A different backend (e.g. staging vs production) means different data.
    buster: `${CACHE_VERSION}:${import.meta.env.VITE_API_URL}`,
    dehydrateOptions: {
      // Marks waiting to sync are saved separately, under MARK_QUEUE_KEY.
      shouldDehydrateMutation: () => false,
      shouldDehydrateQuery: (query: Query) =>
        query.state.status === 'success' &&
        query.state.data != null &&
        SAVED_QUERIES.has(query.queryKey[0] as string) &&
        // Signed out: save nothing, which also empties what was saved.
        queryClient.getQueryData(['me']) != null,
    },
  }
}

/**
 * Loads the saved data into the query cache, then keeps saving changes.
 * Resolves once loading is done (or failed); saving starts only after that,
 * so a half-finished load is never written back.
 */
export async function restoreQueryCache(queryClient: QueryClient) {
  const options = queryPersistOptions(queryClient)
  try {
    // Throws (after deleting it) if the saved data is unreadable.
    await persistQueryClientRestore(options)
  } catch {
    // Start with an empty cache instead.
  } finally {
    persistQueryClientSubscribe(options)
  }
}

// ---------- The offline mark queue ----------
//
// Saved separately from the cached data: it has to outlive it. The cache can
// be thrown away any time (it's fetched again), but these are marks the
// server doesn't have yet. Ids and times only, no names.

/** Matches the server's limit on how long ago a mark can be given. */
const QUEUE_MAX_AGE = 30 * DAY

// Bump only with a migration: a new version deletes marks that haven't been
// sent.
const QUEUE_VERSION = '1'

const queuePersister = createAsyncStoragePersister({
  storage: idbStorage,
  key: MARK_QUEUE_KEY,
  // Save every change right away: a tap must survive the app being closed.
  throttleTime: 0,
})

function queuePersistOptions(
  queryClient: QueryClient,
): PersistQueryClientOptions {
  return {
    queryClient,
    persister: queuePersister,
    maxAge: QUEUE_MAX_AGE,
    buster: `${QUEUE_VERSION}:${import.meta.env.VITE_API_URL}`,
    dehydrateOptions: {
      shouldDehydrateQuery: () => false,
      // Every mark not yet answered, including one on its way right now: if
      // the app closes before the answer, it's sent again (safely) next time.
      shouldDehydrateMutation: (mutation: Mutation) =>
        mutation.options.mutationKey?.[0] === 'marks' &&
        mutation.state.status === 'pending',
    },
  }
}

/** Loads the saved mark queue. Resolves once done, even if it failed. */
export async function restoreMarkQueue(queryClient: QueryClient) {
  try {
    await persistQueryClientRestore(queuePersistOptions(queryClient))
  } catch {
    // Unreadable: it was deleted.
  }
}

/** Saves the mark queue as it is now. */
export function saveMarkQueue(queryClient: QueryClient) {
  void persistQueryClientSave(queuePersistOptions(queryClient)).catch(() => {})
}

/** Deletes everything saved on the device. Used on sign-out. */
export async function clearPersistedCache() {
  await Promise.all([del(QUERIES_KEY), del(MARK_QUEUE_KEY)]).catch(() => {})
}
