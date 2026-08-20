import { type ReactNode } from "react"

import { SupportHeader, type SupportHeaderSection } from "@/components/support-center/support-header"
import { cn } from "@/lib/utils"

export function SupportPageShell({ children, section = "home" }: { children: ReactNode; section?: SupportHeaderSection }) {
  return (
    <div className="min-h-svh overflow-hidden bg-[#f7f9fc] text-foreground dark:bg-background">
      <SupportHeader section={section} />
      {children}
    </div>
  )
}

export function SupportPageContent({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("mx-auto max-w-[var(--support-shell-max-width)] px-5 sm:px-6 md:px-8 lg:px-10", className)}>{children}</div>
}
