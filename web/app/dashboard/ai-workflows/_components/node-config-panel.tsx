"use client"

import { useEffect, useMemo, useState } from "react"
import { Trash2Icon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
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

export function NodeConfigPanel({
  node,
  nodeSpec,
  nodes,
  availableVariables,
  showHeader = true,
  onChange,
  onDelete,
}: {
  node: AIWorkflowDefinition["nodes"][number] | null
  nodeSpec?: AIWorkflowNodeSpec
  nodes: AIWorkflowDefinition["nodes"]
  availableVariables?: WorkflowVariableRef[]
  branchSummaries?: WorkflowBranchSummary[]
  showHeader?: boolean
  onChange: (nodeId: string, data: AIWorkflowDefinition["nodes"][number]["data"]) => void
  onDelete?: (nodeId: string) => void
}) {
  const [configText, setConfigText] = useState("{}")

  useEffect(() => {
    setConfigText(JSON.stringify(node?.data?.config ?? {}, null, 2))
  }, [node?.id, node?.data?.config])

  const configError = useMemo(() => {
    if (!node) {
      return ""
    }
    try {
      const parsed = JSON.parse(configText || "{}")
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? "" : "配置必须是 JSON 对象"
    } catch {
      return "JSON 格式错误"
    }
  }, [configText, node])

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
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4">
        <div className="space-y-2">
          <Label htmlFor={`node-title-${node.id}`}>标题</Label>
          <Input
            id={`node-title-${node.id}`}
            value={node.data?.title ?? ""}
            placeholder={nodeSpec?.title || node.type}
            onChange={(event) => updateData({ title: event.target.value })}
          />
        </div>

        {inputSchema.length > 0 ? (
          <div className="space-y-3">
            <div className="text-sm font-medium">输入</div>
            {inputSchema.map((input) => {
              const value = inputsValues[input.name]
              return (
                <div key={input.name} className="space-y-1.5">
                  <Label className="flex items-center gap-1">
                    <span>{input.label || input.name}</span>
                    {input.required ? <span className="text-destructive">*</span> : null}
                  </Label>
                  <VariableSelector
                    value={isRefValue(value) ? value : undefined}
                    variables={availableVariables ?? []}
                    placeholder="选择变量"
                    onChange={(next) => {
                      updateData({
                        inputsValues: {
                          ...inputsValues,
                          [input.name]: next,
                        },
                      })
                    }}
                  />
                  {input.description ? (
                    <div className="text-xs text-muted-foreground">{input.description}</div>
                  ) : null}
                </div>
              )
            })}
          </div>
        ) : null}

        {node.type === "condition" || branches.length > 0 ? (
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

        <div className="space-y-2">
          <Label htmlFor={`node-config-${node.id}`}>配置 JSON</Label>
          <Textarea
            id={`node-config-${node.id}`}
            value={configText}
            className="min-h-36 font-mono text-xs"
            spellCheck={false}
            onChange={(event) => {
              const next = event.target.value
              setConfigText(next)
              try {
                const parsed = JSON.parse(next || "{}")
                if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
                  updateData({ config: parsed as Record<string, unknown> })
                }
              } catch {
                // The textarea keeps the draft while the user fixes invalid JSON.
              }
            }}
          />
          {configError ? <div className="text-xs text-destructive">{configError}</div> : null}
        </div>
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
  const targetOptions = nodes
    .filter((node) => node.id !== currentNodeId && node.type !== "start")
    .map((node) => ({
      value: node.id,
      label: node.data?.title || node.type || node.id,
    }))
  const operatorOptions = [
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

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm font-medium">条件分支</div>
        <Button type="button" variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={onAdd}>
          添加
        </Button>
      </div>
      {branches.length === 0 ? (
        <div className="rounded-md border bg-muted/20 p-3 text-xs text-muted-foreground">
          暂无分支。条件节点需要至少一个默认分支或条件分支。
        </div>
      ) : null}
      <div className="space-y-3">
        {branches.map((branch) => {
          const condition = branch.condition ?? {}
          return (
            <div key={branch.id} className="space-y-3 rounded-md border p-3">
              <div className="flex items-center justify-between gap-2">
                <Input
                  value={branch.name ?? ""}
                  placeholder={branch.id}
                  className="h-8"
                  onChange={(event) => onChange({ ...branch, name: event.target.value })}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 text-xs text-muted-foreground hover:text-destructive"
                  onClick={() => onDelete(branch.id)}
                >
                  删除
                </Button>
              </div>

              <div className="space-y-1.5">
                <Label>目标节点</Label>
                <OptionCombobox
                  value={branch.targetNodeId}
                  options={targetOptions}
                  placeholder="选择目标节点"
                  onChange={(targetNodeId) => onChange({ ...branch, targetNodeId })}
                />
              </div>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={branch.default === true}
                  className="size-4"
                  onChange={(event) => onChange({
                    ...branch,
                    default: event.target.checked,
                    condition: event.target.checked ? undefined : branch.condition,
                  })}
                />
                默认分支
              </label>

              {branch.default ? null : (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label>左值</Label>
                    <VariableSelector
                      value={isRefValue(condition.left) ? condition.left : undefined}
                      variables={variables}
                      placeholder="选择变量"
                      onChange={(left) => onChange({
                        ...branch,
                        condition: { ...condition, left },
                      })}
                    />
                  </div>
                  <div className="grid grid-cols-[1fr_1fr] gap-2">
                    <div className="space-y-1.5">
                      <Label>操作符</Label>
                      <OptionCombobox
                        value={condition.operator ?? ""}
                        options={operatorOptions}
                        placeholder="选择操作符"
                        onChange={(operator) => onChange({
                          ...branch,
                          condition: { ...condition, operator },
                        })}
                      />
                    </div>
                    <div className={cn("space-y-1.5", ["exists", "empty"].includes(condition.operator ?? "") && "opacity-50")}>
                      <Label>右值</Label>
                      <Input
                        value={stringifyConditionRight(condition.right)}
                        disabled={["exists", "empty"].includes(condition.operator ?? "")}
                        onChange={(event) => onChange({
                          ...branch,
                          condition: { ...condition, right: event.target.value },
                        })}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
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
