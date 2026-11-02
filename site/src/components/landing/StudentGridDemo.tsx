import { useState } from 'react'
import { Minus, Plus } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { PhoneFrame } from './PhoneFrame'

// Sample class for the demo. Counts live in local state only.
const STUDENTS: Array<{ name: string; positive: number; negative: number }> = [
  { name: 'Ava', positive: 3, negative: 0 },
  { name: 'Ben', positive: 1, negative: 2 },
  { name: 'Carlos', positive: 2, negative: 0 },
  { name: 'Dani', positive: 4, negative: 1 },
  { name: 'Eli', positive: 0, negative: 1 },
  { name: 'Fatima', positive: 2, negative: 0 },
  { name: 'Grace', positive: 1, negative: 0 },
  { name: 'Hugo', positive: 2, negative: 3 },
  { name: 'Isla', positive: 5, negative: 0 },
  { name: 'Jamal', positive: 1, negative: 1 },
  { name: 'Kai', positive: 0, negative: 0 },
  { name: 'Lena', positive: 3, negative: 1 },
]

const countBadge = 'h-auto rounded-sm px-1 font-mono font-normal'
const markButton =
  'h-12 border-2 border-border text-base font-bold active:scale-95 motion-reduce:transition-none'

export function StudentGridDemo() {
  const [students, setStudents] = useState(STUDENTS)
  const [selected, setSelected] = useState<string | null>(null)
  const [announcement, setAnnouncement] = useState('')

  const current = students.find((s) => s.name === selected)

  function giveMark(kind: 'positive' | 'negative') {
    if (!current) return
    const updated = { ...current, [kind]: current[kind] + 1 }
    setStudents((all) =>
      all.map((s) => (s.name === current.name ? updated : s)),
    )
    setAnnouncement(
      `${updated.name}: ${updated.positive} positive, ${updated.negative} negative`,
    )
  }

  return (
    <PhoneFrame>
      <div className="flex items-center justify-between border-b-2 border-border bg-card px-3 py-2 font-mono text-xs">
        <span className="font-bold">Period 3</span>
        <span className="text-muted-foreground">
          {students.length} students
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2 p-3">
        {students.map((s) => {
          const isSelected = s.name === selected
          return (
            <Button
              key={s.name}
              variant="outline"
              aria-pressed={isSelected}
              onClick={() => setSelected(isSelected ? null : s.name)}
              className={cn(
                'aspect-square h-auto flex-col gap-1.5 rounded-md border-2 border-border bg-card p-1 text-sm font-bold active:scale-95 motion-reduce:transition-none',
                isSelected && 'border-primary ring-4 ring-ring',
              )}
            >
              {s.name}
              <span className="flex gap-1">
                <Badge className={cn(countBadge, 'bg-chart-5 text-foreground')}>
                  +{s.positive}
                </Badge>
                <Badge
                  className={cn(
                    countBadge,
                    'bg-destructive text-destructive-foreground',
                  )}
                >
                  −{s.negative}
                </Badge>
              </span>
            </Button>
          )
        })}
      </div>

      <div className="flex h-28 flex-col justify-center border-t-2 border-border bg-card p-3">
        {current ? (
          <>
            <p className="mb-2 text-center text-sm font-bold">{current.name}</p>
            <div className="grid grid-cols-2 gap-2">
              <Button
                onClick={() => giveMark('positive')}
                className={cn(
                  markButton,
                  'bg-chart-5 text-foreground hover:bg-chart-5/80',
                )}
              >
                <Plus strokeWidth={3} />
                Positive
              </Button>
              <Button
                onClick={() => giveMark('negative')}
                className={cn(
                  markButton,
                  'bg-destructive text-destructive-foreground hover:bg-destructive/80',
                )}
              >
                <Minus strokeWidth={3} />
                Negative
              </Button>
            </div>
          </>
        ) : (
          <p className="text-center font-mono text-xs text-muted-foreground">
            Tap a student to give a mark
          </p>
        )}
      </div>

      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
    </PhoneFrame>
  )
}
