// A small .xlsx reader, just enough for a school's color-coded calendar
// spreadsheet: each sheet's cells with their shown value, number format and
// fill color, plus merged ranges. The file is read on this device (see
// sheet-import.ts). Plain functions, no DOM or app imports, so Node can run
// them against a test file. Excel and Google Sheets write these XML parts
// the same simple way, so a small tag scanner reads them; a real XML parser
// isn't needed.

export type Cell = {
  /** 1-based. */
  row: number
  col: number
  /** Text, a number (dates are serial days), or nothing. */
  value: string | number | null
  /** The number format's code ("d", "dddd", "General"). */
  format: string
  /** The fill color, "RRGGBB"; null for no fill. */
  fill: string | null
}

export type Merge = { top: number; left: number; bottom: number; right: number }

export type Sheet = {
  name: string
  /** By cellKey(row, col). Empty cells with a style are kept (their fill). */
  cells: Map<string, Cell>
  merges: Array<Merge>
  maxRow: number
  maxCol: number
}

export type Workbook = {
  sheets: Array<Sheet>
  /** Dates count from 1904 (old Mac Excel), not 1900. */
  date1904: boolean
}

/** A file that isn't a spreadsheet, or one too big to open here. */
export class SpreadsheetError extends Error {
  kind: 'not-xlsx' | 'too-big'
  constructor(kind: 'not-xlsx' | 'too-big') {
    super(kind)
    this.kind = kind
  }
}

// One part of the ZIP, unpacked (a zip bomb guard).
const MAX_PART_BYTES = 30 * 1024 * 1024
const MAX_SHEETS = 60

export function cellKey(row: number, col: number) {
  return `${row}:${col}`
}

/** True for a ZIP holding a workbook (an .xlsx, not a Google Calendar export). */
export async function isXlsx(bytes: Uint8Array) {
  if (bytes[0] !== 0x50 || bytes[1] !== 0x4b) return false
  const { unzipSync } = await import('fflate')
  try {
    let found = false
    unzipSync(bytes, {
      filter: (f) => {
        if (f.name === 'xl/workbook.xml') found = true
        return false
      },
    })
    return found
  } catch {
    return false
  }
}

export async function readWorkbook(bytes: Uint8Array): Promise<Workbook> {
  const { unzipSync } = await import('fflate')
  let parts: Partial<Record<string, Uint8Array>>
  const skipped = { tooBig: false }
  try {
    parts = unzipSync(bytes, {
      filter: (f) => {
        if (!/^xl\/.*\.(xml|rels)$/.test(f.name)) return false
        if (f.originalSize > MAX_PART_BYTES) {
          skipped.tooBig = true
          return false
        }
        return true
      },
    })
  } catch {
    throw new SpreadsheetError('not-xlsx')
  }
  if (skipped.tooBig) throw new SpreadsheetError('too-big')
  const decoder = new TextDecoder('utf-8')
  const part = (name: string) => {
    const b = parts[name]
    return b ? decoder.decode(b) : null
  }

  const workbook = part('xl/workbook.xml')
  if (!workbook) throw new SpreadsheetError('not-xlsx')
  const rels = relsOf(part('xl/_rels/workbook.xml.rels') ?? '')
  const strings = sharedStrings(part('xl/sharedStrings.xml') ?? '')
  const theme = themeColors(part('xl/theme/theme1.xml') ?? '')
  const styles = readStyles(part('xl/styles.xml') ?? '', theme)
  const date1904 = /<(?:\w+:)?workbookPr\b[^>]*\bdate1904="(?:1|true)"/.test(
    workbook,
  )

  const sheets: Array<Sheet> = []
  for (const tag of tags(workbook, 'sheet')) {
    if (sheets.length >= MAX_SHEETS) break
    const a = attrs(tag.attrs)
    // Hidden sheets are the template's workings, not the calendar.
    if (a.state === 'hidden' || a.state === 'veryHidden') continue
    const rid =
      a['r:id'] ?? Object.entries(a).find(([k]) => k.endsWith(':id'))?.[1]
    const target = rid ? rels.get(rid) : undefined
    if (!target) continue
    const xml = part(partPath(target))
    if (!xml) continue
    sheets.push(readSheet(decodeXml(a.name ?? 'Sheet'), xml, strings, styles))
  }
  return { sheets, date1904 }
}

/** A cell's serial date as "YYYY-MM-DD" (whole days only). */
export function serialToDate(serial: number, date1904: boolean) {
  const epoch = date1904 ? Date.UTC(1904, 0, 1) : Date.UTC(1899, 11, 30)
  return new Date(epoch + Math.floor(serial) * 86_400_000)
    .toISOString()
    .slice(0, 10)
}

// ---------- Parts ----------

function partPath(target: string) {
  const t = target.replace(/^\//, '')
  return t.startsWith('xl/') ? t : `xl/${t.replace(/^\.\//, '')}`
}

function relsOf(xml: string) {
  const out = new Map<string, string>()
  for (const tag of tags(xml, 'Relationship')) {
    const a = attrs(tag.attrs)
    if (a.Id && a.Target) out.set(a.Id, decodeXml(a.Target))
  }
  return out
}

/** Each shared string's text (rich-text runs joined, phonetic hints left out). */
function sharedStrings(xml: string) {
  const out: Array<string> = []
  for (const si of tags(xml, 'si')) out.push(textOf(si.body))
  return out
}

function textOf(body: string) {
  const plain = body.replace(/<(?:\w+:)?rPh\b[\s\S]*?<\/(?:\w+:)?rPh>/g, '')
  let s = ''
  for (const t of tags(plain, 't')) s += decodeXml(t.body)
  return s
}

type Styles = {
  /** By the cell's s="" index. */
  xfs: Array<{ format: string; fill: string | null }>
}

const BUILTIN_FORMATS: Partial<Record<number, string>> = {
  0: 'General',
  14: 'm/d/yyyy',
  15: 'd-mmm-yy',
  16: 'd-mmm',
  17: 'mmm-yy',
  18: 'h:mm AM/PM',
  19: 'h:mm:ss AM/PM',
  20: 'h:mm',
  21: 'h:mm:ss',
  22: 'm/d/yyyy h:mm',
}

function readStyles(xml: string, theme: Array<string>): Styles {
  const formats = new Map<number, string>()
  for (const t of tags(xml, 'numFmt')) {
    const a = attrs(t.attrs)
    if (a.numFmtId)
      formats.set(Number(a.numFmtId), decodeXml(a.formatCode ?? ''))
  }
  const palette = [...INDEXED]
  const custom = section(xml, 'indexedColors')
  if (custom) {
    tags(custom, 'rgbColor').forEach((t, i) => {
      const rgb = attrs(t.attrs).rgb
      if (rgb) palette[i] = rgb.slice(-6).toUpperCase()
    })
  }
  const fills: Array<string | null> = []
  for (const f of tags(section(xml, 'fills') ?? '', 'fill')) {
    const pattern = tags(f.body, 'patternFill').at(0)
    if (!pattern) {
      fills.push(null)
      continue
    }
    const type = attrs(pattern.attrs).patternType ?? ''
    const fg = tags(pattern.body, 'fgColor').at(0)
    fills.push(
      type === '' || type === 'none' || type === 'gray125' || !fg
        ? null
        : colorOf(attrs(fg.attrs), palette, theme),
    )
  }
  const xfs: Styles['xfs'] = []
  for (const xf of tags(section(xml, 'cellXfs') ?? '', 'xf')) {
    const a = attrs(xf.attrs)
    const id = Number(a.numFmtId ?? 0)
    xfs.push({
      format: formats.get(id) ?? BUILTIN_FORMATS[id] ?? '',
      fill: fills.at(Number(a.fillId ?? 0)) ?? null,
    })
  }
  return { xfs }
}

function colorOf(
  a: Attrs,
  palette: Array<string>,
  theme: Array<string>,
): string | null {
  let rgb: string | undefined
  if (a.rgb) rgb = a.rgb.slice(-6).toUpperCase()
  else if (a.indexed !== undefined) rgb = palette.at(Number(a.indexed))
  else if (a.theme !== undefined) rgb = theme.at(Number(a.theme))
  if (!rgb || !/^[0-9A-F]{6}$/.test(rgb)) return null
  const tint = Number(a.tint ?? 0)
  return tint ? withTint(rgb, tint) : rgb
}

/** The theme's colors in the order cells refer to them (light 1 first). */
function themeColors(xml: string) {
  const scheme = section(xml, 'clrScheme')
  if (!scheme) return []
  const named = new Map<string, string>()
  for (const name of [
    'dk1',
    'lt1',
    'dk2',
    'lt2',
    'accent1',
    'accent2',
    'accent3',
    'accent4',
    'accent5',
    'accent6',
    'hlink',
    'folHlink',
  ]) {
    const body = section(scheme, name)
    if (!body) continue
    const srgb = tags(body, 'srgbClr').at(0)
    const sys = tags(body, 'sysClr').at(0)
    const val = srgb
      ? attrs(srgb.attrs).val
      : sys
        ? attrs(sys.attrs).lastClr
        : undefined
    if (val) named.set(name, val.toUpperCase())
  }
  // Cells number them light 1, dark 1, light 2, dark 2, then the accents.
  return [
    'lt1',
    'dk1',
    'lt2',
    'dk2',
    'accent1',
    'accent2',
    'accent3',
    'accent4',
    'accent5',
    'accent6',
    'hlink',
    'folHlink',
  ].map((n) => named.get(n) ?? '')
}

/** Excel's tint: toward white (above 0) or black (below), in lightness. */
function withTint(rgb: string, tint: number) {
  const n = Number.parseInt(rgb, 16)
  let r = ((n >> 16) & 255) / 255
  let g = ((n >> 8) & 255) / 255
  let b = (n & 255) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h = 0
  let s = 0
  let l = (max + min) / 2
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    h =
      max === r
        ? ((g - b) / d + (g < b ? 6 : 0)) / 6
        : max === g
          ? ((b - r) / d + 2) / 6
          : ((r - g) / d + 4) / 6
  }
  l = tint < 0 ? l * (1 + tint) : l * (1 - tint) + tint
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  const channel = (t: number) => {
    if (t < 0) t += 1
    if (t > 1) t -= 1
    if (t < 1 / 6) return p + (q - p) * 6 * t
    if (t < 1 / 2) return q
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
    return p
  }
  if (s === 0) r = g = b = l
  else {
    r = channel(h + 1 / 3)
    g = channel(h)
    b = channel(h - 1 / 3)
  }
  const hex = (v: number) =>
    Math.round(Math.min(1, Math.max(0, v)) * 255)
      .toString(16)
      .padStart(2, '0')
  return `${hex(r)}${hex(g)}${hex(b)}`.toUpperCase()
}

function readSheet(
  name: string,
  xml: string,
  strings: Array<string>,
  styles: Styles,
): Sheet {
  const cells = new Map<string, Cell>()
  let maxRow = 0
  let maxCol = 0
  const data = section(xml, 'sheetData') ?? ''
  let rowNo = 0
  for (const row of tags(data, 'row')) {
    const ra = attrs(row.attrs)
    rowNo = ra.r ? Number(ra.r) : rowNo + 1
    let colNo = 0
    for (const c of tags(row.body, 'c')) {
      const a = attrs(c.attrs)
      const ref = a.r ? parseRef(a.r) : null
      colNo = ref ? ref.col : colNo + 1
      const r = ref ? ref.row : rowNo
      const style = styles.xfs.at(Number(a.s ?? 0)) ?? {
        format: '',
        fill: null,
      }
      const v = section(c.body, 'v') ?? undefined
      let value: Cell['value'] = null
      switch (a.t) {
        case 's':
          value = v === undefined ? null : (strings.at(Number(v)) ?? null)
          break
        case 'inlineStr':
          value = textOf(section(c.body, 'is') ?? '')
          break
        case 'str':
        case 'e':
          value = v === undefined ? null : decodeXml(v)
          break
        case 'b':
          value = v === '1' ? 'TRUE' : v === '0' ? 'FALSE' : null
          break
        default:
          value = v === undefined || v.trim() === '' ? null : Number(v)
          if (typeof value === 'number' && !Number.isFinite(value)) value = null
      }
      if (value === '') value = null
      cells.set(cellKey(r, colNo), {
        row: r,
        col: colNo,
        value,
        format: style.format,
        fill: style.fill,
      })
      maxRow = Math.max(maxRow, r)
      maxCol = Math.max(maxCol, colNo)
    }
  }
  const merges: Array<Merge> = []
  for (const m of tags(section(xml, 'mergeCells') ?? '', 'mergeCell')) {
    const ref = attrs(m.attrs).ref
    const [from, to] = (ref ?? '').split(':')
    const a = from ? parseRef(from) : null
    const b = to ? parseRef(to) : a
    if (a && b) {
      merges.push({
        top: Math.min(a.row, b.row),
        left: Math.min(a.col, b.col),
        bottom: Math.max(a.row, b.row),
        right: Math.max(a.col, b.col),
      })
    }
  }
  return { name, cells, merges, maxRow, maxCol }
}

/** "AB12" → row 12, column 28. */
function parseRef(ref: string) {
  const m = /^\$?([A-Z]{1,3})\$?(\d+)$/i.exec(ref)
  if (!m) return null
  let col = 0
  for (const ch of m[1].toUpperCase()) col = col * 26 + ch.charCodeAt(0) - 64
  return { row: Number(m[2]), col }
}

// ---------- XML ----------

type Tag = { attrs: string; body: string }

/**
 * Every <name …>…</name> (or <name …/>) in xml, any namespace prefix. Not
 * nested in itself, which holds for the parts read here.
 */
function tags(xml: string, name: string): Array<Tag> {
  const out: Array<Tag> = []
  const re = new RegExp(
    `<(?:\\w+:)?${name}(?=[\\s/>])([^>]*?)(\\/>|>([\\s\\S]*?)<\\/(?:\\w+:)?${name}>)`,
    'g',
  )
  for (const m of xml.matchAll(re))
    out.push({ attrs: m[1], body: m.at(3) ?? '' })
  return out
}

/** The inside of the first <name>…</name>, or null without one. */
function section(xml: string, name: string): string | null {
  const t = tags(xml, name).at(0)
  return t ? t.body : null
}

type Attrs = Partial<Record<string, string>>

function attrs(s: string): Attrs {
  const out: Attrs = {}
  for (const m of s.matchAll(/([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) {
    out[m[1]] = m.at(2) ?? m.at(3) ?? ''
  }
  return out
}

function decodeXml(s: string) {
  return (
    s
      .replace(
        /&(?:#x([0-9a-f]+)|#(\d+)|(lt|gt|amp|quot|apos));/gi,
        (_, hex, dec, named) => {
          if (hex) return String.fromCodePoint(Number.parseInt(hex, 16))
          if (dec) return String.fromCodePoint(Number(dec))
          return { lt: '<', gt: '>', amp: '&', quot: '"', apos: "'" }[
            (named as string).toLowerCase() as 'lt'
          ]
        },
      )
      // Excel's escape for characters XML can't hold ("_x000D_").
      .replace(/_x([0-9a-f]{4})_/gi, (_, hex) =>
        String.fromCharCode(Number.parseInt(hex, 16)),
      )
  )
}

// Excel's default palette, for fills given by index.
const INDEXED =
  '000000 FFFFFF FF0000 00FF00 0000FF FFFF00 FF00FF 00FFFF 000000 FFFFFF FF0000 00FF00 0000FF FFFF00 FF00FF 00FFFF 800000 008000 000080 808000 800080 008080 C0C0C0 808080 9999FF 993366 FFFFCC CCFFFF 660066 FF8080 0066CC CCCCFF 000080 FF00FF FFFF00 00FFFF 800080 800000 008080 0000FF 00CCFF CCFFFF CCFFCC FFFF99 99CCFF FF99CC CC99FF FFCC99 3366FF 33CCCC 99CC00 FFCC00 FF9900 FF6600 666699 969696 003366 339966 003300 333300 993300 993366 333399 333333'.split(
    ' ',
  )
