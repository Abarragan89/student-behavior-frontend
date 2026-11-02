// The marketing pages, for the header, the footer and "More from
// TeachForFree" cards. A new page goes here too.

export type PageLink = {
  href: string
  /** Short, for menus. */
  label: string
  /** One sentence, for cards. */
  description: string
}

export const FEATURE_PAGES: Array<PageLink> = [
  {
    href: '/behavior-tracking',
    label: 'Behavior tracking',
    description:
      'Tap a student, tap a mark. A simple record of positive and negative behavior for every student.',
  },
  {
    href: '/lesson-planner',
    label: 'Lesson planner',
    description:
      'Plan each day as a short checklist, then teach from it on your phone.',
  },
  {
    href: '/substitute-plans',
    label: 'Sub plans',
    description:
      'Share one day with a substitute: the plan and your class, with a link or a printed QR code.',
  },
]

export const FAQ_PAGE: PageLink = {
  href: '/faq',
  label: 'FAQ',
  description: 'Answers about cost, Google Classroom, offline use and privacy.',
}

export const LEGAL_PAGES: Array<Omit<PageLink, 'description'>> = [
  { href: '/privacy', label: 'Privacy' },
  { href: '/terms', label: 'Terms' },
]
