import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  applyOp,
  cachedSection,
  lessonPlanDayQueryOptions,
} from '#/lib/lesson-plans'
import type { Op, PlanDay, PlanSection } from '#/lib/lesson-plans'
import { flushDrafts, isStructural, runOp } from '#/lib/lesson-plan-queue'
import {
  MAX_TEMPLATE_LINES,
  MAX_TEMPLATE_SECTIONS,
  TEMPLATE_DATE,
} from '#/lib/lesson-plan-templates'

// What the plan editor (plan-editor.tsx and the editor-* files) works on: a
// day's plan, where every change shows at once and goes to the server through
// the queue, or a template's draft, kept on the page until it's saved.
//
// The editor's typing drafts and cursor moves (editor-text.ts,
// lesson-plan-queue.ts) are kept in one place for the whole page. That's
// safe because only one editor is ever on screen: days and templates have
// their own pages. Keep it that way.

export type PlanTarget = {
  kind: 'day' | 'template'
  /** The day's date, or TEMPLATE_DATE. Every change carries it. */
  date: string
  /** Makes a change. */
  run: (op: Op) => void
  /**
   * A section as it is right now, which can be newer than what a component
   * last rendered: two quick keys can come before a re-render.
   */
  section: (id: string) => PlanSection | undefined
  /** Every section right now, or undefined if the plan isn't loaded. */
  sections: () => Array<PlanSection> | undefined
}

const PlanTargetContext = createContext<PlanTarget | null>(null)

export const PlanTargetProvider = PlanTargetContext.Provider

export function usePlanTarget() {
  const target = useContext(PlanTargetContext)
  if (!target) throw new Error('usePlanTarget: no PlanTargetProvider')
  return target
}

/** A day's plan: the cached day, changed through the queue (runOp). */
export function useDayTarget(date: string): PlanTarget {
  const queryClient = useQueryClient()
  return useMemo(
    () => ({
      kind: 'day',
      date,
      run: (op) => runOp(queryClient, op),
      section: (id) => cachedSection(queryClient, date, id),
      sections: () =>
        queryClient.getQueryData(lessonPlanDayQueryOptions(date).queryKey)
          ?.sections,
    }),
    [queryClient, date],
  )
}

/**
 * A template's draft, kept on the page. Changes are the same as a day's
 * (applyOp), but nothing is sent until the teacher saves.
 */
export function useTemplateDraft(initial: () => PlanDay) {
  const [day, setDay] = useState(initial)
  // What the draft is right now. Read by the editor between renders, so it
  // can't be React state.
  const ref = useRef(day)

  const target = useMemo<PlanTarget>(
    () => ({
      kind: 'template',
      date: TEMPLATE_DATE,
      run(op) {
        // As runOp does: save typing first, so it lands before this change.
        if (isStructural(op.kind)) flushDrafts()
        if (!fits(ref.current, op)) return
        ref.current = applyOp(ref.current, op)
        setDay(ref.current)
      },
      section: (id) => ref.current.sections.find((s) => s.id === id),
      sections: () => ref.current.sections,
    }),
    [],
  )

  /** The draft right now. Call flushDrafts first to include typing. */
  const current = useCallback(() => ref.current, [])

  /** Starts over from another draft (e.g. the copy saved elsewhere). */
  const reset = useCallback((next: PlanDay) => {
    ref.current = next
    setDay(next)
  }, [])

  return { day, target, current, reset }
}

/**
 * The server checks a day's limits; nothing checks a draft's until it's
 * saved. Refuses an add past them, saying why.
 */
function fits(day: PlanDay, op: Op) {
  if (
    op.kind === 'section-add' &&
    day.sections.length >= MAX_TEMPLATE_SECTIONS &&
    !day.sections.some((s) => s.id === op.id)
  ) {
    toast.error('Couldn’t add the section', {
      id: 'template-limit',
      description: `A template can hold up to ${MAX_TEMPLATE_SECTIONS} sections.`,
    })
    return false
  }
  if (op.kind === 'item-add') {
    const section = day.sections.find((s) => s.id === op.sectionId)
    if (section && section.items.length >= MAX_TEMPLATE_LINES) {
      toast.error('Couldn’t add the line', {
        id: 'template-limit',
        description: `A section can hold up to ${MAX_TEMPLATE_LINES} lines.`,
      })
      return false
    }
  }
  return true
}
