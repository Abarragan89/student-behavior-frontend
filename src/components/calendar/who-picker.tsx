import { useState } from 'react'
import { Check, ChevronDown, UsersRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { GroupDialog } from '#/components/staff/group-dialog'
import { PeopleChecklist } from '#/components/staff/people-checklist'
import type { StaffDirectory } from '#/lib/staff'

export type Audience = {
  everyone: boolean
  staffIds: Set<string>
  groupIds: Set<string>
}

const chip =
  'inline-flex min-h-10 items-center gap-1.5 rounded-full border-2 px-3 text-sm font-bold transition-colors outline-none focus-visible:ring-4 focus-visible:ring-ring motion-reduce:transition-none'

/**
 * Who's invited: everyone on staff, groups (chips), and people (a searchable
 * list). People picked one by one can be saved as a group without leaving
 * the form.
 */
export function WhoPicker({
  directory,
  value,
  onChange,
  disabled,
}: {
  directory: StaffDirectory
  value: Audience
  onChange: (next: Audience) => void
  disabled: boolean
}) {
  const [peopleOpen, setPeopleOpen] = useState(value.staffIds.size > 0)
  const [saving, setSaving] = useState(false)

  const toggleGroup = (id: string) => {
    const next = new Set(value.groupIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    onChange({ ...value, groupIds: next })
  }

  return (
    <fieldset disabled={disabled} className="flex flex-col gap-2">
      <legend className="mb-1 text-base font-bold">Who</legend>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          aria-pressed={value.everyone}
          onClick={() => onChange({ ...value, everyone: !value.everyone })}
          className={cn(
            chip,
            value.everyone
              ? 'border-primary bg-primary text-primary-foreground'
              : 'border-border bg-card hover:bg-muted',
          )}
        >
          {value.everyone ? (
            <Check className="size-4" />
          ) : (
            <UsersRound className="size-4" />
          )}
          Everyone on staff ({directory.people.length})
        </button>
        {!value.everyone &&
          directory.groups.map((g) => {
            const on = value.groupIds.has(g.id)
            return (
              <button
                key={g.id}
                type="button"
                aria-pressed={on}
                onClick={() => toggleGroup(g.id)}
                className={cn(
                  chip,
                  on
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-card hover:bg-muted',
                )}
              >
                {on && <Check className="size-4" />}
                {g.name}
                <span
                  className={cn(
                    'font-medium',
                    on ? 'opacity-80' : 'text-muted-foreground',
                  )}
                >
                  {g.staff_ids.length}
                </span>
              </button>
            )
          })}
      </div>
      {!value.everyone && (
        <>
          <Button
            type="button"
            variant="link"
            aria-expanded={peopleOpen}
            onClick={() => setPeopleOpen(!peopleOpen)}
            className="h-auto self-start px-0 font-bold"
          >
            <ChevronDown
              className={cn(
                'transition-transform motion-reduce:transition-none',
                peopleOpen && 'rotate-180',
              )}
            />
            {value.staffIds.size > 0
              ? `People (${value.staffIds.size})`
              : 'Add people one by one'}
          </Button>
          {peopleOpen && (
            <div className="flex flex-col gap-2">
              <PeopleChecklist
                people={directory.people}
                selected={value.staffIds}
                onChange={(staffIds) => onChange({ ...value, staffIds })}
                disabled={disabled}
              />
              {value.staffIds.size > 1 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setSaving(true)}
                  className="h-10 self-start rounded-lg border-2 font-bold"
                >
                  <UsersRound />
                  Save these {value.staffIds.size} as a group
                </Button>
              )}
            </div>
          )}
        </>
      )}
      <p className="text-sm text-muted-foreground">
        {summarize(value, directory)}
      </p>
      <GroupDialog
        open={saving}
        onOpenChange={setSaving}
        group={null}
        people={directory.people}
        startWith={[...value.staffIds]}
        onSaved={(g) => {
          // The new group replaces the people it was made from.
          const staffIds = new Set(value.staffIds)
          for (const id of g.staff_ids) staffIds.delete(id)
          onChange({
            ...value,
            staffIds,
            groupIds: new Set([...value.groupIds, g.id]),
          })
        }}
      />
    </fieldset>
  )
}

/** "12 people invited", counting each person once. */
export function invitedCount(value: Audience, directory: StaffDirectory) {
  if (value.everyone) return directory.people.length
  const ids = new Set(value.staffIds)
  for (const g of directory.groups) {
    if (value.groupIds.has(g.id)) for (const id of g.staff_ids) ids.add(id)
  }
  return ids.size
}

function summarize(value: Audience, directory: StaffDirectory) {
  const n = invitedCount(value, directory)
  if (n === 0) return 'Nobody invited yet: only you will see it.'
  return `${n} ${n === 1 ? 'person' : 'people'} invited${value.everyone ? ', including anyone you add to your staff later' : ''}.`
}
