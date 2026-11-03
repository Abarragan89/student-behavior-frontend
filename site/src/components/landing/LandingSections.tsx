// Building blocks for the marketing pages, written with the app's shadcn
// components. Rendered to HTML when the site is built; no JavaScript is sent
// for them. (The sections themselves are in components/sections/.)
//
// Everything takes props, not children, so .astro pages can use them without
// Astro wrapping the content in extra elements.
import { ArrowRight, Check } from 'lucide-react'
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
export function MoreLink({
  href,
  label,
  className = 'mt-6',
}: {
  href: string
  label: string
  /** Spacing; a gap above by default. */
  className?: string
}) {
  return (
    <a
      href={href}
      className={cn(
        'inline-flex items-center gap-1.5 font-bold text-primary underline-offset-4 hover:underline dark:text-foreground',
        className,
      )}
    >
      {label}
      <ArrowRight className="size-4" aria-hidden />
    </a>
  )
}
