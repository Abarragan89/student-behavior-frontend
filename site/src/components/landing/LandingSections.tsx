// Homepage sections that are plain content, written with the app's shadcn
// components. Rendered to HTML when the site is built; no JavaScript is sent
// for them. (Parts that need the browser are islands: see Hero.astro.)
import { Check, Heart, LogIn, Smartphone } from 'lucide-react'
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

/** The small label above a heading. A prop, not children, so .astro files can use it too. */
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

export function BehaviorSection() {
  return (
    <section
      id="how-it-works"
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

export function LessonNotesSection() {
  return (
    <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:gap-16 lg:py-24">
      <div className="lg:order-2">
        <Eyebrow
          label="Lesson notes"
          className="bg-accent text-accent-foreground"
        />
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

export function Highlights() {
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
