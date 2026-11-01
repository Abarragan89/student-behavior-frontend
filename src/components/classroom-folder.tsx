import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { Tabs } from '@base-ui/react/tabs'
import { CircleAlert } from 'lucide-react'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'
import type { ClassroomTab } from '#/lib/auth'
import { useClassroomSwitch } from '#/hooks/useClassroomSwitch'

/**
 * The teacher's classrooms as folder tabs, just under the top bar, with the
 * open class's page (children) as the folder. The open tab
 * is the default classroom. Clicking another tab opens it at once and makes
 * it the default on the backend.
 */
export function ClassroomFolder({
  tabs,
  openId,
  children,
}: {
  /** In the server's order (oldest first). It never reorders them. */
  tabs: Array<ClassroomTab>
  /** The default classroom, the one the server has open. */
  openId: string
  children: ReactNode
}) {
  const { shownId, isLoading, error, select } = useClassroomSwitch(openId)
  const shownName = tabs.find((t) => t.id === shownId)?.name

  // With many classes the open tab can be scrolled out of view, e.g. on a
  // phone. Bring it back whenever it changes. Only the tab strip scrolls
  // (sideways), never the page.
  const listRef = useRef<HTMLDivElement>(null)
  const openTabRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    const list = listRef.current
    const tab = openTabRef.current
    if (!list || !tab) return
    const start = tab.offsetLeft
    const end = start + tab.offsetWidth
    if (start < list.scrollLeft || end > list.scrollLeft + list.clientWidth) {
      list.scrollTo({ left: start - 16 })
    }
  }, [shownId])

  return (
    <Tabs.Root
      value={shownId}
      onValueChange={(id: string) => {
        const tab = tabs.find((t) => t.id === id)
        if (tab) select(tab)
      }}
      className="flex flex-1 flex-col"
    >
      {/* The folder's top edge is this line. The open tab covers its piece of
          it, so the tab and the folder below read as one shape. It's drawn
          here, not on the scrolling list, so it spans the full width. */}
      <div className="relative after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-border">
        <Tabs.List
          ref={listRef}
          aria-label="Your classes"
          className="relative z-10 flex items-end gap-1 overflow-x-auto px-4 pt-3 scrollbar-thin"
        >
          {tabs.map((tab) => {
            const isOpen = tab.id === shownId
            return (
              <Tabs.Tab
                key={tab.id}
                value={tab.id}
                ref={isOpen ? openTabRef : undefined}
                title={tab.name}
                className={cn(
                  'flex max-w-56 shrink-0 items-center rounded-t-lg border-x-2 border-t-2 border-border px-4 text-sm font-bold outline-none transition-colors focus-visible:ring-4 focus-visible:ring-ring focus-visible:ring-inset motion-reduce:transition-none',
                  isOpen
                    ? // Taller, white, and no bottom edge: it opens into the
                      // folder.
                      'bg-card pt-3 pb-3 text-foreground'
                    : // Shorter and grey, so it sits behind the open tab.
                      'border-b-2 bg-muted py-2 text-muted-foreground hover:bg-card hover:text-foreground',
                )}
              >
                <span className="truncate">{tab.name}</span>
              </Tabs.Tab>
            )
          })}
        </Tabs.List>
      </div>

      <Tabs.Panel
        value={shownId}
        aria-busy={isLoading || undefined}
        className="flex flex-1 flex-col bg-card outline-none focus-visible:ring-4 focus-visible:ring-ring focus-visible:ring-inset"
      >
        <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-10 px-4 pb-10 pt-14">
          {/* Red icon, black text: small red text on white is hard to read. */}
          {error && (
            <p
              role="alert"
              className="-mb-4 flex items-center gap-2 text-sm font-medium"
            >
              <CircleAlert className="size-5 shrink-0 text-destructive" />
              {error}
            </p>
          )}
          {isLoading ? (
            <p
              role="status"
              className="flex flex-1 items-center justify-center gap-2 font-medium text-muted-foreground"
            >
              <Spinner aria-hidden className="size-5" />
              Opening {shownName}…
            </p>
          ) : (
            children
          )}
        </div>
      </Tabs.Panel>
    </Tabs.Root>
  )
}
