"use client"

import { AlertTriangleIcon, CheckCircle2Icon } from "lucide-react"

import { cn } from "@/lib/utils"

import type { WorkflowDraftValidation } from "./workflow-utils"

export function WorkflowEditorStatus({
  validation,
  nodeCount,
  edgeCount,
}: {
  validation: WorkflowDraftValidation
  nodeCount: number
  edgeCount: number
}) {
  return (
    <div className="pointer-events-none inline-flex w-fit max-w-full items-center gap-2 px-1 text-xs text-slate-500">
      <span
        className={cn(
          "inline-flex shrink-0 items-center gap-1",
          validation.valid ? "text-emerald-600" : "text-amber-700"
        )}
      >
        {validation.valid ? (
          <CheckCircle2Icon className="size-3" />
        ) : (
          <AlertTriangleIcon className="size-3" />
        )}
        {validation.valid ? "检查通过" : `${validation.errors.length} 个问题`}
      </span>
      <span className="shrink-0 text-slate-300">/</span>
      <span className="shrink-0">{nodeCount} 节点</span>
      <span className="shrink-0 text-slate-300">·</span>
      <span className="shrink-0">{edgeCount} 连线</span>
    </div>
  )
}
