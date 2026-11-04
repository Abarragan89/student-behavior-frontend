import { useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useBlocker } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { CircleAlert } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'
import { ApiError } from '#/lib/api'
import { flushDrafts } from '#/lib/lesson-plan-queue'
import {
  MAX_TEMPLATES,
  MAX_TEMPLATE_NAME_LENGTH,
  bodyOf,
  copyOf,
  createTemplate,
  draftDay,
  lessonPlanTemplateQueryOptions,
  lessonPlanTemplatesKey,
  lessonPlanTemplatesQueryOptions,
  saveTemplate,
  sameTemplate,
  templateBody,
  templateTooBig,
} from '#/lib/lesson-plan-templates'
import type {
  LessonPlanTemplate,
  TemplateBody,
} from '#/lib/lesson-plan-templates'
import { useOnline } from '#/lib/online'
import { currentSpace } from '#/lib/space-state'
import { uuidv7 } from '#/lib/uuid'
import { OfflineNote } from '#/components/offline-note'
import {
  EditorEndSpace,
  PlanEditor,
} from '#/components/lesson-plans/plan-editor'
import { useTemplateDraft } from '#/components/lesson-plans/plan-target'
import { StartFromTemplateDialog } from '#/components/lesson-plans/template-picker-dialog'

/**
 * Makes or changes a template: a name, then the same editor as a day's plan.
 * Nothing is sent until Save. Leaving with changes asks first.
 */
export function TemplateEditor({
  heading,
  saved,
  initial,
  onSaved,
}: {
  heading: ReactNode
  /** The template being changed, or null for a new one. */
  saved: LessonPlanTemplate | null
  /** What a new template starts with (e.g. a day's plan). */
  initial?: TemplateBody
  /** After a save: where to go next. */
  onSaved: (template: LessonPlanTemplate) => void
}) {
  const queryClient = useQueryClient()
  const online = useOnline()
  const [start] = useState<TemplateBody>(
    () => (saved ? bodyOf(saved) : initial) ?? { name: '', sections: [] },
  )
  // Saved to the space the editor opened in, even if the tab switches.
  const [space] = useState(currentSpace)
  // The copy on the server (or, for a new one, what it started as): Save
  // sends its version, and leaving compares against it.
  const base = useRef({
    id: saved?.id ?? null,
    version: saved?.version ?? 0,
    body: start,
  })
  // A new template's id, picked once, so a retried save finds the first.
  const [firstId] = useState(uuidv7)
  const newId = useRef(firstId)

  const [name, setName] = useState(start.name)
  const nameRef = useRef(name)
  nameRef.current = name
  const nameInput = useRef<HTMLInputElement>(null)
  const [nameMissing, setNameMissing] = useState(false)
  const draft = useTemplateDraft(() => draftDay(start.sections))
  const [busy, setBusy] = useState(false)
  // Saved somewhere else since this edit started: theirs, to load or replace.
  const [conflict, setConflict] = useState<LessonPlanTemplate | null>(null)

  // A new template can start as a copy of another, while it's still empty.
  const others = useQuery({
    ...lessonPlanTemplatesQueryOptions(),
    enabled: saved === null,
  })
  const [pickerOpen, setPickerOpen] = useState(false)
  const canStartFrom = saved === null && (others.data?.length ?? 0) > 0

  /** Fills the draft from another template, keeping a name already typed. */
  function startFrom(template: LessonPlanTemplate) {
    const copy = copyOf(template)
    draft.reset(draftDay(copy.sections))
    if (nameRef.current.trim() === '') {
      setName(copy.name)
      nameRef.current = copy.name
      setNameMissing(false)
    }
  }

  /** What Save would send, typing included. */
  function current() {
    flushDrafts()
    return templateBody(nameRef.current, draft.current())
  }
  const changed = () => !sameTemplate(current(), base.current.body)

  const blocker = useBlocker({
    shouldBlockFn: changed,
    enableBeforeUnload: changed,
    withResolver: true,
  })

  async function send(body: TemplateBody, version: number) {
    const id = base.current.id
    if (id !== null) return saveTemplate(id, body, version, { space })
    const made = await createTemplate(newId.current, body, { space })
    // A retry answered with what the first try saved (its reply was lost):
    // put this one on top.
    return sameTemplate(bodyOf(made), body)
      ? made
      : saveTemplate(made.id, body, made.version, { space })
  }

  function done(template: LessonPlanTemplate, body: TemplateBody) {
    base.current = { id: template.id, version: template.version, body }
    queryClient.setQueryData(
      lessonPlanTemplateQueryOptions(template.id).queryKey,
      template,
    )
    void queryClient.invalidateQueries({ queryKey: lessonPlanTemplatesKey })
    setBusy(false)
    toast.success(`Saved “${template.name}”`)
    onSaved(template)
  }

  async function save() {
    const body = current()
    if (body.name === '') {
      setNameMissing(true)
      nameInput.current?.focus()
      return
    }
    if (body.sections.length === 0) {
      toast.error('Add a section first', {
        description: 'A template needs at least one section.',
      })
      return
    }
    if (templateTooBig(body)) {
      toast.error('This template is too long', {
        description: 'Take out some lines, then save again.',
      })
      return
    }
    setBusy(true)
    try {
      done(await send(body, base.current.version), body)
    } catch (error) {
      console.error('Saving a template failed:', error)
      await failed(error, body)
      setBusy(false)
    }
  }

  async function failed(error: unknown, body: TemplateBody) {
    const status = error instanceof ApiError ? error.status : undefined
    const id = base.current.id
    if (status === 409 && id === null) {
      toast.error(`You have ${MAX_TEMPLATES} templates`, {
        description: 'Delete one to make another.',
      })
      return
    }
    if (status === 409 && id !== null) {
      // Saved somewhere else since. The same as this edit is no conflict.
      try {
        const theirs = await queryClient.fetchQuery({
          ...lessonPlanTemplateQueryOptions(id),
          staleTime: 0,
        })
        if (sameTemplate(bodyOf(theirs), body)) done(theirs, body)
        else setConflict(theirs)
      } catch {
        toast.error('Couldn’t save the template', {
          description: 'Check your connection and try again.',
        })
      }
      return
    }
    if (status === 404 && id !== null) {
      // Deleted somewhere else. Saving again makes it anew.
      base.current = { ...base.current, id: null, version: 0 }
      newId.current = uuidv7()
      toast.error('This template was deleted on another device', {
        description: 'Save again to keep it as a new template.',
      })
      return
    }
    toast.error('Couldn’t save the template', {
      description:
        status === 400
          ? 'Something in it can’t be saved. Check the times and try again.'
          : 'Check your connection and try again.',
    })
  }

  function loadTheirs(theirs: LessonPlanTemplate) {
    const body = bodyOf(theirs)
    base.current = { id: theirs.id, version: theirs.version, body }
    setName(body.name)
    nameRef.current = body.name
    // New ids, so every section and line starts over from theirs.
    draft.reset(draftDay(body.sections))
    setConflict(null)
  }

  const saveButton = (className: string) => (
    <Button
      onClick={() => void save()}
      disabled={busy || !online}
      aria-busy={busy}
      className={cn(
        'relative rounded-lg border-2 border-border text-base font-bold shadow-md',
        className,
      )}
    >
      <span className={cn(busy && 'invisible')}>Save template</span>
      {busy && (
        <Spinner
          aria-label="Saving template"
          className="absolute inset-0 m-auto size-4"
        />
      )}
    </Button>
  )

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        {heading}
        {saveButton('h-11 shrink-0 px-4')}
      </div>
      <OfflineNote action="save templates" />

      <div className="flex flex-col gap-2">
        <Label htmlFor="template-name" className="text-base font-bold">
          Name
        </Label>
        <Input
          id="template-name"
          ref={nameInput}
          value={name}
          maxLength={MAX_TEMPLATE_NAME_LENGTH}
          placeholder="Like “Regular Monday”"
          autoComplete="off"
          aria-invalid={nameMissing || undefined}
          aria-describedby={nameMissing ? 'template-name-error' : undefined}
          onChange={(e) => {
            setName(e.target.value)
            if (e.target.value.trim() !== '') setNameMissing(false)
          }}
          className="h-11 rounded-lg border-2 border-border bg-card px-3 text-base"
        />
        {nameMissing && (
          <p
            id="template-name-error"
            className="flex items-center gap-2 text-sm font-medium"
          >
            <CircleAlert className="size-4 shrink-0 text-destructive" />
            Give the template a name.
          </p>
        )}
      </div>

      <PlanEditor
        day={draft.day}
        target={draft.target}
        onStartWithTemplate={
          canStartFrom ? () => setPickerOpen(true) : undefined
        }
      />

      {saveButton('h-12 w-full')}
      {draft.day.sections.length > 0 && <EditorEndSpace />}

      <StartFromTemplateDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onPick={startFrom}
      />

      {/* Leaving with changes not saved. */}
      <AlertDialog
        open={blocker.status === 'blocked'}
        onOpenChange={(open) => !open && blocker.reset?.()}
      >
        <AlertDialogContent className="rounded-lg border-2 border-border ring-0">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-bold">
              Discard your changes?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {base.current.id === null
                ? 'This template hasn’t been saved yet.'
                : 'The template stays as it was when you last saved it.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => blocker.reset?.()}>
              Keep editing
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => blocker.proceed?.()}
              className="bg-destructive font-bold text-destructive-foreground hover:bg-destructive/90"
            >
              Discard
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Saved on another device while this edit was open. */}
      <AlertDialog
        open={conflict !== null}
        onOpenChange={(open) => !open && setConflict(null)}
      >
        <AlertDialogContent className="rounded-lg border-2 border-border ring-0">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-bold">
              This template was just changed
            </AlertDialogTitle>
            <AlertDialogDescription>
              Someone saved it on another device while you were editing. Load
              their version, or save yours in its place.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => conflict && loadTheirs(conflict)}>
              Load theirs
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!conflict) return
                // Theirs is what this save replaces.
                base.current = { ...base.current, version: conflict.version }
                setConflict(null)
                void save()
              }}
              className="font-bold"
            >
              Save mine
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
