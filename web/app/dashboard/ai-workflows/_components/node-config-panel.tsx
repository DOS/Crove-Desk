"use client"

import type { ReactNode } from "react"
import { Trash2Icon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { OptionCombobox } from "@/components/option-combobox"
import type { AIWorkflowDefinition, AIWorkflowNodeSpec } from "@/lib/api/admin"
import { cn } from "@/lib/utils"

import { VariableSelector } from "./variable-selector"
import {
  buildVariableSpecDisplay,
  createConditionBranchID,
  isRefValue,
  normalizeNodeConfig,
  refField,
  refNodeId,
  type WorkflowConditionBranch,
  type WorkflowVariableRef,
} from "./workflow-utils"

export type WorkflowBranchSummary = {
  branchId: string
  targetNodeId?: string
  targetName?: string
}

const CONDITION_OPERATOR_OPTIONS = [
  { value: "eq", label: "等于" },
  { value: "neq", label: "不等于" },
  { value: "contains", label: "包含" },
  { value: "not_contains", label: "不包含" },
  { value: "gt", label: "大于" },
  { value: "gte", label: "大于等于" },
  { value: "lt", label: "小于" },
  { value: "lte", label: "小于等于" },
  { value: "exists", label: "存在" },
  { value: "empty", label: "为空" },
]

const inspectorInputClassName = "h-7 rounded-sm border-slate-200 bg-white px-2 text-xs shadow-none"
const inspectorComboboxClassName = "h-7 rounded-sm border-slate-200 bg-white text-xs shadow-none"

export function NodeConfigPanel({
  node,
  nodeSpec,
  nodes,
  availableVariables,
  showHeader = true,
  showConditionBranches = true,
  onChange,
  onDelete,
}: {
  node: AIWorkflowDefinition["nodes"][number] | null
  nodeSpec?: AIWorkflowNodeSpec
  nodes: AIWorkflowDefinition["nodes"]
  availableVariables?: WorkflowVariableRef[]
  branchSummaries?: WorkflowBranchSummary[]
  showHeader?: boolean
  showConditionBranches?: boolean
  onChange: (nodeId: string, data: AIWorkflowDefinition["nodes"][number]["data"]) => void
  onDelete?: (nodeId: string) => void
}) {
  if (!node) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-sm text-muted-foreground">
        未选择节点
      </div>
    )
  }

  const inputsValues = node.data?.inputsValues ?? {}
  const inputSchema = nodeSpec?.inputSchema ?? []
  const outputSchema = nodeSpec?.outputSchema ?? []
  const canDelete = node.type !== "start" && node.type !== "end"
  const config = normalizeNodeConfig(node.data?.config)
  const branches = config.branches ?? []

  const updateData = (data: Partial<AIWorkflowDefinition["nodes"][number]["data"]>) => {
    onChange(node.id, {
      ...(node.data ?? {}),
      ...data,
    })
  }
  const updateConfig = (nextConfig: Record<string, unknown>) => updateData({ config: nextConfig })
  const updateBranch = (branch: WorkflowConditionBranch) => {
    const nextBranches = branches.some((item) => item.id === branch.id)
      ? branches.map((item) => (item.id === branch.id ? branch : item))
      : [...branches, branch]
    updateConfig({ ...config, branches: nextBranches })
  }
  const deleteBranch = (branchId: string) => {
    updateConfig({ ...config, branches: branches.filter((branch) => branch.id !== branchId) })
  }
  const addBranch = () => {
    const targetNodeId = nodes.find((item) => item.id !== node.id && item.type !== "start")?.id ?? ""
    updateBranch({
      id: createConditionBranchID(branches),
      name: "新分支",
      targetNodeId,
      condition: {
        operator: "eq",
      },
    })
  }

  return (
    <div className="pb-3">
      {showHeader ? (
        <div className="border-b px-4 py-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">
                {node.data?.title || nodeSpec?.title || node.type}
              </div>
              <div className="mt-1 truncate text-xs text-muted-foreground">{node.id}</div>
            </div>
            {canDelete ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8 shrink-0 text-muted-foreground hover:text-destructive"
                onClick={() => onDelete?.(node.id)}
                aria-label="删除节点"
              >
                <Trash2Icon className="size-4" />
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
      <div className="overflow-hidden border-y border-slate-200 bg-white">
        {inputSchema.length > 0 ? (
          <InspectorSection title="输入" meta={`${inputSchema.length} 项`}>
            {inputSchema.map((input) => {
              const value = inputsValues[input.name]
              return (
                <InspectorField
                  key={input.name}
                  label={input.label || input.name}
                  required={input.required}
                  fieldName={input.name}
                  fieldType={input.type}
                >
                  <VariableSelector
                    value={isRefValue(value) ? value : undefined}
                    variables={availableVariables ?? []}
                    placeholder="选择变量"
                    triggerClassName={inspectorComboboxClassName}
                    onChange={(next) => {
                      updateData({
                        inputsValues: {
                          ...inputsValues,
                          [input.name]: next,
                        },
                      })
                    }}
                  />
                  {input.description ? <InspectorHint>{input.description}</InspectorHint> : null}
                </InspectorField>
              )
            })}
          </InspectorSection>
        ) : null}

        {showConditionBranches && (node.type === "condition" || branches.length > 0) ? (
          <ConditionBranchesEditor
            branches={branches}
            nodes={nodes}
            currentNodeId={node.id}
            variables={availableVariables ?? []}
            onAdd={addBranch}
            onChange={updateBranch}
            onDelete={deleteBranch}
          />
        ) : null}

        {outputSchema.length > 0 ? (
          <InspectorSection title="输出" meta={`${outputSchema.length} 项`}>
            {outputSchema.map((output) => {
              const item = buildVariableSpecDisplay(output)
              return (
                <InspectorField key={item.key} label={item.label} detail={item.subtitle}>
                  {item.description ? <InspectorHint>{item.description}</InspectorHint> : null}
                </InspectorField>
              )
            })}
          </InspectorSection>
        ) : null}
      </div>
    </div>
  )
}

export function ConditionBranchConfigPanel({
  node,
  nodes,
  branchId,
  variables,
  onChange,
}: {
  node: AIWorkflowDefinition["nodes"][number]
  nodes: AIWorkflowDefinition["nodes"]
  branchId: string
  variables: WorkflowVariableRef[]
  onChange: (nodeId: string, data: AIWorkflowDefinition["nodes"][number]["data"]) => void
}) {
  const config = normalizeNodeConfig(node.data?.config)
  const branches = config.branches ?? []
  const branch = branches.find((item) => item.id === branchId)
  const targetOptions = buildTargetOptions(nodes, node.id)

  if (!branch) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-sm text-muted-foreground">
        条件分支不存在
      </div>
    )
  }

  const updateBranch = (nextBranch: WorkflowConditionBranch) => {
    onChange(node.id, {
      ...(node.data ?? {}),
      config: {
        ...config,
        branches: branches.map((item) => (item.id === nextBranch.id ? nextBranch : item)),
      },
    })
  }

  return (
    <div className="pb-3">
      <div className="overflow-hidden border-y border-slate-200 bg-white">
        <InspectorSection title="分支" meta={branch.default ? "默认" : "条件"}>
          <InspectorRow label="目标节点">
            <OptionCombobox
              value={branch.targetNodeId}
              options={targetOptions}
              placeholder="选择目标节点"
              triggerClassName={inspectorComboboxClassName}
              preserveExternalSelection
              onChange={(targetNodeId) => updateBranch({ ...branch, targetNodeId })}
            />
          </InspectorRow>

          <InspectorRow label="默认分支">
            <label className="inline-flex h-7 items-center gap-2 text-xs text-slate-700">
              <input
                type="checkbox"
                checked={branch.default === true}
                className="size-3.5"
                onChange={(event) => updateBranch({
                  ...branch,
                  default: event.target.checked,
                  condition: event.target.checked ? undefined : branch.condition,
                })}
              />
              其他条件不匹配时执行
            </label>
          </InspectorRow>
        </InspectorSection>

        {branch.default ? (
          <InspectorSection title="条件表达式">
            <div className="px-3 py-2 text-xs text-slate-500">
              默认分支不需要条件表达式，会在其他条件不匹配时执行。
            </div>
          </InspectorSection>
        ) : (
          <InspectorSection title="条件表达式">
            <ConditionFields branch={branch} variables={variables} onChange={updateBranch} />
          </InspectorSection>
        )}
      </div>
    </div>
  )
}

function ConditionBranchesEditor({
  branches,
  nodes,
  currentNodeId,
  variables,
  onAdd,
  onChange,
  onDelete,
}: {
  branches: WorkflowConditionBranch[]
  nodes: AIWorkflowDefinition["nodes"]
  currentNodeId: string
  variables: WorkflowVariableRef[]
  onAdd: () => void
  onChange: (branch: WorkflowConditionBranch) => void
  onDelete: (branchId: string) => void
}) {
  const targetOptions = buildTargetOptions(nodes, currentNodeId)

  return (
    <InspectorSection
      title="条件分支"
      meta={`${branches.length} 项`}
      action={
        <Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-xs text-slate-600" onClick={onAdd}>
          添加
        </Button>
      }
    >
      {branches.length === 0 ? (
        <div className="px-3 py-3 text-xs text-slate-500">
          暂无分支。条件节点需要至少一个默认分支或条件分支。
        </div>
      ) : null}
      <div className="divide-y divide-slate-100">
        {branches.map((branch) => {
          return (
            <div key={branch.id} className="bg-white px-3 py-2">
              <div className="grid grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-2">
                <span className="inline-flex h-5 shrink-0 items-center justify-center rounded-sm border border-slate-200 bg-slate-50 px-1.5 font-mono text-[10px] font-semibold text-slate-600">
                  {branch.default ? "ELSE" : "IF"}
                </span>
                <Input
                  value={branch.name ?? ""}
                  placeholder={branch.id}
                  className={cn(inspectorInputClassName, "min-w-0 border-transparent bg-transparent px-1 font-medium")}
                  onChange={(event) => onChange({ ...branch, name: event.target.value })}
                />
                {branch.default ? null : (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs text-slate-500 hover:text-destructive"
                    onClick={() => onDelete(branch.id)}
                  >
                    删除
                  </Button>
                )}
              </div>

              <div className="mt-2 grid grid-cols-[72px_minmax(0,1fr)] items-center gap-2">
                <div className="text-xs text-slate-500">目标节点</div>
                <OptionCombobox
                  value={branch.targetNodeId}
                  options={targetOptions}
                  placeholder="选择目标节点"
                  triggerClassName={inspectorComboboxClassName}
                  preserveExternalSelection
                  onChange={(targetNodeId) => onChange({ ...branch, targetNodeId })}
                />
              </div>

              <label className="mt-2 flex items-center gap-2 pl-[72px] text-xs text-slate-500">
                <input
                  type="checkbox"
                  checked={branch.default === true}
                  className="size-3.5"
                  onChange={(event) => onChange({
                    ...branch,
                    default: event.target.checked,
                    condition: event.target.checked ? undefined : branch.condition,
                  })}
                />
                默认分支
              </label>

              {branch.default ? null : (
                <div className="border-t border-slate-200 pt-2">
                  <ConditionFields branch={branch} variables={variables} onChange={onChange} compact />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </InspectorSection>
  )
}

function ConditionFields({
  branch,
  variables,
  onChange,
  compact = false,
}: {
  branch: WorkflowConditionBranch
  variables: WorkflowVariableRef[]
  onChange: (branch: WorkflowConditionBranch) => void
  compact?: boolean
}) {
  const condition = branch.condition ?? {}
  const selectedVariable = isRefValue(condition.left)
    ? variables.find((item) => item.nodeId === refNodeId(condition.left) && item.field === refField(condition.left))
    : undefined
  const valueOptions = selectedVariable?.valueOptions ?? []
  const rightDisabled = ["exists", "empty"].includes(condition.operator ?? "")

  return (
    <div className={cn("divide-y divide-slate-100", compact && "divide-y-0")}>
      <div className={cn("grid grid-cols-[92px_minmax(0,1fr)] items-start gap-2 px-3 py-2", compact && "grid-cols-[72px_minmax(0,1fr)] px-0 py-1")}>
        <div className="pt-1.5 text-xs text-slate-500">左值</div>
        <VariableSelector
          value={isRefValue(condition.left) ? condition.left : undefined}
          variables={variables}
          placeholder="选择变量"
          triggerClassName={inspectorComboboxClassName}
          onChange={(left) => onChange({
            ...branch,
            condition: { ...condition, left },
          })}
        />
      </div>
      <div className={cn("grid grid-cols-[92px_minmax(0,1fr)_minmax(0,1fr)] items-start gap-2 px-3 py-2", compact && "grid-cols-[72px_minmax(0,1fr)_96px] px-0 py-1")}>
        <div className="pt-1.5 text-xs text-slate-500">判断</div>
        <div>
          <OptionCombobox
            value={condition.operator ?? ""}
            options={CONDITION_OPERATOR_OPTIONS}
            placeholder="选择操作符"
            triggerClassName={inspectorComboboxClassName}
            preserveExternalSelection
            onChange={(operator) => onChange({
              ...branch,
              condition: { ...condition, operator },
            })}
          />
        </div>
        <div className={cn(rightDisabled && "opacity-50")}>
          {valueOptions.length > 0 && !rightDisabled ? (
            <OptionCombobox
              value={stringifyConditionRight(condition.right)}
              options={valueOptions.map((option) => ({
                value: stringifyConditionRight(option.value),
                label: option.label || stringifyConditionRight(option.value),
                description: option.description,
              }))}
              placeholder="选择取值"
              triggerClassName={inspectorComboboxClassName}
              preserveExternalSelection
              onChange={(nextValue) => {
                const selectedOption = valueOptions.find((option) => stringifyConditionRight(option.value) === nextValue)
                onChange({
                  ...branch,
                  condition: { ...condition, right: selectedOption?.value ?? nextValue },
                })
              }}
            />
          ) : (
            <Input
              value={stringifyConditionRight(condition.right)}
              disabled={rightDisabled}
              className={inspectorInputClassName}
              onChange={(event) => onChange({
                ...branch,
                condition: { ...condition, right: event.target.value },
              })}
            />
          )}
        </div>
      </div>
    </div>
  )
}

function InspectorSection({
  title,
  meta,
  action,
  children,
}: {
  title: string
  meta?: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="border-b border-slate-200 last:border-b-0">
      <div className="flex min-h-8 items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/80 px-3 py-1">
        <div className="min-w-0">
          <div className="truncate text-[11px] font-semibold uppercase tracking-wide text-slate-500">{title}</div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {meta ? <span className="font-mono text-[10px] text-slate-400">{meta}</span> : null}
          {action}
        </div>
      </div>
      <div>{children}</div>
    </section>
  )
}

function InspectorRow({
  label,
  detail,
  required,
  children,
}: {
  label: string
  detail?: string
  required?: boolean
  children: ReactNode
}) {
  return (
    <div className="grid grid-cols-[112px_minmax(0,1fr)] gap-3 border-b border-slate-100 px-3 py-2 last:border-b-0">
      <div className="min-w-0 pt-1">
        <div className="flex min-w-0 items-center gap-1">
          <span className="truncate text-xs font-medium text-slate-700">{label}</span>
          {required ? <span className="text-[10px] text-destructive">*</span> : null}
        </div>
        {detail ? <div className="mt-0.5 truncate font-mono text-[10px] leading-4 text-slate-400">{detail}</div> : null}
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  )
}

function InspectorField({
  label,
  detail,
  fieldName,
  fieldType,
  required,
  children,
}: {
  label: string
  detail?: string
  fieldName?: string
  fieldType?: string
  required?: boolean
  children: ReactNode
}) {
  const metaItems = [
    fieldName ? { label: "字段", value: fieldName } : null,
    fieldType ? { label: "类型", value: fieldType } : null,
  ].filter((item): item is { label: string; value: string } => Boolean(item))

  return (
    <div className="border-b border-slate-100 px-3 py-2.5 last:border-b-0">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex min-w-0 items-start gap-1">
            <span className="min-w-0 break-words text-xs font-medium leading-4 text-slate-700">{label}</span>
            {required ? <span className="shrink-0 text-[10px] text-destructive">*</span> : null}
          </div>
          {detail ? <div className="mt-1 break-all font-mono text-[10px] leading-4 text-slate-400">{detail}</div> : null}
        </div>
      </div>
      {metaItems.length > 0 ? (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {metaItems.map((item) => (
            <span
              key={item.label}
              className="inline-flex min-w-0 max-w-full items-center gap-1 rounded-sm border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[10px] leading-4 text-slate-500"
            >
              <span className="shrink-0 text-slate-400">{item.label}</span>
              <span className="min-w-0 break-all">{item.value}</span>
            </span>
          ))}
        </div>
      ) : null}
      <div className="mt-2 min-w-0">{children}</div>
    </div>
  )
}

function InspectorHint({ children }: { children: ReactNode }) {
  return <div className="mt-1.5 text-xs leading-4 text-slate-500">{children}</div>
}

function buildTargetOptions(nodes: AIWorkflowDefinition["nodes"], currentNodeId: string) {
  return nodes
    .filter((node) => node.id !== currentNodeId && node.type !== "start")
    .map((node) => ({
      value: node.id,
      label: node.data?.title || node.type || node.id,
    }))
}

function stringifyConditionRight(value: unknown) {
  if (value === undefined || value === null) {
    return ""
  }
  if (typeof value === "string") {
    return value
  }
  return JSON.stringify(value)
}
