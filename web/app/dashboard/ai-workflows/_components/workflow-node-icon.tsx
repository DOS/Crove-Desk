import { cn } from "@/lib/utils"
import {
  getWorkflowNodeIconClass,
  getWorkflowNodeMeta,
  type WorkflowNodeTone,
} from "./workflow-node-meta"

export function WorkflowNodeIcon({
  type,
  tone,
  size = "md",
  className,
}: {
  type: string
  tone?: WorkflowNodeTone
  size?: "sm" | "md"
  className?: string
}) {
  const meta = getWorkflowNodeMeta(type)
  const Icon = meta.icon
  const resolvedTone = tone ?? meta.tone

  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-lg shadow-sm",
        size === "md" ? "size-7" : "size-6",
        getWorkflowNodeIconClass(resolvedTone),
        className
      )}
    >
      <Icon className={size === "md" ? "size-4" : "size-3.5"} />
    </span>
  )
}
