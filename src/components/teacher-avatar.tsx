import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import type { Me } from '#/lib/auth'

/**
 * The teacher's Google profile photo, with their initials while it loads or
 * when there's no photo.
 */
export function TeacherAvatar({
  teacher,
  className,
  fallbackClassName,
}: {
  teacher: Me['teacher']
  /** e.g. a size, like `size-16`. */
  className?: string
  /** e.g. bigger initials for a bigger avatar. */
  fallbackClassName?: string
}) {
  return (
    <Avatar className={className}>
      {teacher.picture_url && (
        <AvatarImage
          src={teacher.picture_url}
          // Decorative: the name is always next to it or in a label.
          alt=""
          // Google's photo links can refuse requests that send a referrer.
          referrerPolicy="no-referrer"
        />
      )}
      <AvatarFallback
        className={cn(
          'bg-accent font-bold text-accent-foreground',
          fallbackClassName,
        )}
      >
        {initials(teacher.name)}
      </AvatarFallback>
    </Avatar>
  )
}

/** "Jane Doe" → "JD", "Jane" → "J" */
function initials(name: string) {
  const parts = name.trim().split(/\s+/)
  const first = parts[0]?.charAt(0) ?? ''
  const last = parts.length > 1 ? (parts.at(-1)?.charAt(0) ?? '') : ''
  return `${first}${last}`.toUpperCase()
}
