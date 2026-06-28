import { Field, type WorkflowNodeRegistry, useNodeRender } from "@flowgram.ai/free-layout-editor"

import type { AIWorkflowNodeSpec } from "@/lib/api/admin"
import { WorkflowConditionNodeContent } from "./workflow-condition-node-content"
import { WorkflowNodeCard } from "./workflow-node-card"

export function buildFlowgramNodeRegistries(nodeSpecs: AIWorkflowNodeSpec[]): WorkflowNodeRegistry[] {
  const seen = new Set<string>()
  const specs = nodeSpecs.length > 0
    ? nodeSpecs
    : [
        {
          type: "start",
          title: "开始",
          description: "流程入口",
          icon: "PlayCircleIcon",
          riskLevel: "low" as const,
          interruptible: false,
          requiresConfirmationPredecessor: false,
        },
        {
          type: "end",
          title: "结束",
          description: "流程结束",
          icon: "FlagIcon",
          riskLevel: "low" as const,
          interruptible: false,
          requiresConfirmationPredecessor: false,
        },
      ]

  return specs
    .filter((spec) => {
      if (!spec.type || seen.has(spec.type)) {
        return false
      }
      seen.add(spec.type)
      return true
    })
    .map((spec) => ({
      type: spec.type,
      meta: {
        defaultExpanded: true,
        isStart: spec.type === "start",
        deleteDisable: spec.type === "start" || spec.type === "end",
        copyDisable: spec.type === "start" || spec.type === "end",
        defaultPorts: defaultPortsForNodeType(spec.type),
      },
      formMeta: {
        render: () => (
          <FlowgramNodeForm
          nodeType={spec.type}
          fallbackTitle={spec.title || spec.type}
          icon={spec.icon}
        />
        ),
      },
    }))
}

function FlowgramNodeForm({
  nodeType,
  fallbackTitle,
  icon,
}: {
  nodeType: string
  fallbackTitle: string
  icon: string
}) {
  const { node, selected } = useNodeRender()
  const nodeId = String(node.id ?? "")

  return (
    <Field<string> name="title">
      {({ field }) => (
        <WorkflowNodeCard
          title={field.value || fallbackTitle}
          icon={icon}
          selected={selected}
        >
          {nodeType === "condition" ? (
            <Field<Record<string, unknown>> name="config">
              {({ field: configField }) => (
                <WorkflowConditionNodeContent
                  configValue={configField.value}
                  nodeId={nodeId}
                  onChange={configField.onChange}
                />
              )}
            </Field>
          ) : null}
        </WorkflowNodeCard>
      )}
    </Field>
  )
}

function defaultPortsForNodeType(type: string) {
  if (type === "start") {
    return [{ type: "output" as const }]
  }
  if (type === "end") {
    return [{ type: "input" as const }]
  }
  if (type === "condition") {
    return [{ type: "input" as const }]
  }
  return [{ type: "input" as const }, { type: "output" as const }]
}
