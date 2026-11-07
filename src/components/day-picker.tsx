import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { addDays, isDateString } from '#/lib/day'

// Shared by the student page and a school administrator's dashboard.

/** Previous day, a date picker, next day (not past today), and Today. */
export function DayPicker({
  date,
  today,
  onChange,
}: {
  date: string
  today: string
  onChange: (date: string) => void
}) {
  const arrowClass = 'size-10 rounded-lg border-2 border-border'
  return (
    <div
      role="group"
      aria-label="Day"
      className="flex flex-wrap items-center gap-2"
    >
      <Button
        variant="outline"
        size="icon"
        aria-label="Previous day"
        onClick={() => onChange(addDays(date, -1))}
        className={arrowClass}
      >
        <ChevronLeft className="size-5" />
      </Button>
      <Input
        type="date"
        aria-label="Pick a day"
        value={date}
        max={today}
        onChange={(e) => {
          const picked = e.target.value
          if (isDateString(picked) && picked <= today) onChange(picked)
        }}
        className="h-10 w-auto rounded-lg border-2 border-border bg-card px-3 text-base font-bold"
      />
      <Button
        variant="outline"
        size="icon"
        aria-label="Next day"
        disabled={date >= today}
        onClick={() => onChange(addDays(date, 1))}
        className={arrowClass}
      >
        <ChevronRight className="size-5" />
      </Button>
      {date !== today && (
        <Button
          variant="link"
          onClick={() => onChange(today)}
          className="text-base font-bold"
        >
          Today
        </Button>
      )}
    </div>
  )
}
