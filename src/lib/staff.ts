import { queryOptions } from '@tanstack/react-query'
import Papa from 'papaparse'
import { apiDelete, apiGet, apiPatch, apiPost } from './api'

// A school's staff list (Staff tab): everyone the administrator manages, by
// email, whether or not they use TeachForFree. Imported from a Google Admin
// CSV or JSON file (read here, in the browser: only email, names, title,
// department and org unit are sent), pasted, or added one at a time. Groups
// are named sets of them, for events. Every call is the administrator's own
// ({ space: null }). Never saved on the device: it's people's emails.

export type StaffPerson = {
  id: string
  email: string
  first_name: string
  last_name: string
  title: string
  department: string
  org_unit: string
  source: 'import' | 'manual' | 'joined'
  /** They followed "Stop these emails" in a reminder. */
  opted_out: boolean
  /** They joined the school in TeachForFree (and share their classes). */
  uses_app: boolean
  is_admin: boolean
  created_at: string
}

export type StaffGroup = { id: string; name: string; staff_ids: Array<string> }

export type StaffDirectory = {
  people: Array<StaffPerson>
  groups: Array<StaffGroup>
}

/** Matches the server's limit. */
export const MAX_STAFF = 5000

export const staffQueryOptions = queryOptions({
  queryKey: ['school-staff'],
  queryFn: () => apiGet<StaffDirectory>('/schools/mine/staff', { space: null }),
  staleTime: 0,
})

/** "Ana Ruiz", or their email when the list has no name. */
export function displayName(
  p: Pick<StaffPerson, 'first_name' | 'last_name' | 'email'>,
) {
  return `${p.first_name} ${p.last_name}`.trim() || p.email
}

/** "AR", or the email's first letter. */
export function staffInitials(
  p: Pick<StaffPerson, 'first_name' | 'last_name' | 'email'>,
) {
  const i = `${p.first_name.charAt(0)}${p.last_name.charAt(0)}`.trim()
  return (i || p.email.charAt(0)).toUpperCase()
}

// ---------- Changes ----------

export type PersonInput = {
  email: string
  first_name: string
  last_name: string
  title: string
  department: string
  org_unit?: string
}

export function addPerson(p: PersonInput) {
  return apiPost<StaffPerson>('/schools/mine/staff', p, { space: null })
}

export function updatePerson(id: string, p: Partial<PersonInput>) {
  return apiPatch<StaffPerson>(
    `/schools/mine/staff/${encodeURIComponent(id)}`,
    p,
    { space: null },
  )
}

export function removePerson(id: string) {
  return apiDelete(`/schools/mine/staff/${encodeURIComponent(id)}`, {
    space: null,
  })
}

export type GroupBy = '' | 'org_unit' | 'department'

export type ImportResult = {
  added: number
  updated: number
  skipped: Array<{ email: string; reason: string }>
  groups: number
}

export function importStaff(people: Array<PersonInput>, groupBy: GroupBy) {
  return apiPost<ImportResult>(
    '/schools/mine/staff/import',
    { people, group_by: groupBy },
    // A whole school's list: give it longer than a normal call.
    { space: null, timeoutMs: 60_000 },
  )
}

export function createGroup(name: string, staffIds: Array<string>) {
  return apiPost<StaffGroup>(
    '/schools/mine/groups',
    { name, staff_ids: staffIds },
    { space: null },
  )
}

export function updateGroup(
  id: string,
  change: { name?: string; staff_ids?: Array<string> },
) {
  return apiPatch<StaffGroup>(
    `/schools/mine/groups/${encodeURIComponent(id)}`,
    change,
    { space: null },
  )
}

export function deleteGroup(id: string) {
  return apiDelete(`/schools/mine/groups/${encodeURIComponent(id)}`, {
    space: null,
  })
}

// ---------- Reading a Google Admin export, or a pasted list ----------

/** One person read from a file or paste, before it's sent. */
export type ParsedPerson = PersonInput & { suspended?: boolean }

/** A whole Google Admin export: everyone in it, and the org units it has. */
export type ParsedFile = {
  people: Array<ParsedPerson>
  /** Rows with no email column value at all. */
  noEmail: number
  /** False when no column looked like an email column. */
  hasEmailColumn: boolean
  /** False when the file has no org units (so students can't be spotted). */
  hasOrgUnits: boolean
}

const EMAIL = /[^\s<>,;"'()]+@[^\s<>,;"'()]+\.[^\s<>,;"'()]+/g

/** One row of a file, by lowercased column name. */
type Row = Partial<Record<string, string>>

/**
 * Reads Google Admin's "Download users" file, CSV or JSON (told apart by
 * what's in it), or any CSV with an email column. Throws when a JSON file
 * isn't a list of users.
 */
export function parseStaffFile(text: string): ParsedFile {
  // A byte-order mark in front of the first header would hide it.
  const clean = text.replace(/^\uFEFF/, '')
  return /^\s*[[{]/.test(clean) ? parseStaffJson(clean) : parseStaffCsv(clean)
}

/** A CSV with a header row. */
export function parseStaffCsv(text: string): ParsedFile {
  const parsed = Papa.parse<Row>(text, {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: (h) => h.trim().toLowerCase(),
  })
  return readPeople(parsed.meta.fields ?? [], parsed.data)
}

/**
 * Google Admin's JSON: { "users": [{ "Email Address [Required]": \u2026, \u2026 }] },
 * the same column names as its CSV. A bare list of users works too.
 */
export function parseStaffJson(text: string): ParsedFile {
  const data: unknown = JSON.parse(text)
  const list: unknown = Array.isArray(data)
    ? data
    : data && typeof data === 'object' && 'users' in data
      ? data.users
      : null
  if (!Array.isArray(list)) throw new Error('Not a list of users')
  const headers = new Set<string>()
  const rows: Array<Row> = []
  for (const item of list) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue
    const row: Row = {}
    for (const [key, value] of Object.entries(item)) {
      if (typeof value !== 'string' && typeof value !== 'number') continue
      const name = key.trim().toLowerCase()
      row[name] = String(value)
      headers.add(name)
    }
    rows.push(row)
  }
  return readPeople([...headers], rows)
}

/**
 * The people in a file's rows. Google's columns look like "Email Address
 * [Required]", "First Name [Required]", "Org Unit Path [Required]", "Status
 * [READ ONLY]", "Employee Title", "Department". Only the columns the staff
 * list keeps are read; passwords and the rest are never touched.
 */
function readPeople(headers: Array<string>, rows: Array<Row>): ParsedFile {
  const find = (...names: Array<string>) =>
    headers.find((h) => names.some((n) => h === n || h.startsWith(`${n} [`))) ??
    headers.find((h) => names.some((n) => h.startsWith(n)))
  const emailCol = find('email address', 'primary email', 'email', 'e-mail')
  const firstCol = find('first name', 'given name', 'first')
  const lastCol = find('last name', 'family name', 'surname', 'last')
  const nameCol = find('full name', 'name')
  const orgCol = find('org unit path', 'org unit', 'organizational unit')
  const titleCol = find('employee title', 'job title', 'title')
  const deptCol = find('department')
  const statusCol = find('status')

  const people: Array<ParsedPerson> = []
  let noEmail = 0
  for (const row of rows) {
    const cell = (col: string | undefined) =>
      (col ? (row[col] ?? '') : '').trim()
    const email = cell(emailCol)
    if (!email) {
      noEmail++
      continue
    }
    let first = cell(firstCol)
    let last = cell(lastCol)
    if (!first && !last) [first, last] = splitName(cell(nameCol))
    people.push({
      email,
      first_name: first,
      last_name: last,
      title: cell(titleCol),
      department: cell(deptCol),
      org_unit: cell(orgCol),
      suspended: /suspend|archiv/i.test(cell(statusCol)),
    })
  }
  return {
    people,
    noEmail,
    hasEmailColumn: !!emailCol,
    hasOrgUnits: !!orgCol,
  }
}

/**
 * Reads pasted emails: one per line, or separated by commas or semicolons,
 * with or without names ("Ana Ruiz <ana@school.org>", or a name and an
 * email in two spreadsheet columns).
 */
export function parsePastedStaff(text: string): Array<ParsedPerson> {
  const out: Array<ParsedPerson> = []
  for (const line of text.split(/\r?\n/)) {
    const emails = line.match(EMAIL) ?? []
    // A line with several emails: each between commas/semicolons has its own name.
    const parts = emails.length > 1 ? line.split(/[,;]/) : [line]
    for (const part of parts) {
      const email = part.match(EMAIL)?.[0]
      if (!email) continue
      const name = part
        .replace(email, ' ')
        .replace(/[<>"'\t,;]/g, ' ')
        .trim()
      const [first, last] = splitName(name)
      out.push({
        email,
        first_name: first,
        last_name: last,
        title: '',
        department: '',
      })
    }
  }
  return out
}

/** "Ana Ruiz Ortiz" → ["Ana", "Ruiz Ortiz"]. "Ruiz, Ana" → ["Ana", "Ruiz"]. */
function splitName(name: string): [string, string] {
  const clean = name.replace(/\s+/g, ' ').trim()
  if (!clean) return ['', '']
  const comma = clean.split(',')
  if (comma.length === 2) return [comma[1].trim(), comma[0].trim()]
  const space = clean.indexOf(' ')
  return space < 0
    ? [clean, '']
    : [clean.slice(0, space), clean.slice(space + 1)]
}

/** An org unit that's probably students: left unchecked on import. */
export function looksLikeStudents(orgUnit: string) {
  return /student|pupil|learner|alumni|graduat|class of/i.test(orgUnit)
}

/** The group an imported person would go in: the last part of the org unit. */
export function orgUnitName(orgUnit: string) {
  const parts = orgUnit.replace(/^\/+|\/+$/g, '').split('/')
  return parts[parts.length - 1] || ''
}

/** Org units in a file with how many people each has, by path. */
export function orgUnitsOf(people: Array<ParsedPerson>) {
  const counts = new Map<string, number>()
  for (const p of people) {
    if (p.suspended) continue
    const ou = p.org_unit || '/'
    counts.set(ou, (counts.get(ou) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([path, count]) => ({
      path,
      count,
      students: looksLikeStudents(path),
    }))
    .sort((a, b) => a.path.localeCompare(b.path))
}

/** A bare, plausible email address, lowercased; null if it isn't one. */
export function cleanEmail(email: string) {
  const e = email.trim().toLowerCase()
  return /^[^\s@<>,;"']+@[^\s@<>,;"']+\.[^\s@<>,;"']+$/.test(e) ? e : null
}
