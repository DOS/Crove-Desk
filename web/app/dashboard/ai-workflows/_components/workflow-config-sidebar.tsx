"use client"

import { useState, type PointerEvent as ReactPointerEvent } from "react"
import { XIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { AIWorkflowDefinition, AIWorkflowNodeSpec } from "@/lib/api/admin"

import type { SelectedWorkflowBranch } from "./workflow-branch-selection"
import { ConditionBranchConfigPanel, NodeConfigPanel } from "./node-config-panel"
import { WorkflowNodeIcon } from "./workflow-node-icon"
import {
  getAvailableVariables,
  normalizeNodeConfig,
  type WorkflowNodeData,
} from "./workflow-utils"

const PANEL_DEFAULT_WIDTH = 460
const PANEL_MIN_WIDTH = 320
const PANEL_MAX_WIDTH = 600

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
  const [panelWidth, setPanelWidth] = useState(PANEL_DEFAULT_WIDTH)
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
    ? ""
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
  const updatePanelTitle = (title: string) => {
    if (selectedBranchItem && selectedBranch) {
      const config = normalizeNodeConfig(selectedNode.data?.config)
      onChangeNodeData(selectedNode.id, {
        ...(selectedNode.data ?? {}),
        config: {
          ...config,
          branches: (config.branches ?? []).map((branch) => (
            branch.id === selectedBranch.branchId ? { ...branch, name: title } : branch
          )),
        },
      })
      return
    }
    onChangeNodeData(selectedNode.id, {
      ...(selectedNode.data ?? {}),
      title,
    })
  }
  const startResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault()
    const startX = event.clientX
    const startWidth = panelWidth
    const maxWidth = Math.max(PANEL_MIN_WIDTH, Math.min(PANEL_MAX_WIDTH, window.innerWidth - 320))

    const resize = (moveEvent: PointerEvent) => {
      const nextWidth = startWidth + startX - moveEvent.clientX
      setPanelWidth(Math.min(Math.max(nextWidth, PANEL_MIN_WIDTH), maxWidth))
    }
    const stopResize = () => {
      window.removeEventListener("pointermove", resize)
      window.removeEventListener("pointerup", stopResize)
    }

    window.addEventListener("pointermove", resize)
    window.addEventListener("pointerup", stopResize)
  }

  return (
    <div
      className="pointer-events-none absolute inset-y-3 right-3 z-50 flex max-w-[calc(100%-1.5rem)]"
      style={{ width: panelWidth }}
    >
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="调整属性面板宽度"
        className="group pointer-events-auto absolute inset-y-2 left-0 z-10 flex w-3 -translate-x-1.5 cursor-col-resize items-center justify-center"
        onPointerDown={startResize}
      >
        <span className="h-12 w-1 rounded-full bg-slate-300/80 transition-colors group-hover:bg-blue-400" />
      </div>
      <section className="pointer-events-auto flex min-h-0 w-full flex-col overflow-hidden rounded-lg bg-white shadow-[0_18px_45px_rgba(15,23,42,0.18)] backdrop-blur">
        <div className="shrink-0 p-3 pb-2">
          <div className="overflow-hidden rounded-md border border-slate-200 bg-white">
            <div className="px-3 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 flex-1 items-center gap-2.5">
                  <WorkflowNodeIcon
                    icon={panelIcon}
                    size="sm"
                    className="rounded-md shadow-none"
                  />
                  <div className="min-w-0 flex-1">
                    <Input
                      value={panelTitle}
                      placeholder={selectedBranchItem ? selectedBranchItem.id : selectedNodeSpec?.title || selectedNode.type}
                      className="h-7 w-full rounded-md border-slate-200 bg-slate-50 px-2 text-sm font-semibold leading-5 text-slate-900 shadow-none transition-colors hover:border-slate-300 hover:bg-white focus-visible:border-blue-300 focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-blue-100"
                      onChange={(event) => updatePanelTitle(event.target.value)}
                    />
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
              {panelDescription ? (
                <div className="mt-2 line-clamp-2 text-xs leading-5 text-slate-500">
                  {panelDescription}
                </div>
              ) : null}
            </div>
            {panelMeta ? (
              <div className="border-t border-slate-100 px-3 py-2">
                <div className="flex flex-wrap gap-1.5">
                  <span className="inline-flex h-6 items-center rounded-full border border-slate-200 bg-slate-50 px-2 font-mono text-[11px] text-slate-600">
                    {panelMeta}
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
