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
  {
    href: '/parent-conferences',
    label: 'Parent conferences',
    description:
      'Set your times, print a notice for each family in English and Spanish, and let families pick a new time from the QR code.',
  },
]

/**
 * For administrators: starting a school and inviting the staff. Kept out of
 * FEATURE_PAGES, which are the teacher features (and fill a 4-card row).
 */
export const SCHOOLS_PAGE: PageLink = {
  href: '/for-schools',
  label: 'For schools',
  description:
    'Bring your whole staff on with one join link, and see who’s joined. Teachers stay free.',
}

export const FAQ_PAGE: PageLink = {
  href: '/faq',
  label: 'FAQ',
  description:
    'Answers about cost, Google Classroom, conferences, offline use and privacy.',
}

export const LEGAL_PAGES: Array<Omit<PageLink, 'description'>> = [
  { href: '/privacy', label: 'Privacy' },
  { href: '/terms', label: 'Terms' },
]
