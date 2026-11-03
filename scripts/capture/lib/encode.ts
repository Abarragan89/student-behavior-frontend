// Turns a take's frames into an MP4 for the site, plus its poster and the
// step times the site shows as captions.
import { execFileSync } from 'node:child_process'
import { copyFileSync, mkdirSync, statSync, writeFileSync } from 'node:fs'
import { OUT } from './env.ts'
import type { Take } from './recorder.ts'

export type Chapter = { label: string; start: number }
export type Clip = {
  name: string
  mp4: string
  poster: string
  chaptersFile: string
  chapters: Array<Chapter>
  duration: number
}

const WIDTH = 640

export function encode(take: Take): Clip {
  const dir = `${OUT}clips/`
  mkdirSync(dir, { recursive: true })
  const { frames } = take
  const t0 = frames[0].t
  const lines = ['ffconcat version 1.0']
  frames.forEach((f, i) => {
    const next = i + 1 < frames.length ? frames[i + 1].t : take.end
    lines.push(
      `file '${f.file}'`,
      `duration ${Math.max(0.001, (next - f.t) / 1000).toFixed(4)}`,
    )
  })
  // concat ignores the last duration unless the last file is listed again.
  lines.push(`file '${frames.at(-1)!.file}'`)
  const list = `${take.dir}frames.ffconcat`
  writeFileSync(list, lines.join('\n') + '\n')

  const mp4 = `${dir}${take.name}.mp4`
  // JPEG frames are full-range BT.601; tag the video BT.709 so the brand
  // colors look the same in Safari and Chrome.
  execFileSync('ffmpeg', [
    '-y',
    '-loglevel',
    'error',
    '-f',
    'concat',
    '-safe',
    '0',
    '-i',
    list,
    '-vf',
    `fps=30,scale=${WIDTH}:-2:flags=lanczos:in_range=full:out_range=limited:in_color_matrix=bt601:out_color_matrix=bt709,format=yuv420p`,
    '-c:v',
    'libx264',
    '-preset',
    'slow',
    '-crf',
    '28',
    '-tune',
    'animation',
    '-g',
    '240',
    '-profile:v',
    'high',
    '-level',
    '4.0',
    '-colorspace',
    'bt709',
    '-color_primaries',
    'bt709',
    '-color_trc',
    'bt709',
    '-color_range',
    'tv',
    '-movflags',
    '+faststart',
    '-an',
    mp4,
  ])
  const poster = `${dir}${take.name}-poster.png`
  execFileSync('ffmpeg', [
    '-y',
    '-loglevel',
    'error',
    '-i',
    mp4,
    '-frames:v',
    '1',
    '-update',
    '1',
    poster,
  ])

  const chapters = take.steps.map((s) => ({
    label: s.label,
    start: Math.max(0, Math.round((s.t - t0) / 100) / 10),
  }))
  const duration = Math.round((take.end - t0) / 100) / 10
  const chaptersFile = `${dir}${take.name}.chapters.json`
  writeFileSync(
    chaptersFile,
    JSON.stringify({ duration, chapters }, null, 2) + '\n',
  )
  const mb = statSync(mp4).size / 1024 / 1024
  console.log(`  ${take.name}.mp4: ${mb.toFixed(2)} MB, ${duration} s`)
  if (mb > 2.5)
    console.warn(`  ${take.name}.mp4 is over 2.5 MB; consider a shorter take`)
  return { name: take.name, mp4, poster, chaptersFile, chapters, duration }
}

/** Copies finished files into the site. */
export function publish(files: Array<string>, to: string) {
  mkdirSync(to, { recursive: true })
  for (const f of files) copyFileSync(f, to + f.split('/').at(-1))
}
