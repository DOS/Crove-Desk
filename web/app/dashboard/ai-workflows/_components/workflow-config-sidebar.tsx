"use client"

import { XIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import type { AIWorkflowDefinition, AIWorkflowNodeSpec } from "@/lib/api/admin"

import type { SelectedWorkflowBranch } from "./workflow-branch-selection"
import { ConditionBranchConfigPanel, NodeConfigPanel } from "./node-config-panel"
import {
  getAvailableVariables,
  normalizeNodeConfig,
  type WorkflowNodeData,
} from "./workflow-utils"

export function WorkflowConfigPanel({
  definition,
  nodeSpecs,
  selectedNodeId,
  selectedBranch,
  onClose,
  onSelectBranch,
  onChangeNodeData,
  onDeleteNode,
}: {
  definition: AIWorkflowDefinition
  nodeSpecs: AIWorkflowNodeSpec[]
  selectedNodeId: string
  selectedBranch: SelectedWorkflowBranch | null
  onClose: () => void
  onSelectBranch: (branch: SelectedWorkflowBranch | null) => void
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
  const selectedBranchItem = selectedNode && selectedBranch?.nodeId === selectedNode.id
    ? normalizeNodeConfig(selectedNode.data?.config).branches?.find((branch) => branch.id === selectedBranch.branchId) ?? null
    : null
  const panelTitle = selectedBranchItem
    ? selectedBranchItem.name || selectedBranchItem.id
    : selectedNode?.data?.title || selectedNodeSpec?.title || selectedNode?.type || ""
  const panelMeta = selectedBranchItem ? "条件分支" : selectedNode?.type || ""
  const panelDescription = selectedBranchItem
    ? "配置该条件分支的匹配规则和目标节点。"
    : selectedNodeSpec?.description || ""

  if (!selectedNode) {
    return null
  }

  const deleteSelectedBranch = (branchId: string) => {
    const config = normalizeNodeConfig(selectedNode.data?.config)
    onChangeNodeData(selectedNode.id, {
      ...(selectedNode.data ?? {}),
      config: {
        ...config,
        branches: (config.branches ?? []).filter((branch) => branch.id !== branchId),
      },
    })
    onSelectBranch(null)
  }

  return (
    <div className="pointer-events-none absolute inset-y-3 right-3 z-50 flex w-[360px] max-w-[calc(100%-1.5rem)]">
      <section className="pointer-events-auto flex min-h-0 w-full flex-col overflow-hidden rounded-md border bg-background/95 shadow-sm backdrop-blur">
        <div className="flex shrink-0 items-start justify-between gap-3 border-b px-4 py-3">
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">{panelTitle}</div>
            {panelMeta ? (
              <div className="mt-1 truncate font-mono text-xs text-muted-foreground">{panelMeta}</div>
            ) : null}
            {panelDescription ? (
              <div className="mt-2 line-clamp-3 text-xs leading-5 text-muted-foreground">
                {panelDescription}
              </div>
            ) : null}
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
          {selectedBranchItem && selectedBranch ? (
            <ConditionBranchConfigPanel
              node={selectedNode}
              nodes={definition.nodes}
              branchId={selectedBranch.branchId}
              variables={availableVariables}
              onChange={onChangeNodeData}
              onDelete={deleteSelectedBranch}
            />
          ) : (
            <NodeConfigPanel
              node={selectedNode}
              nodeSpec={selectedNodeSpec}
              nodes={definition.nodes}
              availableVariables={availableVariables}
              showHeader={false}
              showConditionBranches={selectedNode.type !== "condition"}
              onChange={onChangeNodeData}
              onDelete={onDeleteNode}
            />
          )}
        </div>
      </section>
    </div>
  )
}
