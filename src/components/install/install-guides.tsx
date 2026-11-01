import type { ReactNode } from 'react'
import {
  Compass,
  Ellipsis,
  EllipsisVertical,
  Menu,
  MonitorDown,
  Plus,
  Share,
  SquarePlus,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { Platform, PlatformInfo } from '#/lib/pwa-install'

// The "add to home screen" steps for each browser. Menu names change between
// browser versions, so each step names the button and shows its icon, with a
// hint for the older or newer wording.

export interface GuideStep {
  text: ReactNode
  hint?: ReactNode
}

export interface PhoneGuide {
  /** Shown above the steps in a highlighted box. */
  heading?: ReactNode
  steps: GuideStep[]
  note?: ReactNode
  copyLink?: boolean
  /** Android in-app browsers: a link that opens this page in Chrome. */
  openInChrome?: boolean
}

/** A small picture of the browser's button, next to its name. */
export function Glyph({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <span
      aria-hidden
      className="mx-1 inline-grid size-7 place-items-center rounded-md border-2 border-border bg-card align-middle text-foreground"
    >
      <Icon className="size-4" strokeWidth={2.5} />
    </span>
  )
}

const SIGN_IN_NOTE = (
  <>Then open TeachForFree from your Home Screen and sign in with Google.</>
)

const IOS_ADD_STEP: GuideStep = {
  text: (
    <>
      Tap <b>Add to Home Screen</b>
      <Glyph icon={SquarePlus} />
    </>
  ),
  hint: (
    <>
      Not in the list? Tap <b>View More</b> or scroll down. Still missing? Open
      this page in the Safari app.
    </>
  ),
}

const IOS_CONFIRM_STEP: GuideStep = {
  text: (
    <>
      Tap <b>Add</b>
    </>
  ),
  hint: (
    <>
      If you see <b>Open as Web App</b>, leave it on.
    </>
  ),
}

export function getPhoneGuide({ platform, appName }: PlatformInfo): PhoneGuide {
  switch (platform) {
    case 'ios-safari':
      return {
        steps: [
          {
            text: (
              <>
                Tap <b>Share</b>
                <Glyph icon={Share} />
              </>
            ),
            hint: (
              <>
                Can’t see it? Tap <b>•••</b> next to the address bar first.
              </>
            ),
          },
          IOS_ADD_STEP,
          IOS_CONFIRM_STEP,
        ],
        note: SIGN_IN_NOTE,
      }

    case 'ios-chrome':
      return {
        steps: [
          {
            text: (
              <>
                Tap <b>Share</b>
                <Glyph icon={Share} />
                in the address bar
              </>
            ),
            hint: 'It’s on the right side of the address bar.',
          },
          IOS_ADD_STEP,
          IOS_CONFIRM_STEP,
        ],
        note: SIGN_IN_NOTE,
      }

    case 'ios-other':
      return {
        heading: (
          <>
            Easiest in Safari: copy the link, then paste it into Safari’s
            address bar and tap <b>Download the app</b> there.
          </>
        ),
        copyLink: true,
        steps: [
          {
            text: (
              <>
                Or open this browser’s menu
                <Glyph icon={Menu} />
              </>
            ),
            hint: (
              <>
                It may look like <b>≡</b> or <b>•••</b>.
              </>
            ),
          },
          {
            text: (
              <>
                Tap <b>Share</b>
                <Glyph icon={Share} />, then <b>Add to Home Screen</b>
              </>
            ),
          },
          {
            text: (
              <>
                Tap <b>Add</b>
              </>
            ),
          },
        ],
        note: SIGN_IN_NOTE,
      }

    case 'ios-in-app':
    case 'android-in-app': {
      const ios = platform === 'ios-in-app'
      const browser = ios ? 'Safari' : 'Chrome'
      return {
        heading: (
          <>
            Open this page in {browser} first. {appName ?? 'This app'}’s
            built-in browser can’t add apps to your Home Screen.
          </>
        ),
        copyLink: true,
        openInChrome: !ios,
        steps: [
          {
            text: (
              <>
                Tap the menu
                <Glyph icon={ios ? Ellipsis : EllipsisVertical} />
              </>
            ),
            hint: (
              <>
                Usually <b>{ios ? '•••' : '⋮'}</b> in a top or bottom corner.
              </>
            ),
          },
          {
            text: ios ? (
              <>
                Tap <b>Open in Safari</b>
                <Glyph icon={Compass} />
              </>
            ) : (
              <>
                Tap <b>Open in Chrome</b> or <b>Open in browser</b>
              </>
            ),
          },
          {
            text: (
              <>
                Tap <b>Download the app</b> again there
              </>
            ),
          },
        ],
      }
    }

    case 'android-samsung':
      return {
        steps: [
          {
            text: (
              <>
                Tap the menu
                <Glyph icon={Menu} />
                at the bottom right
              </>
            ),
            hint: 'Or tap the install icon in the address bar, if you see one.',
          },
          {
            text: (
              <>
                Tap <b>Add page to</b>
                <Glyph icon={Plus} />, then <b>Home screen</b>
              </>
            ),
          },
          {
            text: (
              <>
                Tap <b>Add</b>
              </>
            ),
          },
        ],
      }

    case 'android-firefox':
      return {
        steps: [
          {
            text: (
              <>
                Tap the menu
                <Glyph icon={EllipsisVertical} />
              </>
            ),
          },
          {
            text: (
              <>
                Tap <b>Add app to Home screen</b>
              </>
            ),
            hint: (
              <>
                Some versions say <b>Install</b> or <b>Add to Home screen</b>.
              </>
            ),
          },
          {
            text: (
              <>
                Tap <b>Add</b>
              </>
            ),
          },
        ],
      }

    case 'android-other':
      return {
        steps: [
          {
            text: (
              <>
                Open this browser’s menu
                <Glyph icon={EllipsisVertical} />
              </>
            ),
            hint: (
              <>
                It may look like <b>⋮</b> or <b>≡</b>.
              </>
            ),
          },
          {
            text: (
              <>
                Tap <b>Install app</b> or <b>Add to Home screen</b>
              </>
            ),
            hint: (
              <>
                In Edge it’s <b>Add to phone</b>.
              </>
            ),
          },
          {
            text: (
              <>
                Tap <b>Install</b> or <b>Add</b>
              </>
            ),
          },
        ],
      }

    // Android Chrome, and any desktop browser shown in a narrow window.
    default:
      return {
        steps: [
          {
            text: (
              <>
                Tap the menu
                <Glyph icon={EllipsisVertical} />
                at the top right
              </>
            ),
          },
          {
            text: (
              <>
                Tap <b>Install app</b>
              </>
            ),
            hint: (
              <>
                On some phones it says <b>Add to Home screen</b> or{' '}
                <b>Install and create shortcut</b>.
              </>
            ),
          },
          {
            text: (
              <>
                Tap <b>Install</b>
              </>
            ),
          },
        ],
      }
  }
}

/** How to install on a computer when the browser can't show its own popup. */
export function desktopSteps(platform: Platform): ReactNode {
  switch (platform) {
    case 'desktop-edge':
      return (
        <>
          Click the install icon
          <Glyph icon={MonitorDown} />
          in the address bar. Or open the <b>…</b> menu, then <b>Apps</b> →{' '}
          <b>Install this site as an app</b>.
        </>
      )
    case 'desktop-safari':
      return (
        <>
          In the menu bar, choose <b>File</b> → <b>Add to Dock</b>. (Needs macOS
          Sonoma or later.)
        </>
      )
    case 'desktop-chrome':
      return (
        <>
          Click the install icon
          <Glyph icon={MonitorDown} />
          at the right end of the address bar. Or open the <b>⋮</b> menu, then{' '}
          <b>Cast, save, and share</b> → <b>Install page as app</b>.
        </>
      )
    default:
      return (
        <>
          This browser can’t install apps. Use the QR code, or open
          teachforfree.com in Chrome or Edge.
        </>
      )
  }
}
