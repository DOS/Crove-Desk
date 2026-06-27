"use client"

import { PlusIcon } from "lucide-react"

import type { AIWorkflowNodeSpec } from "@/lib/api/admin"

export function WorkflowNodePalette({
  nodeSpecs,
  onAddNode,
}: {
  nodeSpecs: AIWorkflowNodeSpec[]
  onAddNode: (spec: AIWorkflowNodeSpec) => void
}) {
  return (
    <aside className="flex w-60 shrink-0 flex-col border-r bg-muted/20">
      <div className="border-b px-3 py-2">
        <div className="text-sm font-medium">节点</div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        <div className="space-y-1">
          {nodeSpecs.map((spec) => (
            <button
              key={spec.type}
              type="button"
              className="flex w-full items-start gap-2 rounded-md border bg-background px-2 py-2 text-left text-sm hover:bg-muted"
              onClick={() => onAddNode(spec)}
            >
              <PlusIcon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
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
