import type { RefObject } from 'react'
import { Users } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import type { Me } from '#/lib/auth'
import { formatStudentCount } from '#/lib/classroom'
import { MarkRing } from '#/components/student-card'
import { useClassToday } from '#/hooks/useClassToday'

/**
 * Like the top of a student's page: today's marks for the whole class as a
 * ring, the class name with a small Switch link, and (not on phones) a line
 * under it. On the Classes page, and in the lesson-plan presenter's class
 * view (the teacher's, and a substitute's).
 */
export function ClassHeader({
  classroom,
  name,
  loading,
  onSwitch,
  headingLevel: Heading = 'h1',
  headingRef,
  headingId,
}: {
  /** The class whose students are on screen. */
  classroom: Pick<Me['classroom'], 'id' | 'students'>
  name: string
  /** A switch is under way: classroom is still the old class. */
  loading: boolean
  /** Opens the class list. Without it there's no Switch (only one class). */
  onSwitch?: () => void
  /** h2 where the page already has its own h1 (the presenter). */
  headingLevel?: 'h1' | 'h2'
  /** The class name, for moving focus to it. */
  headingRef?: RefObject<HTMLHeadingElement | null>
  /** For naming a region after the class. */
  headingId?: string
}) {
  const today = useClassToday(classroom.id, !loading)

  return (
    // Phones: one short row (small ring, name cut off with "…", Switch), so
    // the student cards get the screen.
    <header className="flex items-center gap-3 sm:items-start sm:gap-4">
      <MarkRing today={today} className="size-10 sm:size-20">
        <Avatar aria-hidden className="size-full after:hidden">
          <AvatarFallback className="bg-muted text-foreground">
            <Users className="size-4 sm:size-7" />
          </AvatarFallback>
        </Avatar>
      </MarkRing>
      <div className="flex min-w-0 flex-1 flex-col gap-1 sm:pt-2">
        <div className="flex items-baseline gap-x-3 gap-y-1 sm:flex-wrap">
          <Heading
            ref={headingRef}
            id={headingId}
            // Focusable from code only, for after archiving a class.
            tabIndex={-1}
            title={name}
            className="min-w-0 truncate text-xl font-bold outline-none sm:overflow-visible sm:text-2xl sm:whitespace-normal sm:wrap-break-word"
          >
            {name}
          </Heading>
          {onSwitch && (
            <Button
              variant="link"
              onClick={onSwitch}
              aria-label="Switch class"
              className="h-auto px-0 text-sm font-bold"
            >
              Switch
            </Button>
          )}
        </div>
        {/* Not on phones: space for the cards matters more there. */}
        {!loading && (
          <p className="hidden text-sm text-muted-foreground sm:block">
            {formatStudentCount(classroom.students.length)}
            {today && classroom.students.length > 0 && (
              <>
                {' · '}
                {today.positive + today.negative === 0
                  ? 'No marks yet today'
                  : `Today: ${today.positive} positive, ${today.negative} negative`}
              </>
            )}
          </p>
        )}
      </div>
    </header>
  )
}
