"use client"

import { useMemo } from "react"

import { createFreeAutoLayoutPlugin } from "@flowgram.ai/free-auto-layout-plugin"
import { createDownloadPlugin } from "@flowgram.ai/export-plugin"
import {
  type FreeLayoutPluginContext,
  type FreeLayoutProps,
  type WorkflowJSON,
} from "@flowgram.ai/free-layout-editor"
import { createFreeLinesPlugin } from "@flowgram.ai/free-lines-plugin"
import { createFreeNodePanelPlugin } from "@flowgram.ai/free-node-panel-plugin"
import { createFreeSnapPlugin } from "@flowgram.ai/free-snap-plugin"
import { createFreeStackPlugin } from "@flowgram.ai/free-stack-plugin"
import { createMinimapPlugin } from "@flowgram.ai/minimap-plugin"
import {
  createPanelManagerPlugin,
  type PanelFactory,
} from "@flowgram.ai/panel-manager-plugin"

import type {
  AIWorkflowDefinition,
  AIWorkflowNodeSpec,
} from "@/lib/api/admin"

import { BaseNode, NODE_FORM_PANEL } from "./base-node"
import { CommentNode } from "./comment-node"
import { LineAddButton } from "./line-add-button"
import { NodeFormPanel } from "./node-form-panel"
import { NodePanel } from "./node-panel"
import { buildNodeRegistries } from "./node-registry"
import { onDragLineEnd } from "./on-drag-line-end"
import {
  prepareDefinitionForEditor,
  serializeDefinition,
} from "./workflow-model"

export function useWorkflowEditorProps({
  definition,
  nodeSpecs,
  readonly = false,
  onDefinitionChange,
}: {
  definition: AIWorkflowDefinition
  nodeSpecs: AIWorkflowNodeSpec[]
  readonly?: boolean
  onDefinitionChange?: (definition: AIWorkflowDefinition) => void
}): FreeLayoutProps {
  return useMemo(() => {
    const panelFactories: PanelFactory<{ nodeId: string }>[] = readonly
      ? []
      : [
          {
            key: NODE_FORM_PANEL,
            defaultSize: 500,
            minSize: 300,
            maxSize: 800,
            render: (props) => <NodeFormPanel {...props} />,
          },
        ]

    return {
      background: true,
      readonly,
      twoWayConnection: true,
      enableReadonlyNodeDragging: false,
      playground: { preventGlobalGesture: true },
      scroll: { disableScrollBar: true, enableScrollLimit: false },
      initialData: prepareDefinitionForEditor(definition) as WorkflowJSON,
      nodeRegistries: buildNodeRegistries(nodeSpecs),
      getNodeDefaultRegistry: (type) => ({
        type,
        meta: { defaultExpanded: true },
      }),
      fromNodeJSON: (_node, json) => json,
      toNodeJSON: (_node, json) => json,
      materials: {
        renderDefaultNode: BaseNode,
        renderNodes: { comment: CommentNode },
      },
      nodeEngine: { enable: true },
      variableEngine: { enable: true },
      history: {
        enable: !readonly,
        enableChangeNode: !readonly,
      },
      lineColor: {
        hidden: "transparent",
        default: "#94a3b8",
        drawing: "#2563eb",
        hovered: "#2563eb",
        selected: "#2563eb",
        error: "#dc2626",
        flowing: "#2563eb",
      },
      canAddLine: (_ctx, fromPort, toPort) => {
        if (readonly || fromPort.node === toPort.node) return false
        return !fromPort.node.lines.allInputNodes.includes(toPort.node)
      },
      canDeleteLine: () => !readonly,
      canDeleteNode: (_ctx, node) =>
        !readonly && !["start", "end"].includes(String(node.flowNodeType)),
      onContentChange: (ctx) => {
        if (readonly || ctx.document.disposed) return
        onDefinitionChange?.(
          serializeDefinition(ctx.document.toJSON() as AIWorkflowDefinition)
        )
      },
      onDragLineEnd: readonly ? undefined : onDragLineEnd,
      onAllLayersRendered: (ctx: FreeLayoutPluginContext) => {
        window.requestAnimationFrame(() => ctx.tools.fitView(false))
      },
      plugins: () => [
        createFreeStackPlugin({}),
        createFreeLinesPlugin({
          renderInsideLine: readonly ? undefined : LineAddButton,
        }),
        createMinimapPlugin({
          disableLayer: true,
          canvasStyle: {
            canvasWidth: 176,
            canvasHeight: 104,
            canvasPadding: 32,
            canvasBackground: "#f8fafc",
            viewportBackground: "rgba(255,255,255,.7)",
            viewportBorderColor: "#cbd5e1",
            nodeColor: "#cbd5e1",
          },
        }),
        createFreeSnapPlugin({
          edgeColor: "#2563eb",
          alignColor: "#2563eb",
        }),
        createFreeAutoLayoutPlugin({}),
        createDownloadPlugin({
          getFilename: (format) => `workflow.${format}`,
        }),
        ...(readonly
          ? []
          : [
              createFreeNodePanelPlugin({ renderer: NodePanel }),
              createPanelManagerPlugin({
                factories: panelFactories,
                autoResize: true,
              }),
            ]),
      ],
    }
  }, [definition, nodeSpecs, onDefinitionChange, readonly])
}
