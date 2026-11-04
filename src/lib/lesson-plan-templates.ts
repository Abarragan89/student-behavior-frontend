import { queryOptions } from '@tanstack/react-query'
import { ApiError, apiDelete, apiGet, apiPost, apiPut } from './api'
import type { ApiOptions } from './api'
import { SHARED_STALE_MS } from './freshness'
import { isBlank } from './lesson-plans'
import type { Indent, PlanDay, PlanSection } from './lesson-plans'
import { uuidv7 } from './uuid'

// Lesson plan templates: a teacher's reusable day ("Regular Monday"), with
// subjects, times and lines but no date and no checkmarks. A day can start
// from one, or be replaced by one.
//
// Unlike a day, a template is saved whole with a Save button. The editor
// edits a copy on the page (plan-target.tsx), so nothing here is queued, and
// nothing is saved on the device (persist.ts never keeps these queries).

// The backend's limits.
export const MAX_TEMPLATE_NAME_LENGTH = 80
export const MAX_TEMPLATES = 50
// The same as a day's, so a template always fits a day.
export const MAX_TEMPLATE_SECTIONS = 40
export const MAX_TEMPLATE_LINES = 150
// The subjects as JSON, in bytes. Real templates are a few kilobytes.
const MAX_TEMPLATE_BYTES = 256 * 1024

/**
 * The date a template's draft carries in place of a day's. Every change
 * (Op) has a date; this one is never sent (runOp refuses it).
 */
export const TEMPLATE_DATE = 'template'

export type TemplateItem = { text: string; indent: Indent }

export type TemplateSection = {
  title: string
  /** "08:15", or null. */
  start_time: string | null
  end_time: string | null
  items: Array<TemplateItem>
}

export type LessonPlanTemplate = {
  id: string
  name: string
  /** Bumped by every save. A save from an older version is refused (409). */
  version: number
  updated_at: string
  sections: Array<TemplateSection>
}

/** A subject as the list shows it: its lines only counted. */
export type TemplateOutline = {
  title: string
  start_time: string | null
  end_time: string | null
  items: number
}

export type TemplateSummary = {
  id: string
  name: string
  version: number
  updated_at: string
  outline: Array<TemplateOutline>
}

/** What a save sends: the name and subjects. */
export type TemplateBody = {
  name: string
  sections: Array<TemplateSection>
}

// ---------- Reading ----------

export const lessonPlanTemplatesKey = ['lesson-plan-templates'] as const

/** The space's templates, sorted by name. */
export function lessonPlanTemplatesQueryOptions() {
  return queryOptions({
    queryKey: lessonPlanTemplatesKey,
    queryFn: () => apiGet<Array<TemplateSummary>>('/lesson-plan-templates'),
    staleTime: SHARED_STALE_MS,
  })
}

export function lessonPlanTemplateQueryOptions(id: string) {
  return queryOptions({
    queryKey: ['lesson-plan-template', id] as const,
    queryFn: () => apiGet<LessonPlanTemplate>(`/lesson-plan-templates/${id}`),
    staleTime: SHARED_STALE_MS,
  })
}

// ---------- Writing ----------

/**
 * Saves a new template. id is picked here, so sending it twice finds the
 * first one (as it was then). A 409 means the space has MAX_TEMPLATES.
 */
export function createTemplate(
  id: string,
  body: TemplateBody,
  options?: ApiOptions,
) {
  return apiPost<LessonPlanTemplate>(
    '/lesson-plan-templates',
    { id, ...body },
    options,
  )
}

/**
 * Replaces a template's name and subjects. version is the one the edit
 * started from; a 409 means it was saved somewhere else since.
 */
export function saveTemplate(
  id: string,
  body: TemplateBody,
  version: number,
  options?: ApiOptions,
) {
  return apiPut<LessonPlanTemplate>(
    `/lesson-plan-templates/${id}`,
    { ...body, version },
    options,
  )
}

/** Deletes a template. Already gone counts as done. */
export async function deleteTemplate(id: string) {
  try {
    await apiDelete(`/lesson-plan-templates/${id}`)
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return
    throw error
  }
}

/**
 * Puts a template's subjects on date, unchecked, and returns the new plan.
 * Without replace the server refuses (409) if date already has a plan; with
 * it, the date's plan is deleted first. Only pass replace when the teacher
 * was told and agreed.
 */
export function applyTemplate(
  date: string,
  templateId: string,
  replace: boolean,
) {
  return apiPost<PlanDay>(`/lesson-plans/${date}/from-template`, {
    template_id: templateId,
    replace,
  })
}

// ---------- Between days, drafts and templates ----------

/**
 * A day's sections as a template's: no ids, no checkmarks, no blank lines
 * (an extra Enter makes those).
 */
export function sectionsFromDay(
  sections: Array<PlanSection>,
): Array<TemplateSection> {
  return sections.map((s) => ({
    title: s.title,
    start_time: s.start_time,
    end_time: s.end_time,
    items: s.items
      .filter((i) => !isBlank(i))
      .map((i) => ({ text: i.text, indent: i.indent })),
  }))
}

/** A template's subjects as a day the editor can work on, with new ids. */
export function draftDay(sections: Array<TemplateSection>): PlanDay {
  return {
    date: TEMPLATE_DATE,
    sections: sections.map((s) => {
      const id = uuidv7()
      return {
        id,
        date: TEMPLATE_DATE,
        title: s.title,
        start_time: s.start_time,
        end_time: s.end_time,
        items: s.items.map((i) => ({
          id: uuidv7(),
          section_id: id,
          text: i.text,
          indent: i.indent,
          done: false,
        })),
      }
    }),
  }
}

/** A name as the server keeps it: trimmed, spaces squeezed to one. */
export function cleanTemplateName(name: string) {
  return name.trim().split(/\s+/).filter(Boolean).join(' ')
}

/** What saving the editor's name and draft would send. */
export function templateBody(name: string, draft: PlanDay): TemplateBody {
  return {
    name: cleanTemplateName(name),
    sections: sectionsFromDay(draft.sections),
  }
}

/** A saved template's name and subjects. */
export function bodyOf(template: LessonPlanTemplate): TemplateBody {
  return { name: template.name, sections: template.sections }
}

/**
 * What a new template starts with when it's made from another one: the same
 * subjects, times and lines, named "Copy of …" until the teacher renames it.
 */
export function copyOf(template: LessonPlanTemplate): TemplateBody {
  return {
    name: `Copy of ${template.name}`.slice(0, MAX_TEMPLATE_NAME_LENGTH),
    sections: template.sections,
  }
}

/** Whether two templates have the same name and subjects. */
export function sameTemplate(a: TemplateBody, b: TemplateBody) {
  return JSON.stringify(normalized(a)) === JSON.stringify(normalized(b))
}

// The same keys in the same order, so JSON.stringify compares content only.
function normalized(body: TemplateBody) {
  return {
    name: body.name,
    sections: body.sections.map((s) => ({
      title: s.title,
      start_time: s.start_time ?? null,
      end_time: s.end_time ?? null,
      items: s.items.map((i) => ({ text: i.text, indent: i.indent })),
    })),
  }
}

/** Over the server's size limit. Counted a little high, never low. */
export function templateTooBig(body: TemplateBody) {
  const bytes = new TextEncoder().encode(
    JSON.stringify({ v: 1, sections: normalized(body).sections }),
  ).length
  return bytes > MAX_TEMPLATE_BYTES
}

/** "1 subject", "4 subjects". */
export function subjectCount(n: number) {
  return `${n} ${n === 1 ? 'subject' : 'subjects'}`
}

/**
 * When a template's day runs: its earliest start and latest end, for
 * formatClockRange. Nulls when no subject has a time.
 */
export function templateHours(sections: Array<TemplateOutline>) {
  // "HH:MM" strings sort like the times they name.
  let start: string | null = null
  let end: string | null = null
  for (const s of sections) {
    if (s.start_time && (start === null || s.start_time < start)) {
      start = s.start_time
    }
    const last = s.end_time ?? s.start_time
    if (last && (end === null || last > end)) end = last
  }
  return {
    start,
    end: end !== null && start !== null && end > start ? end : null,
  }
}
