import type { ReactNode } from 'react'

export function PhoneFrame({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-xs rounded-3xl border-4 border-border bg-card p-2 shadow-xl">
      <div
        aria-hidden
        className="mx-auto mb-2 h-1.5 w-14 rounded-full bg-foreground"
      />
      <div className="overflow-hidden rounded-2xl border-2 border-border bg-background">
        {children}
      </div>
    </div>
  )
}
