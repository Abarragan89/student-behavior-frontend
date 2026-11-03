import { toast } from 'sonner'
import { Copy, Share } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/**
 * The phone's share sheet where there is one, and always Copy. For links
 * a teacher sends someone (a sub's day, a co-teacher invite).
 */
export function SendLinkButtons({
  url,
  shareTitle,
  shareText,
  copiedDescription,
}: {
  url: string
  /** The share sheet's title and message. */
  shareTitle: string
  shareText: string
  /** Under "Link copied": where to paste it. */
  copiedDescription: string
}) {
  const canShare = typeof navigator.share === 'function'

  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
      toast.success('Link copied', { description: copiedDescription })
    } catch {
      toast('Copy this link', { description: url })
    }
  }

  async function share() {
    try {
      await navigator.share({ title: shareTitle, text: shareText, url })
    } catch (error) {
      // Closed without sharing.
      if (error instanceof DOMException && error.name === 'AbortError') return
      void copy()
    }
  }

  const buttonClass =
    'h-12 flex-1 rounded-lg border-2 border-border text-base font-bold'
  return (
    <div className="flex gap-2">
      {canShare && (
        <Button
          onClick={() => void share()}
          className={cn(buttonClass, 'shadow-sm')}
        >
          <Share className="size-5" />
          Share…
        </Button>
      )}
      <Button
        variant={canShare ? 'outline' : 'default'}
        onClick={() => void copy()}
        className={cn(buttonClass, canShare ? 'bg-card' : 'shadow-sm')}
      >
        <Copy className="size-5" />
        Copy link
      </Button>
    </div>
  )
}
