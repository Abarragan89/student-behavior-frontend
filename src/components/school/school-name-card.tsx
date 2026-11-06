import { useId, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Pencil, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { OfflineNote } from '#/components/offline-note'
import { useOnline } from '#/lib/online'
import {
  MAX_NAME_LENGTH,
  formatMonthYear,
  renameSchool,
  schoolQueryOptions,
  setMySchool,
} from '#/lib/school'
import type { SchoolDetail } from '#/lib/school'

/**
 * The school's name (the administrator can fix it) and its plan: every
 * school is a founding school, free through the pilot.
 */
export function SchoolNameCard({ detail }: { detail: SchoolDetail }) {
  const headingId = useId()
  const fieldId = useId()
  const online = useOnline()
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(detail.school.name)
  const isAdmin = detail.role === 'admin'
  const pilotEnds = detail.school.pilot_ends_at

  const rename = useMutation({
    mutationFn: () => renameSchool(name.trim()),
    onSuccess: (school) => {
      queryClient.setQueryData<SchoolDetail | null>(
        schoolQueryOptions.queryKey,
        (d) => d && { ...d, school },
      )
      setMySchool(queryClient, {
        id: school.id,
        name: school.name,
        role: detail.role,
      })
      setEditing(false)
      toast.success('School name saved')
    },
    onError: (error) => {
      console.error('Renaming the school failed:', error)
      toast.error('Couldn’t save the name. Try again.')
    },
  })
  const busy = rename.isPending

  return (
    <section aria-labelledby={headingId}>
      <Card className="gap-4 rounded-lg border-2 border-border shadow-md ring-0 [--card-spacing:--spacing(6)]">
        <CardHeader>
          <h2 id={headingId} className="text-lg font-bold">
            School
          </h2>
          <CardDescription>
            {isAdmin
              ? 'You’re the administrator.'
              : `Run by ${detail.admin_name || 'your administrator'}.`}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {editing ? (
            <form
              onSubmit={(e) => {
                e.preventDefault()
                if (name.trim() && !busy) rename.mutate()
              }}
              className="flex flex-col gap-2"
            >
              <label htmlFor={fieldId} className="text-sm font-bold">
                School name
              </label>
              <Input
                id={fieldId}
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={MAX_NAME_LENGTH}
                autoFocus
                disabled={busy}
                className="h-11 rounded-lg border-2 border-border bg-card text-base"
              />
              <OfflineNote action="rename your school" />
              <div className="flex gap-2">
                <Button
                  type="submit"
                  disabled={!online || busy || !name.trim()}
                  aria-busy={busy}
                  className="h-10 rounded-lg font-bold"
                >
                  {busy && <Spinner aria-hidden className="size-4" />}
                  Save
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setName(detail.school.name)
                    setEditing(false)
                  }}
                  disabled={busy}
                  className="h-10 rounded-lg border-2 font-bold"
                >
                  Cancel
                </Button>
              </div>
            </form>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <p className="min-w-0 flex-1 text-xl font-bold wrap-break-word">
                {detail.school.name}
              </p>
              {isAdmin && (
                <Button
                  variant="outline"
                  onClick={() => setEditing(true)}
                  disabled={!online}
                  className="h-10 rounded-lg border-2 font-bold"
                >
                  <Pencil />
                  Rename
                </Button>
              )}
            </div>
          )}

          {pilotEnds && (
            <div className="flex gap-3 rounded-lg bg-secondary p-3 text-sm">
              <Sparkles className="mt-0.5 size-4 shrink-0" />
              <p>
                <span className="font-bold">
                  Founding school · free through {formatMonthYear(pilotEnds)}
                </span>
                <br />
                {isAdmin
                  ? 'No credit card. Pricing will be announced before then. Teachers stay free either way.'
                  : 'Teachers stay free.'}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  )
}
