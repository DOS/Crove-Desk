"use client"

import { useMemo } from "react"

import {
  type FreeLayoutPluginContext,
  type FreeLayoutProps,
  type WorkflowNodeEntity,
  type WorkflowJSON,
} from "@flowgram.ai/free-layout-editor"
import { createFreeLinesPlugin } from "@flowgram.ai/free-lines-plugin"
import { createFreeNodePanelPlugin } from "@flowgram.ai/free-node-panel-plugin"
import { createFreeSnapPlugin } from "@flowgram.ai/free-snap-plugin"
import { createMinimapPlugin } from "@flowgram.ai/minimap-plugin"

import type { AIWorkflowDefinition, AIWorkflowNodeSpec } from "@/lib/api/admin"

import { FlowgramNodeRenderer } from "./flowgram-node-renderer"
import { buildFlowgramNodeRegistries } from "./flowgram-node-registries"
import { WorkflowLineAddButton } from "./workflow-line-add-button"
import { WorkflowLineNodePanel } from "./workflow-line-node-panel"
import {
  normalizeConditionPortsForFlowgram,
  syncConditionBranchTargetsFromEdges,
} from "./workflow-utils"

export function useFlowgramEditorProps({
  definition,
  nodeSpecs,
  readonly = false,
  onDefinitionChange,
}: {
  definition: AIWorkflowDefinition
  nodeSpecs: AIWorkflowNodeSpec[]
  readonly?: boolean
  onDefinitionChange?: (definition: AIWorkflowDefinition) => void
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
        nodeRegistries: buildFlowgramNodeRegistries(nodeSpecs),
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
          createFreeLinesPlugin({
            renderInsideLine: WorkflowLineAddButton,
          }),
          createFreeNodePanelPlugin({
            renderer: (props) => (
              <WorkflowLineNodePanel
                {...props}
                nodeSpecs={nodeSpecs}
              />
            ),
          }),
          createMinimapPlugin({
            disableLayer: true,
          }),
          createFreeSnapPlugin({}),
        ],
      }
    },
    [definition, nodeSpecs, onDefinitionChange, readonly]
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
