"use client"

import type { AIWorkflowDefinition, AIWorkflowNodeSpec } from "@/lib/api/admin"
import { cn } from "@/lib/utils"

import { NodeConfigPanel } from "./node-config-panel"
import {
  getAvailableVariables,
  getNodeTitle,
  type WorkflowNodeData,
} from "./workflow-utils"

export function WorkflowConfigSidebar({
  definition,
  nodeSpecs,
  selectedNodeId,
  onSelectNode,
  onChangeNodeData,
  onDeleteNode,
}: {
  definition: AIWorkflowDefinition
  nodeSpecs: AIWorkflowNodeSpec[]
  selectedNodeId: string
  onSelectNode: (nodeId: string) => void
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

  return (
    <aside className="relative z-50 flex w-80 shrink-0 flex-col border-l bg-background">
      <div className="border-b px-3 py-2">
        <div className="text-sm font-medium">配置</div>
      </div>
      <div className="max-h-48 overflow-y-auto border-b p-2">
        <div className="space-y-1">
          {definition.nodes.map((node) => (
            <button
              key={node.id}
              type="button"
              className={cn(
                "flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted",
                selectedNodeId === node.id && "bg-muted"
              )}
              onClick={() => onSelectNode(node.id)}
            >
              <span className="min-w-0 truncate">{getNodeTitle(node, nodeSpecs)}</span>
              <span className="shrink-0 text-xs text-muted-foreground">{node.type}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="min-h-0 flex-1">
        <NodeConfigPanel
          node={selectedNode}
          nodeSpec={selectedNodeSpec}
          nodes={definition.nodes}
          availableVariables={availableVariables}
          onChange={onChangeNodeData}
          onDelete={onDeleteNode}
        />
      </div>
    </aside>
  )
}
