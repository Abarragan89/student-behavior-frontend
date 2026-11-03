import { getImage } from 'astro:assets'
import type { Clip } from '../../captures'

/** A clip's poster for <video poster>, which takes one URL: a 640px WebP. */
export function posterImage(clip: Clip) {
  return getImage({ src: clip.poster, width: 640, format: 'webp', quality: 80 })
}
