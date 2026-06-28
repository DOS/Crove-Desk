import { cn } from "@/lib/utils"
import { getWorkflowNodeMeta } from "./workflow-node-meta"

export function WorkflowNodeIcon({
  type,
  size = "md",
  className,
}: {
  type: string
  size?: "sm" | "md"
  className?: string
}) {
  const meta = getWorkflowNodeMeta(type)
  const Icon = meta.icon

  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground shadow-sm",
        size === "md" ? "size-7" : "size-6",
        className
      )}
    >
      <Icon className={size === "md" ? "size-4" : "size-3.5"} />
    </span>
  )
}
