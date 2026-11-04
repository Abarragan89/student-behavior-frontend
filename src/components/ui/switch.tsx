import { Switch as SwitchPrimitive } from "@base-ui/react/switch"
import { cn } from "cn"

// An on/off switch, in the app's look: a black outline, filled with the
// primary color when on. Base UI gives it role="switch" and aria-checked.
function Switch({ className, ...props }: SwitchPrimitive.Root.Props) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border-2 border-border bg-muted p-0.5 transition-colors outline-none focus-visible:ring-4 focus-visible:ring-ring data-checked:bg-primary data-disabled:cursor-not-allowed data-disabled:opacity-50 motion-reduce:transition-none",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="block size-5 rounded-full border-2 border-border bg-card shadow-sm transition-transform data-checked:translate-x-5 motion-reduce:transition-none"
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
