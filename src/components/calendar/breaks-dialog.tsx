import { useId, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'
import { OfflineNote } from '#/components/offline-note'
import { ResponsiveDialog } from '#/components/responsive-dialogue'
import { formatShortDate } from '#/lib/calendar'
import { useOnline } from '#/lib/online'
import {
  breaksQueryOptions,
  createBreak,
  deleteBreak,
  invalidateCalendar,
} from '#/lib/school-calendar'
import { breaksIn, schoolYearOf, yearLabel } from '#/lib/school-years'

/**
 * The school's breaks ("Winter break, Dec 21 – Jan 1"): entered once,
 * skipped by every repeating event that skips breaks. One school year at a
 * time (July to June), so the list stays short as the years go by.
 */
export function BreaksDialog({
  open,
  onOpenChange,
  today,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  today: string
}) {
  return (
    <ResponsiveDialog
      isOpen={open}
      setIsOpen={onOpenChange}
      title="School breaks"
      description="Repeating events skip these days, unless you tell one not to."
      showDescription
      keyboardAware
    >
      {open && <Breaks today={today} />}
    </ResponsiveDialog>
  )
}

const field = 'h-11 rounded-lg border-2 border-border bg-card text-base'

function Breaks({ today }: { today: string }) {
  const id = useId()
  const online = useOnline()
  const queryClient = useQueryClient()
  const breaks = useQuery(breaksQueryOptions)
  const [name, setName] = useState('')
  const [first, setFirst] = useState('')
  const [last, setLast] = useState('')
  const thisYear = schoolYearOf(today)
  const [year, setYear] = useState(thisYear)
  // Years with breaks, this year and next (to enter next year's in spring),
  // and the one shown; newest first.
  const years = [
    ...new Set([
      thisYear + 1,
      thisYear,
      year,
      ...(breaks.data ?? []).map((b) => schoolYearOf(b.first_day)),
    ]),
  ].sort((a, b) => b - a)
  const shown = breaksIn(year, breaks.data ?? [])
  const refresh = () => {
    invalidateCalendar(queryClient)
  }
  const add = useMutation({
    mutationFn: () =>
      createBreak({ name, first_day: first, last_day: last || first }),
    onSuccess: (b) => {
      refresh()
      // Show the year it's in, so it doesn't seem to vanish.
      setYear(schoolYearOf(b.first_day))
      setName('')
      setFirst('')
      setLast('')
      toast.success(`Added ${b.name}`)
    },
    onError: (error) => {
      console.error('Adding a break failed:', error)
      toast.error('Couldn’t add the break. Try again.')
    },
  })
  const remove = useMutation({
    mutationFn: deleteBreak,
    onSuccess: () => {
      refresh()
      toast.success('Break deleted')
    },
    onError: (error) => {
      console.error('Deleting a break failed:', error)
      toast.error('Couldn’t delete the break. Try again.')
    },
  })
  const valid =
    name.trim() !== '' && first !== '' && (last === '' || last >= first)

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={`${id}-year`} className="font-bold">
          School year
        </label>
        <select
          id={`${id}-year`}
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          className="h-10 rounded-lg border-2 border-border bg-card px-2 text-sm font-bold outline-none focus-visible:ring-4 focus-visible:ring-ring"
        >
          {years.map((y) => (
            <option key={y} value={y}>
              {yearLabel(y)}
              {y === thisYear ? ' (this year)' : ''}
            </option>
          ))}
        </select>
      </div>
      <ul className="-mt-2 flex flex-col gap-2">
        {breaks.data && shown.length === 0 && (
          <li className="text-sm text-muted-foreground">
            No breaks in {yearLabel(year)} yet.
          </li>
        )}
        {shown.map((b) => (
          <li
            key={b.id}
            className={cn(
              'flex items-center gap-3 rounded-lg border-2 border-border bg-card px-3 py-2',
              b.last_day < today && 'opacity-60',
            )}
          >
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate font-bold">{b.name}</span>
              <span className="text-sm text-muted-foreground">
                {b.first_day === b.last_day
                  ? formatShortDate(b.first_day)
                  : `${formatShortDate(b.first_day)} – ${formatShortDate(b.last_day)}`}
              </span>
            </span>
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Delete ${b.name}`}
              onClick={() => remove.mutate(b.id)}
              disabled={!online || remove.isPending}
              className="size-10 rounded-lg"
            >
              <Trash2 className="text-destructive" />
            </Button>
          </li>
        ))}
      </ul>
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          if (valid && !add.isPending) add.mutate()
        }}
        className="flex flex-col gap-3 rounded-lg border-2 border-dashed border-border p-3"
      >
        <h3 className="font-bold">Add a break</h3>
        <div className="flex flex-col gap-2">
          <label htmlFor={`${id}-name`} className="text-sm font-bold">
            Name
          </label>
          <Input
            id={`${id}-name`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={80}
            placeholder="Winter break"
            className={field}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-2">
            <label htmlFor={`${id}-first`} className="text-sm font-bold">
              First day
            </label>
            <Input
              id={`${id}-first`}
              type="date"
              value={first}
              onChange={(e) => setFirst(e.target.value)}
              className={cn(field, 'px-3')}
            />
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor={`${id}-last`} className="text-sm font-bold">
              Last day
            </label>
            <Input
              id={`${id}-last`}
              type="date"
              min={first || undefined}
              value={last}
              onChange={(e) => setLast(e.target.value)}
              className={cn(field, 'px-3')}
            />
          </div>
        </div>
        <OfflineNote action="add breaks" />
        <Button
          type="submit"
          disabled={!online || !valid || add.isPending}
          className="h-11 self-start rounded-lg px-4 font-bold"
        >
          {add.isPending && <Spinner aria-hidden className="size-4" />}
          Add break
        </Button>
      </form>
    </div>
  )
}
