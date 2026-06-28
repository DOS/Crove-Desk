"use client"

import { XIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import type { AIWorkflowDefinition, AIWorkflowNodeSpec } from "@/lib/api/admin"

import type { SelectedWorkflowBranch } from "./workflow-branch-selection"
import { ConditionBranchConfigPanel, NodeConfigPanel } from "./node-config-panel"
import { WorkflowNodeIcon } from "./workflow-node-icon"
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
  const panelIcon = selectedBranchItem ? "GitBranchIcon" : selectedNodeSpec?.icon

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
    <div className="pointer-events-none absolute inset-y-3 right-3 z-50 flex w-[380px] max-w-[calc(100%-1.5rem)]">
      <section className="pointer-events-auto flex min-h-0 w-full flex-col overflow-hidden rounded-xl border border-slate-200 bg-[#f8fafc] shadow-lg backdrop-blur">
        <div className="shrink-0 p-3 pb-2">
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <div className="flex items-start justify-between gap-3 px-3 py-3">
              <div className="flex min-w-0 items-start gap-2.5">
                <WorkflowNodeIcon
                  icon={panelIcon}
                  size="sm"
                  className="rounded-md bg-slate-100 text-slate-600 shadow-none"
                />
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold leading-5 text-slate-900">
                    {panelTitle}
                  </div>
                  {panelDescription ? (
                    <div className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">
                      {panelDescription}
                    </div>
                  ) : null}
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-7 shrink-0 rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                aria-label="关闭属性面板"
                onClick={onClose}
              >
                <XIcon className="size-4" />
              </Button>
            </div>
            {panelMeta ? (
              <div className="border-t border-slate-100 px-3 py-2">
                <div className="flex flex-wrap gap-1.5">
                  <span className="inline-flex h-6 items-center rounded-full border border-slate-200 bg-slate-50 px-2 font-mono text-[11px] text-slate-600">
                    {panelMeta}
                  </span>
                  <span className="inline-flex h-6 items-center rounded-full border border-blue-100 bg-blue-50 px-2 text-[11px] text-blue-700">
                    可配置
                  </span>
                </div>
              </div>
            ) : null}
          </div>
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
              onChange={onChangeNodeData}
              onDelete={onDeleteNode}
            />
          )}
        </div>
      </section>
    </div>
  )
}
