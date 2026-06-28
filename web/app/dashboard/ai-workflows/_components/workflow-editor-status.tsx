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
    <div className="pointer-events-none inline-flex min-h-8 w-fit max-w-full items-center gap-2 rounded-md border border-slate-200/80 bg-white/90 px-2.5 py-1 text-xs text-slate-500 shadow-sm backdrop-blur">
      <span
        className={cn(
          "inline-flex shrink-0 items-center gap-1",
          validation.valid ? "text-emerald-600" : "text-amber-700"
        )}
      >
        {validation.valid ? (
          <CheckCircle2Icon className="size-3.5" />
        ) : (
          <AlertTriangleIcon className="size-3.5" />
        )}
        {validation.valid ? "检查通过" : `${validation.errors.length} 个问题`}
      </span>
      <span className="h-3 w-px shrink-0 bg-slate-200" />
      <span className="shrink-0">{nodeCount} 节点</span>
      <span className="shrink-0">{edgeCount} 连线</span>
    </div>
  )
}
