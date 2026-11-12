import { useEffect, useRef, useState } from 'react'
import { FileUp } from 'lucide-react'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'

/** Is a file (not text or a link) being dragged? */
function draggingFiles(e: { dataTransfer: DataTransfer | null }) {
  return !!e.dataTransfer?.types.includes('Files')
}

/**
 * A box to drop a file on, or click (tap) to choose one: the staff and
 * calendar imports. While it's on the page, a file dropped beside it
 * doesn't open in the tab and leave the app.
 */
export function FileDropBox({
  accept,
  kinds,
  onFile,
  busy = false,
  describedBy,
}: {
  /** The file input's accept list. */
  accept: string
  /** What files it takes, in words: "CSV or JSON". */
  kinds: string
  onFile: (file: File) => void
  /** Reading a file: the box waits. */
  busy?: boolean
  describedBy?: string
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  // The box's own handlers run first and mark the event handled.
  useEffect(() => {
    const stop = (e: DragEvent) => {
      if (e.defaultPrevented || !draggingFiles(e)) return
      e.preventDefault()
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'none'
    }
    window.addEventListener('dragover', stop)
    window.addEventListener('drop', stop)
    return () => {
      window.removeEventListener('dragover', stop)
      window.removeEventListener('drop', stop)
    }
  }, [])

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          // So choosing the same file again (after fixing it) still reads it.
          e.target.value = ''
          if (file) onFile(file)
        }}
      />
      <button
        type="button"
        disabled={busy}
        aria-busy={busy}
        onClick={() => fileRef.current?.click()}
        onDragEnter={(e) => {
          if (busy || !draggingFiles(e)) return
          e.preventDefault()
          setDragging(true)
        }}
        onDragOver={(e) => {
          if (busy || !draggingFiles(e)) return
          e.preventDefault()
          e.dataTransfer.dropEffect = 'copy'
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          const file = e.dataTransfer.files[0] as File | undefined
          if (file && !busy) onFile(file)
        }}
        aria-describedby={describedBy}
        className={cn(
          // Children ignore the pointer, so dragging over them isn't a "leave".
          'flex w-full cursor-pointer flex-col items-center gap-1.5 rounded-lg border-2 border-dashed border-border bg-card px-4 py-7 text-center transition-colors outline-none hover:border-primary/60 hover:bg-primary/5 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 disabled:cursor-wait disabled:opacity-70 motion-reduce:transition-none *:pointer-events-none',
          dragging &&
            'border-primary bg-primary/10 hover:border-primary hover:bg-primary/10',
        )}
      >
        {busy ? (
          <Spinner aria-hidden className="mb-1 size-8 text-muted-foreground" />
        ) : (
          <FileUp
            aria-hidden
            className={cn(
              'mb-1 size-8 text-muted-foreground',
              dragging && 'text-primary',
            )}
          />
        )}
        <span className="text-base font-bold">
          {busy ? (
            'Reading the file…'
          ) : (
            <>
              <span className="pointer-coarse:hidden">
                {dragging ? 'Let go to read it' : 'Drop the file here'}
              </span>
              <span className="hidden pointer-coarse:inline">
                Tap to choose the file
              </span>
            </>
          )}
        </span>
        <span className="text-sm text-muted-foreground">
          <span className="pointer-coarse:hidden">or click to choose · </span>
          {kinds}
        </span>
      </button>
    </>
  )
}
