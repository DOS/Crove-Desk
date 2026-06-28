"use client"

import type { ReactNode } from "react"
import { Trash2Icon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { OptionCombobox } from "@/components/option-combobox"
import type { AIWorkflowDefinition, AIWorkflowNodeSpec } from "@/lib/api/admin"
import { cn } from "@/lib/utils"

import { VariableSelector } from "./variable-selector"
import {
  createConditionBranchID,
  isRefValue,
  normalizeNodeConfig,
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

const cardInputClassName = "h-8 rounded-md border-slate-200 bg-white text-xs shadow-none"
const cardComboboxClassName = "h-8 rounded-md border-slate-200 bg-white text-xs shadow-none"

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
    <div className="flex h-full flex-col">
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
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 pb-3">
        {inputSchema.length > 0 ? (
          <ConfigCard title="输入" meta={`${inputSchema.length} 项`}>
            <div className="space-y-3">
            {inputSchema.map((input) => {
              const value = inputsValues[input.name]
              return (
                <div key={input.name} className="space-y-1.5">
                  <Label className="flex items-center gap-1 text-xs text-slate-600">
                    <span>{input.label || input.name}</span>
                    {input.required ? <span className="text-destructive">*</span> : null}
                  </Label>
                  <VariableSelector
                    value={isRefValue(value) ? value : undefined}
                    variables={availableVariables ?? []}
                    placeholder="选择变量"
                    triggerClassName={cardComboboxClassName}
                    onChange={(next) => {
                      updateData({
                        inputsValues: {
                          ...inputsValues,
                          [input.name]: next,
                        },
                      })
                    }}
                  />
                </div>
              )
            })}
            </div>
          </ConfigCard>
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
  onDelete,
}: {
  node: AIWorkflowDefinition["nodes"][number]
  nodes: AIWorkflowDefinition["nodes"]
  branchId: string
  variables: WorkflowVariableRef[]
  onChange: (nodeId: string, data: AIWorkflowDefinition["nodes"][number]["data"]) => void
  onDelete: (branchId: string) => void
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
    <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 pb-3">
      <ConfigCard title="分支目标" meta={branch.default ? "默认" : "条件"}>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-slate-600">目标节点</Label>
            <OptionCombobox
              value={branch.targetNodeId}
              options={targetOptions}
              placeholder="选择目标节点"
              triggerClassName={cardComboboxClassName}
              onChange={(targetNodeId) => updateBranch({ ...branch, targetNodeId })}
            />
          </div>

          <label className="flex items-center gap-2 text-xs text-slate-600">
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
            默认分支
          </label>
        </div>
      </ConfigCard>

      {branch.default ? (
        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500">
          默认分支不需要条件表达式，会在其他条件不匹配时执行。
        </div>
      ) : (
        <ConfigCard title="条件表达式">
          <ConditionFields branch={branch} variables={variables} onChange={updateBranch} />
        </ConfigCard>
      )}

      {branch.default ? null : (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 px-2 text-xs text-slate-500 hover:text-destructive"
          onClick={() => onDelete(branch.id)}
        >
          删除条件
        </Button>
      )}
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
    <ConfigCard
      title="条件分支"
      meta={`${branches.length} 项`}
      action={
        <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={onAdd}>
          添加
        </Button>
      }
    >
      {branches.length === 0 ? (
        <div className="rounded-md border border-dashed border-slate-200 bg-slate-50 px-3 py-3 text-xs text-slate-500">
          暂无分支。条件节点需要至少一个默认分支或条件分支。
        </div>
      ) : null}
      <div className="space-y-2">
        {branches.map((branch) => {
          return (
            <div key={branch.id} className="space-y-2 rounded-lg border border-slate-200 bg-slate-50/60 p-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex h-5 shrink-0 items-center rounded-full border border-slate-200 bg-white px-2 font-mono text-[10px] font-semibold text-slate-600">
                  {branch.default ? "ELSE" : "IF"}
                </span>
                <Input
                  value={branch.name ?? ""}
                  placeholder={branch.id}
                  className={cn(cardInputClassName, "min-w-0 flex-1 border-transparent bg-white font-medium")}
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

              <div className="grid grid-cols-[64px_minmax(0,1fr)] items-center gap-2">
                <Label className="text-xs text-slate-500">目标节点</Label>
                <OptionCombobox
                  value={branch.targetNodeId}
                  options={targetOptions}
                  placeholder="选择目标节点"
                  triggerClassName={cardComboboxClassName}
                  onChange={(targetNodeId) => onChange({ ...branch, targetNodeId })}
                />
              </div>

              <label className="flex items-center gap-2 text-xs text-slate-500">
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
    </ConfigCard>
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

  return (
    <div className={cn("space-y-3", compact && "space-y-2")}>
      <div className={cn("space-y-1.5", compact && "grid grid-cols-[64px_minmax(0,1fr)] items-center gap-2 space-y-0")}>
        <Label className="text-xs text-slate-500">左值</Label>
        <VariableSelector
          value={isRefValue(condition.left) ? condition.left : undefined}
          variables={variables}
          placeholder="选择变量"
          triggerClassName={cardComboboxClassName}
          onChange={(left) => onChange({
            ...branch,
            condition: { ...condition, left },
          })}
        />
      </div>
      <div className={cn("grid grid-cols-[1fr_1fr] gap-2", compact && "grid-cols-[64px_minmax(0,1fr)_96px] items-center")}>
        {compact ? <Label className="text-xs text-slate-500">判断</Label> : null}
        <div className={cn("space-y-1.5", compact && "space-y-0")}>
          {compact ? null : <Label className="text-xs text-slate-500">操作符</Label>}
          <OptionCombobox
            value={condition.operator ?? ""}
            options={CONDITION_OPERATOR_OPTIONS}
            placeholder="选择操作符"
            triggerClassName={cardComboboxClassName}
            onChange={(operator) => onChange({
              ...branch,
              condition: { ...condition, operator },
            })}
          />
        </div>
        <div className={cn("space-y-1.5", compact && "space-y-0", ["exists", "empty"].includes(condition.operator ?? "") && "opacity-50")}>
          {compact ? null : <Label className="text-xs text-slate-500">右值</Label>}
          <Input
            value={stringifyConditionRight(condition.right)}
            disabled={["exists", "empty"].includes(condition.operator ?? "")}
            className={cardInputClassName}
            onChange={(event) => onChange({
              ...branch,
              condition: { ...condition, right: event.target.value },
            })}
          />
        </div>
      </div>
    </div>
  )
}

function ConfigCard({
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
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="flex min-h-10 items-center justify-between gap-2 border-b border-slate-100 px-3 py-2">
        <div className="min-w-0">
          <div className="truncate text-[13px] font-semibold text-slate-900">{title}</div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {meta ? <span className="text-xs text-slate-500">{meta}</span> : null}
          {action}
        </div>
      </div>
      <div className="p-3">{children}</div>
    </section>
  )
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
