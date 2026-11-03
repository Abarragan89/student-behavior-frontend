import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import {
  formatFullDate,
  formatHourSpan,
  formatTime,
  timeZoneLabel,
} from '#/lib/day'
import { localDate, markTime } from '#/lib/marks'
import type { Mark } from '#/lib/marks'
import {
  busiestHour,
  countByType,
  perDay,
  schoolDaysToShow,
  sumDays,
} from '#/lib/mark-stats'
import type { TypeCount } from '#/lib/mark-stats'
import type { DailyCounts, StudentDetail } from '#/lib/students'
import {
  CountBar,
  FillSwatch,
  MarkSymbol,
  ReportTimeline,
  ShareBar,
  TrendStrip,
} from '#/components/report-charts'
import { Wordmark } from '#/components/Wordmark'

/**
 * One day of a student's marks as a printed report for the family: what
 * happened in plain words, the day as a left-to-right chart, every mark
 * listed, recent days for context, and lines to sign.
 *
 * It's on the page all the time but only shows on paper (`print:block`), so
 * the browser's own Print menu prints it too. Laid out for the paper, not the
 * screen (no sm: or md:), so a phone and a computer print the same page.
 * Always dark ink on white, in dark mode too. The page using it names the
 * saved PDF (usePrintTitle), since a page can print several reports at once.
 *
 * Families see "Needs work" where the app says "Negative".
 */
export function StudentReport({
  student,
  date,
  marks,
  trend,
  teacherName,
  timeZone: zone,
  classroomName,
}: {
  student: StudentDetail
  date: string
  marks: Array<Mark>
  /** The recent days, or undefined if they couldn't load (e.g. offline). */
  trend: DailyCounts | undefined
  teacherName: string
  timeZone: string
  /** The class a mark was given in, only when there's more than one. */
  classroomName?: (classroomId: string) => string | undefined
}) {
  const fullName = `${student.first_name} ${student.last_name}`.trim()
  const first = student.first_name || fullName
  const positive = marks.filter((m) => m.is_positive).length
  const negative = marks.length - positive
  const busiest = busiestHour(marks, zone)
  const types = countByType(marks)
  const sorted = [...marks].sort((a, b) =>
    markTime(a).localeCompare(markTime(b)),
  )
  const summary = daySummary(first, positive, negative)

  return (
    <article className="hidden bg-white text-[10pt] leading-snug text-neutral-900 [-webkit-print-color-adjust:exact] [print-color-adjust:exact] print:block">
      <header className="flex items-end justify-between gap-6 border-b-2 border-neutral-900 pb-2">
        <div className="min-w-0">
          <p className="text-[9pt] font-bold tracking-wider text-neutral-600 uppercase">
            Behavior report
          </p>
          <h1 className="text-[18pt] leading-tight font-bold break-words">
            {fullName}
          </h1>
          <p className="text-neutral-700">
            {student.classrooms.length > 0 && (
              <>
                {student.classrooms.length > 1 ? 'Classes' : 'Class'}:{' '}
                {student.classrooms.map((c) => c.name).join(' · ')}
                {teacherName && ' · '}
              </>
            )}
            {teacherName && <>Teacher: {teacherName}</>}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <Wordmark />
          <p className="text-[11pt] font-bold whitespace-nowrap">
            {formatFullDate(date)}
          </p>
        </div>
      </header>

      <Section title="At a glance">
        <p className="text-[12pt] font-bold">{summary.headline}</p>
        {summary.detail && <p>{summary.detail}</p>}
        <dl className="mt-1.5 grid grid-cols-3 gap-2">
          <ReportStat
            label="Positive"
            symbol={<MarkSymbol positive />}
            value={String(positive)}
          />
          <ReportStat
            label="Needs work"
            symbol={<MarkSymbol positive={false} />}
            value={String(negative)}
          />
          <ReportStat
            label="Busiest hour"
            value={busiest ? formatHourSpan(busiest.hour) : '—'}
            note={busiest ? `${busiest.count} marks` : undefined}
          />
        </dl>
        {marks.length > 0 && (
          <div className="mt-2 grid grid-cols-[auto_1fr_auto] items-center gap-2 text-[9pt] font-bold whitespace-nowrap">
            <span className="flex items-center gap-1">
              <FillSwatch positive />
              Positive {positive}
            </span>
            <ShareBar positive={positive} negative={negative} />
            <span className="flex items-center gap-1">
              Needs work {negative}
              <FillSwatch positive={false} />
            </span>
          </div>
        )}
      </Section>

      <div className="grid grid-cols-2 gap-6">
        <Section title="What the marks were for">
          {types.length === 0 ? (
            <p className="text-neutral-600">No marks this day.</p>
          ) : (
            <div className="flex flex-col gap-1.5">
              <TypeGroup
                positive
                types={types.filter((t) => t.isPositive)}
                max={types[0].count}
              />
              <TypeGroup
                positive={false}
                types={types.filter((t) => !t.isPositive)}
                max={types[0].count}
              />
            </div>
          )}
        </Section>
        <RecentDays trend={trend} date={date} />
      </div>

      <Section title="When marks happened">
        <ReportTimeline marks={marks} timeZone={zone} />
        <p className="mt-0.5 text-[9pt] text-neutral-600">
          Left to right is the day. Each shape is one mark at the time it was
          given; marks close together stack up.
        </p>
      </Section>

      <Section title="All marks">
        {sorted.length === 0 ? (
          <p className="text-neutral-600">No marks were recorded this day.</p>
        ) : (
          // Two columns, earliest first: down the left, then down the right
          // (on each page, if the list runs long).
          <ol className="columns-2 gap-x-6">
            {sorted.map((mark) => (
              <li
                key={mark.id}
                className="grid break-inside-avoid grid-cols-[5.25em_7.25em_1fr] items-start gap-x-2 border-b border-neutral-300 py-0.5"
              >
                <span className="whitespace-nowrap tabular-nums">
                  {formatTime(markTime(mark), zone)}
                </span>
                <span className="flex items-center gap-1 whitespace-nowrap">
                  <MarkSymbol positive={mark.is_positive} />
                  {mark.is_positive ? 'Positive' : 'Needs work'}
                </span>
                <span className="min-w-0 font-bold break-words">
                  {mark.name}
                  {classroomName && (
                    <span className="block text-[8pt] font-normal text-neutral-600">
                      {classroomName(mark.classroom_id)}
                    </span>
                  )}
                  {/* What the teacher wrote about it, if anything. */}
                  {mark.note && (
                    <span className="block text-[8.5pt] font-normal italic">
                      {mark.note}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ol>
        )}
      </Section>

      <div className="grid break-inside-avoid grid-cols-2 gap-6">
        <Section title="Talk about it at home">
          <ul className="flex list-disc flex-col gap-0.5 pl-4">
            {talkingPoints(first, types).map((point) => (
              <li key={point.lead}>
                <b>{point.lead}</b> {point.text}
              </li>
            ))}
          </ul>
        </Section>
        <Section title="Comments">
          {[0, 1, 2].map((line) => (
            <div key={line} className="h-6 border-b border-neutral-400" />
          ))}
        </Section>
      </div>

      <section className="mt-4 grid break-inside-avoid grid-cols-3 gap-6">
        <SignatureLine label="Student" name={fullName} />
        <SignatureLine label="Parent or guardian" />
        <SignatureLine label="Teacher" name={teacherName} />
      </section>

      <footer className="mt-3 border-t border-neutral-300 pt-1 text-[8pt] leading-tight text-neutral-600">
        Times are in {timeZoneLabel(date, zone)}. Marks are moments the teacher
        chose to record, not a full record of the day. Printed{' '}
        {formatFullDate(localDate())} from TeachForFree.
      </footer>
    </article>
  )
}

function Section({
  title,
  children,
  className,
}: {
  title: string
  children: ReactNode
  className?: string
}) {
  return (
    <section className={cn('mt-2.5 flex flex-col', className)}>
      <h2 className="mb-1 text-[9pt] font-bold tracking-wider text-neutral-600 uppercase">
        {title}
      </h2>
      {children}
    </section>
  )
}

function ReportStat({
  label,
  value,
  symbol,
  note,
}: {
  label: string
  value: string
  symbol?: ReactNode
  note?: string
}) {
  // A border, not a fill: browsers leave background colors off paper.
  return (
    <div className="flex min-w-0 items-baseline justify-between gap-2 rounded-md border border-neutral-400 px-2.5 py-1">
      <dt className="flex items-center gap-1 self-center text-[9pt] text-neutral-600">
        {symbol}
        {label}
      </dt>
      <dd className="text-right text-[13pt] leading-tight font-bold whitespace-nowrap">
        {value}
        {note && (
          <span className="ml-1 text-[8pt] font-normal text-neutral-600">
            {note}
          </span>
        )}
      </dd>
    </div>
  )
}

/** One kind's mark types, each with a bar on a scale shared by both kinds. */
function TypeGroup({
  positive,
  types,
  max,
}: {
  positive: boolean
  types: Array<TypeCount>
  max: number
}) {
  return (
    <div className="flex flex-col gap-1">
      <h3 className="flex items-center gap-1 text-[9pt] font-bold">
        <MarkSymbol positive={positive} />
        {positive ? 'Positive' : 'Needs work'}
      </h3>
      {types.length === 0 ? (
        <p className="text-[9pt] text-neutral-600">None this day</p>
      ) : (
        types.map((type) => (
          <div
            key={type.id}
            className="grid grid-cols-[1fr_5.5em_1.75em] items-center gap-2"
          >
            <span className="min-w-0 break-words">{type.name}</span>
            <CountBar count={type.count} max={max} positive={positive} />
            <span className="text-right font-bold tabular-nums">
              {type.count}
            </span>
          </div>
        ))
      )}
    </div>
  )
}

/** The last school days side by side, so one day can be seen in context. */
function RecentDays({
  trend,
  date,
}: {
  trend: DailyCounts | undefined
  date: string
}) {
  const days = trend && schoolDaysToShow(trend.days, date)
  if (!days?.length) {
    return (
      <Section title="Recent school days">
        <p className="text-neutral-600">
          Recent days couldn’t be loaded. Connect to the internet and print
          again to include them.
        </p>
      </Section>
    )
  }

  // Averaged over days with marks only: a day without any may be a day the
  // student was away, which would make every day look quieter.
  const { positive, negative, marked } = sumDays(days)

  return (
    <Section title={`Last ${days.length} school days`}>
      <div className="mb-1 flex flex-wrap gap-x-3 text-[9pt] font-bold">
        <span className="flex items-center gap-1">
          <FillSwatch positive />
          Positive (up)
        </span>
        <span className="flex items-center gap-1">
          <FillSwatch positive={false} />
          Needs work (down)
        </span>
        <span className="flex items-center gap-1">
          <svg
            viewBox="0 0 12 12"
            aria-hidden
            className="inline-block size-[0.85em]"
          >
            <rect width="12" height="12" rx="2" className="fill-neutral-200" />
          </svg>
          This report
        </span>
      </div>
      <TrendStrip days={days} reportDate={date} />
      <p className="mt-1 text-[9pt]">
        In all: {positive} positive, {negative} needs work.
        {marked >= 2 && (
          <>
            {' '}
            A typical day with marks: {perDay(positive / marked)} positive,{' '}
            {perDay(negative / marked)} needs work.
          </>
        )}
      </p>
    </Section>
  )
}

/** A line to sign, who signs it, and a line for the date. */
function SignatureLine({ label, name }: { label: string; name?: string }) {
  return (
    <div className="flex flex-col">
      <div className="h-8 border-b border-neutral-900" />
      <p className="mt-0.5 text-[9pt] text-neutral-700">
        <b className="text-neutral-900">{label}</b>
        {name && <> — {name}</>}
      </p>
      <div className="mt-2 flex items-end gap-1.5 text-[9pt] text-neutral-700">
        Date
        <div className="h-5 flex-1 border-b border-neutral-900" />
      </div>
    </div>
  )
}

// ---------- The words ----------

/** "3 positive marks", "1 positive mark", "no positive marks". */
function count(n: number, noun: string) {
  if (n === 0) return `no ${noun}s`
  return `${n} ${noun}${n === 1 ? '' : 's'}`
}

/** The day in a sentence or two. */
function daySummary(first: string, positive: number, negative: number) {
  const total = positive + negative
  if (total === 0) {
    return { headline: `No marks were recorded for ${first} this day.` }
  }
  const headline = `${first} received ${count(positive, 'positive mark')} and ${count(negative, 'needs-work mark')}.`
  // One mark says all there is in the headline.
  if (total === 1) return { headline }
  if (negative === 0) return { headline, detail: 'Every mark was positive.' }
  if (positive === 0) {
    return { headline, detail: 'Every mark was a needs-work mark.' }
  }
  // A percent of a handful of marks sounds more certain than it is.
  const percent =
    total >= 5 ? ` (${Math.round((positive / total) * 100)}%)` : ''
  return {
    headline,
    detail: `${positive} of ${total} marks were positive${percent}.`,
  }
}

function times(n: number) {
  return n === 1 ? 'once' : `${n} times`
}

/** What to praise and what to work on, from the day's most common marks. */
function talkingPoints(first: string, types: Array<TypeCount>) {
  const praise = types.find((t) => t.isPositive)
  const work = types.find((t) => !t.isPositive)
  const points: Array<{ lead: string; text: string }> = []
  if (praise) {
    points.push({
      lead: 'Celebrate:',
      text: `“${praise.name}”, ${times(praise.count)}. Ask ${first} what they did.`,
    })
  }
  if (work) {
    points.push({
      lead: 'Work on together:',
      text: `“${work.name}”, ${times(work.count)}. Talk about what could help next time.`,
    })
  }
  if (!work && praise) {
    points.push({
      lead: 'Notice:',
      text: 'No needs-work marks this day. That’s worth saying out loud.',
    })
  }
  if (points.length === 0) {
    points.push({
      lead: 'Ask:',
      text: `What was the best part of ${first}’s day?`,
    })
  }
  return points
}
