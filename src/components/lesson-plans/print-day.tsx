import { useEffect } from 'react'
import { formatClockRange } from '#/lib/calendar'
import { formatFullDate } from '#/lib/day'
import { isBlank } from '#/lib/lesson-plans'
import type { PlanDay } from '#/lib/lesson-plans'

/**
 * The day's plan on paper, with empty boxes to tick by hand. On the page all
 * the time but only shown when printing (`print:block`), like the student
 * report. Dark ink on white, in dark mode too.
 */
export function PrintDay({ day }: { day: PlanDay }) {
  // The saved PDF is named after the page title.
  const title = `Lesson plan – ${day.date}`
  useEffect(() => {
    let saved: string | null = null
    const before = () => {
      saved ??= document.title
      document.title = title
    }
    const after = () => {
      if (saved !== null) document.title = saved
      saved = null
    }
    window.addEventListener('beforeprint', before)
    window.addEventListener('afterprint', after)
    return () => {
      window.removeEventListener('beforeprint', before)
      window.removeEventListener('afterprint', after)
      after()
    }
  }, [title])

  return (
    <article className="hidden bg-white text-black print:block">
      <header className="mb-6 border-b-2 border-black pb-3">
        <h1 className="text-2xl font-bold">Lesson plan</h1>
        <p className="text-lg">{formatFullDate(day.date)}</p>
      </header>
      {day.sections.length === 0 ? (
        <p>Nothing planned.</p>
      ) : (
        <div className="flex flex-col gap-5">
          {day.sections.map((s) => {
            const time = formatClockRange(s.start_time, s.end_time)
            const lines = s.items.filter((i) => !isBlank(i))
            return (
              <section key={s.id} className="break-inside-avoid">
                <h2 className="flex items-baseline justify-between gap-4 border-b border-black/40 pb-1 text-lg font-bold">
                  <span>{s.title.trim() || 'Untitled section'}</span>
                  {time && <span className="text-sm font-medium">{time}</span>}
                </h2>
                <ul className="mt-2 flex flex-col gap-1.5">
                  {lines.map((i) => (
                    <li
                      key={i.id}
                      className={
                        i.indent === 1
                          ? 'ml-8 flex items-start gap-2'
                          : 'flex items-start gap-2'
                      }
                    >
                      <span
                        aria-hidden
                        className={
                          i.indent === 1
                            ? 'mt-1 size-3.5 shrink-0 rounded-full border-[1.5px] border-black'
                            : 'mt-0.5 size-4 shrink-0 border-[1.5px] border-black'
                        }
                      />
                      <span className="whitespace-pre-wrap">{i.text}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )
          })}
        </div>
      )}
    </article>
  )
}
