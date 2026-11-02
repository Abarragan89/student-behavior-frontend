import { useEffect } from 'react'
import { Check } from 'lucide-react'
import { formatClockRange, formatShortDate } from '#/lib/calendar'
import { formatFullDate } from '#/lib/day'
import { isBlank } from '#/lib/lesson-plans'
import type { PlanDay } from '#/lib/lesson-plans'
import { QrSvg } from '#/components/qr-svg'

/**
 * The day's plan on paper, with empty boxes to tick by hand. On the page all
 * the time but only shown when printing (`print:block`), like the student
 * report. Dark ink on white, in dark mode too.
 *
 * With subLink (the teacher said yes when printing), the first page's top
 * right has a QR code for a substitute, opening this plan and the class
 * lists on their phone (see src/lib/sub.ts).
 */
export function PrintDay({
  day,
  subLink,
}: {
  day: PlanDay
  /** The day's substitute link, to print as a QR code. */
  subLink?: string
}) {
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
      {/* In the header, so the QR code is on the first page only. */}
      <header className="mb-6 flex items-start justify-between gap-6 border-b-2 border-black pb-3">
        <div>
          <h1 className="text-2xl font-bold">Lesson plan</h1>
          <p className="text-lg">{formatFullDate(day.date)}</p>
        </div>
        {subLink && <SubQrCard url={subLink} date={day.date} />}
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
                      className={`flex items-start gap-2 ${{ 0: '', 1: 'ml-8', 2: 'ml-16' }[i.indent]}`}
                    >
                      <span
                        aria-hidden
                        className={
                          i.indent > 0
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

/**
 * For the substitute: what the code opens, at a glance, and why it's worth
 * scanning.
 */
function SubQrCard({ url, date }: { url: string; date: string }) {
  return (
    <aside className="flex w-[3.4in] shrink-0 break-inside-avoid flex-col gap-2 rounded-lg border-2 border-black p-3">
      <div className="flex items-center gap-3">
        <QrSvg
          value={url}
          label="QR code for the substitute view of this plan"
          className="size-[1.15in] shrink-0"
        />
        <div className="flex min-w-0 flex-col gap-1">
          <p className="text-xs font-bold tracking-widest uppercase">
            Substitute? Scan me
          </p>
          <p className="text-base leading-snug font-bold">
            Today’s plan + class behavior tracker, right on your phone
          </p>
        </div>
      </div>
      <ul className="flex flex-col gap-0.5 text-sm">
        {[
          'Check off the lesson as you go',
          'Give behavior marks in one tap',
        ].map((text) => (
          <li key={text} className="flex items-center gap-1.5">
            <Check aria-hidden className="size-4 shrink-0" strokeWidth={3} />
            {text}
          </li>
        ))}
      </ul>
      <p className="text-xs">No login needed · Works {formatShortDate(date)}</p>
    </aside>
  )
}
