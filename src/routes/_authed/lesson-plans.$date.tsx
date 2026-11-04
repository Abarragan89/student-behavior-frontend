import { useEffect, useState } from 'react'
import { flushSync } from 'react-dom'
import { Link, createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import {
  CalendarDays,
  CalendarX,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  BookmarkPlus,
  LayoutTemplate,
  Presentation,
  Printer,
  RefreshCw,
  Share,
} from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
import {
  Empty,
  EmptyContent,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'
import {
  formatClockRange,
  formatWeekday,
  monthOf,
  stepSchoolDay,
} from '#/lib/calendar'
import { formatLongDate, isDateString, useToday } from '#/lib/day'
import {
  isBlank,
  lessonPlanDayQueryOptions,
  progress,
} from '#/lib/lesson-plans'
import type { PlanDay } from '#/lib/lesson-plans'
import { flushDrafts } from '#/lib/lesson-plan-queue'
import { useOnline } from '#/lib/online'
import { canShareWithSub, mayLoad, usePermission } from '#/lib/workspace'
import { meQueryOptions } from '#/lib/auth'
import { OfflineNote } from '#/components/offline-note'
import { CopyDayDialog } from '#/components/lesson-plans/copy-day-dialog'
import {
  EditorEndSpace,
  PlanEditor,
} from '#/components/lesson-plans/plan-editor'
import { useDayTarget } from '#/components/lesson-plans/plan-target'
import { TemplatePickerDialog } from '#/components/lesson-plans/template-picker-dialog'
import { PrintDay } from '#/components/lesson-plans/print-day'
import { PrintDialog } from '#/components/lesson-plans/print-dialog'
import { ProgressBar } from '#/components/lesson-plans/progress-bar'
import { ShareDayDialog } from '#/components/lesson-plans/share-day-dialog'

// /lesson-plans/2026-11-05: where a day is planned. Teaching from it happens
// in Presenter view (/lesson-plans/2026-11-05/present), on the whole screen.
export const Route = createFileRoute('/_authed/lesson-plans/$date')({
  // A co-teacher needs at least View on Lesson plans (_authed.tsx checks).
  staticData: { feature: { key: 'lesson_plans', level: 'view' } },
  // Started early, not waited for: the page shows what it has meanwhile.
  loader: ({ context: { queryClient }, params }) => {
    if (!isDateString(params.date)) return
    if (!mayLoad(queryClient, 'lesson_plans')) return
    void queryClient
      .query(lessonPlanDayQueryOptions(params.date))
      .catch(() => null)
  },
  component: LessonPlanDayPage,
})

function LessonPlanDayPage() {
  const { date } = Route.useParams()
  if (!isDateString(date)) return <NotADate />
  // A new page for each date, so drafts and dialogs don't carry over.
  return <DayPlan key={date} date={date} />
}

function DayPlan({ date }: { date: string }) {
  const navigate = Route.useNavigate()
  const today = useToday()
  const online = useOnline()
  const day = useQuery(lessonPlanDayQueryOptions(date))
  // A co-teacher with View only reads the plan; sharing with a sub also
  // needs Edit on Classes (the sub gives marks).
  const editable = usePermission('lesson_plans') === 'edit'
  const { data: me } = useQuery(meQueryOptions)
  const canShare = canShareWithSub(me)
  const target = useDayTarget(date)
  const [copyOpen, setCopyOpen] = useState(false)
  const [templateOpen, setTemplateOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [printOpen, setPrintOpen] = useState(false)
  // The sub link to print as a QR code, for this one printout only.
  const [printLink, setPrintLink] = useState<string | null>(null)
  useEffect(() => {
    const done = () => setPrintLink(null)
    window.addEventListener('afterprint', done)
    return () => window.removeEventListener('afterprint', done)
  }, [])

  function print(subLink: string | null) {
    // On the page before the print dialog opens; the question box is hidden
    // on paper while it closes (styles.css).
    flushSync(() => {
      setPrintOpen(false)
      setPrintLink(subLink)
    })
    window.print()
  }

  const sections = day.data?.sections ?? []
  const { done, total } = progress(sections)

  // Replaced, not pushed: Back still leaves the plan for the calendar.
  function showDay(next: string) {
    flushDrafts()
    void navigate({
      to: '/lesson-plans/$date',
      params: { date: next },
      replace: true,
    })
  }

  const arrowClass =
    'size-11 shrink-0 rounded-lg border-2 border-border bg-card'

  return (
    <>
      <main className="mx-auto flex w-full max-w-3xl min-w-0 flex-1 flex-col gap-5 px-4 py-6 sm:py-8 print:hidden">
        <Link
          to="/lesson-plans"
          search={{
            month: monthOf(date) === monthOf(today) ? undefined : monthOf(date),
          }}
          className={cn(
            buttonVariants({ variant: 'link' }),
            'h-auto self-start px-0 text-base font-bold',
          )}
        >
          <CalendarDays className="size-5" />
          Calendar
        </Link>

        <header className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            aria-label={`Previous school day, ${formatLongDate(stepSchoolDay(date, -1))}`}
            onClick={() => showDay(stepSchoolDay(date, -1))}
            className={arrowClass}
          >
            <ChevronLeft className="size-5" />
          </Button>
          <div className="flex min-w-0 flex-1 flex-col items-center text-center">
            <h1 className="text-xl leading-tight font-bold sm:text-2xl">
              {formatLongDate(date)}
            </h1>
            {date === today ? (
              <p className="text-sm font-bold text-primary">Today</p>
            ) : (
              <Button
                variant="link"
                onClick={() => showDay(today)}
                className="h-auto px-1 py-0 text-sm font-bold"
              >
                Go to today
              </Button>
            )}
          </div>
          <Button
            variant="outline"
            size="icon"
            aria-label={`Next school day, ${formatLongDate(stepSchoolDay(date, 1))}`}
            onClick={() => showDay(stepSchoolDay(date, 1))}
            className={arrowClass}
          >
            <ChevronRight className="size-5" />
          </Button>
        </header>

        {sections.length > 0 && (
          <div className="flex items-center gap-2">
            <Link
              to="/lesson-plans/$date/present"
              params={{ date }}
              onClick={flushDrafts}
              className={cn(
                buttonVariants(),
                'h-12 flex-1 rounded-lg border-2 border-border text-base font-bold shadow-sm',
              )}
            >
              <Presentation className="size-5" />
              Presenter view
            </Link>
            {/* A sub's link only works on its day, so not for days gone by. */}
            {date >= today && canShare && (
              <Button
                variant="outline"
                size="icon"
                aria-label="Share with a substitute"
                title="Share with a substitute"
                onClick={() => {
                  flushDrafts()
                  setShareOpen(true)
                }}
                className="size-12 shrink-0 rounded-lg border-2 border-border bg-card"
              >
                <Share className="size-5" />
              </Button>
            )}
            <Button
              variant="outline"
              size="icon"
              aria-label="Print this plan"
              onClick={() => {
                flushDrafts()
                // Today or later: offer a QR code for a sub. A sub link
                // can't work for a day gone by, so those just print.
                if (date >= today && canShare) setPrintOpen(true)
                else window.print()
              }}
              className="size-12 shrink-0 rounded-lg border-2 border-border bg-card"
            >
              <Printer className="size-5" />
            </Button>
          </div>
        )}

        {/* Templates need the editor: online, and allowed to edit. */}
        {sections.length > 0 && online && editable && (
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              onClick={() => {
                flushDrafts()
                setTemplateOpen(true)
              }}
              className="h-11 rounded-lg border-2 border-border bg-card text-base font-bold"
            >
              <LayoutTemplate className="size-5" />
              Use a template
            </Button>
            <Link
              to="/lesson-plans/templates/new"
              search={{ from: date }}
              onClick={flushDrafts}
              className={cn(
                buttonVariants({ variant: 'outline' }),
                'h-11 rounded-lg border-2 border-border bg-card text-base font-bold',
              )}
            >
              <BookmarkPlus className="size-5" />
              Save as template
            </Link>
          </div>
        )}

        {total > 0 && (
          <ProgressBar
            done={done}
            total={total}
            label={done === total ? 'All done!' : `${done} of ${total} done`}
          />
        )}

        {day.data ? (
          online && editable ? (
            <>
              <PlanEditor
                day={day.data}
                target={target}
                onCopyFromDay={() => setCopyOpen(true)}
                onStartWithTemplate={() => setTemplateOpen(true)}
              />
              {sections.length > 0 && <EditorEndSpace />}
            </>
          ) : sections.length > 0 ? (
            <>
              {editable && (
                <OfflineNote action="edit this plan. You can still check things off in Presenter view" />
              )}
              <PlanOutline day={day.data} />
            </>
          ) : (
            <Empty className="rounded-xl border-2 border-dashed border-border px-4 py-10">
              <EmptyHeader>
                <EmptyMedia
                  variant="icon"
                  className="size-14 rounded-lg border-2 border-border bg-chart-3 text-foreground"
                >
                  <CalendarX className="size-7" />
                </EmptyMedia>
                <EmptyTitle className="text-xl font-bold">
                  Nothing planned for {formatWeekday(date)}
                </EmptyTitle>
              </EmptyHeader>
              {editable && (
                <EmptyContent>
                  <OfflineNote
                    action="plan this day"
                    className="justify-center"
                  />
                </EmptyContent>
              )}
            </Empty>
          )
        ) : day.isError ? (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <p className="flex items-center gap-2 font-medium">
              <CircleAlert className="size-5 shrink-0 text-destructive" />
              {online
                ? 'Couldn’t load this day’s plan.'
                : 'This day’s plan isn’t saved on this device. Connect to the internet to see it.'}
            </p>
            <Button
              variant="outline"
              onClick={() => void day.refetch()}
              disabled={day.isFetching}
              className="h-11 rounded-lg border-2 border-border font-bold"
            >
              <RefreshCw className={cn(day.isFetching && 'animate-spin')} />
              Try again
            </Button>
          </div>
        ) : (
          <p
            role="status"
            className="flex items-center justify-center gap-2 py-16 font-medium text-muted-foreground"
          >
            <Spinner aria-hidden className="size-5" />
            {online ? 'Loading plan…' : 'Waiting for a connection…'}
          </p>
        )}
      </main>

      {day.data && <PrintDay day={day.data} subLink={printLink ?? undefined} />}
      {canShare && (
        <PrintDialog
          date={date}
          open={printOpen}
          onOpenChange={setPrintOpen}
          onPrint={print}
        />
      )}
      {editable && (
        <CopyDayDialog open={copyOpen} onOpenChange={setCopyOpen} date={date} />
      )}
      {editable && (
        <TemplatePickerDialog
          open={templateOpen}
          onOpenChange={setTemplateOpen}
          date={date}
        />
      )}
      {canShare && (
        <ShareDayDialog
          date={date}
          open={shareOpen}
          onOpenChange={setShareOpen}
        />
      )}
    </>
  )
}

/**
 * The plan to read, not edit: shown offline, when editing can't be saved,
 * and to a co-teacher who can view but not edit plans.
 */
function PlanOutline({ day }: { day: PlanDay }) {
  return (
    <div className="flex flex-col gap-3">
      {day.sections.map((s) => {
        const time = formatClockRange(s.start_time, s.end_time)
        return (
          <section
            key={s.id}
            className="rounded-xl border-2 border-border bg-card p-4 shadow-md"
          >
            <h2 className="text-lg leading-snug font-bold">
              {s.title.trim() || 'Untitled section'}
            </h2>
            {time && <p className="text-sm text-muted-foreground">{time}</p>}
            <ul className="mt-2 flex flex-col gap-1.5">
              {s.items
                .filter((i) => !isBlank(i))
                .map((i) => (
                  <li
                    key={i.id}
                    className={cn(
                      'flex items-start gap-2',
                      { 0: '', 1: 'ml-7', 2: 'ml-14' }[i.indent],
                    )}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        'mt-1 flex size-4 shrink-0 items-center justify-center border-2 border-border',
                        i.indent > 0 ? 'rounded-full' : 'rounded',
                        i.done && 'bg-chart-5',
                      )}
                    >
                      {i.done && <Check className="size-3" strokeWidth={4} />}
                    </span>
                    <span
                      className={cn(
                        'wrap-break-word whitespace-pre-wrap',
                        i.done && 'text-muted-foreground line-through',
                      )}
                    >
                      {i.text}
                      <span className="sr-only">{i.done ? ' (done)' : ''}</span>
                    </span>
                  </li>
                ))}
            </ul>
          </section>
        )
      })}
    </div>
  )
}

function NotADate() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-10 text-center">
      <p className="text-lg font-bold">That isn’t a date we can open.</p>
      <Link
        to="/lesson-plans"
        className={cn(
          buttonVariants({ variant: 'outline' }),
          'h-11 rounded-lg border-2 border-border bg-card px-4 text-base font-bold',
        )}
      >
        <CalendarDays className="size-5" />
        Back to the calendar
      </Link>
    </main>
  )
}
