import { useMemo, useState } from 'react'
import { Combobox } from '@base-ui/react/combobox'
import { Check, UsersRound, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { GroupDialog } from '#/components/staff/group-dialog'
import { matchesSearch } from '#/components/staff/people-checklist'
import { displayName } from '#/lib/staff'
import type { StaffDirectory } from '#/lib/staff'

/** Who an event's emails go to: everyone on staff, or groups and people. */
export type Audience = {
  everyone: boolean
  staffIds: Set<string>
  groupIds: Set<string>
}

type Option = {
  /** "everyone", "g:<id>" or "p:<id>". */
  value: string
  label: string
  /** The muted text after it: a count, or a person's title or email. */
  detail: string
  kind: 'everyone' | 'group' | 'person'
}
type OptionGroup = { value: string; items: Array<Option> }

const EVERYONE = 'everyone'
/** People listed at once; typing finds anyone. */
const SHOWN = 150

/**
 * Who gets an event's emails (it's added or changed, and its reminders): a
 * search box that finds everyone on staff, groups and people, each pick a
 * chip in the box. Picking Everyone clears the rest, and picking anyone
 * clears Everyone. People picked one by one can be saved as a group without
 * leaving the form.
 */
export function WhoPicker({
  id,
  directory,
  value,
  onChange,
  disabled,
}: {
  /** The search box's id, for its label. */
  id: string
  directory: StaffDirectory
  value: Audience
  onChange: (next: Audience) => void
  disabled: boolean
}) {
  const [query, setQuery] = useState('')
  const [saving, setSaving] = useState(false)

  const { groups, byValue } = useMemo(() => {
    const everyone: Option = {
      value: EVERYONE,
      label: 'Everyone on staff',
      detail: count(directory.people.length, 'person', 'people'),
      kind: 'everyone',
    }
    const groupOptions = directory.groups.map((g): Option => ({
      value: `g:${g.id}`,
      label: g.name,
      detail: count(g.staff_ids.length, 'person', 'people'),
      kind: 'group',
    }))
    const people = directory.people.map((p): Option => ({
      value: `p:${p.id}`,
      label: displayName(p),
      detail: p.title || (displayName(p) === p.email ? '' : p.email),
      kind: 'person',
    }))
    const all = [everyone, ...groupOptions, ...people]
    return {
      groups: [
        { value: '', items: [everyone] },
        { value: 'Groups', items: groupOptions },
        { value: 'People', items: people },
      ] satisfies Array<OptionGroup>,
      byValue: new Map(all.map((o) => [o.value, o])),
    }
  }, [directory])

  // Searched here (name, email, title, department; the first SHOWN people).
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const people = directory.people
      .filter((p) => matchesSearch(p, q))
      .slice(0, SHOWN)
      .map((p) => byValue.get(`p:${p.id}`)!)
    return groups
      .map((g) => ({
        ...g,
        items:
          g.value === 'People'
            ? people
            : g.items.filter((o) => o.label.toLowerCase().includes(q)),
      }))
      .filter((g) => g.items.length > 0)
  }, [query, groups, directory.people, byValue])

  const selected: Array<Option> = value.everyone
    ? [byValue.get(EVERYONE)!]
    : [
        ...[...value.groupIds].map((g) => byValue.get(`g:${g}`)),
        ...[...value.staffIds].map((p) => byValue.get(`p:${p}`)),
      ].filter((o): o is Option => o !== undefined)

  const pick = (next: Array<Option>) => {
    const had = new Set(selected.map((o) => o.value))
    const added = next.find((o) => !had.has(o.value))
    if (added?.kind === 'everyone') {
      onChange({ everyone: true, staffIds: new Set(), groupIds: new Set() })
      return
    }
    const rest = next.filter((o) => o.kind !== 'everyone')
    onChange({
      everyone: false,
      groupIds: new Set(
        rest.filter((o) => o.kind === 'group').map((o) => o.value.slice(2)),
      ),
      staffIds: new Set(
        rest.filter((o) => o.kind === 'person').map((o) => o.value.slice(2)),
      ),
    })
  }

  return (
    <div className="flex flex-col gap-2">
      <Combobox.Root
        multiple
        items={groups}
        filteredItems={filtered}
        value={selected}
        onValueChange={(next: Array<Option>) => pick(next)}
        inputValue={query}
        onInputValueChange={setQuery}
        isItemEqualToValue={(a: Option, b: Option) => a.value === b.value}
        // Stays open after a pick, to pick several.
        onOpenChange={(open, details) => {
          if (!open && details.reason === 'item-press') details.cancel()
        }}
        disabled={disabled}
      >
        <Combobox.InputGroup className="flex min-h-11 w-full cursor-text flex-wrap items-center rounded-lg border-2 border-border bg-card px-1.5 py-1 focus-within:ring-4 focus-within:ring-ring/50 has-disabled:opacity-50">
          <Combobox.Chips
            className="flex w-full flex-wrap items-center gap-1.5"
            aria-label={selected.length > 0 ? 'Gets emails' : undefined}
          >
            {selected.map((o) => (
              <Combobox.Chip
                key={o.value}
                aria-label={o.label}
                aria-description="Press Backspace or Delete to remove"
                className="flex min-h-8 max-w-full cursor-default items-center gap-1.5 rounded-full border-2 border-border bg-muted py-0.5 pr-0.5 pl-2.5 text-sm font-bold outline-none focus-within:border-primary data-highlighted:border-primary"
              >
                {o.kind !== 'person' && (
                  <UsersRound aria-hidden className="size-3.5 shrink-0" />
                )}
                <span className="min-w-0 truncate">{o.label}</span>
                <Combobox.ChipRemove
                  aria-label={`Remove ${o.label}`}
                  className="flex size-6 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-background hover:text-foreground"
                >
                  <X className="size-3.5" />
                </Combobox.ChipRemove>
              </Combobox.Chip>
            ))}
            <Combobox.Input
              id={id}
              placeholder={
                selected.length > 0 ? 'Add more' : 'Search people or groups'
              }
              aria-description={
                selected.length > 0
                  ? `${selected.length} picked. From the start of the box, press Left Arrow to reach them.`
                  : undefined
              }
              className="h-8 min-w-36 flex-1 bg-transparent px-1.5 text-base outline-none"
            />
          </Combobox.Chips>
        </Combobox.InputGroup>

        <Combobox.Portal>
          <Combobox.Positioner className="z-50 outline-none" sideOffset={4}>
            <Combobox.Popup className="max-h-[min(var(--available-height),20rem)] w-(--anchor-width) max-w-(--available-width) overflow-y-auto overscroll-contain rounded-lg border-2 border-border bg-popover p-1 text-popover-foreground shadow-md">
              <Combobox.Empty>
                <p className="px-2 py-3 text-sm text-muted-foreground">
                  {directory.people.length === 0
                    ? 'Your staff list is empty.'
                    : 'Nobody matches that search.'}
                </p>
              </Combobox.Empty>
              <Combobox.List>
                {(group: OptionGroup) => (
                  <Combobox.Group key={group.value} items={group.items}>
                    {group.value !== '' && (
                      <Combobox.GroupLabel className="px-2 pt-2 pb-1 text-xs font-bold text-muted-foreground">
                        {group.value}
                      </Combobox.GroupLabel>
                    )}
                    <Combobox.Collection>
                      {(o: Option) => (
                        <Combobox.Item
                          key={o.value}
                          value={o}
                          className="flex min-h-10 cursor-default items-center gap-2 rounded-md px-2 py-1.5 outline-none select-none data-highlighted:bg-muted"
                        >
                          <span className="flex size-4 shrink-0 items-center justify-center">
                            <Combobox.ItemIndicator>
                              <Check className="size-4" />
                            </Combobox.ItemIndicator>
                          </span>
                          {o.kind !== 'person' && (
                            <UsersRound
                              aria-hidden
                              className="size-4 shrink-0 text-muted-foreground"
                            />
                          )}
                          <span className="min-w-0 truncate font-bold">
                            {o.label}
                          </span>
                          {o.detail && (
                            <span className="ml-auto min-w-0 shrink truncate pl-2 text-sm text-muted-foreground">
                              {o.detail}
                            </span>
                          )}
                        </Combobox.Item>
                      )}
                    </Combobox.Collection>
                  </Combobox.Group>
                )}
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>

      {value.staffIds.size > 1 && (
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          onClick={() => setSaving(true)}
          className="h-10 self-start rounded-lg border-2 font-bold"
        >
          <UsersRound />
          Save these {value.staffIds.size} people as a group
        </Button>
      )}
      <GroupDialog
        open={saving}
        onOpenChange={setSaving}
        group={null}
        people={directory.people}
        startWith={[...value.staffIds]}
        onSaved={(g) => {
          // The new group replaces the people it was made from.
          const staffIds = new Set(value.staffIds)
          for (const p of g.staff_ids) staffIds.delete(p)
          onChange({
            ...value,
            staffIds,
            groupIds: new Set([...value.groupIds, g.id]),
          })
        }}
      />
    </div>
  )
}

function count(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`
}

/** How many people get the emails, counting each person once. */
export function invitedCount(value: Audience, directory: StaffDirectory) {
  if (value.everyone) return directory.people.length
  const ids = new Set(value.staffIds)
  for (const g of directory.groups) {
    if (value.groupIds.has(g.id)) for (const p of g.staff_ids) ids.add(p)
  }
  return ids.size
}
