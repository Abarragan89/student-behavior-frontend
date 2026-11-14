// The colors a calendar category can have. The server keeps the key and
// checks it against the same list (internal/schoolevent). Chips are a soft
// tint with dark text (light text in dark mode), so a month full of them
// stays readable; the hue still tells "yellow = out" at a glance, as a
// school's color-coded spreadsheet does. Gray is for events with no
// category: categories pick from the rest (PICK_COLORS). The server still
// takes gray, for categories made gray before. Class names are written out
// in full so Tailwind finds them. No React or app imports: the spreadsheet
// import (sheet-import.ts) uses nearestColor too.

export const CATEGORY_COLORS = [
  'red',
  'orange',
  'amber',
  'yellow',
  'lime',
  'green',
  'teal',
  'cyan',
  'sky',
  'blue',
  'indigo',
  'violet',
  'purple',
  'fuchsia',
  'pink',
  'rose',
  'slate',
] as const

export type CategoryColor = (typeof CATEGORY_COLORS)[number]

/** An event with no category is gray. */
export const NO_CATEGORY_COLOR: CategoryColor = 'slate'

/** The colors a category can be given: all but gray. */
export const PICK_COLORS = CATEGORY_COLORS.filter(
  (c) => c !== NO_CATEGORY_COLOR,
)

type Style = {
  label: string
  /** An event chip: background, text and hover. */
  chip: string
  /** A small solid dot (legend, pickers). */
  dot: string
  /** Its hue in degrees, for matching a spreadsheet's colors; none for gray. */
  hue: number | null
}

export const CATEGORY_STYLES: Record<CategoryColor, Style> = {
  red: {
    label: 'Red',
    chip: 'bg-red-200 text-red-950 hover:bg-red-300 dark:bg-red-400/30 dark:text-red-50 dark:hover:bg-red-400/40',
    dot: 'bg-red-500',
    hue: 0,
  },
  orange: {
    label: 'Orange',
    chip: 'bg-orange-200 text-orange-950 hover:bg-orange-300 dark:bg-orange-400/30 dark:text-orange-50 dark:hover:bg-orange-400/40',
    dot: 'bg-orange-500',
    hue: 33,
  },
  amber: {
    label: 'Amber',
    chip: 'bg-amber-200 text-amber-950 hover:bg-amber-300 dark:bg-amber-400/30 dark:text-amber-50 dark:hover:bg-amber-400/40',
    dot: 'bg-amber-500',
    hue: 45,
  },
  yellow: {
    label: 'Yellow',
    chip: 'bg-yellow-200 text-yellow-950 hover:bg-yellow-300 dark:bg-yellow-300/30 dark:text-yellow-50 dark:hover:bg-yellow-300/40',
    dot: 'bg-yellow-400',
    hue: 58,
  },
  lime: {
    label: 'Lime',
    chip: 'bg-lime-200 text-lime-950 hover:bg-lime-300 dark:bg-lime-400/30 dark:text-lime-50 dark:hover:bg-lime-400/40',
    dot: 'bg-lime-500',
    hue: 85,
  },
  green: {
    label: 'Green',
    chip: 'bg-green-200 text-green-950 hover:bg-green-300 dark:bg-green-400/30 dark:text-green-50 dark:hover:bg-green-400/40',
    dot: 'bg-green-600',
    hue: 125,
  },
  teal: {
    label: 'Teal',
    chip: 'bg-teal-200 text-teal-950 hover:bg-teal-300 dark:bg-teal-400/30 dark:text-teal-50 dark:hover:bg-teal-400/40',
    dot: 'bg-teal-600',
    hue: 165,
  },
  cyan: {
    label: 'Cyan',
    chip: 'bg-cyan-200 text-cyan-950 hover:bg-cyan-300 dark:bg-cyan-400/30 dark:text-cyan-50 dark:hover:bg-cyan-400/40',
    dot: 'bg-cyan-500',
    hue: 185,
  },
  sky: {
    label: 'Sky',
    chip: 'bg-sky-200 text-sky-950 hover:bg-sky-300 dark:bg-sky-400/30 dark:text-sky-50 dark:hover:bg-sky-400/40',
    dot: 'bg-sky-500',
    hue: 200,
  },
  blue: {
    label: 'Blue',
    chip: 'bg-blue-200 text-blue-950 hover:bg-blue-300 dark:bg-blue-400/30 dark:text-blue-50 dark:hover:bg-blue-400/40',
    dot: 'bg-blue-600',
    hue: 220,
  },
  indigo: {
    label: 'Indigo',
    chip: 'bg-indigo-200 text-indigo-950 hover:bg-indigo-300 dark:bg-indigo-400/30 dark:text-indigo-50 dark:hover:bg-indigo-400/40',
    dot: 'bg-indigo-600',
    hue: 240,
  },
  violet: {
    label: 'Violet',
    chip: 'bg-violet-200 text-violet-950 hover:bg-violet-300 dark:bg-violet-400/30 dark:text-violet-50 dark:hover:bg-violet-400/40',
    dot: 'bg-violet-600',
    hue: 260,
  },
  purple: {
    label: 'Purple',
    chip: 'bg-purple-200 text-purple-950 hover:bg-purple-300 dark:bg-purple-400/30 dark:text-purple-50 dark:hover:bg-purple-400/40',
    dot: 'bg-purple-600',
    hue: 278,
  },
  fuchsia: {
    label: 'Magenta',
    chip: 'bg-fuchsia-200 text-fuchsia-950 hover:bg-fuchsia-300 dark:bg-fuchsia-400/30 dark:text-fuchsia-50 dark:hover:bg-fuchsia-400/40',
    dot: 'bg-fuchsia-500',
    hue: 300,
  },
  pink: {
    label: 'Pink',
    chip: 'bg-pink-200 text-pink-950 hover:bg-pink-300 dark:bg-pink-400/30 dark:text-pink-50 dark:hover:bg-pink-400/40',
    dot: 'bg-pink-500',
    hue: 325,
  },
  rose: {
    label: 'Rose',
    chip: 'bg-rose-200 text-rose-950 hover:bg-rose-300 dark:bg-rose-400/30 dark:text-rose-50 dark:hover:bg-rose-400/40',
    dot: 'bg-rose-600',
    hue: 345,
  },
  slate: {
    label: 'Gray',
    chip: 'bg-slate-200 text-slate-950 hover:bg-slate-300 dark:bg-slate-400/30 dark:text-slate-50 dark:hover:bg-slate-400/40',
    dot: 'bg-slate-500',
    hue: null,
  },
}

export function isCategoryColor(c: string): c is CategoryColor {
  return (CATEGORY_COLORS as ReadonlyArray<string>).includes(c)
}

/** A color's classes; one from a newer app shows as gray. */
export function categoryStyle(color: string): Style {
  return isCategoryColor(color) ? CATEGORY_STYLES[color] : CATEGORY_STYLES.slate
}

/** Hue (0–360) and chroma (0–1) of "RRGGBB". */
export function hueOf(hex: string): { hue: number; chroma: number } {
  const n = Number.parseInt(hex.slice(-6), 16)
  const r = ((n >> 16) & 255) / 255
  const g = ((n >> 8) & 255) / 255
  const b = (n & 255) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const chroma = max - min
  if (chroma === 0) return { hue: 0, chroma }
  let hue =
    max === r
      ? ((g - b) / chroma) % 6
      : max === g
        ? (b - r) / chroma + 2
        : (r - g) / chroma + 4
  hue *= 60
  if (hue < 0) hue += 360
  return { hue, chroma }
}

/** Degrees between two hues, the short way round (0–180). */
export function hueGap(a: number, b: number) {
  const d = Math.abs(a - b) % 360
  return d > 180 ? 360 - d : d
}

/**
 * Our color closest to a spreadsheet's "RRGGBB". A color not yet taken is
 * preferred when it's fairly close, so two pinks in the sheet don't both
 * become Pink. Gray is for no category, so a near-gray gets the first color
 * free from Blue on.
 */
export function nearestColor(
  hex: string,
  taken: ReadonlySet<CategoryColor> = new Set(),
): CategoryColor {
  const { hue, chroma } = hueOf(hex)
  if (chroma < 0.15) {
    const from = PICK_COLORS.indexOf('blue')
    const order = [...PICK_COLORS.slice(from), ...PICK_COLORS.slice(0, from)]
    return order.find((c) => !taken.has(c)) ?? 'blue'
  }
  const ranked = PICK_COLORS.filter((c) => CATEGORY_STYLES[c].hue !== null)
    .map((c) => ({ c, gap: hueGap(hue, CATEGORY_STYLES[c].hue ?? 0) }))
    .sort((a, b) => a.gap - b.gap)
  const best = ranked[0]
  const free = ranked.find((r) => !taken.has(r.c) && r.gap <= best.gap + 45)
  return (free ?? best).c
}

/**
 * A chip's colors on paper: the light-theme tint only. Printing keeps the
 * page's dark-mode class, so the chip's dark: colors would print otherwise.
 */
export function printChip(color: string) {
  return categoryStyle(color)
    .chip.split(' ')
    .filter((c) => !c.includes(':'))
    .join(' ')
}
