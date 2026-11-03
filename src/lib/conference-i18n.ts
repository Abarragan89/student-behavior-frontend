// English and Spanish for what families see: the printed notice and the page
// its QR code opens (/conference). The teacher's screens stay in English.
//
// Times are always shown in the conference's time zone (the teacher's), not
// the reader's device's, so the page and the paper agree.

export type Lang = 'en' | 'es'

/** es-US writes "3:15 p. m."; plain es would use a 24-hour clock. */
const LOCALE: Record<Lang, string> = { en: 'en-US', es: 'es-US' }

/** A stored choice wins, then the browser's languages, then English. */
export function pickLanguage(stored: Lang | null): Lang {
  if (stored) return stored
  const langs =
    typeof navigator === 'undefined'
      ? []
      : navigator.languages.length > 0
        ? navigator.languages
        : [navigator.language]
  return langs.some((l) => /^es\b/i.test(l)) ? 'es' : 'en'
}

/** "Thursday, November 12" ("jueves, 12 de noviembre"). */
export function formatDay(when: string, timeZone: string, lang: Lang) {
  return new Date(when).toLocaleDateString(LOCALE[lang], {
    timeZone,
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })
}

/** With the year, for paper: "Thursday, November 12, 2026". */
export function formatFullDay(when: string, timeZone: string, lang: Lang) {
  return new Date(when).toLocaleDateString(LOCALE[lang], {
    timeZone,
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

/** "3:15 PM" ("3:15 p. m."). */
export function formatClockTime(when: string, timeZone: string, lang: Lang) {
  return new Date(when).toLocaleTimeString(LOCALE[lang], {
    timeZone,
    hour: 'numeric',
    minute: '2-digit',
  })
}

/** "3:15 – 3:30 PM" ("3:15 – 3:30 p. m."). */
export function formatRange(
  start: string,
  end: string,
  timeZone: string,
  lang: Lang,
) {
  return new Intl.DateTimeFormat(LOCALE[lang], {
    timeZone,
    hour: 'numeric',
    minute: '2-digit',
  }).formatRange(new Date(start), new Date(end))
}

/** "Thursday, November 12, 3:15 – 3:30 PM", for sentences. */
export function formatWhen(
  start: string,
  end: string,
  timeZone: string,
  lang: Lang,
) {
  return `${formatDay(start, timeZone, lang)}, ${formatRange(start, end, timeZone, lang)}`
}

/**
 * Days for a sign-up notice, capitalized: "Thursday, November 5 and Friday,
 * November 6" ("Jueves, 5 de noviembre y viernes, 6 de noviembre"). More
 * than three are shown first to last: "Thursday, November 5 – Friday,
 * November 13". days are times on each day, in order.
 */
export function formatDayList(
  days: Array<string>,
  timeZone: string,
  lang: Lang,
) {
  if (days.length === 0) return ''
  if (days.length > 3) {
    return capitalize(
      new Intl.DateTimeFormat(LOCALE[lang], {
        timeZone,
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      }).formatRange(new Date(days[0]), new Date(days[days.length - 1])),
    )
  }
  return capitalize(
    new Intl.ListFormat(LOCALE[lang], { type: 'conjunction' }).format(
      days.map((d) => formatDay(d, timeZone, lang)),
    ),
  )
}

/** Spanish days are lower case; at the start of a line they need a capital. */
export function capitalize(s: string) {
  return s.charAt(0).toLocaleUpperCase() + s.slice(1)
}

/** "Central Time" ("hora central"), or null when it's the device's own. */
export function timeZoneNote(timeZone: string, lang: Lang) {
  if (Intl.DateTimeFormat().resolvedOptions().timeZone === timeZone) return null
  return (
    new Intl.DateTimeFormat(LOCALE[lang], {
      timeZone,
      timeZoneName: 'long',
    })
      .formatToParts(new Date())
      .find((p) => p.type === 'timeZoneName')?.value ?? timeZone
  )
}

// ---------- The family's page ----------

export const familyStrings = {
  en: {
    opening: 'Opening your conference…',
    title: (first: string) => `${first}’s conference`,
    withTeacher: (teacher: string) => `with ${teacher}`,
    yourTime: 'Your time',
    noTime: (first: string) => `${first} doesn’t have a conference time yet.`,
    pickBelow: 'Choose an open time below.',
    firstCome: 'Times are first come, first served.',
    changeHeading: 'Change your time',
    tapOpen: 'Tap an open time to choose it.',
    open: 'Open',
    unavailable: 'Unavailable',
    mine: 'Your time',
    noneOpen:
      'There are no other open times right now. This page updates by itself.',
    noneOpenNoTime: (teacher: string) =>
      `There are no open times right now. This page updates by itself. If none open up, please contact ${teacher}.`,
    confirmTitle: 'Switch to this time?',
    confirmTitleNew: 'Choose this time?',
    confirmBody: (from: string, to: string) =>
      `Your conference will move from ${from} to ${to}. Your current time will open up for another family.`,
    confirmBodyNew: (to: string) => `Your conference will be ${to}.`,
    confirmYes: 'Yes, switch',
    confirmYesNew: 'Yes, choose it',
    cancel: 'Cancel',
    moving: 'Switching…',
    moved: (to: string) => `Done! Your conference is now ${to}.`,
    justTaken: 'Another family just chose this time.',
    taken:
      'Sorry, another family just chose that time. Please pick another one.',
    lockedTarget: (hours: number) =>
      `That time is less than ${hours} hours away, so it can’t be chosen here.`,
    lockedMine: (hours: number, teacher: string) =>
      `Your conference is less than ${hours} hours away, so it can’t be changed here. If you can’t come, please contact ${teacher}.`,
    closed: (teacher: string) =>
      `Changes can’t be made online right now. To change your time, please contact ${teacher}.`,
    closedNoTime: (teacher: string) =>
      `Times can’t be chosen online right now. Please contact ${teacher} to get a time.`,
    stale: 'Your time was just changed. Please check it and try again.',
    tooMany:
      'Too many changes for now. Please wait a few minutes and try again.',
    failed: 'Couldn’t change your time. Check your connection and try again.',
    live: 'Live',
    reconnecting: 'Reconnecting…',
    offline: 'You’re offline',
    loadFailed: 'Couldn’t open this page. Try again in a moment.',
    tryAgain: 'Try again',
    missingKeyTitle: 'This link is missing its code',
    missingKey: 'Scan the QR code on the notice again.',
    notWorkingTitle: 'This link doesn’t work',
    notWorking:
      'It may have been replaced with a new one. Please contact your child’s teacher.',
    endedTitle: 'These conferences are over',
    ended: 'Thank you!',
    privacy: (first: string) =>
      `Only you can see that this time is ${first}’s. Other families just see “Unavailable.”`,
    tzNote: (tz: string) => `Times are in ${tz}.`,
    switchTo: 'Español',
    switchToLabel: 'Ver en español',
  },
  es: {
    opening: 'Abriendo su conferencia…',
    title: (first: string) => `Conferencia de ${first}`,
    withTeacher: (teacher: string) => `con ${teacher}`,
    yourTime: 'Su horario',
    noTime: (first: string) =>
      `${first} todavía no tiene un horario para la conferencia.`,
    pickBelow: 'Elija un horario disponible abajo.',
    firstCome: 'Los horarios se asignan por orden de llegada.',
    changeHeading: 'Cambiar su horario',
    tapOpen: 'Toque un horario disponible para elegirlo.',
    open: 'Disponible',
    unavailable: 'No disponible',
    mine: 'Su horario',
    noneOpen:
      'No hay otros horarios disponibles en este momento. Esta página se actualiza sola.',
    noneOpenNoTime: (teacher: string) =>
      `No hay horarios disponibles en este momento. Esta página se actualiza sola. Si no se abre ninguno, comuníquese con ${teacher}.`,
    confirmTitle: '¿Cambiar a este horario?',
    confirmTitleNew: '¿Elegir este horario?',
    confirmBody: (from: string, to: string) =>
      `Su conferencia pasará del ${from} al ${to}. Su horario actual quedará disponible para otra familia.`,
    confirmBodyNew: (to: string) => `Su conferencia será el ${to}.`,
    confirmYes: 'Sí, cambiar',
    confirmYesNew: 'Sí, elegirlo',
    cancel: 'Cancelar',
    moving: 'Cambiando…',
    moved: (to: string) => `¡Listo! Su conferencia ahora es el ${to}.`,
    justTaken: 'Otra familia acaba de elegir este horario.',
    taken:
      'Lo sentimos, otra familia acaba de elegir ese horario. Por favor, elija otro.',
    lockedTarget: (hours: number) =>
      `Faltan menos de ${hours} horas para ese horario, así que no se puede elegir aquí.`,
    lockedMine: (hours: number, teacher: string) =>
      `Faltan menos de ${hours} horas para su conferencia, así que ya no se puede cambiar aquí. Si no puede venir, comuníquese con ${teacher}.`,
    closed: (teacher: string) =>
      `En este momento no se pueden hacer cambios en línea. Para cambiar su horario, comuníquese con ${teacher}.`,
    closedNoTime: (teacher: string) =>
      `En este momento no se pueden elegir horarios en línea. Comuníquese con ${teacher} para obtener un horario.`,
    stale: 'Su horario acaba de cambiar. Revíselo e intente de nuevo.',
    tooMany:
      'Demasiados cambios por ahora. Espere unos minutos e intente de nuevo.',
    failed:
      'No se pudo cambiar su horario. Revise su conexión e intente de nuevo.',
    live: 'En vivo',
    reconnecting: 'Reconectando…',
    offline: 'Sin conexión',
    loadFailed: 'No se pudo abrir esta página. Intente de nuevo en un momento.',
    tryAgain: 'Intentar de nuevo',
    missingKeyTitle: 'A este enlace le falta su código',
    missingKey: 'Vuelva a escanear el código QR del aviso.',
    notWorkingTitle: 'Este enlace no funciona',
    notWorking:
      'Es posible que lo hayan reemplazado por uno nuevo. Comuníquese con el maestro o la maestra de su hijo(a).',
    endedTitle: 'Las conferencias ya terminaron',
    ended: '¡Gracias!',
    privacy: (first: string) =>
      `Solo usted puede ver que este horario es de ${first}. Las demás familias solo ven “No disponible”.`,
    tzNote: (tz: string) => `Los horarios están en ${tz}.`,
    switchTo: 'English',
    switchToLabel: 'View in English',
  },
} satisfies Record<Lang, Record<string, unknown>>

// ---------- The printed notice ----------

export const noticeStrings = {
  en: {
    heading: 'Parent–Teacher Conference',
    forFamily: (name: string) => `For the parent or guardian of ${name}`,
    yourConference: 'Your conference',
    withTeacher: (teacher: string, location: string) =>
      location ? `with ${teacher} · ${location}` : `with ${teacher}`,
    canChange: (hours: number) =>
      `Can’t come at this time? Scan the QR code with your phone’s camera to see the open times and choose a new one. You can change your time until ${hours} hours before your conference.`,
    cannotChange:
      'Can’t come at this time? Please contact me to find another time.',
    scanChange: 'Scan to see or change your time',
    scanSee: 'Scan to see your conference time',
    // A sign-up notice: the student has no time yet.
    signUpLabel: 'Sign up for a conference',
    signUpCall: 'Choose your time',
    signUpDays: (days: string) => `Conference days: ${days}`,
    signUpBody: (hours: number) =>
      `Scan the QR code with your phone’s camera to see the open times and choose one. Times are first come, first served, so please choose soon. You can choose until ${hours} hours before a time.`,
    scanSignUp: 'Scan to choose your time',
    private: (first: string) =>
      `This code is only for ${first}’s conference. Please don’t share it.`,
    thanks: (teacher: string) =>
      `Thank you! I look forward to meeting with you. — ${teacher}`,
  },
  es: {
    heading: 'Conferencia de padres y maestros',
    forFamily: (name: string) =>
      `Para el padre, la madre o el tutor de ${name}`,
    yourConference: 'Su conferencia',
    withTeacher: (teacher: string, location: string) =>
      location ? `con ${teacher} · ${location}` : `con ${teacher}`,
    canChange: (hours: number) =>
      `¿No puede venir a esta hora? Escanee el código QR con la cámara de su teléfono para ver los horarios disponibles y elegir otro. Puede cambiar su horario hasta ${hours} horas antes de la conferencia.`,
    cannotChange:
      '¿No puede venir a esta hora? Comuníquese conmigo para buscar otro horario.',
    scanChange: 'Escanee para ver o cambiar su horario',
    scanSee: 'Escanee para ver su horario',
    signUpLabel: 'Inscríbase para una conferencia',
    signUpCall: 'Elija su horario',
    signUpDays: (days: string) => `Días de conferencias: ${days}`,
    signUpBody: (hours: number) =>
      `Escanee el código QR con la cámara de su teléfono para ver los horarios disponibles y elegir uno. Los horarios se asignan por orden de llegada, así que elija pronto. Puede elegir hasta ${hours} horas antes de un horario.`,
    scanSignUp: 'Escanee para elegir su horario',
    private: (first: string) =>
      `Este código es solo para la conferencia de ${first}. Por favor, no lo comparta.`,
    thanks: (teacher: string) =>
      `¡Gracias! Espero reunirme con usted. — ${teacher}`,
  },
} satisfies Record<Lang, Record<string, unknown>>
