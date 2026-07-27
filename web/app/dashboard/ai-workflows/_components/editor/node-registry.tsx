"use client"

import {
  Field,
  type WorkflowNodeRegistry,
} from "@flowgram.ai/free-layout-editor"

import type { AIWorkflowNodeSpec } from "@/lib/api/admin"

import { WorkflowNodeIcon } from "./node-icon"
import { normalizeConditionBranches } from "./workflow-model"

export function buildNodeRegistries(
  nodeSpecs: AIWorkflowNodeSpec[]
): WorkflowNodeRegistry[] {
  return [
    ...nodeSpecs.map((spec) => ({
    type: spec.type,
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
      render: () => <CanvasNodeContent spec={spec} />,
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

function CanvasNodeContent({ spec }: { spec: AIWorkflowNodeSpec }) {
  return (
    <Field<string> name="title">
      {({ field }) => (
        <div className="w-[360px] select-none">
          <div className="flex items-center gap-2 border-b border-[rgba(82,100,154,0.13)] px-4 py-3">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-[#f2f3ff] text-[#4e40e5]">
              <WorkflowNodeIcon name={spec.icon} className="size-3.5" />
            </span>
            <div className="min-w-0 flex-1 truncate text-sm font-semibold text-[#060709]">
              {field.value || spec.title}
            </div>
          </div>
          <div className="px-4 py-3">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <div className="line-clamp-2 text-xs leading-5 text-[rgba(6,7,9,0.5)]">
                {spec.description}
              </div>
            </div>
          </div>
          {spec.type === "condition" ? (
            <Field<Record<string, unknown>> name="config">
              {({ field: configField }) => {
                const branches = normalizeConditionBranches({
                  data: { config: configField.value },
                })
                return (
                  <div className="mt-3 space-y-1.5 border-t border-[rgba(82,100,154,0.13)] pt-2.5">
                    {branches.map((branch, index) => (
                      <div
                        key={branch.id}
                        className="relative flex items-center gap-2 rounded-md bg-[#f7f7fa] px-2 py-1.5 text-xs"
                      >
                        <span className="w-8 shrink-0 font-medium uppercase text-[#4e40e5]">
                          {branch.default ? "else" : index === 0 ? "if" : "elif"}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-[rgba(6,7,9,0.65)]">
                          {branch.name || branch.id}
                        </span>
                        <span
                          data-port-id={branch.id}
                          data-port-type="output"
                          className="absolute -right-4 top-1/2 size-0"
                        />
                      </div>
                    ))}
                  </div>
                )
              }}
            </Field>
          ) : null}
          </div>
        </div>
      )}
    </Field>
  )
}

function getDefaultPorts(type: string) {
  if (type === "start") return [{ type: "output" as const }]
  if (type === "end") return [{ type: "input" as const }]
  if (type === "condition") return [{ type: "input" as const }]
  return [{ type: "input" as const }, { type: "output" as const }]
}
