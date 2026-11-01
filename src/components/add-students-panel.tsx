import { useId } from 'react'
import { useQuery } from '@tanstack/react-query'
import { FieldSeparator } from '@/components/ui/field'
import { Spinner } from '@/components/ui/spinner'
import type { Me } from '#/lib/auth'
import { classroomStatusQueryOptions } from '#/lib/classroom'
import AddStudentsForm from '#/components/forms/add-students-form'
import { ConnectClassroomButton } from '#/components/connect-classroom-button'
import { ConnectNoticeAlert } from '#/components/classroom-connect-notice'
import type { ConnectNotice } from '#/components/classroom-connect-notice'
import { GoogleClassCards } from '#/components/google-class-cards'

/**
 * The Add Students dialog's content: type names in, or bring a class in from
 * Google Classroom underneath (or connect it first).
 */
export function AddStudentsPanel({
  classroom,
  notice,
  onDismissNotice,
  onAdded,
  onImported,
}: {
  /** The open class: typed names are added to it. */
  classroom: Me['classroom']
  /** How "Connect Google Classroom" went, when it just sent them back. */
  notice: ConnectNotice | null
  onDismissNotice: () => void
  /** After typed names are saved and on the Classes page. */
  onAdded: () => void
  /** After a Google class is imported and open. */
  onImported: () => void
}) {
  const connectHeadingId = useId()
  // Loaded ahead by the Classes page; on other pages this is its first load.
  const status = useQuery(classroomStatusQueryOptions)

  return (
    <div className="flex flex-col gap-8">
      <AddStudentsForm classroomId={classroom.id} onSuccess={onAdded} />

      {/* The "or" sits on the dialog's own white, not the page background. */}
      <FieldSeparator className="*:data-[slot=field-separator-content]:bg-popover">
        or
      </FieldSeparator>

      <div className="flex flex-col gap-4">
        {notice && (
          <ConnectNoticeAlert notice={notice} onDismiss={onDismissNotice} />
        )}

        {status.data?.connected ? (
          <GoogleClassCards
            openCourseId={classroom.google_course_id}
            onImported={onImported}
          />
        ) : status.isPending ? (
          <p
            role="status"
            className="flex items-center gap-2 text-sm font-medium text-muted-foreground"
          >
            <Spinner aria-hidden className="size-4" />
            Checking Google Classroom…
          </p>
        ) : (
          // Not connected (or the check failed): offer to connect.
          <section
            aria-labelledby={connectHeadingId}
            className="flex flex-col items-start gap-4"
          >
            <div className="flex flex-col gap-1">
              <h2 id={connectHeadingId} className="text-lg font-bold">
                Import from Google Classroom
              </h2>
              <p className="text-sm text-muted-foreground">
                Connect Google Classroom to bring in your classes and their
                students.
              </p>
            </div>
            <ConnectClassroomButton />
          </section>
        )}
      </div>
    </div>
  )
}
