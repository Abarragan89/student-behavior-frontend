import type { Scene } from '../lib/scene.ts'
import { classes } from './classes.ts'
import { family, teacherConference } from './conferences.ts'
import { editor } from './editor.ts'
import { guide } from './guide.ts'
import { hero } from './hero.ts'
import { smoke } from './smoke.ts'
import { stills } from './stills.ts'
import { sub } from './sub.ts'

/** In run order. smoke and guide are only run when asked for. */
export const SCENES: Record<string, Scene> = {
  stills,
  hero,
  classes,
  editor,
  sub,
  family,
  'teacher-conference': teacherConference,
}
export const EXTRA_SCENES: Record<string, Scene> = { smoke, guide }
