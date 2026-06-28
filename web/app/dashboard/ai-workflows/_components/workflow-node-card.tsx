import type { ReactNode } from "react"

import { cn } from "@/lib/utils"
import { WorkflowNodeIcon } from "./workflow-node-icon"

export function WorkflowNodeCard({
  title,
  icon,
  selected,
  children,
}: {
  title: string
  icon: string
  selected: boolean
  children?: ReactNode
}) {
  return (
    <div
      className={cn(
        "group relative rounded-lg bg-[#FFFFFF] p-0.5 transition-all",
        "w-[242px]",
        selected
          ? "border-[var(--g-selection-background)] shadow-[0_8px_24px_rgba(20,24,38,0.14)]"
          : "border-border/80 shadow-sm hover:border-border hover:shadow-md"
      )}
    >
      <div className="overflow-hidden rounded-lg border border-transparent bg-[#FFFFFF]">
        <div className="flex items-center gap-2 px-3 pb-2 pt-3">
          <WorkflowNodeIcon icon={icon} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold leading-5 text-foreground">
              {title}
            </div>
          </div>
        </div>
        {children ? <div className="border-t bg-muted/20 px-3 py-2.5">{children}</div> : null}
      </div>
    </div>
  )
}
