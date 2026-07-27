"use client"

import { type WorkflowNodeRegistry } from "@flowgram.ai/free-layout-editor"

import type { AIWorkflowNodeSpec } from "@/lib/api/admin"

import { WorkflowNodeForm } from "./node-form-panel"

export function buildNodeRegistries(
  nodeSpecs: AIWorkflowNodeSpec[]
): WorkflowNodeRegistry[] {
  return [
    ...nodeSpecs.map((spec) => ({
    type: spec.type,
    info: {
      description: spec.description,
    },
    meta: {
      defaultExpanded: true,
      isStart: spec.type === "start",
      deleteDisable: spec.type === "start" || spec.type === "end",
      copyDisable: spec.type === "start" || spec.type === "end",
      nodePanelVisible: spec.type !== "start",
      useDynamicPort: spec.type === "condition",
      defaultPorts: getDefaultPorts(spec.type),
    },
    formMeta: {
      render: () => <WorkflowNodeForm spec={spec} />,
    },
    })),
    {
      type: "comment",
      meta: {
        sidebarDisabled: true,
        nodePanelVisible: false,
        defaultPorts: [],
        renderKey: "comment",
        size: { width: 240, height: 150 },
      },
      formMeta: {
        render: () => <></>,
      },
      getInputPoints: () => [],
      getOutputPoints: () => [],
    },
  ]
}

function getDefaultPorts(type: string) {
  if (type === "start") return [{ type: "output" as const }]
  if (type === "end") return [{ type: "input" as const }]
  if (type === "condition") return [{ type: "input" as const }]
  return [{ type: "input" as const }, { type: "output" as const }]
}
