import { Check, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ClassroomTab } from '#/lib/auth'
import { ResponsiveDialog } from '#/components/responsive-dialogue'
import { OfflineNote } from '#/components/offline-note'
import { useOnline } from '#/lib/online'

/**
 * All of the teacher's classes, from the "Switch" link on the Classes page.
 * The open one is marked. Picking another closes the dialog and opens it.
 */
export function SwitchClassDialog({
  classrooms,
  openId,
  open,
  onOpenChange,
  onPick,
}: {
  /** In the server's order (oldest first). */
  classrooms: Array<ClassroomTab>
  /** The class on screen. */
  openId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onPick: (classroom: ClassroomTab) => void
}) {
  // Switching saves the open class on the server, and only the open class's
  // students are saved on the device.
  const online = useOnline()

  return (
    <ResponsiveDialog
      isOpen={open}
      setIsOpen={onOpenChange}
      title="Switch class"
      description="Choose a class to open."
      showDescription
    >
      <OfflineNote action="switch classes" className="mb-3" />
      <ul className="flex flex-col gap-2">
        {classrooms.map((classroom) => {
          const isOpen = classroom.id === openId
          return (
            <li key={classroom.id}>
              <button
                type="button"
                aria-current={isOpen || undefined}
                disabled={!isOpen && !online}
                onClick={() => {
                  onOpenChange(false)
                  if (!isOpen) onPick(classroom)
                }}
                className={cn(
                  'flex w-full items-center gap-3 rounded-lg border-2 px-4 py-3 text-left text-base font-bold outline-none transition-colors focus-visible:ring-4 focus-visible:ring-ring motion-reduce:transition-none',
                  isOpen
                    ? 'border-primary bg-primary/10 hover:bg-primary/15'
                    : 'border-border bg-card hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-card',
                )}
              >
                <span className="min-w-0 flex-1 truncate">
                  {classroom.name}
                </span>
                {isOpen ? (
                  <span className="flex shrink-0 items-center gap-1 text-sm text-muted-foreground">
                    <Check className="size-4 text-primary" strokeWidth={3} />
                    Open
                  </span>
                ) : (
                  <ChevronRight
                    aria-hidden
                    className="size-5 shrink-0 text-muted-foreground"
                  />
                )}
              </button>
            </li>
          )
        })}
      </ul>
    </ResponsiveDialog>
  )
}
