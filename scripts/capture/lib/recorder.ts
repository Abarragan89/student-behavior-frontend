// Records a phone take: every frame Chrome draws, with its time, plus the
// named steps a scene marks (they become the captions on the site).
import { mkdirSync, rmSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import type { Phone } from './browser.ts'
import { PHONE } from './browser.ts'
import { OUT } from './env.ts'

export type Frame = { file: string; t: number }
export type Take = {
  name: string
  dir: string
  frames: Array<Frame>
  steps: Array<{ label: string; t: number }>
  end: number
}

export async function record(
  name: string,
  p: Phone,
  scene: (step: (label: string) => void) => Promise<void>,
): Promise<Take> {
  const dir = `${OUT}frames/${name}/`
  rmSync(dir, { recursive: true, force: true })
  mkdirSync(dir, { recursive: true })
  const frames: Array<Frame> = []
  const steps: Array<{ label: string; t: number }> = []
  const writes: Array<Promise<void>> = []
  const now = () => performance.timeOrigin + performance.now()

  const onFrame = async (f: {
    data: string
    sessionId: number
    metadata: { timestamp?: number }
  }) => {
    const file = `${dir}${String(frames.length).padStart(5, '0')}.jpg`
    // Chrome's own timestamp (seconds) is when the frame was drawn.
    frames.push({
      file,
      t: f.metadata.timestamp ? f.metadata.timestamp * 1000 : now(),
    })
    writes.push(writeFile(file, Buffer.from(f.data, 'base64')))
    await p.cdp
      .send('Page.screencastFrameAck', { sessionId: f.sessionId })
      .catch(() => {})
  }
  p.cdp.on('Page.screencastFrame', onFrame)
  await p.cdp.send('Page.startScreencast', {
    format: 'jpeg',
    quality: 92,
    maxWidth: PHONE.width * 2,
    maxHeight: PHONE.height * 2,
    everyNthFrame: 1,
  })
  // Chrome only sends a frame when something changes; nudge one now.
  await p.page.evaluate(() =>
    document.documentElement.animate([{ opacity: 1 }, { opacity: 1 }], 50),
  )
  const t0 = now()
  const step = (label: string) => steps.push({ label, t: now() })
  try {
    await scene(step)
  } finally {
    await new Promise((r) => setTimeout(r, 300))
    await p.cdp.send('Page.stopScreencast').catch(() => {})
    p.cdp.off('Page.screencastFrame', onFrame)
    await Promise.all(writes)
  }
  if (!frames.length) throw new Error(`${name}: no frames recorded`)
  const end = now()
  console.log(
    `  ${name}: ${frames.length} frames, ${((end - t0) / 1000).toFixed(1)} s`,
  )
  return { name, dir, frames, steps, end }
}

/** A still of the phone screen at 2× (786×1586), for the site. */
export async function phoneShot(p: Phone, name: string) {
  mkdirSync(`${OUT}stills/`, { recursive: true })
  const file = `${OUT}stills/${name}.png`
  const r = await p.cdp.send('Page.captureScreenshot', { format: 'png' })
  await writeFile(file, Buffer.from(r.data, 'base64'))
  return file
}
