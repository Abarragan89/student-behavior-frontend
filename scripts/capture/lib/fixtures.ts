// The demo data. Every name is made up.

export const TEACHER_NAME = 'Ms. Lee'
export const CLASS_NAME = 'Period 3 · English 7'
export const OTHER_CLASS_NAME = 'Period 5 · English 7'

export const STUDENTS = [
  'Ava Chen',
  'Marcus Bell',
  'Sofia Ramirez',
  'Liam Walsh',
  'Priya Patel',
  'Noah Kim',
  'Zoe Martin',
  'Ethan Brooks',
  'Maya Johnson',
  'Lucas Nguyen',
  'Isla Rossi',
  'Jayden Carter',
  'Amara Okafor',
  'Owen Fischer',
  'Chloe Dubois',
  'Mateo Silva',
  'Harper Lewis',
  'Elijah Ward',
  'Nora Haddad',
  'Caleb Foster',
  'Lily Tanaka',
  'Diego Morales',
  'Grace Novak',
  'Samuel Adeyemi',
]

export const OTHER_STUDENTS = [
  'Ruby Alvarez',
  'Theo Grant',
  'Hana Sato',
  'Felix Romero',
  'Leah Okonkwo',
  'Arjun Mehta',
]

export type Line = { text: string; indent?: 0 | 1 | 2; done?: boolean }
export type Section = {
  title: string
  start?: string
  end?: string
  lines: Array<Line>
}

/** A full teaching day. Period 3 (10:00–10:45) is "now" at 10:15. */
export const FULL_DAY: Array<Section> = [
  {
    title: 'Before school',
    start: '07:45',
    end: '08:10',
    lines: [
      { text: 'Write the warm-up on the board', done: true },
      { text: 'Print 24 exit tickets', done: true },
      { text: 'Email Mr. Ortiz about the field trip', done: true },
    ],
  },
  {
    title: 'Period 1 — English 7',
    start: '08:15',
    end: '09:00',
    lines: [
      { text: 'Warm-up: journal prompt', done: true },
      { text: 'Vocabulary: 5 words from chapter 6', done: true },
      { text: 'Say it, define it, use it', indent: 1, done: true },
      { text: 'Read aloud, pages 112–118', done: true },
      { text: 'Exit ticket', done: true },
    ],
  },
  {
    title: 'Period 2 — English 7',
    start: '09:05',
    end: '09:50',
    lines: [
      { text: 'Warm-up: journal prompt', done: true },
      { text: 'Vocabulary quiz (10 min)', done: true },
      { text: 'Partner reading, pages 112–118', done: true },
    ],
  },
  {
    title: 'Period 3 — English 7',
    start: '10:00',
    end: '10:45',
    lines: [
      { text: 'Warm-up: what makes a good friend?' },
      { text: 'Mini-lesson: theme vs. topic' },
      { text: 'Topic is one word: friendship', indent: 1 },
      { text: 'Theme is the lesson about it', indent: 1 },
      { text: 'Example from our class novel', indent: 2 },
      { text: 'Groups: find 2 clues for the theme' },
      { text: 'Share out, one idea per group' },
      { text: 'Exit ticket: the theme in a sentence' },
    ],
  },
  {
    title: 'Lunch duty',
    start: '10:50',
    end: '11:20',
    lines: [{ text: 'Cafeteria, north doors' }],
  },
  {
    title: 'Period 4 — Prep',
    start: '11:25',
    end: '12:10',
    lines: [
      { text: 'Grade Period 1 exit tickets' },
      { text: 'Copy Friday’s quiz' },
      { text: 'Call two families back' },
    ],
  },
  {
    title: 'Period 5 — English 7',
    start: '12:50',
    end: '13:35',
    lines: [
      { text: 'Warm-up: what makes a good friend?' },
      { text: 'Mini-lesson: theme vs. topic' },
      { text: 'Groups: find 2 clues for the theme' },
      { text: 'Exit ticket: the theme in a sentence' },
    ],
  },
  {
    title: 'After school',
    start: '15:00',
    end: '15:30',
    lines: [
      { text: 'Tutoring in Room 12' },
      { text: 'Post tomorrow’s agenda' },
    ],
  },
]

/** Lines checked off in the hero clip, in order. */
export const HERO_TICKS = [
  'Warm-up: what makes a good friend?',
  'Mini-lesson: theme vs. topic',
  'Topic is one word: friendship',
]

/** Shorter days for the month calendar (copied around, some finished). */
export const SHORT_DAY: Array<Section> = [
  {
    title: 'Period 3 — English 7',
    start: '10:00',
    end: '10:45',
    lines: [
      { text: 'Warm-up: journal prompt' },
      { text: 'Read aloud, chapter 7' },
      { text: 'Exit ticket' },
    ],
  },
]

// ---------- Marks ----------

export type MarkSpec = {
  student: string
  /** 0 = today, 1 = the school day before, … */
  daysAgo: number
  /** "09:12" local time. */
  time: string
  type: string
}

/**
 * Marcus Bell's last 10 school days: 14 negative and 7 positive marks.
 * Yesterday is the busy day his student page shows.
 */
export const MARCUS = 'Marcus Bell'
const marcus = (daysAgo: number, time: string, type: string): MarkSpec => ({
  student: MARCUS,
  daysAgo,
  time,
  type,
})
export const MARCUS_MARKS: Array<MarkSpec> = [
  // yesterday: 4 negative, 2 positive
  marcus(1, '08:17', 'Unprepared'),
  marcus(1, '09:12', 'Off task'),
  marcus(1, '10:24', 'Disruptive'),
  marcus(1, '10:38', 'Participating'),
  marcus(1, '12:58', 'Off task'),
  marcus(1, '13:20', 'Helping others'),
  marcus(2, '09:40', 'Off task'),
  marcus(2, '13:05', 'On task'),
  marcus(3, '12:10', 'Disruptive'),
  marcus(3, '12:55', 'Off task'),
  marcus(4, '09:30', 'Participating'),
  marcus(5, '08:20', 'Unprepared'),
  marcus(5, '10:15', 'Off task'),
  marcus(6, '11:00', 'Participating'),
  marcus(7, '13:15', 'Disruptive'),
  marcus(7, '09:50', 'Helping others'),
  marcus(8, '09:05', 'Off task'),
  marcus(8, '09:20', 'Off task'),
  marcus(9, '10:30', 'On task'),
  marcus(10, '08:18', 'Unprepared'),
  marcus(10, '12:40', 'Disruptive'),
]

/** Today's marks before 10:15, so the class grid shows counts. */
export const TODAY_MARKS: Array<MarkSpec> = [
  ['Ava Chen', '08:21', 'On task'],
  ['Ava Chen', '09:14', 'Helping others'],
  ['Sofia Ramirez', '08:40', 'Participating'],
  ['Priya Patel', '09:02', 'On task'],
  ['Noah Kim', '08:55', 'Off task'],
  ['Maya Johnson', '09:30', 'Participating'],
  ['Lucas Nguyen', '09:31', 'Helping others'],
  ['Jayden Carter', '09:45', 'Disruptive'],
  ['Amara Okafor', '10:02', 'Participating'],
  ['Chloe Dubois', '10:05', 'On task'],
  ['Mateo Silva', '08:33', 'Unprepared'],
  ['Nora Haddad', '10:08', 'On task'],
  ['Lily Tanaka', '09:50', 'Helping others'],
  ['Grace Novak', '10:10', 'Participating'],
].map(([student, time, type]) => ({ student, time, type, daysAgo: 0 }))

/** A few older marks for everyone else, so reports aren't empty. */
export const BACKGROUND_MARKS: Array<MarkSpec> = STUDENTS.filter(
  (s) => s !== MARCUS,
).flatMap((student, i) => [
  {
    student,
    daysAgo: 1 + (i % 5),
    time: `0${8 + (i % 2)}:${String(10 + i).padStart(2, '0')}`,
    type: i % 4 === 0 ? 'Off task' : 'On task',
  },
  {
    student,
    daysAgo: 2 + (i % 7),
    time: `1${i % 3}:${String(5 + i).padStart(2, '0')}`,
    type: i % 3 === 0 ? 'Helping others' : 'Participating',
  },
])

// ---------- Conferences ----------

export const CONFERENCE = {
  title: 'Fall conferences',
  notice_name: TEACHER_NAME,
  location: 'Room 12',
}
/** The family whose page the clip shows. */
export const FAMILY_STUDENT = 'Ava Chen'
/** Students left without a time. */
export const NO_TIME_YET = ['Diego Morales', 'Owen Fischer']
/** Families who already moved (shown under "Changes by families"). */
export const FAMILIES_WHO_MOVED = ['Priya Patel', 'Noah Kim']
