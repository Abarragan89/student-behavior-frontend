import { useSyncExternalStore } from 'react'

// The sound a mark makes as it's given (see useGiveMark), and the roster's
// speaker button that turns it off. Web Audio, not <audio>: it starts at once
// on phones, plays over music the teacher has on instead of pausing it, and
// on iPhones the silent switch quiets it too.

// MP3: every browser decodes it (decodeAudioData), at a twentieth of the
// WAVs' size. Saved for offline use with the rest of the app (vite.config.ts).
const URLS = {
  positive: '/sounds/positive-mark.mp3',
  negative: '/sounds/negative-mark.mp3',
}

type Clips<T> = { positive: T; negative: T }

/** A sound that would start this long after the tap is skipped. */
const LATE_MS = 1500

let files: Promise<Clips<ArrayBuffer>> | null = null
let context: AudioContext | null = null
let clips: Promise<Clips<AudioBuffer>> | null = null
let playing: AudioBufferSourceNode | null = null

/** Downloads the sounds ahead of time, so the first tap doesn't wait. */
export function preloadMarkSounds() {
  loadFiles().catch(() => {})
}

function loadFiles() {
  files ??= Promise.all([fetchFile(URLS.positive), fetchFile(URLS.negative)])
    .then(([positive, negative]) => ({ positive, negative }))
    .catch((err: unknown) => {
      files = null // Tried again next time.
      throw err
    })
  return files
}

async function fetchFile(url: string) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${url}: ${res.status}`)
  return res.arrayBuffer()
}

/** Decoded once: decoding uses up the downloaded copy. */
function decode(ctx: AudioContext) {
  clips ??= loadFiles()
    .then(async (f) => {
      const [positive, negative] = await Promise.all([
        ctx.decodeAudioData(f.positive),
        ctx.decodeAudioData(f.negative),
      ])
      return { positive, negative }
    })
    .catch((err: unknown) => {
      // Downloaded again next time, since decoding used it up.
      files = null
      clips = null
      throw err
    })
  return clips
}

/**
 * Plays the positive or negative mark sound, unless turned off. Called in the
 * tap itself, which browsers need before a page can make sound. A new tap cuts
 * off the last sound instead of piling up. Never throws: a mark is still given
 * without its sound.
 */
export function playMarkSound(positive: boolean) {
  if (muted) return
  try {
    if (!context) {
      context = new AudioContext()
      // iPhones (Safari 17+): mix with other audio, follow the silent switch.
      const nav = navigator as Navigator & { audioSession?: { type: string } }
      if (nav.audioSession) nav.audioSession.type = 'ambient'
    }
    const ctx = context
    // Here, in the tap: that's what lets it start on iPhones, and wakes it
    // after the phone paused it (a call, the app in the background).
    ctx.resume().catch(() => {})
    const tappedAt = performance.now()

    decode(ctx)
      .then((c) => {
        if (muted || performance.now() - tappedAt > LATE_MS) return
        stopPlaying()
        const node = ctx.createBufferSource()
        node.buffer = positive ? c.positive : c.negative
        node.connect(ctx.destination)
        node.onended = () => {
          if (playing === node) playing = null
        }
        node.start()
        playing = node
      })
      .catch(() => {})
  } catch {
    // No Web Audio in this browser: marks make no sound.
  }
}

function stopPlaying() {
  try {
    playing?.stop()
  } catch {
    // Already stopped.
  }
  playing = null
}

// Turned off with the roster's speaker button. Kept on this device only; it
// holds no student data, so it stays after signing out.

const MUTED_KEY = 'tff:mark-sounds-muted'

let muted = readMuted()
const listeners = new Set<() => void>()

function readMuted() {
  try {
    return localStorage.getItem(MUTED_KEY) === '1'
  } catch {
    return false
  }
}

export function setMarkSoundsMuted(next: boolean) {
  muted = next
  if (next) stopPlaying()
  try {
    if (next) localStorage.setItem(MUTED_KEY, '1')
    else localStorage.removeItem(MUTED_KEY)
  } catch {
    // Private browsing: back on next visit.
  }
  listeners.forEach((onChange) => onChange())
}

function subscribe(onChange: () => void) {
  listeners.add(onChange)
  return () => {
    listeners.delete(onChange)
  }
}

export function useMarkSoundsMuted() {
  return useSyncExternalStore(subscribe, () => muted)
}
