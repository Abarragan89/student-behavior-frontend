import { PhoneFrame } from './PhoneFrame'

// A sample of what a teacher's lesson notes look like. Decorative only.
const OUTLINE: Array<{ title: string; notes: Array<string> }> = [
  { title: 'Warm-up · 5 min', notes: ['3 problems on the board'] },
  {
    title: 'Mini-lesson',
    notes: ['Equivalent fractions', 'Use fraction strips'],
  },
  { title: 'Partner practice', notes: ['p. 42, #1–10'] },
  { title: 'Exit ticket', notes: ['Simplify 6/8'] },
]

export function LessonNotesMockup() {
  return (
    <div aria-hidden>
      <PhoneFrame>
        <div className="flex items-center justify-between border-b-2 border-border bg-card px-3 py-2 font-mono text-xs">
          <span className="font-bold">Thursday</span>
          <span className="text-muted-foreground">Lesson notes</span>
        </div>

        <div className="space-y-4 p-4">
          <p className="text-lg font-bold leading-tight">
            Period 3 — Fractions
          </p>
          <ul className="space-y-3 font-mono text-sm">
            {OUTLINE.map((item) => (
              <li key={item.title}>
                <p className="font-bold">{item.title}</p>
                <ul className="ml-5 list-disc text-muted-foreground">
                  {item.notes.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
          <p className="rounded-md border-2 border-border bg-accent px-2 py-1 font-mono text-sm text-accent-foreground">
            Ask: is 2/4 the same as 1/2?
          </p>
        </div>
      </PhoneFrame>
    </div>
  )
}
