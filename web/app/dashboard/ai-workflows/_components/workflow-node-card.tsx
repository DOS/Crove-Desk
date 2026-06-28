import type { ReactNode } from "react"

import { cn } from "@/lib/utils"
import type { AIWorkflowNodeSpec } from "@/lib/api/admin"
import { WorkflowNodeIcon } from "./workflow-node-icon"

export function WorkflowNodeCard({
  nodeType,
  title,
  spec,
  selected,
  width = "normal",
  children,
}: {
  nodeType: string
  title: string
  spec?: AIWorkflowNodeSpec
  selected: boolean
  width?: "normal" | "wide"
  children?: ReactNode
}) {
  return (
    <div
      className={cn(
        "group relative rounded-lg border bg-background p-0.5 transition-all",
        width === "wide" ? "w-[320px]" : "w-[280px]",
        selected
          ? "border-[var(--g-selection-background)] shadow-[0_8px_24px_rgba(20,24,38,0.14)]"
          : "border-border/80 shadow-sm hover:border-border hover:shadow-md"
      )}
    >
      <div className="overflow-hidden rounded-lg border border-transparent bg-background">
        <div className="flex items-center gap-2 px-3 pb-2 pt-3">
          <WorkflowNodeIcon type={nodeType} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold leading-5 text-foreground">
              {title}
            </div>
          </div>
        </div>
        {spec?.description ? (
          <div className="mx-3 mb-2 line-clamp-2 rounded-lg bg-muted/45 px-2 py-1.5 text-xs leading-4 text-muted-foreground">
            {spec.description}
          </div>
        ) : null}
        {children ? <div className="border-t bg-muted/20 px-3 py-2.5">{children}</div> : null}
      </div>
    </div>
  )
}
