import { useId, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Check,
  ChevronDown,
  Pencil,
  Plus,
  Trash2,
  UserRound,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'
import { ResponsiveDialog } from '#/components/responsive-dialogue'
import { ApiError } from '#/lib/api'
import {
  CATEGORY_STYLES,
  NO_CATEGORY_COLOR,
  PICK_COLORS,
  categoryStyle,
} from '#/lib/category-colors'
import type { CategoryColor } from '#/lib/category-colors'
import { useOnline } from '#/lib/online'
import {
  createCategory,
  deleteCategory,
  editCategory,
  invalidateCalendar,
  MAX_CATEGORIES,
  MAX_CATEGORY_NAME,
} from '#/lib/school-calendar'
import type {
  CategoryDisplay,
  CategoryInput,
  EventCategory,
} from '#/lib/school-calendar'

// Calendar categories: what kind of event it is ("IEP/504", "Staff out")
// and the color it shows in. Kept with the calendar (they come back with
// it), so every change refreshes it.

export function CategoryDot({
  color,
  className,
}: {
  color: string
  className?: string
}) {
  return (
    <span
      aria-hidden
      className={cn(
        'inline-block size-2.5 shrink-0 rounded-full',
        categoryStyle(color).dot,
        className,
      )}
    />
  )
}

/** "No category": gray, as events with no category are. */
function NoCategoryDot({ className }: { className?: string }) {
  return <CategoryDot color={NO_CATEGORY_COLOR} className={className} />
}

/**
 * The colors to choose from, as a row of swatches: not gray, which is no
 * category's (a category made gray before shows none picked).
 */
export function ColorPicker({
  value,
  onChange,
  disabled = false,
  label = 'Color',
}: {
  value: CategoryColor
  onChange: (c: CategoryColor) => void
  disabled?: boolean
  label?: string
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="flex flex-wrap gap-1.5"
    >
      {PICK_COLORS.map((c) => {
        const on = c === value
        return (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={CATEGORY_STYLES[c].label}
            title={CATEGORY_STYLES[c].label}
            disabled={disabled}
            onClick={() => onChange(c)}
            className={cn(
              'flex size-8 items-center justify-center rounded-full outline-none focus-visible:ring-4 focus-visible:ring-ring disabled:opacity-50',
              CATEGORY_STYLES[c].dot,
              on &&
                'ring-2 ring-foreground ring-offset-2 ring-offset-background',
            )}
          >
            {on && <Check className="size-4 text-white drop-shadow" />}
          </button>
        )
      })}
    </div>
  )
}

function categoryError(error: unknown, name: string) {
  if (error instanceof ApiError && error.reason === 'category_exists')
    return `There’s already a category called “${name.trim()}”.`
  if (error instanceof ApiError && error.reason === 'too_many_categories')
    return `You can have up to ${MAX_CATEGORIES} categories.`
  return 'Couldn’t save the category. Try again.'
}

/** How a category can show in a month, in words. */
export const DISPLAY_OPTIONS: Array<{
  value: CategoryDisplay
  label: string
  hint: string
}> = [
  {
    value: 'chip',
    label: 'Each event',
    hint: 'Its own line, like most events',
  },
  {
    value: 'combined',
    label: 'One line a day',
    hint: '“Employee out: Garcia, Ruiz”',
  },
  {
    value: 'header',
    label: 'Beside the date',
    hint: 'A daily duty, “SB-Cruz”',
  },
]

/** The choice of how a category shows, as a row of options. */
export function DisplayPicker({
  value,
  onChange,
  disabled = false,
}: {
  value: CategoryDisplay
  onChange: (d: CategoryDisplay) => void
  disabled?: boolean
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Show as"
      className="flex flex-wrap gap-1.5"
    >
      {DISPLAY_OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          disabled={disabled}
          onClick={() => onChange(o.value)}
          title={o.hint}
          className={cn(
            'flex min-h-9 flex-col items-start rounded-lg border-2 px-2.5 py-1 text-left text-sm font-bold transition-colors outline-none focus-visible:ring-4 focus-visible:ring-ring disabled:opacity-50 motion-reduce:transition-none',
            value === o.value
              ? 'border-primary bg-primary/10'
              : 'border-border bg-card hover:bg-muted',
          )}
        >
          {o.label}
          <span className="text-xs font-medium text-muted-foreground">
            {o.hint}
          </span>
        </button>
      ))}
    </div>
  )
}

/** Name, color, how it shows and who sees it: a new category or a change. */
function CategoryForm({
  initial,
  submitLabel,
  busy,
  onSubmit,
  onCancel,
}: {
  initial: CategoryInput
  submitLabel: string
  busy: boolean
  onSubmit: (c: CategoryInput) => void
  onCancel: () => void
}) {
  const id = useId()
  const online = useOnline()
  const [name, setName] = useState(initial.name)
  const [color, setColor] = useState<CategoryColor>(initial.color)
  const [display, setDisplay] = useState<CategoryDisplay>(initial.display)
  const valid = name.trim() !== ''
  const value = { name, color, display }
  return (
    <div className="flex flex-col gap-3 rounded-lg border-2 border-border bg-muted/40 p-3">
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${id}-name`} className="text-sm font-bold">
          Name
        </label>
        <Input
          id={`${id}-name`}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            // Inside the event form, Enter would save the event.
            if (e.key === 'Enter') {
              e.preventDefault()
              if (valid && !busy) onSubmit(value)
            }
          }}
          maxLength={MAX_CATEGORY_NAME}
          placeholder="IEP/504"
          disabled={busy}
          autoFocus
          className="h-11 rounded-lg border-2 border-border bg-card text-base"
        />
      </div>
      <ColorPicker value={color} onChange={setColor} disabled={busy} />
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-bold">Show as</span>
        <DisplayPicker value={display} onChange={setDisplay} disabled={busy} />
      </div>
      <div className="flex gap-2">
        <Button
          type="button"
          onClick={() => onSubmit(value)}
          disabled={!valid || busy || !online}
          className="h-10 rounded-lg font-bold"
        >
          {busy && <Spinner aria-hidden className="size-4" />}
          {submitLabel}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={onCancel}
          disabled={busy}
          className="h-10 rounded-lg font-bold"
        >
          Cancel
        </Button>
      </div>
    </div>
  )
}

function useRefreshCalendar() {
  const queryClient = useQueryClient()
  return () => {
    invalidateCalendar(queryClient)
  }
}

/**
 * The event form's choice of category: a button showing the chosen one (or
 * None) that opens a menu of them all, None first and "New category" last.
 * An event has at most one: it's the color it shows in.
 */
export function CategoryPicker({
  categories,
  value,
  onChange,
  disabled = false,
}: {
  categories: Array<EventCategory>
  value: string | null
  onChange: (id: string | null) => void
  disabled?: boolean
}) {
  const refresh = useRefreshCalendar()
  const [adding, setAdding] = useState(false)
  // Just made: chosen before the refreshed list has it.
  const [made, setMade] = useState<EventCategory | null>(null)
  const create = useMutation({
    mutationFn: createCategory,
    onSuccess: (c) => {
      refresh()
      setMade(c)
      onChange(c.id)
      setAdding(false)
    },
    onError: (error, c) => {
      console.error('Adding a category failed:', error)
      toast.error(categoryError(error, c.name))
    },
  })
  const chosen =
    value === null
      ? undefined
      : (categories.find((c) => c.id === value) ??
        (made?.id === value ? made : undefined))
  const canAdd = !adding && categories.length < MAX_CATEGORIES

  return (
    <div className="flex flex-col gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger
          disabled={disabled}
          render={
            <Button
              type="button"
              variant="outline"
              className="h-11 w-full justify-between rounded-lg border-2 bg-card px-3 text-base font-medium sm:w-72"
            />
          }
        >
          <span className="flex min-w-0 items-center gap-2">
            <span className="sr-only">Category: </span>
            {chosen ? (
              <>
                <CategoryDot color={chosen.color} />
                <span className="truncate font-bold">{chosen.name}</span>
              </>
            ) : (
              <>
                <NoCategoryDot />
                <span className="text-muted-foreground">None</span>
              </>
            )}
          </span>
          <ChevronDown className="text-muted-foreground" />
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          className="max-h-80 w-(--anchor-width) min-w-64 overflow-y-auto rounded-lg border-2 border-border p-1 shadow-md ring-0"
        >
          <DropdownMenuRadioGroup
            value={chosen ? chosen.id : ''}
            onValueChange={(id: string) => onChange(id || null)}
          >
            <DropdownMenuRadioItem
              value=""
              closeOnClick
              className="min-h-10 rounded-md text-base font-bold"
            >
              <NoCategoryDot />
              None
            </DropdownMenuRadioItem>
            {categories.map((c) => (
              <DropdownMenuRadioItem
                key={c.id}
                value={c.id}
                // One per event: picking it is the whole job.
                closeOnClick
                className="min-h-10 rounded-md text-base font-bold"
              >
                <CategoryDot color={c.color} />
                <span className="min-w-0 truncate">{c.name}</span>
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
          {canAdd && <DropdownMenuSeparator />}
          {canAdd && (
            <DropdownMenuItem
              className="min-h-10 rounded-md text-base font-bold text-muted-foreground"
              onClick={() => setAdding(true)}
            >
              <Plus />
              New category
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {adding && (
        <CategoryForm
          initial={{
            name: '',
            color: unusedColor(categories),
            display: 'chip',
          }}
          submitLabel="Add category"
          busy={create.isPending}
          onSubmit={(c) => create.mutate(c)}
          onCancel={() => setAdding(false)}
        />
      )}
    </div>
  )
}

/** The legend key for events with no category. */
export const NO_CATEGORY = 'none'
/** The legend key for the "Mine" chip. */
export const MINE = 'mine'

/**
 * The calendar's legend, which is also how you focus it: "Mine", then a
 * chip per category with how many events it has this month. Tap chips to
 * pick them; while any are picked, their events stand out and the rest
 * fade. Picking several shows them all (an event stands out if any picked
 * chip covers it).
 */
export function CategoryLegend({
  categories,
  counts,
  mineCount,
  focus,
  onFocusChange,
  onEdit,
}: {
  categories: Array<EventCategory>
  /** Events this month by category id (NO_CATEGORY for none). */
  counts: Map<string, number>
  /** Your events this month. */
  mineCount: number
  /** The picked chips: category ids, NO_CATEGORY, MINE. */
  focus: Set<string>
  onFocusChange: (next: Set<string>) => void
  /** The administrator's way to change categories; none for teachers. */
  onEdit?: () => void
}) {
  const uncategorized = counts.get(NO_CATEGORY) ?? 0
  const keys: Array<{
    key: string
    name: string
    color: string | null
    count: number
  }> = [
    ...categories.map((c) => ({
      key: c.id,
      name: c.name,
      color: c.color,
      count: counts.get(c.id) ?? 0,
    })),
    ...(uncategorized > 0 || focus.has(NO_CATEGORY)
      ? [
          {
            key: NO_CATEGORY,
            name: 'No category',
            color: null,
            count: uncategorized,
          },
        ]
      : []),
  ]
  const toggle = (key: string) => {
    const next = new Set(focus)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    onFocusChange(next)
  }
  const chipClass = (on: boolean, count: number) =>
    cn(
      'flex min-h-8 items-center gap-1.5 rounded-full border-2 px-2.5 text-xs font-bold transition-colors outline-none focus-visible:ring-4 focus-visible:ring-ring motion-reduce:transition-none',
      on
        ? 'border-primary bg-primary text-primary-foreground'
        : 'border-border bg-card hover:bg-muted',
      // None this month: there, but quiet.
      !on && count === 0 && 'text-muted-foreground',
    )
  const countClass = (on: boolean) =>
    cn('font-medium tabular-nums', !on && 'text-muted-foreground')

  const mineOn = focus.has(MINE)
  const mineChip = (
    <button
      type="button"
      aria-pressed={mineOn}
      onClick={() => toggle(MINE)}
      title="Your events: ones you get reminders for, or with your name in them"
      className={chipClass(mineOn, mineCount)}
    >
      <UserRound className="size-3.5" />
      Mine
      <span className={countClass(mineOn)}>{mineCount}</span>
    </button>
  )
  const clear = focus.size > 0 && (
    <Button
      type="button"
      variant="link"
      onClick={() => onFocusChange(new Set())}
      className="h-8 px-1.5 text-xs font-bold"
    >
      Clear
    </Button>
  )
  if (categories.length === 0) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        {mineChip}
        {clear}
        {onEdit && (
          <Button
            type="button"
            variant="link"
            onClick={onEdit}
            className="h-auto px-0 text-sm font-bold"
          >
            <Plus />
            Color-code events with categories
          </Button>
        )}
      </div>
    )
  }
  return (
    <div
      role="group"
      aria-label="Highlight events"
      className="flex flex-wrap items-center gap-1.5"
    >
      {mineChip}
      <span aria-hidden className="mx-0.5 h-5 w-px bg-border" />
      {keys.map((k) => {
        const on = focus.has(k.key)
        return (
          <button
            key={k.key}
            type="button"
            aria-pressed={on}
            onClick={() => toggle(k.key)}
            title={on ? `Stop highlighting ${k.name}` : `Highlight ${k.name}`}
            className={chipClass(on, k.count)}
          >
            {k.color ? (
              <CategoryDot
                color={k.color}
                className={cn(on && 'ring-2 ring-primary-foreground')}
              />
            ) : (
              <NoCategoryDot
                className={cn(on && 'ring-2 ring-primary-foreground')}
              />
            )}
            {k.name}
            <span className={countClass(on)}>{k.count}</span>
          </button>
        )
      })}
      {clear}
      {onEdit && (
        <Button
          type="button"
          variant="ghost"
          onClick={onEdit}
          className="h-8 rounded-full px-2.5 text-xs font-bold text-muted-foreground"
        >
          <Pencil className="size-3.5" />
          Edit
        </Button>
      )}
    </div>
  )
}

/** The first color no category has yet; once all are, they go round again. */
export function unusedColor(categories: Array<EventCategory>): CategoryColor {
  const used = new Set(categories.map((c) => c.color))
  return (
    PICK_COLORS.find((c) => !used.has(c)) ??
    PICK_COLORS[categories.length % PICK_COLORS.length]
  )
}

/** Rename, recolor, add and delete the school's categories. */
export function CategoriesDialog({
  open,
  onOpenChange,
  categories,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  categories: Array<EventCategory>
}) {
  return (
    <ResponsiveDialog
      isOpen={open}
      setIsOpen={onOpenChange}
      title="Categories"
      description="Each event can have one. Its color shows on the calendar."
      showDescription
      className="sm:max-w-lg"
    >
      {open && <CategoryList categories={categories} />}
    </ResponsiveDialog>
  )
}

function CategoryList({ categories }: { categories: Array<EventCategory> }) {
  const online = useOnline()
  const refresh = useRefreshCalendar()
  // Which row is open: a category's id, "new", or none.
  const [editing, setEditing] = useState<string | null>(null)
  const [confirming, setConfirming] = useState<string | null>(null)

  const save = useMutation({
    mutationFn: ({ id, c }: { id: string | null; c: CategoryInput }) =>
      id ? editCategory(id, c) : createCategory(c),
    onSuccess: () => {
      refresh()
      setEditing(null)
    },
    onError: (error, { c }) => {
      console.error('Saving a category failed:', error)
      toast.error(categoryError(error, c.name))
    },
  })
  const remove = useMutation({
    mutationFn: (c: EventCategory) => deleteCategory(c.id),
    onSuccess: (_, c) => {
      refresh()
      setConfirming(null)
      toast.success(`Deleted “${c.name}”`, {
        description: 'Its events stay on the calendar, with no color.',
      })
    },
    onError: (error) => {
      console.error('Deleting a category failed:', error)
      toast.error('Couldn’t delete the category. Try again.')
    },
  })

  return (
    <div className="flex flex-col gap-3">
      {categories.length === 0 && editing !== 'new' && (
        <p className="text-sm text-muted-foreground">
          No categories yet. Add one, or import your school’s spreadsheet: its
          colors become categories.
        </p>
      )}
      <ul className="flex flex-col gap-2">
        {categories.map((c) =>
          editing === c.id ? (
            <li key={c.id}>
              <CategoryForm
                initial={{
                  name: c.name,
                  color: c.color,
                  display: c.display,
                }}
                submitLabel="Save"
                busy={save.isPending}
                onSubmit={(next) => save.mutate({ id: c.id, c: next })}
                onCancel={() => setEditing(null)}
              />
            </li>
          ) : (
            <li
              key={c.id}
              className="flex min-h-12 items-center gap-3 rounded-lg border-2 border-border bg-card px-3 py-1.5"
            >
              <CategoryDot color={c.color} className="size-3.5" />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-bold">{c.name}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {DISPLAY_OPTIONS.find((o) => o.value === c.display)?.label ??
                    'Each event'}
                </span>
              </span>
              {confirming === c.id ? (
                <>
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => remove.mutate(c)}
                    disabled={remove.isPending || !online}
                    className="h-9 rounded-lg px-3 font-bold"
                  >
                    {remove.isPending && (
                      <Spinner aria-hidden className="size-4" />
                    )}
                    Delete
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setConfirming(null)}
                    disabled={remove.isPending}
                    className="h-9 rounded-lg px-3 font-bold"
                  >
                    Keep
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Edit ${c.name}`}
                    onClick={() => {
                      setConfirming(null)
                      setEditing(c.id)
                    }}
                    className="size-9 rounded-lg"
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Delete ${c.name}`}
                    onClick={() => {
                      setEditing(null)
                      setConfirming(c.id)
                    }}
                    className="size-9 rounded-lg text-destructive hover:text-destructive"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </>
              )}
            </li>
          ),
        )}
      </ul>
      {editing === 'new' ? (
        <CategoryForm
          initial={{
            name: '',
            color: unusedColor(categories),
            display: 'chip',
          }}
          submitLabel="Add category"
          busy={save.isPending}
          onSubmit={(c) => save.mutate({ id: null, c })}
          onCancel={() => setEditing(null)}
        />
      ) : (
        categories.length < MAX_CATEGORIES && (
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setConfirming(null)
              setEditing('new')
            }}
            className="h-11 self-start rounded-lg border-2 px-3 font-bold"
          >
            <Plus />
            Add a category
          </Button>
        )
      )}
    </div>
  )
}
