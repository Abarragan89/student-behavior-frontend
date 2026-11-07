import { useId, useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { displayName } from '#/lib/staff'
import type { StaffPerson } from '#/lib/staff'

/** How many rows show at once; search narrows the rest. */
const SHOWN = 150

/** Whether a person matches a search: name, email, title or department. */
export function matchesSearch(p: StaffPerson, q: string) {
  if (!q) return true
  const hay =
    `${p.first_name} ${p.last_name} ${p.email} ${p.title} ${p.department}`.toLowerCase()
  return q
    .toLowerCase()
    .split(/\s+/)
    .every((word) => hay.includes(word))
}

/**
 * A searchable checkbox list of the staff: for a group's people, and for
 * who's invited to an event. Long lists show the first matches; searching
 * finds anyone.
 */
export function PeopleChecklist({
  people,
  selected,
  onChange,
  disabled = false,
  label = 'People',
}: {
  people: Array<StaffPerson>
  selected: Set<string>
  onChange: (next: Set<string>) => void
  disabled?: boolean
  label?: string
}) {
  const id = useId()
  const [query, setQuery] = useState('')
  const matches = useMemo(
    () => people.filter((p) => matchesSearch(p, query.trim())),
    [people, query],
  )
  const shown = matches.slice(0, SHOWN)
  const allShownPicked =
    shown.length > 0 && shown.every((p) => selected.has(p.id))

  function toggle(personId: string, on: boolean) {
    const next = new Set(selected)
    if (on) next.add(personId)
    else next.delete(personId)
    onChange(next)
  }

  return (
    <fieldset disabled={disabled} className="flex min-w-0 flex-col gap-2">
      <legend className="mb-1 text-base font-bold">
        {label}{' '}
        <span className="font-normal text-muted-foreground">
          ({selected.size} picked)
        </span>
      </legend>
      <div className="relative">
        <Search
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          id={`${id}-search`}
          type="search"
          aria-label={`Search ${label.toLowerCase()}`}
          placeholder="Search by name, email or title"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="h-11 rounded-lg border-2 border-border bg-card pl-9 text-base"
        />
      </div>
      <div className="flex flex-wrap items-center gap-x-3 text-sm">
        <Button
          type="button"
          variant="link"
          className="h-auto px-0 font-bold"
          disabled={shown.length === 0}
          onClick={() => {
            const next = new Set(selected)
            for (const p of shown) {
              if (allShownPicked) next.delete(p.id)
              else next.add(p.id)
            }
            onChange(next)
          }}
        >
          {allShownPicked
            ? query
              ? 'Unpick these'
              : 'Unpick everyone shown'
            : query
              ? `Pick these ${shown.length}`
              : `Pick everyone shown`}
        </Button>
        {selected.size > 0 && (
          <Button
            type="button"
            variant="link"
            className="h-auto px-0 font-bold"
            onClick={() => onChange(new Set())}
          >
            Clear
          </Button>
        )}
      </div>
      <ul className="flex max-h-72 flex-col gap-1.5 overflow-y-auto rounded-lg border-2 border-border p-1.5">
        {shown.length === 0 && (
          <li className="px-2 py-3 text-sm text-muted-foreground">
            {people.length === 0
              ? 'Your staff list is empty.'
              : 'Nobody matches that search.'}
          </li>
        )}
        {shown.map((p) => (
          <li key={p.id}>
            <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-2.5 py-1.5 transition-colors has-checked:bg-primary/10 hover:bg-muted motion-reduce:transition-none">
              <input
                type="checkbox"
                checked={selected.has(p.id)}
                onChange={(e) => toggle(p.id, e.target.checked)}
                className="size-5 shrink-0 accent-primary"
              />
              <span className="flex min-w-0 flex-col">
                <span className="truncate font-bold">{displayName(p)}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {[p.title, p.email].filter(Boolean).join(' · ')}
                </span>
              </span>
            </label>
          </li>
        ))}
        {matches.length > shown.length && (
          <li className="px-2 py-2 text-xs text-muted-foreground">
            Showing {shown.length} of {matches.length}. Search to find someone
            else.
          </li>
        )}
      </ul>
    </fieldset>
  )
}
