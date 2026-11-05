import {
  formatSlotDay,
  formatSlotRange,
  fullName,
  meetingState,
  slotsByDay,
} from '#/lib/conferences'
import type { Conference } from '#/lib/conferences'

/**
 * The teacher's schedule on paper: each day on its own page, its times in
 * order with who has each, a circle to tick by hand (or how the meeting
 * went, once it's over), and the teacher's note on each, with room to
 * write. On the page all the time but only shown when printing
 * (`print:block`), so a plain Ctrl+P prints it too.
 * Dark ink on white, borders instead of fills, sizes for paper.
 */
export function PrintSchedule({
  conference,
  day,
  now,
}: {
  conference: Conference
  /** Only this day ("2026-11-12"); null for every day. */
  day: string | null
  now: number
}) {
  const tz = conference.timezone
  const students = new Map(conference.students.map((s) => [s.id, s]))
  const days = slotsByDay(conference.slots, tz).filter(
    (d) => day === null || d.day === day,
  )
  const printed = new Date(now).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
  const where = [conference.notice_name, conference.location]
    .filter(Boolean)
    .join(' · ')

  if (days.length === 0) {
    return (
      <div className="hidden bg-white text-black print:block">
        <h1 className="text-[18pt] font-bold">{conference.title}</h1>
        <p className="text-[12pt]">No times yet.</p>
      </div>
    )
  }

  return (
    <div className="hidden bg-white text-black print:block">
      {days.map(({ day: d, slots }) => {
        const taken = slots.filter((s) => s.student_id).length
        return (
          <section key={d} className="schedule-day">
            <header className="mb-[4mm] flex items-end justify-between gap-[6mm] border-b-2 border-black pb-[2mm]">
              <div className="min-w-0">
                <p className="truncate text-[10pt] font-bold tracking-wide uppercase">
                  {conference.title}
                </p>
                <h1 className="text-[20pt] leading-tight font-bold">
                  {formatSlotDay(slots[0].starts_at, tz)}
                </h1>
                {where && <p className="truncate text-[11pt]">{where}</p>}
              </div>
              <p className="shrink-0 text-right text-[10pt] leading-snug">
                {taken} of {slots.length}{' '}
                {slots.length === 1 ? 'time' : 'times'} taken
                <br />
                Printed {printed}
              </p>
            </header>

            <table className="w-full table-fixed border-collapse text-[11pt]">
              <thead>
                <tr className="border-b-[1.5px] border-black text-left text-[9pt] tracking-wide uppercase">
                  <th scope="col" className="w-[36mm] py-[1.5mm] pr-[3mm]">
                    Time
                  </th>
                  <th scope="col" className="w-[54mm] py-[1.5mm] pr-[3mm]">
                    Student
                  </th>
                  <th scope="col" className="w-[26mm] py-[1.5mm] pr-[3mm]">
                    Done
                  </th>
                  <th scope="col" className="py-[1.5mm]">
                    Notes
                  </th>
                </tr>
              </thead>
              <tbody>
                {slots.map((slot) => {
                  const student = slot.student_id
                    ? students.get(slot.student_id)
                    : undefined
                  const state = student ? meetingState(slot, now) : 'open'
                  return (
                    <tr
                      key={slot.id}
                      className="h-[11mm] break-inside-avoid border-b border-black/40 align-middle"
                    >
                      <td className="pr-[3mm] font-bold whitespace-nowrap tabular-nums">
                        {formatSlotRange(slot.starts_at, slot.ends_at, tz)}
                      </td>
                      <td className="pr-[3mm] wrap-break-word">
                        {student ? (
                          <span className="font-bold">{fullName(student)}</span>
                        ) : (
                          <span className="text-black/50">Open</span>
                        )}
                      </td>
                      <td className="pr-[3mm]">
                        {state === 'completed' ? (
                          <span className="font-bold">✓ Complete</span>
                        ) : state === 'no_show' ? (
                          <span className="font-bold">No show</span>
                        ) : state === 'upcoming' ? (
                          <span
                            aria-label="Not done yet"
                            className="inline-block size-[5mm] rounded-full border-[1.5px] border-black align-middle"
                          />
                        ) : null}
                      </td>
                      {/* The teacher's note, with room left to write. */}
                      <td className="py-[1.5mm] text-[10pt] leading-snug wrap-break-word">
                        {student?.note}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </section>
        )
      })}
    </div>
  )
}
