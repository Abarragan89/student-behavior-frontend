import { useId, useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ChevronLeft, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import { FileDropBox } from '#/components/file-drop-box'
import { OfflineNote } from '#/components/offline-note'
import { ResponsiveDialog } from '#/components/responsive-dialogue'
import { ApiError } from '#/lib/api'
import { useOnline } from '#/lib/online'
import {
  MAX_STAFF,
  cleanEmail,
  displayName,
  importStaff,
  orgUnitName,
  orgUnitsOf,
  parsePastedStaff,
  parseStaffFile,
  staffQueryOptions,
} from '#/lib/staff'
import type {
  GroupBy,
  ParsedFile,
  ParsedPerson,
  StaffDirectory,
} from '#/lib/staff'

/**
 * Bring the staff in: a Google Admin "Download users" CSV or JSON, or pasted
 * emails. Read here, in the browser; the org units that look like students
 * start unchecked, so student accounts don't land on the staff list.
 */
export function ImportDialog({
  open,
  onOpenChange,
  directory,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  directory: StaffDirectory
}) {
  return (
    <ResponsiveDialog
      isOpen={open}
      setIsOpen={onOpenChange}
      title="Import your staff"
      description="From Google Admin, or paste a list of emails."
      showDescription
      className="sm:max-w-xl"
    >
      {open && (
        <ImportFlow directory={directory} onDone={() => onOpenChange(false)} />
      )}
    </ResponsiveDialog>
  )
}

type Source =
  | {
      kind: 'file'
      name: string
      people: Array<ParsedPerson>
      noEmail: number
      /** The file has org units (so students can be left out). */
      orgUnits: boolean
    }
  | { kind: 'paste'; people: Array<ParsedPerson> }

function ImportFlow({
  directory,
  onDone,
}: {
  directory: StaffDirectory
  onDone: () => void
}) {
  const [source, setSource] = useState<Source | null>(null)
  const [step, setStep] = useState<'source' | 'units' | 'preview'>('source')
  const units = useMemo(
    () => (source?.kind === 'file' ? orgUnitsOf(source.people) : []),
    [source],
  )
  const [unchecked, setUnchecked] = useState<Set<string>>(new Set())
  const hasDepartments =
    source?.kind === 'file' && source.people.some((p) => p.department)
  const [groupBy, setGroupBy] = useState<GroupBy>('')

  function chooseSource(next: Source) {
    setSource(next)
    if (next.kind === 'file') {
      const found = orgUnitsOf(next.people)
      setUnchecked(new Set(found.filter((u) => u.students).map((u) => u.path)))
      setGroupBy(found.filter((u) => !u.students).length > 1 ? 'org_unit' : '')
      setStep(found.length > 1 ? 'units' : 'preview')
    } else {
      setGroupBy('')
      setStep('preview')
    }
  }

  const chosen = useMemo(() => {
    if (!source) return []
    if (source.kind === 'paste') return source.people
    return source.people.filter(
      (p) => !p.suspended && !unchecked.has(p.org_unit || '/'),
    )
  }, [source, unchecked])

  if (step === 'source' || !source)
    return <SourceStep onChoose={chooseSource} />

  const suspended =
    source.kind === 'file' ? source.people.filter((p) => p.suspended).length : 0

  if (step === 'units') {
    return (
      <div className="flex flex-col gap-5">
        <BackButton onClick={() => setStep('source')} />
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-base font-bold">Who to bring in</legend>
          <p className="-mt-1 text-sm text-muted-foreground">
            Org units from Google. Units that look like students start
            unchecked: only add staff.
          </p>
          <ul className="flex max-h-72 flex-col gap-1.5 overflow-y-auto">
            {units.map((u) => (
              <li key={u.path}>
                <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border-2 border-border bg-card px-3 py-1.5 font-bold transition-colors has-checked:border-primary has-checked:bg-primary/10 motion-reduce:transition-none">
                  <input
                    type="checkbox"
                    checked={!unchecked.has(u.path)}
                    onChange={(e) => {
                      const next = new Set(unchecked)
                      if (e.target.checked) next.delete(u.path)
                      else next.add(u.path)
                      setUnchecked(next)
                    }}
                    className="size-5 shrink-0 accent-primary"
                  />
                  <span className="min-w-0 flex-1 truncate">{u.path}</span>
                  {u.students && (
                    <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-muted-foreground">
                      <TriangleAlert className="size-3.5" />
                      Students?
                    </span>
                  )}
                  <span className="shrink-0 text-sm font-medium text-muted-foreground tabular-nums">
                    {u.count}
                  </span>
                </label>
              </li>
            ))}
          </ul>
          {suspended > 0 && (
            <p className="text-sm text-muted-foreground">
              {suspended} suspended{' '}
              {suspended === 1 ? 'account is' : 'accounts are'} left out.
            </p>
          )}
        </fieldset>
        <GroupChoice
          value={groupBy}
          onChange={setGroupBy}
          hasDepartments={hasDepartments}
        />
        <Button
          onClick={() => setStep('preview')}
          disabled={chosen.length === 0}
          className="h-12 rounded-lg text-base font-bold"
        >
          Next: check {chosen.length}{' '}
          {chosen.length === 1 ? 'person' : 'people'}
        </Button>
      </div>
    )
  }

  return (
    <PreviewStep
      people={chosen}
      directory={directory}
      groupBy={groupBy}
      noEmail={source.kind === 'file' ? source.noEmail : 0}
      noOrgUnits={source.kind === 'file' && !source.orgUnits}
      onBack={() =>
        setStep(source.kind === 'file' && units.length > 1 ? 'units' : 'source')
      }
      onDone={onDone}
    />
  )
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <Button
      type="button"
      variant="link"
      onClick={onClick}
      className="h-auto self-start px-0 font-bold"
    >
      <ChevronLeft />
      Back
    </Button>
  )
}

/** Step 1: Google's file (dropped or chosen), or pasted emails. */
function SourceStep({ onChoose }: { onChoose: (s: Source) => void }) {
  const id = useId()
  const [problem, setProblem] = useState<string | null>(null)
  const [pasted, setPasted] = useState('')
  const pastedPeople = useMemo(() => parsePastedStaff(pasted), [pasted])

  async function readFile(file: File) {
    setProblem(null)
    if (/\.(xlsx?|numbers|ods)$/i.test(file.name)) {
      setProblem(
        'That’s a spreadsheet file. In Google Admin, download users as CSV or JSON.',
      )
      return
    }
    if (file.size > 20 * 1024 * 1024) {
      setProblem(
        'That file is too big. Download just your staff from Google Admin.',
      )
      return
    }
    let parsed: ParsedFile
    try {
      parsed = parseStaffFile(await file.text())
    } catch {
      setProblem(
        'Couldn’t read that file. Download users from Google Admin again, as CSV or JSON.',
      )
      return
    }
    if (parsed.people.length + parsed.noEmail === 0) {
      setProblem('No one is listed in that file.')
      return
    }
    if (!parsed.hasEmailColumn) {
      setProblem(
        'No email column in that file. Download users from Google Admin as CSV or JSON.',
      )
      return
    }
    if (parsed.people.length === 0) {
      setProblem('No email addresses in that file.')
      return
    }
    onChoose({
      kind: 'file',
      name: file.name,
      people: parsed.people,
      noEmail: parsed.noEmail,
      orgUnits: parsed.hasOrgUnits,
    })
  }

  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-col gap-2">
        <h3 className="text-base font-bold">From Google Admin</h3>
        <ol className="list-decimal pl-5 text-sm text-muted-foreground">
          <li>In Google Admin, open Directory → Users.</li>
          <li>
            Click Download users. Choose All user info columns, then CSV or
            JSON.
          </li>
          <li>Add that file below.</li>
        </ol>
        <FileDropBox
          accept=".csv,.json,text/csv,application/json"
          kinds="CSV or JSON"
          onFile={(file) => void readFile(file)}
          describedBy={`${id}-file-note`}
        />
        {problem && (
          <p role="alert" className="text-sm font-bold text-destructive">
            {problem}
          </p>
        )}
        <p id={`${id}-file-note`} className="text-xs text-muted-foreground">
          The file is read on this device. Only emails, names, titles,
          departments and org units are sent.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <label htmlFor={`${id}-paste`} className="text-base font-bold">
          Or paste emails
        </label>
        <Textarea
          id={`${id}-paste`}
          value={pasted}
          onChange={(e) => setPasted(e.target.value)}
          rows={4}
          placeholder={
            'ana@school.org, ben@school.org\nCara Kim <cara@school.org>'
          }
          className="rounded-lg border-2 border-border bg-card text-base"
        />
        <Button
          type="button"
          variant="outline"
          disabled={pastedPeople.length === 0}
          onClick={() => onChoose({ kind: 'paste', people: pastedPeople })}
          className="h-11 self-start rounded-lg border-2 px-4 font-bold"
        >
          {pastedPeople.length > 0
            ? `Use ${pastedPeople.length} ${pastedPeople.length === 1 ? 'email' : 'emails'}`
            : 'Use these emails'}
        </Button>
      </section>
    </div>
  )
}

/** Make a group per org unit, per department, or none. */
function GroupChoice({
  value,
  onChange,
  hasDepartments,
}: {
  value: GroupBy
  onChange: (v: GroupBy) => void
  hasDepartments: boolean
}) {
  const id = useId()
  const options: Array<{ value: GroupBy; label: string }> = [
    { value: 'org_unit', label: 'A group for each org unit' },
    ...(hasDepartments
      ? [
          {
            value: 'department' as GroupBy,
            label: 'A group for each department',
          },
        ]
      : []),
    { value: '', label: 'No groups' },
  ]
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-base font-bold">Groups</legend>
      <div className="flex flex-col gap-1.5">
        {options.map((o) => (
          <label
            key={o.value}
            className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border-2 border-border bg-card px-3 py-1.5 font-bold transition-colors has-checked:border-primary has-checked:bg-primary/10 motion-reduce:transition-none"
          >
            <input
              type="radio"
              name={`${id}-groups`}
              checked={value === o.value}
              onChange={() => onChange(o.value)}
              className="size-4 shrink-0 accent-primary"
            />
            {o.label}
          </label>
        ))}
      </div>
    </fieldset>
  )
}

/** The last step: who's new, who's updated, who's skipped; then add. */
function PreviewStep({
  people,
  directory,
  groupBy,
  noEmail,
  noOrgUnits,
  onBack,
  onDone,
}: {
  people: Array<ParsedPerson>
  directory: StaffDirectory
  groupBy: GroupBy
  noEmail: number
  /** A file without org units: students in it couldn't be left out. */
  noOrgUnits: boolean
  onBack: () => void
  onDone: () => void
}) {
  const online = useOnline()
  const queryClient = useQueryClient()
  const existing = useMemo(
    () => new Set(directory.people.map((p) => p.email.toLowerCase())),
    [directory],
  )
  const summary = useMemo(() => {
    const seen = new Set<string>()
    const rows: Array<ParsedPerson> = []
    let invalid = 0
    let twice = 0
    for (const p of people) {
      const email = cleanEmail(p.email)
      if (!email) {
        invalid++
        continue
      }
      if (seen.has(email)) {
        twice++
        continue
      }
      seen.add(email)
      rows.push({ ...p, email })
    }
    const fresh = rows.filter((p) => !existing.has(p.email))
    return { rows, fresh, updates: rows.length - fresh.length, invalid, twice }
  }, [people, existing])
  const groupNames = useMemo(() => {
    if (!groupBy) return []
    const names = new Set(
      summary.rows
        .map((p) =>
          groupBy === 'org_unit' ? orgUnitName(p.org_unit ?? '') : p.department,
        )
        .filter(Boolean),
    )
    return [...names].sort()
  }, [summary.rows, groupBy])
  const tooMany = directory.people.length + summary.fresh.length > MAX_STAFF

  const run = useMutation({
    mutationFn: () =>
      importStaff(
        summary.rows.map(({ suspended: _s, ...p }) => p),
        groupBy,
      ),
    onSuccess: (res) => {
      void queryClient.invalidateQueries({
        queryKey: staffQueryOptions.queryKey,
      })
      onDone()
      const parts = [
        res.added > 0 && `${res.added} added`,
        res.updated > 0 && `${res.updated} updated`,
        res.groups > 0 &&
          `${res.groups} ${res.groups === 1 ? 'group' : 'groups'}`,
      ].filter(Boolean)
      toast.success('Your staff list is updated', {
        description: parts.join(' · ') || 'Nothing changed.',
      })
    },
    onError: (error) => {
      console.error('Importing staff failed:', error)
      toast.error(
        error instanceof ApiError && error.reason === 'too_many_staff'
          ? `A staff list holds up to ${MAX_STAFF} people.`
          : error instanceof ApiError && error.reason === 'too_many_groups'
            ? 'That would make too many groups. Choose No groups.'
            : 'Couldn’t import. Try again.',
      )
    },
  })
  const busy = run.isPending
  const skipped = summary.invalid + summary.twice + noEmail

  return (
    <div className="flex flex-col gap-5">
      <BackButton onClick={onBack} />
      <dl className="grid grid-cols-3 gap-2 text-center">
        {[
          ['New', summary.fresh.length],
          ['Already on your list', summary.updates],
          ['Skipped', skipped],
        ].map(([label, n]) => (
          <div key={label} className="rounded-lg bg-muted px-2 py-3">
            <dd className="text-2xl font-bold tabular-nums">{n}</dd>
            <dt className="text-xs text-muted-foreground">{label}</dt>
          </div>
        ))}
      </dl>
      {skipped > 0 && (
        <p className="text-sm text-muted-foreground">
          Skipped:{' '}
          {[
            noEmail > 0 && `${noEmail} with no email`,
            summary.invalid > 0 &&
              `${summary.invalid} that aren’t email addresses`,
            summary.twice > 0 && `${summary.twice} listed twice`,
          ]
            .filter(Boolean)
            .join(', ')}
          .
        </p>
      )}
      {summary.fresh.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <h3 className="text-sm font-bold">New</h3>
          <ul className="max-h-40 overflow-y-auto rounded-lg border-2 border-border p-2 text-sm">
            {summary.fresh.slice(0, 50).map((p) => (
              <li key={p.email} className="truncate py-0.5">
                <span className="font-bold">{displayName(p)}</span>
                {(p.first_name || p.last_name) && (
                  <span className="text-muted-foreground"> · {p.email}</span>
                )}
              </li>
            ))}
            {summary.fresh.length > 50 && (
              <li className="py-0.5 text-muted-foreground">
                and {summary.fresh.length - 50} more
              </li>
            )}
          </ul>
        </div>
      )}
      {noOrgUnits && (
        <p className="flex gap-2 rounded-lg bg-muted px-3 py-2 text-sm">
          <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
          <span>
            This file has no org units, so student accounts can’t be left out.
            If your students have school Google accounts, download again with
            All user info columns.
          </span>
        </p>
      )}
      {groupNames.length > 0 && (
        <p className="text-sm">
          <span className="font-bold">Groups:</span> {groupNames.join(', ')}
        </p>
      )}
      {summary.updates > 0 && (
        <p className="text-sm text-muted-foreground">
          People already on your list get the new names and titles. Blank
          details don’t erase anything.
        </p>
      )}
      {tooMany && (
        <p role="alert" className="text-sm font-bold text-destructive">
          A staff list holds up to {MAX_STAFF} people. Choose fewer org units.
        </p>
      )}
      <OfflineNote action="import your staff" />
      <Button
        onClick={() => run.mutate()}
        disabled={!online || busy || summary.rows.length === 0 || tooMany}
        aria-busy={busy}
        className="h-12 rounded-lg text-base font-bold"
      >
        {busy && <Spinner aria-hidden className="size-4" />}
        {summary.fresh.length > 0
          ? `Add ${summary.fresh.length} ${summary.fresh.length === 1 ? 'person' : 'people'}`
          : `Update ${summary.updates} ${summary.updates === 1 ? 'person' : 'people'}`}
      </Button>
    </div>
  )
}
