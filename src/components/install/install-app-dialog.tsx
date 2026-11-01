import { useMemo } from 'react'
import type { ReactNode } from 'react'
import { Copy, Download, ExternalLink, Monitor, Smartphone } from 'lucide-react'
import { toast } from 'sonner'
import { renderSVG } from 'uqr'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ResponsiveDialog } from '#/components/responsive-dialogue'
import {
  isDesktopPlatform,
  promptInstall,
  usePwaInstall,
} from '#/lib/pwa-install'
import type { PlatformInfo } from '#/lib/pwa-install'
import { desktopSteps, getPhoneGuide } from './install-guides'
import type { GuideStep, PhoneGuide } from './install-guides'

// Loaded only when someone opens it (see install-app.tsx), so the QR code
// library and all the copy stay out of the first page load.

export interface InstallAppDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  info: PlatformInfo
}

const chunkyButton =
  'h-11 w-full rounded-lg border-2 border-border text-base font-bold shadow-md'

export default function InstallAppDialog({
  open,
  onOpenChange,
  info,
}: InstallAppDialogProps) {
  const desktop = isDesktopPlatform(info.platform)

  return (
    <ResponsiveDialog
      isOpen={open}
      setIsOpen={onOpenChange}
      title="Get the TeachForFree app"
      description={
        desktop
          ? 'Free, no app store needed.'
          : 'Free, no app store needed. Opens full-screen from your home screen, like any other app.'
      }
      showDescription
      className={desktop ? 'sm:max-w-2xl' : undefined}
    >
      {desktop ? (
        <DesktopGuide info={info} onInstalled={() => onOpenChange(false)} />
      ) : (
        <PhoneSteps guide={getPhoneGuide(info)} />
      )}
    </ResponsiveDialog>
  )
}

// ---------- Phones and tablets ----------

function PhoneSteps({ guide }: { guide: PhoneGuide }) {
  return (
    <div className="flex flex-col gap-5 pb-2">
      {guide.heading && (
        <p className="rounded-lg border-2 border-border bg-accent p-3 text-base text-accent-foreground">
          {guide.heading}
        </p>
      )}

      {(guide.copyLink || guide.openInChrome) && (
        <div className="flex flex-col gap-2">
          {guide.openInChrome && <OpenInChromeLink />}
          {guide.copyLink && <CopyLinkButton />}
        </div>
      )}

      <Steps steps={guide.steps} />

      {guide.note && <p className="text-base font-medium">{guide.note}</p>}

      <p className="text-sm text-muted-foreground">
        Already added it? Open TeachForFree from your home screen.
      </p>
    </div>
  )
}

function Steps({ steps }: { steps: GuideStep[] }) {
  return (
    <ol className="flex flex-col gap-4">
      {steps.map((step, index) => (
        <li key={index} className="flex gap-3">
          <span
            aria-hidden
            className="grid size-9 shrink-0 place-items-center rounded-md border-2 border-border bg-primary font-mono text-base font-bold text-primary-foreground"
          >
            {index + 1}
          </span>
          <div className="flex min-w-0 flex-col gap-1 pt-1">
            <p className="text-base leading-7">{step.text}</p>
            {step.hint && (
              <p className="text-sm text-muted-foreground">{step.hint}</p>
            )}
          </div>
        </li>
      ))}
    </ol>
  )
}

function CopyLinkButton() {
  const url = `${window.location.origin}/`

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      toast.success('Link copied', {
        description: 'Paste it into your browser’s address bar.',
      })
    } catch {
      toast('Copy this link', { description: url })
    }
  }

  return (
    <Button
      variant="outline"
      onClick={copy}
      className={cn('bg-card text-card-foreground', chunkyButton)}
    >
      <Copy />
      Copy link
    </Button>
  )
}

/** Android only: asks the phone to open this page in Chrome. */
function OpenInChromeLink() {
  const { host, pathname } = window.location
  const href = `intent://${host}${pathname}#Intent;scheme=https;package=com.android.chrome;end`

  return (
    <a
      href={href}
      className={cn(
        'inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground',
        chunkyButton,
      )}
    >
      <ExternalLink className="size-5" />
      Open in Chrome
    </a>
  )
}

// ---------- Computers ----------

function DesktopGuide({
  info,
  onInstalled,
}: {
  info: PlatformInfo
  onInstalled: () => void
}) {
  const { canPrompt } = usePwaInstall()

  const install = async () => {
    if ((await promptInstall()) === 'accepted') onInstalled()
  }

  return (
    <div className="grid gap-4 pb-2 md:grid-cols-2">
      <GuideCard icon={Smartphone} title="On your phone">
        <QrCode url={`${window.location.origin}/`} />
        <p className="text-base">
          Scan with your phone’s camera, then tap <b>Download the app</b>.
        </p>
      </GuideCard>

      <GuideCard icon={Monitor} title="On this computer">
        {canPrompt ? (
          <>
            <p className="text-base">
              Opens in its own window, with an icon in your dock or taskbar.
            </p>
            <Button onClick={install} className={chunkyButton}>
              <Download />
              Install TeachForFree
            </Button>
          </>
        ) : (
          <p className="text-base leading-7">{desktopSteps(info.platform)}</p>
        )}
      </GuideCard>
    </div>
  )
}

function GuideCard({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Smartphone
  title: string
  children: ReactNode
}) {
  return (
    <section className="flex flex-col items-center gap-3 rounded-lg border-2 border-border bg-card p-4 text-center">
      <h3 className="flex items-center gap-2 text-lg font-bold">
        <Icon className="size-5" />
        {title}
      </h3>
      {children}
    </section>
  )
}

function QrCode({ url }: { url: string }) {
  const src = useMemo(
    () =>
      `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
        renderSVG(url, { ecc: 'M', border: 2 }),
      )}`,
    [url],
  )

  return (
    <img
      src={src}
      alt={`QR code for ${url}`}
      className="size-44 rounded-md border-2 border-border bg-white"
    />
  )
}
