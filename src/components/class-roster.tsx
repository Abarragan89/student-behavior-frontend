import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { Me, Student } from '#/lib/auth'
import { formatStudentCount } from '#/lib/classroom'
import { useToday } from '#/lib/day'
import { markCountsQueryOptions } from '#/lib/marks'
import { MarkDialog } from '#/components/mark-dialog'
import { RosterToolbar } from '#/components/roster-toolbar'
import { StudentCard } from '#/components/student-card'
import { useGiveMark } from '#/hooks/useGiveMark'
import type { MarkTarget } from '#/hooks/useGiveMark'

/**
 * The open class's students as a grid of cards (see StudentCard): initials
 * in a ring of today's marks, first name, and the + / − counts. 3 per row on
 * phones, up to 8 on laptops. Sorted by the backend. Straight on the page,
 * not in a card, so phones get the full width.
 *
 * Tapping a card opens the marks to give that student. Above the grid,
 * "Select all" gives a mark to the whole class, and "Select" lets the teacher
 * tap several cards and give them all one mark.
 */
export function ClassRoster({ classroom }: { classroom: Me['classroom'] }) {
  const { id: classroomId, name, students } = classroom
  const labels = cardLabels(students)

  // Today's counts, in the teacher's own time zone.
  const today = useToday()
  const counts = useQuery(markCountsQueryOptions(classroomId, today))
  const countsByStudent = useMemo(
    () => new Map(counts.data?.students.map((s) => [s.student_id, s])),
    [counts.data],
  )
  const give = useGiveMark(classroomId)

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

  function openMarks(next: MarkTarget) {
    setTarget(next)
    setDialogOpen(true)
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

  function pick(markType: Parameters<typeof give>[1]) {
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
      const inPopup =
        e.target instanceof Element &&
        e.target.closest('[role=dialog], [role=alertdialog], [role=menu]')
      if (!inPopup) stopSelecting()
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [selecting, dialogOpen])

  return (
    <section aria-label="Students" className="flex flex-col gap-2">
      <RosterToolbar
        selecting={selecting}
        selectedCount={selected.length}
        onSelect={() => setSelecting(true)}
        onSelectAll={() => openMarks({ kind: 'class', students })}
        onGive={() =>
          openMarks(
            // Just one: the same as tapping their card.
            selected.length === 1
              ? { kind: 'student', student: selected[0] }
              : { kind: 'selected', students: selected },
          )
        }
        onCancel={stopSelecting}
      />

      <ul className="grid grid-cols-4 gap-2 sm:grid-cols-5 sm:gap-3 md:grid-cols-6 lg:grid-cols-8">
        {students.map((student, i) => (
          <li key={student.id} className="min-w-0">
            <StudentCard
              student={student}
              label={labels[i]}
              // Null until the counts load (or if they can't), so no fake
              // zeros. Students missing from the counts have none today.
              today={
                counts.data
                  ? (countsByStudent.get(student.id) ?? {
                      positive: 0,
                      negative: 0,
                    })
                  : null
              }
              selecting={selecting}
              selected={selecting && selectedIds.has(student.id)}
              onPress={() =>
                selecting
                  ? toggle(student.id)
                  : openMarks({ kind: 'student', student })
              }
            />
          </li>
        ))}
      </ul>

      <MarkDialog
        {...dialogText(target, name)}
        studentId={target?.kind === 'student' ? target.student.id : undefined}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onPick={pick}
      />
    </section>
  )
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
