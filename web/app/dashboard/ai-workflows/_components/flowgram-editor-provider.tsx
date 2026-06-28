"use client"

import { useMemo } from "react"

import {
  type FreeLayoutPluginContext,
  type FreeLayoutProps,
  type WorkflowNodeEntity,
  type WorkflowJSON,
} from "@flowgram.ai/free-layout-editor"
import { createFreeSnapPlugin } from "@flowgram.ai/free-snap-plugin"
import { createMinimapPlugin } from "@flowgram.ai/minimap-plugin"

import type { AIWorkflowDefinition, AIWorkflowNodeSpec } from "@/lib/api/admin"

import { FlowgramNodeRenderer } from "./flowgram-node-renderer"
import { buildFlowgramNodeRegistries } from "./flowgram-node-registries"
import {
  normalizeConditionPortsForFlowgram,
  syncConditionBranchTargetsFromEdges,
} from "./workflow-utils"

export type SelectedWorkflowBranch = {
  nodeId: string
  branchId: string
}

export function useFlowgramEditorProps({
  definition,
  nodeSpecs,
  selectedBranch,
  readonly = false,
  onDefinitionChange,
  onSelectBranch,
}: {
  definition: AIWorkflowDefinition
  nodeSpecs: AIWorkflowNodeSpec[]
  selectedBranch?: SelectedWorkflowBranch | null
  readonly?: boolean
  onDefinitionChange?: (definition: AIWorkflowDefinition) => void
  onSelectBranch?: (branch: SelectedWorkflowBranch | null) => void
}) {
  return useMemo<FreeLayoutProps>(
    () => {
      const initialData = normalizeConditionPortsForFlowgram(definition)
      return {
        background: true,
        readonly,
        scroll: {
          disableScrollBar: true,
        },
        initialData: initialData as WorkflowJSON,
        fromNodeJSON(_node, json) {
          return json
        },
        toNodeJSON(_node, json) {
          return json
        },
        materials: {
          renderDefaultNode: FlowgramNodeRenderer,
        },
        nodeRegistries: buildFlowgramNodeRegistries(nodeSpecs, selectedBranch, onSelectBranch),
        nodeEngine: {
          enable: true,
        },
        history: {
          enable: !readonly,
          enableChangeNode: !readonly,
        },
        canDeleteNode: (_ctx, node) => {
          const type = String(node.flowNodeType ?? "")
          return type !== "start" && type !== "end"
        },
        canDeleteLine: () => !readonly,
        onContentChange: (ctx) => {
          if (readonly) {
            return
          }
          const next = normalizeConditionPortsForFlowgram(
            syncConditionBranchTargetsFromEdges(ctx.document.toJSON() as AIWorkflowDefinition)
          )
          onDefinitionChange?.(next)
        },
        onAllLayersRendered: (ctx) => {
          scrollToInitialNode(ctx)
        },
        getNodeDefaultRegistry(type) {
          return {
            type,
            meta: {
              defaultExpanded: true,
            },
          }
        },
        plugins: () => [
          createMinimapPlugin({
            disableLayer: true,
            canvasStyle: {
              canvasWidth: 150,
              canvasHeight: 84,
              canvasPadding: 48,
              canvasBackground: "rgba(245, 245, 245, 1)",
              canvasBorderRadius: 8,
              viewportBackground: "rgba(235, 235, 235, 1)",
              viewportBorderRadius: 4,
              viewportBorderColor: "rgba(201, 201, 201, 1)",
              viewportBorderWidth: 1,
              viewportBorderDashLength: 2,
              nodeColor: "rgba(255, 255, 255, 1)",
              nodeBorderRadius: 2,
              nodeBorderWidth: 0.145,
              nodeBorderColor: "rgba(6, 7, 9, 0.10)",
              overlayColor: "rgba(255, 255, 255, 0)",
            },
          }),
          createFreeSnapPlugin({
            edgeColor: "#00B2B2",
            alignColor: "#00B2B2",
            edgeLineWidth: 1,
            alignLineWidth: 1,
            alignCrossWidth: 8,
          }),
        ],
      }
    },
    [definition, nodeSpecs, onDefinitionChange, onSelectBranch, readonly, selectedBranch]
  )
}

function scrollToInitialNode(ctx: FreeLayoutPluginContext) {
  const nodes = ctx.document.getAllNodes()
  const startNode = nodes.find((node) => String(node.flowNodeType ?? "") === "start")
  const targetNode = startNode ?? findLeftTopNode(nodes)
  if (!targetNode) {
    return
  }

  window.requestAnimationFrame(() => {
    const viewport = ctx.playground.config.getViewport(false)
    void ctx.playground.scrollToView({
      bounds: targetNode.transform.bounds,
      scrollDelta: {
        x: Math.max(viewport.width / 2 - 250, 0),
        y: Math.max(viewport.height / 2 - 180, 0),
      },
      zoom: 1,
      scrollToCenter: true,
    })
  })
}

function findLeftTopNode(nodes: WorkflowNodeEntity[]) {
  return [...nodes].sort((left, right) => {
    const leftBounds = left.transform.bounds
    const rightBounds = right.transform.bounds
    if (leftBounds.left !== rightBounds.left) {
      return leftBounds.left - rightBounds.left
    }
    return leftBounds.top - rightBounds.top
  })[0]
}
