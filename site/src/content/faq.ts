// Questions and answers, shown on /faq (all of them), the homepage and the
// feature pages (a few each, by id), and given to search engines as FAQPage
// data. Plain text only, so the same words work in all three places.
//
// Keep every answer true to what the app does today.

export type FaqItem = {
  /** The anchor on /faq, e.g. /faq#is-it-free */
  id: string
  question: string
  /** Paragraphs. */
  answer: Array<string>
  link?: { href: string; label: string }
}

export type FaqGroup = { title: string; items: Array<FaqItem> }

export const FAQ_GROUPS: Array<FaqGroup> = [
  {
    title: 'Getting started',
    items: [
      {
        id: 'is-it-free',
        question: 'Is TeachForFree really free?',
        answer: [
          'Yes. There’s nothing to pay, no paid plan, and no ads. TeachForFree is a personal project by one developer, made so classroom tools don’t come out of a teacher’s paycheck.',
        ],
      },
      {
        id: 'who-is-it-for',
        question: 'Who is TeachForFree for?',
        answer: [
          'K–12 teachers who want a quick way to track behavior and keep simple daily lesson plans, mostly from their phone. Substitutes can use a link you share with them. Students never sign in or have accounts.',
        ],
      },
      {
        id: 'how-to-sign-up',
        question: 'How do I sign up?',
        answer: [
          'Tap “Sign in with Google.” Signing in the first time creates your free account, with a class ready for your roster. There’s no separate password.',
          'You need a Google account. A school Google account works if your school allows it.',
        ],
      },
      {
        id: 'google-classroom',
        question: 'Can I import my class from Google Classroom?',
        answer: [
          'Yes, if you want to. Connect Google Classroom (it only asks to read your classes and rosters), then pick a class. TeachForFree brings in the class name and each student’s first and last name, never email addresses.',
          'Importing the same class again adds any new students. It never removes anyone. You can disconnect Google Classroom from your Account page at any time.',
        ],
      },
      {
        id: 'paste-roster',
        question: 'Can I add students without Google Classroom?',
        answer: [
          'Yes. Type or paste names into Add students, separated by commas or one per line, so a column copied from a spreadsheet works. You can add up to 100 at a time.',
        ],
      },
      {
        id: 'install',
        question: 'Do I need to download an app?',
        answer: [
          'No. TeachForFree works in the web browser on your phone, tablet or computer.',
          'For one-tap access you can add it to your home screen with “Download the app.” On iPhone that’s Share, then Add to Home Screen in Safari; most Android phones install it in one tap. There’s no app store and nothing to pay.',
        ],
      },
    ],
  },
  {
    title: 'Behavior tracking',
    items: [
      {
        id: 'customize-marks',
        question: 'Can I choose which behaviors I track?',
        answer: [
          'Yes. You start with six: On task, Helping others and Participating (positive), and Off task, Disruptive and Unprepared (negative). Add your own, rename them, or remove any you don’t use. Your marks are the same in all your classes.',
        ],
      },
      {
        id: 'whole-class',
        question: 'Can I give a mark to the whole class at once?',
        answer: [
          'Yes. Tap Select or Select all, pick the students, and give everyone the same mark in one tap. One Undo takes the whole group back.',
        ],
      },
      {
        id: 'parents',
        question: 'Can parents see the marks?',
        answer: [
          'There are no parent accounts or messages. Instead, you can print a student’s report for any day, or save it as a PDF. It shows that day’s marks, the last 10 school days, what the marks were for, talking points for home, and lines for signatures.',
        ],
      },
      {
        id: 'export',
        question: 'Can I export marks to a spreadsheet?',
        answer: [
          'Not yet. For now, a printed or PDF report is the way to take a student’s record out of TeachForFree.',
        ],
      },
      {
        id: 'points',
        question: 'Does TeachForFree use points or rewards?',
        answer: [
          'No. A mark is simply positive or negative, with the behavior and the time. Each student’s card shows today’s count, and their page shows when each mark happened, so you have a clear record to talk through with students and families.',
        ],
      },
    ],
  },
  {
    title: 'Lesson plans',
    items: [
      {
        id: 'reuse-plans',
        question: 'Can I reuse last week’s lesson plan?',
        answer: [
          'Yes. On an empty day, choose “Copy from another day.” It suggests the same weekday last week. You can also copy one section to another day. Copying never overwrites a plan, and nothing comes over checked off.',
        ],
      },
      {
        id: 'teach-from-it',
        question: 'Can I use my plan while I’m teaching?',
        answer: [
          'Yes. Presenter view shows the whole day full screen, with big rows to tap as you finish each part, a clock, and a “Now” label on the section whose time it is. On most devices it keeps the screen from going to sleep, and you can open your class to give marks without leaving it.',
        ],
      },
      {
        id: 'templates',
        question: 'Are there lesson plan templates?',
        answer: [
          'No, on purpose. A plan is just sections and checklist lines, so there are no boxes to fill in. Start from a blank day or copy one you’ve already written.',
        ],
      },
    ],
  },
  {
    title: 'Substitutes',
    items: [
      {
        id: 'share-with-sub',
        question: 'How do I share my plans with a substitute?',
        answer: [
          'Open the day and tap Share. You get a link that works on that date only, and you choose which classes it opens. Send it however you like, or print the plan with a QR code the sub can scan.',
          'The sub sees that day’s plan, can check off lines as they go, and can give behavior marks in the classes you picked. Their marks are labeled “Sub” for you.',
        ],
      },
      {
        id: 'sub-account',
        question: 'Does the substitute need an account?',
        answer: [
          'No. The link is all they need. Nothing is saved on their phone, and they can’t see other days, past marks or student pages.',
        ],
      },
      {
        id: 'sub-wrong-person',
        question: 'What if a sub link gets to the wrong person?',
        answer: [
          'Turn it off. It stops working right away, and marks or checkmarks already given stay. Links also stop on their own at midnight at the end of that day, and you can see when a link was last opened.',
        ],
      },
    ],
  },
  {
    title: 'Devices and offline',
    items: [
      {
        id: 'offline',
        question: 'Does TeachForFree work without internet?',
        answer: [
          'Yes, in the installed app (the version on your home screen). You can give marks and check off lesson plan lines offline, and they’re sent when you’re back online. Today’s and the next school day’s plans are saved so you can read them.',
          'On the website, marks given while the connection drops wait until it’s back, as long as the tab stays open. Changes like adding students or editing a plan always need a connection.',
        ],
      },
      {
        id: 'several-devices',
        question: 'Can I use it on my phone and my laptop?',
        answer: [
          'Yes. Sign in with the same Google account on each one. A mark given on your phone shows up on your laptop within about half a minute.',
        ],
      },
    ],
  },
  {
    title: 'Privacy and your data',
    items: [
      {
        id: 'student-data',
        question: 'Is student information safe? What about FERPA and COPPA?',
        answer: [
          'Student names and lesson plans are encrypted in the database. Student information is never sold, never used for ads, and never used to train AI. Students don’t sign in, and nothing is collected from them directly.',
          'The information belongs to you and your school, and it’s used only to run TeachForFree for you. Check your school’s rules before adding students. The privacy policy explains the details, including FERPA and COPPA.',
        ],
        link: { href: '/privacy', label: 'Read the privacy policy' },
      },
      {
        id: 'shared-computer',
        question: 'Is it okay to use on a shared school computer?',
        answer: [
          'Yes. The website doesn’t save student information on the computer. Sign out when you’re done, since otherwise you stay signed in on that browser for up to 30 days.',
        ],
      },
      {
        id: 'delete-data',
        question: 'How do I delete my data?',
        answer: [
          'You can delete marks, students and classes yourself in the app. To delete your whole account and everything in it, email the address in the privacy policy from the account you sign in with.',
        ],
        link: {
          href: '/privacy#deleting-your-account',
          label: 'How deleting works',
        },
      },
      {
        id: 'school-version',
        question: 'Is there a version for a whole school or district?',
        answer: [
          'Not right now. Each teacher has their own free account, and classes can’t be shared between teachers. A substitute link is the way to share a day.',
        ],
      },
    ],
  },
]

export const ALL_FAQ: Array<FaqItem> = FAQ_GROUPS.flatMap((g) => g.items)

/** The questions with these ids, in this order. Unknown ids fail the build. */
export function faqItems(ids: Array<string>): Array<FaqItem> {
  return ids.map((id) => {
    const item = ALL_FAQ.find((q) => q.id === id)
    if (!item) throw new Error(`No FAQ item "${id}" in site/src/content/faq.ts`)
    return item
  })
}

/** schema.org FAQPage data for search engines. */
export function faqJsonLd(items: Array<FaqItem>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: { '@type': 'Answer', text: item.answer.join('\n\n') },
    })),
  }
}
