"use client"

import { useMemo } from "react"

import {
  type FreeLayoutProps,
  type WorkflowJSON,
} from "@flowgram.ai/free-layout-editor"

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
      materials: {
        renderDefaultNode: FlowgramNodeRenderer,
      },
      nodeEngine: {
        enable: false,
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
      plugins: () => [],
    }),
    [definition, nodeSpecs, onDefinitionChange, readonly]
  )
}
