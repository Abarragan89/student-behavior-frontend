import type { ReactNode } from 'react'
import { ArrowDown, Check, Heart, LogIn, Smartphone } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from '@/components/ui/item'
import { cn } from '@/lib/utils'
import { loginUrl } from '#/lib/api'
import { Wordmark } from '#/components/Wordmark'
import { InstallAppButton } from '#/components/install/install-app'
import { StudentGridDemo } from './StudentGridDemo'
import { LessonNotesMockup } from './LessonNotesMockup'

export function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <TopBar />
      <main>
        <Hero />
        <BehaviorSection />
        <LessonNotesSection />
        <Highlights />
        <ClosingBand />
      </main>
      <Footer />
    </div>
  )
}

// ---------- Sections ----------

function TopBar() {
  return (
    <header className="sticky top-0 z-10 border-b-2 border-border bg-background">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
        <Wordmark />
        <div className="flex items-center gap-2">
          <InstallAppButton
            compact
            className="h-10 rounded-lg border-2 border-border px-3 text-sm"
          />
          <ButtonLink
            href={loginUrl}
            variant="outline"
            className="h-10 px-4 text-sm shadow-none"
          >
            Sign in
          </ButtonLink>
        </div>
      </div>
    </header>
  )
}

function Hero() {
  return (
    <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-12 sm:px-6 lg:grid-cols-2 lg:gap-16 lg:py-20">
      <div>
        <Eyebrow className="bg-secondary text-foreground">
          Free for teachers
        </Eyebrow>
        <h1 className="mt-5 text-4xl font-bold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
          Track behavior. Teach from your notes. All from{' '}
          <span className="box-decoration-clone rounded-md bg-accent px-2 text-accent-foreground">
            your phone.
          </span>
        </h1>
        <p className="mt-6 max-w-xl text-lg text-muted-foreground">
          Two simple tools: tap a student to give a positive or negative mark,
          and keep short lesson outlines you can glance at while you teach.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <ButtonLink href={loginUrl}>
            Sign in with Google — it's free
          </ButtonLink>
          {/* Phones only: the top bar has room for just an icon there. */}
          <InstallAppButton
            variant="outline"
            className="h-12 rounded-lg border-2 border-border bg-card px-6 text-base text-card-foreground shadow-md sm:hidden"
          />
          <ButtonLink href="#how-it-works" variant="outline">
            See how it works
            <ArrowDown className="size-5" />
          </ButtonLink>
        </div>
      </div>

      <div>
        <p className="mb-4 flex items-center justify-center gap-1 font-mono text-sm font-bold">
          Try it: tap a student
          <ArrowDown className="size-4" />
        </p>
        <StudentGridDemo />
      </div>
    </section>
  )
}

const BEHAVIOR_STEPS = [
  {
    title: 'Open your class',
    text: 'Every student is a square on your dashboard.',
  },
  {
    title: 'Tap a student',
    text: 'Their name opens with two big buttons.',
  },
  {
    title: 'Give a mark',
    text: 'Positive or negative, added to that student’s tally. Back to teaching.',
  },
]

function BehaviorSection() {
  return (
    <section
      id="how-it-works"
      className="scroll-mt-16 border-y-2 border-border bg-muted"
    >
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:gap-16 lg:py-24">
        <div>
          <Eyebrow>Behavior tracking</Eyebrow>
          <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
            Every student, one tap away.
          </h2>
          <p className="mt-4 max-w-xl text-lg text-muted-foreground">
            See your whole class at a glance. Recognize good choices and note
            the ones that need work, in two taps, without stopping the lesson.
          </p>
        </div>

        <ItemGroup>
          {BEHAVIOR_STEPS.map((step, i) => (
            <Item
              key={step.title}
              role="listitem"
              variant="outline"
              className="gap-4 rounded-lg border-2 bg-card p-5 shadow-md"
            >
              <ItemMedia className="size-10 rounded-md border-2 border-border bg-primary font-mono text-base font-bold text-primary-foreground">
                {i + 1}
              </ItemMedia>
              <ItemContent>
                <ItemTitle className="text-lg font-bold">
                  {step.title}
                </ItemTitle>
                <ItemDescription className="line-clamp-none text-base">
                  {step.text}
                </ItemDescription>
              </ItemContent>
            </Item>
          ))}
        </ItemGroup>
      </div>
    </section>
  )
}

const LESSON_POINTS = [
  'A quick outline: warm-up, key points, activity',
  'Open it on your phone in the middle of class',
  'No templates or boxes to fill in',
]

function LessonNotesSection() {
  return (
    <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:gap-16 lg:py-24">
      <div className="lg:order-2">
        <Eyebrow className="bg-accent text-accent-foreground">
          Lesson notes
        </Eyebrow>
        <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
          Lesson notes, not lesson plans.
        </h2>
        <p className="mt-4 max-w-xl text-lg text-muted-foreground">
          Jot down tomorrow’s lesson the way you’d write it on a sticky note,
          then keep it open on your phone while you teach.
        </p>
        <ItemGroup className="mt-6">
          {LESSON_POINTS.map((point) => (
            <Item key={point} role="listitem" size="xs" className="px-0 py-0">
              <ItemMedia className="size-6 rounded-sm border-2 border-border bg-chart-5 text-foreground">
                <Check className="size-4" strokeWidth={3} />
              </ItemMedia>
              <ItemContent>
                <ItemTitle className="line-clamp-none text-base font-medium">
                  {point}
                </ItemTitle>
              </ItemContent>
            </Item>
          ))}
        </ItemGroup>
      </div>

      <div className="lg:order-1">
        <LessonNotesMockup />
      </div>
    </section>
  )
}

const HIGHLIGHTS: Array<{
  title: string
  text: string
  icon: LucideIcon
  chip: string
}> = [
  {
    title: 'Free for teachers',
    text: 'No cost to sign up or use. Classroom tools shouldn’t come out of your paycheck.',
    icon: Heart,
    chip: 'bg-primary text-primary-foreground',
  },
  {
    title: 'Made for your phone',
    text: 'Big buttons and short pages, built to use in the middle of a lesson.',
    icon: Smartphone,
    chip: 'bg-secondary text-foreground',
  },
  {
    title: 'Sign in with Google',
    text: 'Use the Google account you already have. No new password to remember.',
    icon: LogIn,
    chip: 'bg-accent text-accent-foreground',
  },
]

function Highlights() {
  return (
    <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6 lg:pb-24">
      <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
        Made for teaching, not paperwork.
      </h2>
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {HIGHLIGHTS.map(({ title, text, icon: Icon, chip }) => (
          <Card
            key={title}
            className="rounded-lg border-2 border-border shadow-md ring-0 [--card-spacing:--spacing(6)]"
          >
            <CardHeader className="gap-2">
              <span
                className={cn(
                  'mb-2 grid size-12 place-items-center rounded-md border-2 border-border',
                  chip,
                )}
              >
                <Icon className="size-6" />
              </span>
              <CardTitle className="text-xl font-bold">{title}</CardTitle>
              <CardDescription className="text-base">{text}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>
    </section>
  )
}

function ClosingBand() {
  return (
    <section className="border-y-2 border-border bg-primary text-primary-foreground">
      <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-4 py-16 sm:px-6 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Ready for tomorrow’s class?
          </h2>
          <p className="mt-2 text-lg text-primary-foreground/80">
            Sign in with Google to get started. It’s free.
          </p>
        </div>
        <ButtonLink href={loginUrl} variant="outline">
          Sign in with Google
        </ButtonLink>
      </div>
    </section>
  )
}

function Footer() {
  return (
    <footer className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-8 font-mono text-sm text-muted-foreground sm:flex-row sm:justify-between sm:px-6">
      <p>© {new Date().getFullYear()} TeachForFree</p>
      <p>teachforfree.com</p>
    </footer>
  )
}

// ---------- Small building blocks ----------

// A link styled as a shadcn button. Links stay <a> (not <Button>) so screen
// readers announce them as links.
function ButtonLink({
  href,
  variant = 'default',
  className,
  children,
}: {
  href: string
  variant?: 'default' | 'outline'
  className?: string
  children: ReactNode
}) {
  return (
    <a
      href={href}
      className={cn(
        buttonVariants({ variant }),
        'h-12 rounded-lg border-2 border-border px-6 text-base font-bold shadow-md',
        // shadcn's outline variant has no text color, so it would inherit
        // white text inside the violet closing band.
        variant === 'outline' && 'bg-card text-card-foreground',
        className,
      )}
    >
      {children}
    </a>
  )
}

function Eyebrow({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <Badge
      className={cn(
        'h-auto rounded-md border-2 border-border px-2 py-1 font-mono font-bold uppercase tracking-wider',
        className,
      )}
    >
      {children}
    </Badge>
  )
}
