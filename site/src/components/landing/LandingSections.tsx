// Content blocks for the marketing pages, written with the app's shadcn
// components. Rendered to HTML when the site is built; no JavaScript is sent
// for them. (Parts that need the browser are islands: see Hero.astro.)
//
// Everything takes props, not children, so .astro pages can use them without
// Astro wrapping the content in extra elements.
import { ArrowRight, Check, Heart, LogIn, Smartphone } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
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
import { LessonNotesMockup } from './LessonNotesMockup'
import { SubPlanMockup } from './SubPlanMockup'

// ---------- Building blocks ----------

/** The small label above a heading. */
export function Eyebrow({
  label,
  className,
}: {
  label: string
  className?: string
}) {
  return (
    <Badge
      className={cn(
        'h-auto rounded-md border-2 border-border px-2 py-1 font-mono font-bold uppercase tracking-wider',
        className,
      )}
    >
      {label}
    </Badge>
  )
}

export type Step = { title: string; text: string }

/** Numbered steps in outlined cards. */
export function StepList({ steps }: { steps: Array<Step> }) {
  return (
    <ItemGroup>
      {steps.map((step, i) => (
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
            <ItemTitle className="text-lg font-bold">{step.title}</ItemTitle>
            <ItemDescription className="line-clamp-none text-base">
              {step.text}
            </ItemDescription>
          </ItemContent>
        </Item>
      ))}
    </ItemGroup>
  )
}

/** A short list with green checkmarks. */
export function CheckList({
  items,
  className,
}: {
  items: Array<string>
  className?: string
}) {
  return (
    <ItemGroup className={className}>
      {items.map((text) => (
        <Item key={text} role="listitem" size="xs" className="px-0 py-0">
          <ItemMedia className="size-6 rounded-sm border-2 border-border bg-chart-5 text-foreground">
            <Check className="size-4" strokeWidth={3} />
          </ItemMedia>
          <ItemContent>
            <ItemTitle className="line-clamp-none text-base font-medium">
              {text}
            </ItemTitle>
          </ItemContent>
        </Item>
      ))}
    </ItemGroup>
  )
}

export type Feature = {
  title: string
  text: string
  icon: LucideIcon
  /** Colors for the icon's square. */
  chip?: string
}

const CHIPS = [
  'bg-primary text-primary-foreground',
  'bg-secondary text-foreground',
  'bg-accent text-accent-foreground',
]

/** Feature cards in a grid, each with an icon. */
export function FeatureCards({
  items,
  headingLevel = 'h3',
  className = 'md:grid-cols-2 lg:grid-cols-3',
}: {
  items: Array<Feature>
  /** The cards' headings sit under a page's h2 by default. */
  headingLevel?: 'h2' | 'h3'
  /** Grid columns. */
  className?: string
}) {
  const Heading = headingLevel
  return (
    <ul className={cn('grid gap-4', className)}>
      {items.map(({ title, text, icon: Icon, chip }, i) => (
        <li key={title} className="flex">
          <Card className="w-full rounded-lg border-2 border-border shadow-md ring-0 [--card-spacing:--spacing(6)]">
            <CardHeader className="gap-2">
              <span
                className={cn(
                  'mb-2 grid size-12 place-items-center rounded-md border-2 border-border',
                  chip ?? CHIPS[i % CHIPS.length],
                )}
              >
                <Icon className="size-6" aria-hidden />
              </span>
              <CardTitle className="text-xl font-bold">
                <Heading>{title}</Heading>
              </CardTitle>
              <CardDescription className="text-base">{text}</CardDescription>
            </CardHeader>
          </Card>
        </li>
      ))}
    </ul>
  )
}

/** "Learn more →" under a section. */
export function MoreLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      className="mt-6 inline-flex items-center gap-1.5 font-bold text-primary underline-offset-4 hover:underline dark:text-foreground"
    >
      {label}
      <ArrowRight className="size-4" aria-hidden />
    </a>
  )
}

// ---------- Homepage sections ----------

const BEHAVIOR_STEPS: Array<Step> = [
  {
    title: 'Open your class',
    text: 'Every student is a card on your dashboard, with today’s marks.',
  },
  {
    title: 'Tap a student',
    text: 'Your marks pop up: positive on one side, negative on the other.',
  },
  {
    title: 'Give a mark',
    text: 'One tap adds it to that student’s record, with the time. Back to teaching.',
  },
]

export function BehaviorSection() {
  return (
    <section
      id="how-it-works"
      data-band
      className="scroll-mt-16 border-y-2 border-border bg-muted"
    >
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:gap-16 lg:py-24">
        <div>
          <Eyebrow label="Behavior tracking" />
          <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
            Every student, one tap away.
          </h2>
          <p className="mt-4 max-w-xl text-lg text-muted-foreground">
            See your whole class at a glance. Recognize good choices and note
            the ones that need work, in two taps, without stopping the lesson.
          </p>
          <MoreLink
            href="/behavior-tracking"
            label="More about behavior tracking"
          />
        </div>

        <StepList steps={BEHAVIOR_STEPS} />
      </div>
    </section>
  )
}

export function LessonNotesSection() {
  return (
    <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:gap-16 lg:py-24">
      <div className="lg:order-2">
        <Eyebrow
          label="Lesson plans"
          className="bg-accent text-accent-foreground"
        />
        <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
          Lesson plans as simple as sticky notes.
        </h2>
        <p className="mt-4 max-w-xl text-lg text-muted-foreground">
          Jot down tomorrow’s lesson the way you’d write it on a sticky note,
          then keep it open on your phone while you teach.
        </p>
        <CheckList
          className="mt-6"
          items={[
            'A quick outline: warm-up, key points, activity',
            'Open it on your phone in the middle of class',
            'No templates or boxes to fill in',
          ]}
        />
        <MoreLink href="/lesson-planner" label="More about lesson plans" />
      </div>

      <div className="lg:order-1">
        <LessonNotesMockup />
      </div>
    </section>
  )
}

export function SubstituteSection() {
  return (
    <section data-band className="border-y-2 border-border bg-muted">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:gap-16 lg:py-24">
        <div>
          <Eyebrow
            label="Substitutes"
            className="bg-secondary text-foreground"
          />
          <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
            Out tomorrow? Share the day.
          </h2>
          <p className="mt-4 max-w-xl text-lg text-muted-foreground">
            Send your sub one link, or print your plan with a QR code. They get
            that day’s plan and your class on their phone. No account needed.
          </p>
          <CheckList
            className="mt-6"
            items={[
              'They check off the plan as they go',
              'They give marks, labeled “Sub” for you',
              'The link works that day only, and you can turn it off',
            ]}
          />
          <MoreLink href="/substitute-plans" label="More about sub plans" />
        </div>

        <div>
          <SubPlanMockup />
        </div>
      </div>
    </section>
  )
}

const HIGHLIGHTS: Array<Feature> = [
  {
    title: 'Free for teachers',
    text: 'No cost to sign up or use. Classroom tools shouldn’t come out of your paycheck.',
    icon: Heart,
  },
  {
    title: 'Made for your phone',
    text: 'Big buttons and short pages, built to use in the middle of a lesson.',
    icon: Smartphone,
  },
  {
    title: 'Sign in with Google',
    text: 'Use the Google account you already have. No new password to remember.',
    icon: LogIn,
  },
]

export function Highlights() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-24">
      <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
        Made for teaching, not paperwork.
      </h2>
      <div className="mt-8">
        <FeatureCards items={HIGHLIGHTS} className="md:grid-cols-3" />
      </div>
    </section>
  )
}
