// How current the server's data stays on screen, for teachers using more than
// one device (the installed app on a phone and a laptop, say). A change on
// one shows on the other the next time it opens, comes back to the front or
// changes pages, and within LIVE_REFRESH_MS on pages that show marks or the
// plan.

/**
 * How long fetched data counts as current. Long enough that components
 * showing the same data at once share one request; short enough that coming
 * back to the app asks the server again.
 */
export const SHARED_STALE_MS = 15_000

/**
 * How often pages showing today's marks or the plan being taught check the
 * server, while they're on screen and online (React Query pauses it
 * otherwise).
 */
export const LIVE_REFRESH_MS = 30_000
