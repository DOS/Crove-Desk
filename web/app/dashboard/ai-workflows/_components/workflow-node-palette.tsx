"use client"

import type { AIWorkflowNodeSpec } from "@/lib/api/admin"
import { WorkflowNodeIcon } from "./workflow-node-icon"

export function WorkflowNodePalette({
  nodeSpecs,
  onAddNode,
}: {
  nodeSpecs: AIWorkflowNodeSpec[]
  onAddNode: (spec: AIWorkflowNodeSpec) => void
}) {
  return (
    <aside className="absolute left-3 top-3 z-50 flex max-h-[calc(100%-1.5rem)] w-64 shrink-0 flex-col overflow-hidden rounded-md border bg-background/95 shadow-sm backdrop-blur">
      <div className="border-b px-3 py-2">
        <div className="text-xs font-medium text-muted-foreground">节点</div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
        <div className="space-y-1">
          {nodeSpecs.map((spec) => (
            <button
              key={spec.type}
              type="button"
              className="flex w-full items-start gap-2 rounded-md px-2 py-2 text-left text-sm transition-colors hover:bg-muted"
              onClick={() => onAddNode(spec)}
            >
              <WorkflowNodeIcon type={spec.type} size="sm" className="mt-0.5" />
              <span className="min-w-0">
                <span className="block truncate font-medium">{spec.title || spec.type}</span>
                <span className="line-clamp-2 text-xs text-muted-foreground">{spec.description}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </aside>
  )
}
