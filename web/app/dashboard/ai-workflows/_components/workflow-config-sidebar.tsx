"use client"

import { XIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import type { AIWorkflowDefinition, AIWorkflowNodeSpec } from "@/lib/api/admin"

import { NodeConfigPanel } from "./node-config-panel"
import {
  getAvailableVariables,
  type WorkflowNodeData,
} from "./workflow-utils"

export function WorkflowConfigPanel({
  definition,
  nodeSpecs,
  selectedNodeId,
  onClose,
  onChangeNodeData,
  onDeleteNode,
}: {
  definition: AIWorkflowDefinition
  nodeSpecs: AIWorkflowNodeSpec[]
  selectedNodeId: string
  onClose: () => void
  onChangeNodeData: (nodeId: string, data: WorkflowNodeData) => void
  onDeleteNode: (nodeId: string) => void
}) {
  const selectedNode = definition.nodes.find((node) => node.id === selectedNodeId) ?? null
  const selectedNodeSpec = selectedNode
    ? nodeSpecs.find((spec) => spec.type === selectedNode.type)
    : undefined
  const availableVariables = selectedNode
    ? getAvailableVariables(definition, selectedNode.id, nodeSpecs)
    : []

  if (!selectedNode) {
    return null
  }

  return (
    <div className="pointer-events-none absolute inset-y-3 right-3 z-50 flex w-[360px] max-w-[calc(100%-1.5rem)]">
      <section className="pointer-events-auto flex min-h-0 w-full flex-col overflow-hidden rounded-lg border bg-background shadow-2xl">
        <div className="flex shrink-0 items-start justify-between gap-3 border-b px-4 py-3">
          <div className="min-w-0">
            <div className="text-sm font-medium">属性</div>
            <div className="mt-0.5 truncate text-xs text-muted-foreground">
              {selectedNode.data?.title || selectedNodeSpec?.title || selectedNode.type}
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 shrink-0 text-muted-foreground"
            aria-label="关闭属性面板"
            onClick={onClose}
          >
            <XIcon className="size-4" />
          </Button>
        </div>
        <div className="min-h-0 flex-1">
          <NodeConfigPanel
            node={selectedNode}
            nodeSpec={selectedNodeSpec}
            nodes={definition.nodes}
            availableVariables={availableVariables}
            showHeader={false}
            onChange={onChangeNodeData}
            onDelete={onDeleteNode}
          />
        </div>
      </section>
    </div>
  )
}
