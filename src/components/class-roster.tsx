import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Tabs, TabsContent } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import type { OpenClassroom, Student } from '#/lib/auth'
import { formatStudentCount } from '#/lib/classroom'
import { formatNet, groupColorClass, groupMembers } from '#/lib/groups'
import type { StudentGroup } from '#/lib/groups'
import { useMarkSource } from '#/lib/mark-source'
import { useOnline } from '#/lib/online'
import { preloadMarkSounds } from '#/lib/sounds'
import { GroupEditor } from '#/components/groups/group-editor'
import { GroupsView } from '#/components/groups/groups-view'
import { MarkDialog } from '#/components/mark-dialog'
import { RandomPickDialog } from '#/components/random-pick-dialog'
import { RosterToolbar } from '#/components/roster-toolbar'
import type { RosterView } from '#/components/roster-toolbar'
import { StudentCard, initials } from '#/components/student-card'
import { useGiveMark } from '#/hooks/useGiveMark'
import type { MarkTarget } from '#/hooks/useGiveMark'
import { useRandomPick } from '#/hooks/useRandomPick'
import type { RandomPick } from '#/hooks/useRandomPick'

// The tab each class was last on, while the app is open. The roster is keyed
// by class, so without this every switch would land back on Students.
const lastView = new Map<string, RosterView>()

/** A group that can be marked or picked: it has members on the roster. */
type MarkableGroup = StudentGroup & { members: Array<Student> }

/**
 * The open class's students as a grid of cards (see StudentCard): initials
 * in a ring of today's marks, first name, and the + / − counts. 3 per row on
 * phones, up to 8 on laptops. Sorted by the backend. Straight on the page,
 * not in a card, so phones get the full width.
 *
 * Tapping a card opens the marks to give that student. Above the grid (see
 * RosterToolbar):
 * - Students | Groups tabs. Groups shows the class's groups (GroupsView):
 *   tapping one gives the whole group a mark, and Edit changes them
 *   (GroupEditor).
 * - "Select" lets the teacher tap several cards and give them all one mark,
 *   or print their behavior reports (when onPrintReports is given). Once
 *   picking, "Select all" picks every card, so the teacher can untick the
 *   few who shouldn't get it.
 * - "Random" picks a student (or, on Groups, a group) to call on (see
 *   RandomPickDialog), each one once before anyone comes up again.
 *
 * Read-only (a co-teacher who can view but not edit Classes): no marks to
 * give, so no Select or Edit (just the tabs and Random), and a card opens
 * the student's page. A substitute can mark groups but not change them.
 */
export function ClassRoster({
  classroom,
  pageLinks = true,
  readOnly = false,
  onPrintReports,
}: {
  classroom: Pick<OpenClassroom, 'id' | 'name' | 'students'>
  /** The marks dialog's links to other pages (see MarkDialog). */
  pageLinks?: boolean
  readOnly?: boolean
  /**
   * Print was pressed while picking, with the picked students in roster
   * order. They stay picked. Left out, there's no Print button.
   */
  onPrintReports?: (students: Array<Student>) => void
}) {
  const navigate = useNavigate()
  const online = useOnline()
  const { id: classroomId, name, students } = classroom
  const sectionRef = useRef<HTMLElement>(null)
  const labels = cardLabels(students)
  const labelsById = new Map(students.map((s, i) => [s.id, labels[i]]))
  const labelFor = (s: Student) => labelsById.get(s.id) ?? s.first_name
  const [view, setView] = useState<RosterView>(
    () => lastView.get(classroomId) ?? 'students',
  )

  // Today's counts, in the teacher's own time zone (or, for a substitute,
  // the shared day's; see mark-source.tsx).
  const source = useMarkSource()
  const counts = source.useCounts(classroomId)
  const countsByStudent = useMemo(
    () => new Map(counts.data?.students.map((s) => [s.student_id, s])),
    [counts.data],
  )
  const give = useGiveMark(classroomId)

  // Null until the counts load (or if they can't), so no fake zeros.
  // Students missing from the counts have none today.
  function todayFor(studentId: string) {
    if (!counts.data) return null
    return countsByStudent.get(studentId) ?? { positive: 0, negative: 0 }
  }

  // The class's groups and team points. Loaded with the roster, so the tab
  // and Random are ready.
  const groups = source.useGroups(classroomId)
  const canEditGroups = !readOnly && source.canEditGroups
  // Opening the editor; shuffle opens Random groups straight away.
  const [editing, setEditing] = useState<{ shuffle: boolean } | null>(null)
  const markableGroups = useMemo<Array<MarkableGroup>>(
    () =>
      (groups.data?.groups ?? [])
        .map((g) => ({ ...g, members: groupMembers(g, students) }))
        .filter((g) => g.members.length > 0),
    [groups.data, students],
  )

  // So the first mark's sound doesn't wait for the download.
  useEffect(() => {
    preloadMarkSounds()
  }, [])

  // Picking students for one mark. Read through the roster, so students
  // who've left it (after a refresh) drop out on their own.
  const [selecting, setSelecting] = useState(false)
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  )
  const selected = students.filter((s) => selectedIds.has(s.id))

  // Who the marks dialog is for. Kept after closing, so its title doesn't
  // blank out while it animates away.
  const [target, setTarget] = useState<MarkTarget | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  // Calling on a student, or a group, at random. seq counts the picks: each
  // new one plays the dialog's shuffle.
  const picker = useRandomPick(classroomId, students)
  const [pick, setPick] = useState<
    (RandomPick<Student> & { seq: number }) | null
  >(null)
  const [randomOpen, setRandomOpen] = useState(false)
  const groupPicker = useRandomPick(`${classroomId}:groups`, markableGroups)
  const [groupPick, setGroupPick] = useState<
    (RandomPick<MarkableGroup> & { seq: number }) | null
  >(null)
  const [randomGroupOpen, setRandomGroupOpen] = useState(false)

  function pickRandom() {
    const next = picker.draw()
    if (!next) return
    setPick((prev) => ({ ...next, seq: (prev?.seq ?? 0) + 1 }))
    setRandomOpen(true)
  }

  function pickRandomGroup() {
    const next = groupPicker.draw()
    if (!next) return
    setGroupPick((prev) => ({ ...next, seq: (prev?.seq ?? 0) + 1 }))
    setRandomGroupOpen(true)
  }

  function openMarks(next: MarkTarget) {
    setTarget(next)
    setDialogOpen(true)
  }

  function markGroup(group: StudentGroup, members: Array<Student>) {
    openMarks({ kind: 'group', group, students: members })
  }

  function switchView(next: RosterView) {
    lastView.set(classroomId, next)
    setView(next)
  }

  function stopSelecting() {
    setSelecting(false)
    setSelectedIds(new Set())
  }

  function toggle(studentId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (!next.delete(studentId)) next.add(studentId)
      return next
    })
  }

  function giveFromDialog(markType: Parameters<typeof give>[1]) {
    if (!target) return
    give(target, markType)
    // While selecting, the dialog can only have come from the Give button:
    // done with these students.
    if (selecting) stopSelecting()
  }

  // Escape also leaves select mode, unless it's closing a dialog or menu.
  // Listened for first (window, capture), before any dialog closes itself.
  useEffect(() => {
    if (!selecting || dialogOpen) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      // Not while hidden (the presenter's class view, closed).
      if (sectionRef.current?.closest('[inert]')) return
      const inPopup =
        e.target instanceof Element &&
        e.target.closest('[role=dialog], [role=alertdialog], [role=menu]')
      if (inPopup) return
      stopSelecting()
      // Used up, so the presenter's class view doesn't also close.
      e.preventDefault()
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [selecting, dialogOpen])

  const onGroups = view === 'groups'

  return (
    <section
      ref={sectionRef}
      aria-label="Students"
      className="flex flex-col gap-2"
    >
      <Tabs
        value={view}
        onValueChange={(next: RosterView) => switchView(next)}
        className="gap-2"
      >
        {/* Hidden, not removed, while editing groups: the editor has its own
            bar, and the panels are named by their tabs. */}
        <div className={cn(editing && 'hidden')}>
          <RosterToolbar
            view={view}
            readOnly={readOnly}
            selecting={selecting}
            selectedCount={selected.length}
            totalCount={students.length}
            onSelect={() => setSelecting(true)}
            onToggleAll={() =>
              setSelectedIds(
                selected.length === students.length
                  ? new Set()
                  : new Set(students.map((s) => s.id)),
              )
            }
            onGive={() =>
              openMarks(
                // Just one: the same as tapping their card. Everyone (nobody
                // unticked): the whole class.
                selected.length === 1
                  ? { kind: 'student', student: selected[0] }
                  : selected.length === students.length
                    ? { kind: 'class', students }
                    : { kind: 'selected', students: selected },
              )
            }
            onPrint={onPrintReports && (() => onPrintReports(selected))}
            onCancel={stopSelecting}
            onRandom={onGroups ? pickRandomGroup : pickRandom}
            randomDisabled={
              onGroups ? markableGroups.length === 0 : students.length === 0
            }
            onEditGroups={
              // Shown once there are groups; the empty tab has its own
              // buttons to make some.
              canEditGroups && (groups.data?.groups.length ?? 0) > 0
                ? () => setEditing({ shuffle: false })
                : undefined
            }
            editGroupsDisabled={!online || !groups.data}
          />
        </div>

        {/* Not a tab stop itself: the cards inside are. */}
        <TabsContent value="students" tabIndex={-1} className="text-base">
          <ul className="grid grid-cols-4 gap-2 sm:grid-cols-5 sm:gap-3 md:grid-cols-6 lg:grid-cols-8">
            {students.map((student, i) => (
              <li key={student.id} className="min-w-0">
                <StudentCard
                  student={student}
                  label={labels[i]}
                  today={todayFor(student.id)}
                  selecting={selecting}
                  selected={selecting && selectedIds.has(student.id)}
                  onPress={() => {
                    if (readOnly) {
                      if (pageLinks) {
                        void navigate({
                          to: '/students/$studentId',
                          params: { studentId: student.id },
                        })
                      }
                      return
                    }
                    if (selecting) toggle(student.id)
                    else openMarks({ kind: 'student', student })
                  }}
                />
              </li>
            ))}
          </ul>
        </TabsContent>
        <TabsContent
          value="groups"
          tabIndex={-1}
          className="rounded-xl text-base"
        >
          {editing && groups.data ? (
            <GroupEditor
              classroomId={classroomId}
              data={groups.data}
              students={students}
              labelFor={labelFor}
              startWithShuffle={editing.shuffle}
              onClose={() => setEditing(null)}
            />
          ) : (
            <GroupsView
              groups={groups}
              students={students}
              labelFor={labelFor}
              canEdit={canEditGroups}
              canMark={!readOnly}
              onMark={markGroup}
              onEdit={() => setEditing({ shuffle: false })}
              onShuffle={() => setEditing({ shuffle: true })}
            />
          )}
        </TabsContent>
      </Tabs>

      <MarkDialog
        {...dialogText(target, name)}
        studentId={target?.kind === 'student' ? target.student.id : undefined}
        pageLinks={pageLinks}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onPick={giveFromDialog}
      />

      <RandomPickDialog
        open={randomOpen}
        onOpenChange={setRandomOpen}
        title="Random student"
        description="Everyone comes up once before anyone comes up again."
        pick={pick}
        items={students}
        labelFor={labelFor}
        fullNameFor={(s) => `${s.first_name} ${s.last_name}`.trim()}
        avatarFor={(s) => (
          <Avatar aria-hidden className="size-full after:hidden">
            <AvatarFallback className="bg-muted text-2xl font-bold text-foreground sm:text-3xl">
              {initials(s.first_name, s.last_name)}
            </AvatarFallback>
          </Avatar>
        )}
        todayFor={(s) => todayFor(s.id)}
        left={picker.left}
        total={picker.total}
        onPickAgain={pickRandom}
        onStartOver={picker.reset}
        onGiveMark={
          readOnly
            ? undefined
            : (student) => {
                setRandomOpen(false)
                openMarks({ kind: 'student', student })
              }
        }
      />

      <RandomPickDialog
        open={randomGroupOpen}
        onOpenChange={setRandomGroupOpen}
        title="Random group"
        description="Every group comes up once before any comes up again."
        pick={groupPick}
        items={markableGroups}
        labelFor={(g) => g.name}
        fullNameFor={(g) => g.name}
        avatarFor={(g) => (
          <span
            aria-hidden
            className={cn(
              'flex size-full items-center justify-center rounded-full text-2xl font-bold tabular-nums sm:text-3xl',
              groupColorClass(g.color),
            )}
          >
            {formatNet(currentScore(g))}
          </span>
        )}
        todayFor={currentScore}
        left={groupPicker.left}
        total={groupPicker.total}
        onPickAgain={pickRandomGroup}
        onStartOver={groupPicker.reset}
        onGiveMark={
          readOnly
            ? undefined
            : (g) => {
                setRandomGroupOpen(false)
                const latest = markableGroups.find((x) => x.id === g.id) ?? g
                markGroup(latest, latest.members)
              }
        }
      />
    </section>
  )

  /** A group's team points as they are now, not when it was picked. */
  function currentScore(g: StudentGroup) {
    return groups.data?.groups.find((x) => x.id === g.id)?.score ?? g.score
  }
}

/** The marks dialog's title and line under it, for who it's giving to. */
function dialogText(target: MarkTarget | null, className: string) {
  const undoNote = 'You can undo it for 5 seconds.'
  if (!target) return { title: '', description: '' }
  if (target.kind === 'student') {
    const { first_name, last_name } = target.student
    return {
      title: `${first_name} ${last_name}`.trim(),
      description: `Tap a mark. ${undoNote}`,
    }
  }
  const { length } = target.students
  if (target.kind === 'selected') {
    return {
      title: formatStudentCount(length),
      description: `Tap a mark to give it to all ${length}. ${undoNote}`,
    }
  }
  if (target.kind === 'group') {
    const { name } = target.group
    return {
      title: `${name} · ${formatStudentCount(length)}`,
      description:
        length === 1
          ? `Tap a mark to give it to ${name} and its 1 student. ${undoNote}`
          : `Tap a mark to give it to ${name} and each of its ${length} students. ${undoNote}`,
    }
  }
  return {
    title: length === 1 ? 'Whole class' : `All ${formatStudentCount(length)}`,
    description: `Tap a mark to give it to everyone in ${className}. ${undoNote}`,
  }
}

/**
 * What each card says: the first name, or "Sam L." when another student in
 * the class is also called Sam, so the two can be told apart.
 */
function cardLabels(students: Array<Student>) {
  const key = (s: Student) => s.first_name.trim().toLowerCase()
  const count = new Map<string, number>()
  for (const s of students) count.set(key(s), (count.get(key(s)) ?? 0) + 1)

  return students.map((s) => {
    const lastInitial = s.last_name.trim().charAt(0).toUpperCase()
    return (count.get(key(s)) ?? 0) > 1 && lastInitial
      ? `${s.first_name} ${lastInitial}.`
      : s.first_name
  })
}
