import type { ClassroomTab } from '#/lib/auth'
import type { StudentDetail } from '#/lib/students'
import { usePrintTitle } from '#/hooks/usePrintTitle'
import type { ReportsToPrint } from '#/components/print-reports-dialog'
import { StudentReport } from '#/components/student-report'

/**
 * Several students' behavior reports on paper, each starting a new page
 * (.report-page in styles.css), in roster order. On the page only while
 * printing, like StudentReport itself. Names the saved PDF after the class.
 */
export function PrintedReports({
  reports,
  className,
  classrooms,
  teacherName,
}: {
  reports: ReportsToPrint
  className: string
  /** The teacher's classes, to name each student's. */
  classrooms: Array<Pick<ClassroomTab, 'id' | 'name'>>
  teacherName: string
}) {
  const { date, data } = reports
  usePrintTitle(`Behavior reports – ${className} – ${date}`)

  const names = new Map(classrooms.map((c) => [c.id, c.name]))
  const byId = new Map(data.students.map((s) => [s.student_id, s]))

  return (
    <div className="hidden print:block">
      {reports.students.map((student) => {
        const report = byId.get(student.id)
        if (!report) return null
        const detail: StudentDetail = {
          id: student.id,
          first_name: student.first_name,
          last_name: student.last_name,
          classrooms: report.classroom_ids.flatMap((id) => {
            const name = names.get(id)
            return name ? [{ id, name }] : []
          }),
        }
        return (
          <div key={student.id} className="report-page">
            <StudentReport
              student={detail}
              date={date}
              marks={report.marks}
              trend={{
                timezone: data.timezone,
                from: data.from,
                to: data.to,
                days: report.days,
              }}
              teacherName={teacherName}
              timeZone={data.timezone}
              // Only label marks with their class when there's more than one.
              classroomName={
                detail.classrooms.length > 1 ? (id) => names.get(id) : undefined
              }
            />
          </div>
        )
      })}
    </div>
  )
}
