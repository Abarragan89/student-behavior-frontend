import {
  capitalize,
  formatDayList,
  formatFullDay,
  formatRange,
  noticeStrings,
} from '#/lib/conference-i18n'
import type { Lang } from '#/lib/conference-i18n'
import { CUTOFF_HOURS, fullName, signUpDays } from '#/lib/conferences'
import type { Conference, ConferenceNotice } from '#/lib/conferences'
import { QrSvg } from '#/components/qr-svg'

/**
 * The notices on paper, one page per student: English on the top half,
 * Spanish on the bottom, each complete with its own QR code, so a family can
 * keep just their half. A student with no time yet gets a sign-up notice:
 * the same page, inviting the family to choose a time with the code. On the
 * page only while printing (`print:block`).
 * Dark ink on white, borders instead of fills, so it prints the same on any
 * printer and with "background graphics" off.
 *
 * The editor names the saved PDF (usePrintTitle).
 *
 * Sizes are in millimeters and points, for paper. A page is 250mm tall,
 * which fits both Letter (255mm) and A4 (273mm) inside the 12mm margins in
 * styles.css.
 */
export function PrintNotices({
  conference,
  notices,
  now,
}: {
  conference: Conference
  notices: Array<ConferenceNotice> | null
  now: number
}) {
  if (!notices) return null
  // For sign-up notices: the days a family can still choose a time on.
  const days = signUpDays(conference, now)
  return (
    <div className="hidden bg-white text-black print:block">
      {notices.map((n) => (
        <section
          key={n.student_id}
          className="notice-page flex h-[250mm] flex-col overflow-hidden"
        >
          <NoticeHalf
            lang="en"
            notice={n}
            conference={conference}
            days={days}
          />
          <div
            aria-hidden
            className="my-[4mm] border-t-[1.5px] border-dashed border-black/60"
          />
          <NoticeHalf
            lang="es"
            notice={n}
            conference={conference}
            days={days}
          />
        </section>
      ))}
    </div>
  )
}

function NoticeHalf({
  lang,
  notice,
  conference,
  days,
}: {
  lang: Lang
  notice: ConferenceNotice
  conference: Conference
  days: Array<string>
}) {
  const s = noticeStrings[lang]
  const tz = conference.timezone
  const teacher = conference.notice_name
  const canChange = conference.parent_changes
  const url = lang === 'es' ? notice.url_es : notice.url
  const signUp = notice.starts_at === null || notice.ends_at === null
  const scan = signUp ? s.scanSignUp : canChange ? s.scanChange : s.scanSee

  return (
    <article
      lang={lang}
      className="grid h-[120mm] grid-cols-[1fr_50mm] gap-[6mm] overflow-hidden"
    >
      <div className="flex min-w-0 flex-col gap-[3mm]">
        <header>
          <h2 className="text-[20pt] leading-tight font-bold">{s.heading}</h2>
          <p className="line-clamp-2 text-[12pt]">
            {s.forFamily(fullName(notice))}
          </p>
        </header>
        <div className="rounded-[2mm] border-2 border-black px-[4mm] py-[3mm]">
          {notice.starts_at === null || notice.ends_at === null ? (
            <>
              <p className="text-[10pt] font-bold tracking-wide uppercase">
                {s.signUpLabel}
              </p>
              <p className="text-[26pt] leading-tight font-bold">
                {s.signUpCall}
              </p>
              {days.length > 0 && (
                <p className="line-clamp-2 text-[12pt] font-bold">
                  {s.signUpDays(formatDayList(days, tz, lang))}
                </p>
              )}
            </>
          ) : (
            <>
              <p className="text-[10pt] font-bold tracking-wide uppercase">
                {s.yourConference}
              </p>
              <p className="text-[15pt] font-bold">
                {capitalize(formatFullDay(notice.starts_at, tz, lang))}
              </p>
              <p className="text-[26pt] leading-tight font-bold">
                {formatRange(notice.starts_at, notice.ends_at, tz, lang)}
              </p>
            </>
          )}
          <p className="line-clamp-2 text-[12pt]">
            {s.withTeacher(teacher, conference.location)}
          </p>
        </div>
        <p className="text-[12pt] leading-snug">
          {signUp
            ? s.signUpBody(CUTOFF_HOURS)
            : canChange
              ? s.canChange(CUTOFF_HOURS)
              : s.cannotChange}
        </p>
        <p className="mt-auto text-[12pt] italic">{s.thanks(teacher)}</p>
      </div>

      <div className="flex flex-col items-center gap-[2mm] pt-[2mm] text-center">
        {/* The white border is the quiet zone phones need around the code. */}
        <div className="border border-black bg-white p-[3mm]">
          <QrSvg value={url} label={scan} className="size-[42mm]" />
        </div>
        <p className="text-[11pt] leading-tight font-bold">{scan}</p>
        <p className="text-[9.5pt] leading-tight">
          {s.private(notice.first_name)}
        </p>
      </div>
    </article>
  )
}
