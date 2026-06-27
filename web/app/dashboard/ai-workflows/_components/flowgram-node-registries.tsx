import { Field, type WorkflowNodeRegistry } from "@flowgram.ai/free-layout-editor"

import type { AIWorkflowNodeSpec } from "@/lib/api/admin"

export function buildFlowgramNodeRegistries(nodeSpecs: AIWorkflowNodeSpec[]): WorkflowNodeRegistry[] {
  const seen = new Set<string>()
  const specs = nodeSpecs.length > 0
    ? nodeSpecs
    : [
        { type: "start", title: "开始" },
        { type: "end", title: "结束" },
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
        render: () => <FlowgramNodeForm nodeType={spec.type} fallbackTitle={spec.title || spec.type} />,
      },
    }))
}

function FlowgramNodeForm({
  nodeType,
  fallbackTitle,
}: {
  nodeType: string
  fallbackTitle: string
}) {
  return (
    <div className="min-w-0 flex-1">
      <Field<string> name="title">
        {({ field }) => (
          <div className="truncate text-sm font-medium leading-5">
            {field.value || fallbackTitle}
          </div>
        )}
      </Field>
      <div className="mt-1 truncate text-xs text-muted-foreground">{nodeType}</div>
    </div>
  )
}

function defaultPortsForNodeType(type: string) {
  if (type === "start") {
    return [{ type: "output" as const }]
  }
  if (type === "end") {
    return [{ type: "input" as const }]
  }
  return [{ type: "input" as const }, { type: "output" as const }]
}
