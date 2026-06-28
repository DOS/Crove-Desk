import { Field, type WorkflowNodeRegistry } from "@flowgram.ai/free-layout-editor"
import { PlusIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import type { AIWorkflowNodeSpec } from "@/lib/api/admin"
import {
  createConditionBranchID,
  normalizeNodeConfig,
  type WorkflowConditionBranch,
} from "./workflow-utils"

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
  if (nodeType === "condition") {
    return <ConditionNodeForm fallbackTitle={fallbackTitle} />
  }

  return (
    <div className="flex w-full flex-col">
      <Field<string> name="title">
        {({ field }) => (
          <div className="border-b px-4 py-3 text-sm font-medium leading-5">
            {field.value || fallbackTitle}
          </div>
        )}
      </Field>
      <div className="px-4 py-3 text-xs text-muted-foreground">{nodeType}</div>
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
  if (type === "condition") {
    return [{ type: "input" as const }]
  }
  return [{ type: "input" as const }, { type: "output" as const }]
}

function ConditionNodeForm({ fallbackTitle }: { fallbackTitle: string }) {
  return (
    <div className="flex w-full flex-col">
      <Field<string> name="title">
        {({ field }) => (
          <div className="border-b px-4 py-3 text-sm font-medium leading-5">
            {field.value || fallbackTitle}
          </div>
        )}
      </Field>
      <Field<Record<string, unknown>> name="config">
        {({ field }) => {
          const config = normalizeNodeConfig(field.value)
          const branches = ensureConditionBranches(config.branches ?? [])
          const updateBranches = (nextBranches: WorkflowConditionBranch[]) => {
            field.onChange({
              ...config,
              branches: ensureConditionBranches(nextBranches),
            })
          }

          return (
            <div className="px-4 py-3">
              <div className="space-y-2">
                {branches.map((branch, index) => (
                  <div
                    key={branch.id}
                    className="relative flex min-h-10 items-center gap-2 rounded-md bg-[#eef1f7] px-3 text-xs transition-colors before:absolute before:bottom-2 before:left-0 before:top-2 before:w-0.5 before:rounded-full before:bg-[#4e40e5] hover:bg-[#e6eaff]"
                  >
                    <span className="min-w-0 flex-1 truncate font-medium text-foreground/90">
                      {branch.name || (branch.default ? "默认分支" : branch.id)}
                    </span>
                    <span className="shrink-0 rounded-sm bg-[#e7e9f3] px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                      {branch.default ? "else" : index === 0 ? "if" : "elseif"}
                    </span>
                    <span
                      data-port-id={branch.id}
                      data-port-type="output"
                      className="absolute -right-4 top-1/2 size-0"
                    />
                  </div>
                ))}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="mt-2 h-7 px-2 text-xs text-muted-foreground"
                onClick={(event) => {
                  event.stopPropagation()
                  updateBranches([
                    ...branches,
                    {
                      id: createConditionBranchID(branches),
                      name: "新条件",
                      targetNodeId: "",
                      condition: { operator: "eq" },
                    },
                  ])
                }}
              >
                <PlusIcon className="size-3.5" />
                添加条件
              </Button>
            </div>
          )
        }}
      </Field>
    </div>
  )
}

function ensureConditionBranches(branches: WorkflowConditionBranch[]) {
  const normalized = branches.some((branch) => branch.default)
    ? branches
    : [...branches, { id: "default", name: "默认分支", targetNodeId: "", default: true }]
  return [
    ...normalized.filter((branch) => !branch.default),
    ...normalized.filter((branch) => branch.default).slice(0, 1),
  ]
}
