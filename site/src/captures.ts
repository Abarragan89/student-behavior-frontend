// The recordings and screenshots of the app shown on the site, made with
// fictitious demo data by `npm run capture -- --publish` (scripts/capture).
// Re-run it after changing what these screens look like.
import type { ImageMetadata } from 'astro'

import planAndMarks from './assets/captures/plan-and-marks.mp4'
import planAndMarksPoster from './assets/captures/plan-and-marks-poster.png'
import planAndMarksChapters from './assets/captures/plan-and-marks.chapters.json'
import classMarks from './assets/captures/class-marks.mp4'
import classMarksPoster from './assets/captures/class-marks-poster.png'
import classMarksChapters from './assets/captures/class-marks.chapters.json'
import planEditor from './assets/captures/plan-editor.mp4'
import planEditorPoster from './assets/captures/plan-editor-poster.png'
import planEditorChapters from './assets/captures/plan-editor.chapters.json'
import subView from './assets/captures/sub-view.mp4'
import subViewPoster from './assets/captures/sub-view-poster.png'
import subViewChapters from './assets/captures/sub-view.chapters.json'
import conferenceFamily from './assets/captures/conference-family.mp4'
import conferenceFamilyPoster from './assets/captures/conference-family-poster.png'
import conferenceFamilyChapters from './assets/captures/conference-family.chapters.json'
import conferenceTeacher from './assets/captures/conference-teacher.mp4'
import conferenceTeacherPoster from './assets/captures/conference-teacher-poster.png'
import conferenceTeacherChapters from './assets/captures/conference-teacher.chapters.json'

import studentTop from './assets/captures/student-top.png'
import studentDay from './assets/captures/student-day.png'
import studentMarks from './assets/captures/student-marks.png'
import calendar from './assets/captures/calendar.png'
import shareDialog from './assets/captures/share-dialog.png'
import report from './assets/captures/report.png'
import planPrintQr from './assets/captures/plan-print-qr.png'
import conferenceNotice from './assets/captures/conference-notice.png'

export { default as reportPdf } from './assets/captures/report-sample.pdf?url'

export type Clip = {
  src: string
  poster: ImageMetadata
  chapters: {
    duration: number
    chapters: Array<{ label: string; start: number }>
  }
  /** What happens in it, for screen readers. */
  label: string
}

export const CLIPS = {
  planAndMarks: {
    src: planAndMarks,
    poster: planAndMarksPoster,
    chapters: planAndMarksChapters,
    label:
      'A teacher scrolls through today’s lesson plan, opens Presenter view and checks off three lines. Without leaving the plan, they open the class, give Marcus a “Participating” mark, then select the whole class except three students and give them all “On task”.',
  },
  classMarks: {
    src: classMarks,
    poster: classMarksPoster,
    chapters: classMarksChapters,
    label:
      'On the Classes page, a teacher taps Ava and gives her “Helping others”, selects three students and gives them “Participating”, then opens Marcus’s page to see his marks for the day on a timeline.',
  },
  planEditor: {
    src: planEditor,
    poster: planEditorPoster,
    chapters: planEditorChapters,
    label:
      'A teacher plans tomorrow: they name a section “Period 3 — English 7”, give it a time from 10:00 to 10:45, type four lines and indent one under another.',
  },
  subView: {
    src: subView,
    poster: subViewPoster,
    chapters: subViewChapters,
    label:
      'A substitute opens the link to “Ms. Lee’s plan”, which opens on the class happening now. They check off two lines, open the class and give Ava an “On task” mark.',
  },
  conferenceFamily: {
    src: conferenceFamily,
    poster: conferenceFamilyPoster,
    chapters: conferenceFamilyChapters,
    label:
      'A family opens their conference page from the QR code, switches it to Spanish and back, taps an open time and confirms the switch. Taken times are grayed out.',
  },
  conferenceTeacher: {
    src: conferenceTeacher,
    poster: conferenceTeacherPoster,
    chapters: conferenceTeacherChapters,
    label:
      'A teacher scrolls the conference times, where some are marked “Picked by family”, puts Diego in an open time, then scrolls to “Changes by families”.',
  },
} satisfies Record<string, Clip>

export const SHOTS = {
  studentTop: {
    image: studentTop,
    alt: 'Marcus Bell’s student page for Friday: 2 positive marks, 4 negative, and a busiest hour of 10–11 AM.',
  },
  studentDay: {
    image: studentDay,
    alt: 'Marcus’s day as a timeline from 6 AM to 5 PM: green dots for positive marks on one side, red for negative on the other.',
  },
  studentMarks: {
    image: studentMarks,
    alt: 'Marcus’s marks for the day, listed by time: Unprepared at 8:17 AM, Off task at 9:12, Disruptive at 10:24, Participating at 10:38, and more.',
  },
  calendar: {
    image: calendar,
    alt: 'The lesson plans page: today’s plan with a Presenter view button, and a month calendar with a dot on each planned day.',
  },
  shareDialog: {
    image: shareDialog,
    alt: 'The Share with a substitute drawer: a link for Monday only, a Copy link button, the classes the sub can open, and Turn off link.',
  },
} satisfies Record<string, { image: ImageMetadata; alt: string }>

export const PRINTS = {
  report: {
    image: report,
    alt: 'A printed behavior report for Marcus Bell: 2 positive and 4 needs-work marks, what they were for, a chart of the last 10 school days (7 positive, 14 needs work in all), a timeline of the day, talking points for home and signature lines.',
  },
  planPrintQr: {
    image: planPrintQr,
    alt: 'A printed lesson plan with checkboxes for each line, and a box at the top: “Substitute? Scan me. Today’s plan + class behavior tracker, right on your phone,” with a QR code.',
  },
  conferenceNotice: {
    image: conferenceNotice,
    alt: 'A printed conference notice for Ava Chen’s family: the conference time in English on the top half and in Spanish on the bottom half, each with a QR code to see or change the time.',
  },
} satisfies Record<string, { image: ImageMetadata; alt: string }>
