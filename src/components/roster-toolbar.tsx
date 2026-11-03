import { useEffect, useRef } from 'react'
import type { Ref } from 'react'
import { Check, Dices, Minus, Printer, Volume2, VolumeX } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import { formatStudentCount } from '#/lib/classroom'
import { setMarkSoundsMuted, useMarkSoundsMuted } from '#/lib/sounds'

/** What the roster's grid shows: each student, or the teacher's groups. */
export type RosterView = 'students' | 'groups'

const linkClass = 'h-9 px-2 text-base font-bold'
const boxClass =
  'h-9 rounded-lg border-2 border-border bg-card px-2.5 text-base font-bold'

// A segmented control, in the app's look rather than shadcn's: black border,
// and the open tab filled like the open page in the nav.
const tabsListClass =
  'gap-0.5 rounded-lg border-2 border-border bg-card p-0.5 group-data-horizontal/tabs:h-9'
const tabClass = cn(
  'rounded-md px-2.5 text-sm font-bold text-foreground transition-colors not-data-active:hover:bg-muted focus-visible:ring-4 focus-visible:ring-ring focus-visible:outline-none motion-reduce:transition-none sm:px-3 sm:text-base dark:text-foreground',
  'data-active:bg-primary data-active:text-primary-foreground dark:data-active:bg-primary dark:data-active:text-primary-foreground',
)

/**
 * The row above the roster's grid. Kept to one line on a phone, so the
 * smaller labels there are shorter, and Random and Print are just icons.
 *
 * Normally: the Students | Groups tabs on the left; on the right the speaker
 * button (not read-only), "Select" (students) or "Edit" (groups, for whoever
 * may change them), then Random.
 *
 * While picking students, the tabs make way for a Select all tick box, and
 * the right has Cancel, Print (their behavior reports, when onPrint is
 * given) and the button that gives them a mark.
 */
export function RosterToolbar({
  view,
  readOnly,
  selecting,
  selectedCount,
  totalCount,
  onSelect,
  onToggleAll,
  onGive,
  onPrint,
  onCancel,
  onRandom,
  randomDisabled,
  onEditGroups,
  editGroupsDisabled = false,
}: {
  view: RosterView
  /** Can't give marks: no picking, just the tabs and Random. */
  readOnly: boolean
  selecting: boolean
  selectedCount: number
  totalCount: number
  onSelect: () => void
  /** Picks everyone, or nobody when everyone's already picked. */
  onToggleAll: () => void
  onGive: () => void
  /** Left out where there are no reports to print (presenter, substitute). */
  onPrint?: () => void
  onCancel: () => void
  onRandom: () => void
  randomDisabled: boolean
  /** Opens the group editor. Left out where groups can't be changed. */
  onEditGroups?: () => void
  /** Offline, or the groups haven't loaded. */
  editGroupsDisabled?: boolean
}) {
  // The pressed button disappears when the bar switches, so move focus to
  // the first button of the new set. Only on a switch, not on the first
  // render.
  const firstRef = useRef<HTMLButtonElement>(null)
  const shown = useRef(selecting)
  useEffect(() => {
    if (shown.current === selecting) return
    shown.current = selecting
    firstRef.current?.focus()
  }, [selecting])

  const groups = view === 'groups'
  const randomLabel = groups ? 'Pick a random group' : 'Pick a random student'

  return (
    <div className="mb-1 flex min-h-9 items-center justify-between gap-2">
      <div className="flex min-w-0 items-center">
        {/* Hidden, not removed, while picking: the panels are named by
            their tabs. */}
        <TabsList
          aria-label="Show"
          // The grid swaps at once, so the arrow keys can switch tabs.
          activateOnFocus
          className={cn(tabsListClass, selecting && 'hidden')}
        >
          <TabsTrigger value="students" className={tabClass}>
            Students
          </TabsTrigger>
          <TabsTrigger value="groups" className={tabClass}>
            Groups
          </TabsTrigger>
        </TabsList>
        {selecting && (
          <SelectAllButton
            ref={firstRef}
            state={
              selectedCount === 0
                ? 'none'
                : selectedCount === totalCount
                  ? 'all'
                  : 'some'
            }
            onPress={onToggleAll}
          />
        )}
      </div>

      <div className="flex items-center gap-1 sm:gap-2">
        {selecting ? (
          <>
            <Button variant="link" onClick={onCancel} className={linkClass}>
              Cancel
            </Button>
            {onPrint && (
              <Button
                variant="outline"
                onClick={onPrint}
                disabled={selectedCount === 0}
                aria-label="Print reports"
                title="Print reports"
                className={boxClass}
              >
                <Printer className="size-5" aria-hidden />
                <span className="max-sm:hidden">Print</span>
              </Button>
            )}
            <Button
              onClick={onGive}
              disabled={selectedCount === 0}
              // "Mark 3" on phones, read out in full.
              aria-label={
                selectedCount === 0
                  ? undefined
                  : `Mark ${formatStudentCount(selectedCount)}`
              }
              className="h-9 rounded-lg border-2 border-border px-4 text-base font-bold shadow-md active:scale-95 motion-reduce:transition-none"
            >
              {selectedCount === 0 ? (
                <>
                  <span className="sm:hidden">Mark</span>
                  <span className="max-sm:hidden">Select students</span>
                </>
              ) : (
                <>
                  Mark {selectedCount}
                  <span className="max-sm:hidden">
                    {selectedCount === 1 ? ' student' : ' students'}
                  </span>
                </>
              )}
            </Button>
          </>
        ) : (
          <>
            {!readOnly && <SoundButton />}
            {!readOnly && !groups && (
              <Button
                ref={firstRef}
                variant="link"
                onClick={onSelect}
                className={linkClass}
              >
                Select
              </Button>
            )}
            {groups && onEditGroups && (
              <Button
                variant="link"
                onClick={onEditGroups}
                disabled={editGroupsDisabled}
                className={linkClass}
              >
                Edit
              </Button>
            )}
            <Button
              variant="outline"
              onClick={onRandom}
              disabled={randomDisabled}
              aria-label={randomLabel}
              title={groups && randomDisabled ? 'No groups yet' : randomLabel}
              className={boxClass}
            >
              <Dices className="size-5" aria-hidden />
              <span className="max-sm:hidden">Random</span>
            </Button>
          </>
        )}
      </div>

      {/* Tells screen readers how many are picked as it changes. */}
      <span role="status" className="sr-only">
        {selecting ? `${selectedCount} selected` : ''}
      </span>
    </div>
  )
}

/**
 * Picks every student, or nobody once they're all picked. Its tick box
 * matches the cards': empty, a dash when some are picked, a tick when all
 * are. "All" on phones.
 */
function SelectAllButton({
  ref,
  state,
  onPress,
}: {
  ref: Ref<HTMLButtonElement>
  state: 'none' | 'some' | 'all'
  onPress: () => void
}) {
  return (
    // Its padding is pulled out, so the tick box lines up with the cards.
    <button
      ref={ref}
      type="button"
      role="checkbox"
      aria-checked={state === 'all' ? true : state === 'some' ? 'mixed' : false}
      aria-label="Select all"
      onClick={onPress}
      className="-ml-2 flex h-9 shrink-0 items-center gap-2 rounded-lg px-2 text-base font-bold text-primary outline-none hover:bg-muted focus-visible:ring-4 focus-visible:ring-ring"
    >
      <span
        aria-hidden
        className={cn(
          'flex size-5 items-center justify-center rounded-full border-2',
          state === 'none'
            ? 'border-border bg-card'
            : 'border-primary bg-primary text-primary-foreground',
        )}
      >
        {state === 'all' && <Check className="size-3.5" strokeWidth={4} />}
        {state === 'some' && <Minus className="size-3.5" strokeWidth={4} />}
      </span>
      <span className="sm:hidden">All</span>
      <span className="max-sm:hidden">Select all</span>
    </button>
  )
}

/**
 * Turns the sound marks make on or off (see src/lib/sounds.ts), on this
 * device. Pressed means on.
 */
function SoundButton() {
  const muted = useMarkSoundsMuted()

  return (
    <button
      type="button"
      aria-label="Mark sounds"
      aria-pressed={!muted}
      title={muted ? 'Sounds off' : 'Sounds on'}
      onClick={() => setMarkSoundsMuted(!muted)}
      className="flex size-9 shrink-0 items-center justify-center rounded-lg text-primary outline-none hover:bg-muted focus-visible:ring-4 focus-visible:ring-ring"
    >
      {muted ? (
        <VolumeX className="size-5" aria-hidden />
      ) : (
        <Volume2 className="size-5" aria-hidden />
      )}
    </button>
  )
}
