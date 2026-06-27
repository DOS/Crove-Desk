"use client"

import { useMemo } from "react"

import {
  type FreeLayoutProps,
  type WorkflowJSON,
} from "@flowgram.ai/free-layout-editor"
import { createFreeSnapPlugin } from "@flowgram.ai/free-snap-plugin"
import { createMinimapPlugin } from "@flowgram.ai/minimap-plugin"

import type { AIWorkflowDefinition, AIWorkflowNodeSpec } from "@/lib/api/admin"

import { FlowgramNodeRenderer } from "./flowgram-node-renderer"
import { buildFlowgramNodeRegistries } from "./flowgram-node-registries"

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
    () => ({
      background: true,
      readonly,
      initialData: definition as WorkflowJSON,
      nodeRegistries: buildFlowgramNodeRegistries(nodeSpecs),
      fromNodeJSON(_node, json) {
        return json
      },
      toNodeJSON(_node, json) {
        return json
      },
      materials: {
        renderDefaultNode: FlowgramNodeRenderer,
      },
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
        onDefinitionChange?.(ctx.document.toJSON() as AIWorkflowDefinition)
      },
      onAllLayersRendered: (ctx) => {
        void ctx.tools.fitView(false)
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
    }),
    [definition, nodeSpecs, onDefinitionChange, readonly]
  )
}
