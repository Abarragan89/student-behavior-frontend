import { useId } from 'react'
import { Info } from 'lucide-react'
import {
  FEATURES,
  LEVELS,
  isFullAccess,
  levelOf,
  withLevel,
} from '#/lib/coteachers'
import type { Permissions } from '#/lib/coteachers'

/**
 * One row per feature (from FEATURES), each with No access / View / Edit.
 * A new feature added to FEATURES gets its own row here with no other change.
 */
export function PermissionRows({
  value,
  onChange,
  disabled = false,
}: {
  value: Permissions
  onChange: (next: Permissions) => void
  disabled?: boolean
}) {
  const id = useId()

  return (
    <div className="flex flex-col gap-5">
      {FEATURES.map((feature) => (
        <fieldset
          key={feature.key}
          disabled={disabled}
          aria-describedby={`${id}-${feature.key}-about`}
          className="flex flex-col gap-2"
        >
          <legend className="text-base font-bold">{feature.label}</legend>
          <p
            id={`${id}-${feature.key}-about`}
            className="-mt-1 text-sm text-muted-foreground"
          >
            {feature.description}
          </p>
          <div className="grid grid-cols-3 gap-2">
            {LEVELS.map((level) => (
              <label
                key={level.value}
                className="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-border bg-card px-2 py-2 text-sm font-bold transition-colors has-checked:border-primary has-checked:bg-primary/10 has-focus-visible:ring-4 has-focus-visible:ring-ring has-disabled:cursor-not-allowed has-disabled:opacity-50 motion-reduce:transition-none"
              >
                <input
                  type="radio"
                  name={`${id}-${feature.key}`}
                  value={level.value}
                  checked={levelOf(value, feature.key) === level.value}
                  onChange={() =>
                    onChange(withLevel(value, feature.key, level.value))
                  }
                  className="size-4 shrink-0 accent-primary"
                />
                {level.label}
              </label>
            ))}
          </div>
        </fieldset>
      ))}

      {isFullAccess(value) && (
        <p className="flex items-start gap-2 rounded-lg bg-muted px-3 py-2 text-sm">
          <Info className="mt-0.5 size-4 shrink-0" />
          Edit on everything is complete access: they can do anything you can,
          except invite co-teachers, connect Google Classroom, or archive or
          delete classes.
        </p>
      )}
    </div>
  )
}
