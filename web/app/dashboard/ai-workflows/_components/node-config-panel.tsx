"use client"

import { useState } from "react"
import type { Node } from "@xyflow/react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { OptionCombobox } from "@/components/option-combobox"
import { VariableSelector } from "./variable-selector"
import type {
  WorkflowConditionBranch,
  WorkflowNodeSpec,
  WorkflowNodeConfig,
  WorkflowVariableRef,
  WorkflowVariableSpec,
  WorkflowVariableSelector,
} from "./workflow-utils"

type WorkflowNodeData = Record<string, unknown> & {
  nodeType?: string
  name?: string
  title?: string
  config?: WorkflowNodeConfig
  inputs?: Record<string, WorkflowVariableSelector>
}

export type WorkflowBranchSummary = {
  branchId: string
  targetNodeId: string
  targetName: string
  conditionLabel: string
  isDefault: boolean
}

export type WorkflowBranchTargetOption = {
  value: string
  label: string
}

export function NodeConfigPanel({
  node,
  nodeSpec,
  availableVariables,
  branchSummaries = [],
  branchTargetOptions = [],
  onChange,
}: {
  node: Node<WorkflowNodeData> | null
  nodeSpec?: WorkflowNodeSpec
  availableVariables: WorkflowVariableRef[]
  branchSummaries?: WorkflowBranchSummary[]
  branchTargetOptions?: WorkflowBranchTargetOption[]
  onChange: (nodeId: string, data: WorkflowNodeData) => void
}) {
  if (!node) {
    return (
      <div className="flex h-full items-center justify-center px-4 text-sm text-muted-foreground">
        选择一个节点后，可以配置输入映射并查看输出变量。
      </div>
    )
  }

  return (
    <NodeConfigForm
      key={node.id}
      node={node}
      nodeSpec={nodeSpec}
      availableVariables={availableVariables}
      branchSummaries={branchSummaries}
      branchTargetOptions={branchTargetOptions}
      onChange={onChange}
    />
  )
}

function NodeConfigForm({
  node,
  nodeSpec,
  availableVariables,
  branchSummaries,
  branchTargetOptions,
  onChange,
}: {
  node: Node<WorkflowNodeData>
  nodeSpec?: WorkflowNodeSpec
  availableVariables: WorkflowVariableRef[]
  branchSummaries: WorkflowBranchSummary[]
  branchTargetOptions: WorkflowBranchTargetOption[]
  onChange: (nodeId: string, data: WorkflowNodeData) => void
}) {
  const [name, setName] = useState(node.data.name ?? "")
  const [configText, setConfigText] = useState(JSON.stringify(node.data.config ?? {}, null, 2))
  const [inputs, setInputs] = useState<Record<string, WorkflowVariableSelector>>(
    node.data.inputs ?? {}
  )
  const [error, setError] = useState("")
  const inputSchema = nodeSpec?.inputSchema ?? []
  const outputSchema = nodeSpec?.outputSchema ?? []
  const isConditionNode = node.data.nodeType === "condition"
  const fallbackNodeName = nodeSpec?.title || node.data.title || node.data.nodeType || node.id
  const panelTitle = name.trim() || node.data.name?.trim() || fallbackNodeName

  const commitChange = (next: Partial<WorkflowNodeData>) => {
    onChange(node.id, {
      ...node.data,
      name: name.trim() || fallbackNodeName,
      config: node.data.config ?? {},
      inputs,
      ...next,
    })
  }

  const handleApply = () => {
    try {
      const parsed = JSON.parse(configText || "{}") as Record<string, unknown>
      setError("")
      commitChange({ config: parsed })
    } catch {
      setError("Config must be valid JSON.")
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 p-4">
      <div>
        <div className="text-sm font-medium">{panelTitle}</div>
        <div className="mt-1 text-xs text-muted-foreground">
          {node.data.nodeType && node.data.nodeType !== panelTitle
            ? `${node.id} · ${node.data.nodeType}`
            : node.id}
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="workflow-node-name">节点名称</Label>
        <Input
          id="workflow-node-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          onBlur={() => commitChange({ name: name.trim() || node.data.nodeType || node.id })}
        />
      </div>
      {isConditionNode ? (
        <ConditionNodePanel
          branches={node.data.config?.branches ?? []}
          branchSummaries={branchSummaries}
          branchTargetOptions={branchTargetOptions}
          availableVariables={availableVariables}
          outputSchema={outputSchema}
          onChange={(branches) => commitChange({ config: { ...(node.data.config ?? {}), branches } })}
        />
      ) : (
        <>
          {inputSchema.length > 0 ? (
            <div className="space-y-3">
              <div className="text-sm font-medium">输入映射</div>
              {availableVariables.length === 0 ? (
                <div className="rounded-md border border-dashed p-2 text-xs text-muted-foreground">
                  当前节点前面还没有可用变量，请先连接上游节点。
                </div>
              ) : null}
              {inputSchema.map((input) => (
                <div key={input.name} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <Label className="text-xs">
                      {input.name}
                      {input.required ? <span className="text-destructive"> *</span> : null}
                    </Label>
                    <span className="text-xs text-muted-foreground">{input.type}</span>
                  </div>
                  <VariableSelector
                    value={inputs[input.name]}
                    variables={availableVariables}
                    onChange={(value) => {
                      const nextInputs = {
                        ...inputs,
                        [input.name]: value,
                      }
                      setInputs(nextInputs)
                      commitChange({
                        inputs: nextInputs,
                      })
                    }}
                  />
                  {inputs[input.name] ? (
                    <div className="text-xs text-muted-foreground">
                      已选择：{inputs[input.name].nodeId}.{inputs[input.name].field}
                    </div>
                  ) : null}
                  {input.description ? (
                    <div className="text-xs text-muted-foreground">{input.description}</div>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}
          <details className="rounded-md border bg-background p-3">
            <summary className="cursor-pointer text-sm font-medium">高级配置 JSON</summary>
            <div className="mt-3 space-y-2">
              <Textarea
                id="workflow-node-config"
                className="h-40 font-mono text-xs"
                value={configText}
                onChange={(event) => setConfigText(event.target.value)}
              />
              {error ? <div className="text-xs text-destructive">{error}</div> : null}
              <Button type="button" variant="outline" size="sm" onClick={handleApply}>
                保存高级配置
              </Button>
            </div>
          </details>
          {outputSchema.length > 0 ? (
            <div className="space-y-2">
              <div className="text-sm font-medium">输出变量</div>
              <div className="space-y-1 rounded-md border bg-background p-2">
                {outputSchema.map((output) => (
                  <div key={output.name} className="space-y-0.5 rounded-sm px-1 py-0.5">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="truncate font-medium">{output.name}</span>
                      <span className="shrink-0 text-muted-foreground">{output.type}</span>
                    </div>
                    {output.description ? (
                      <div className="text-xs text-muted-foreground">{output.description}</div>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  )
}

function ConditionNodePanel({
  branches,
  branchSummaries,
  branchTargetOptions,
  availableVariables,
  outputSchema,
  onChange,
}: {
  branches: WorkflowConditionBranch[]
  branchSummaries: WorkflowBranchSummary[]
  branchTargetOptions: WorkflowBranchTargetOption[]
  availableVariables: WorkflowVariableRef[]
  outputSchema: WorkflowVariableSpec[]
  onChange: (branches: WorkflowConditionBranch[]) => void
}) {
  const summariesByBranchID = new Map(branchSummaries.map((item) => [item.branchId, item]))
  const commitBranch = (branchId: string, patch: Partial<WorkflowConditionBranch>) => {
    onChange(branches.map((branch) => (
      branch.id === branchId ? normalizeBranch({ ...branch, ...patch }) : branch
    )))
  }
  const addBranch = () => {
    const index = branches.length + 1
    onChange([
      ...branches,
      {
        id: `branch_${index}`,
        name: `分支 ${index}`,
        targetNodeId: branchTargetOptions[0]?.value ?? "",
        condition: { operator: "eq" },
      },
    ])
  }
  const deleteBranch = (branchId: string) => {
    onChange(branches.filter((branch) => branch.id !== branchId))
  }
  const markDefault = (branchId: string) => {
    onChange(branches.map((branch) => normalizeBranch({
      ...branch,
      default: branch.id === branchId,
      condition: branch.id === branchId ? undefined : branch.condition ?? { operator: "eq" },
    })))
  }

  return (
    <>
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="text-sm font-medium">分支</div>
          <Button type="button" variant="outline" size="sm" onClick={addBranch}>
            添加分支
          </Button>
        </div>
        {branches.length > 0 ? (
          <div className="space-y-2">
            {branches.map((branch, index) => {
              const summary = summariesByBranchID.get(branch.id)
              const condition = branch.condition ?? {}
              const selectedVariable = findConditionVariable(availableVariables, condition.left)
              const operatorOptions = getConditionOperatorOptions(selectedVariable)
              const conditionRight = condition.right === undefined || condition.right === null
                ? ""
                : String(condition.right)
              return (
                <div key={branch.id} className="space-y-3 rounded-md border bg-background p-3">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="min-w-0 truncate font-medium">
                      {branch.default ? "ELSE" : index === 0 ? "IF" : "ELSE IF"}
                    </span>
                    <span className="shrink-0 rounded-sm bg-muted px-1.5 py-0.5 text-muted-foreground">
                      {branch.default ? "默认" : "条件"}
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">分支名称</Label>
                    <Input
                      value={branch.name ?? ""}
                      onChange={(event) => commitBranch(branch.id, { name: event.target.value })}
                      placeholder="例如：需要转人工"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">目标节点</Label>
                    <OptionCombobox
                      value={branch.targetNodeId}
                      options={branchTargetOptions}
                      placeholder="选择目标节点"
                      searchPlaceholder="搜索目标节点"
                      emptyText="请先从条件节点连出下游节点"
                      onChange={(value) => commitBranch(branch.id, { targetNodeId: value })}
                    />
                  </div>
                  {branch.default ? (
                    <div className="rounded-md border border-dashed p-2 text-xs text-muted-foreground">
                      未命中上方条件时进入：{summary?.targetName ?? (branch.targetNodeId || "未选择目标节点")}
                    </div>
                  ) : (
                    <div className="space-y-3 rounded-md border bg-muted/20 p-2">
                      <div className="space-y-1.5">
                        <Label className="text-xs">判断变量</Label>
                        <VariableSelector
                          value={condition.left}
                          variables={availableVariables}
                          onChange={(value) => commitBranch(branch.id, {
                            condition: { ...condition, left: value },
                          })}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">判断方式</Label>
                        <OptionCombobox
                          value={condition.operator ?? "eq"}
                          options={operatorOptions}
                          placeholder="选择判断方式"
                          searchPlaceholder="搜索判断方式"
                          emptyText="没有可用判断方式"
                          onChange={(value) => commitBranch(branch.id, {
                            condition: { ...condition, operator: value },
                          })}
                        />
                      </div>
                      {!conditionOperatorWithoutRight(condition.operator ?? "eq") ? (
                        <ConditionRightControl
                          value={conditionRight}
                          variable={selectedVariable}
                          onChange={(right) => commitBranch(branch.id, {
                            condition: { ...condition, right },
                          })}
                        />
                      ) : null}
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {!branch.default ? (
                      <Button type="button" size="sm" variant="outline" onClick={() => markDefault(branch.id)}>
                        设为默认
                      </Button>
                    ) : null}
                    <Button type="button" size="sm" variant="outline" onClick={() => deleteBranch(branch.id)}>
                      删除
                    </Button>
                  </div>
                  <div className="line-clamp-2 text-xs text-muted-foreground">
                    {summary?.conditionLabel ?? "尚未完成分支配置"}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="rounded-md border border-dashed p-2 text-xs text-muted-foreground">
            当前还没有分支。
          </div>
        )}
      </div>
      {outputSchema.length > 0 ? (
        <div className="space-y-2">
          <div className="text-sm font-medium">输出变量</div>
          <div className="space-y-1 rounded-md border bg-background p-2">
            {outputSchema.map((output) => (
              <div key={output.name} className="space-y-0.5 rounded-sm px-1 py-0.5">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="truncate font-medium">{output.name}</span>
                  <span className="shrink-0 text-muted-foreground">{output.type}</span>
                </div>
                {output.description ? (
                  <div className="text-xs text-muted-foreground">{output.description}</div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </>
  )
}

const conditionOperators = [
  { value: "eq", label: "等于" },
  { value: "neq", label: "不等于" },
  { value: "contains", label: "包含" },
  { value: "exists", label: "存在" },
  { value: "not_exists", label: "不存在" },
  { value: "truthy", label: "为真" },
  { value: "is_true", label: "为真" },
  { value: "falsy", label: "为假" },
  { value: "is_false", label: "为假" },
  { value: "gt", label: "大于" },
  { value: "gte", label: "大于等于" },
  { value: "lt", label: "小于" },
  { value: "lte", label: "小于等于" },
]

function ConditionRightControl({
  value,
  variable,
  onChange,
}: {
  value: string
  variable?: WorkflowVariableRef
  onChange: (value: unknown) => void
}) {
  const valueOptions = getConditionValueOptions(variable)
  if (valueOptions.length > 0) {
    return (
      <div className="space-y-1.5">
        <Label className="text-xs">比较值</Label>
        <OptionCombobox
          value={value}
          options={valueOptions}
          placeholder="选择比较值"
          searchPlaceholder="搜索比较值"
          emptyText="当前变量没有可选值"
          onChange={(nextValue) => onChange(decodeConditionRight(nextValue, variable))}
        />
      </div>
    )
  }

  return (
    <div className="space-y-1.5">
      <Label className="text-xs">比较值</Label>
      <Input
        type={variable?.type === "number" || variable?.type === "integer" ? "number" : "text"}
        value={value}
        onChange={(event) => onChange(normalizeConditionRight(event.target.value, variable))}
        placeholder={variable ? `请输入${variable.label || variable.field}的比较值` : "请输入比较值"}
      />
    </div>
  )
}

function conditionOperatorWithoutRight(operator: string) {
  return ["exists", "not_exists", "truthy", "is_true", "falsy", "is_false"].includes(operator)
}

function normalizeConditionRight(value: string, variable?: WorkflowVariableRef) {
  const trimmed = value.trim()
  if (variable?.type === "boolean") {
    return trimmed === "true"
  }
  if (variable?.type === "number" || variable?.type === "integer") {
    return trimmed === "" ? "" : Number(trimmed)
  }
  if (variable?.type === "string") {
    return trimmed
  }
  if (trimmed === "true") return true
  if (trimmed === "false") return false
  if (trimmed !== "" && !Number.isNaN(Number(trimmed))) return Number(trimmed)
  return trimmed
}

function findConditionVariable(
  variables: WorkflowVariableRef[],
  selector?: WorkflowVariableSelector
): WorkflowVariableRef | undefined {
  if (!selector?.nodeId || !selector.field) {
    return undefined
  }
  return variables.find((item) => item.nodeId === selector.nodeId && item.field === selector.field)
}

function getConditionOperatorOptions(variable?: WorkflowVariableRef) {
  if (!variable?.operators?.length) {
    return conditionOperators
  }
  const allowed = new Set(variable.operators)
  return conditionOperators.filter((item) => allowed.has(item.value))
}

function getConditionValueOptions(variable?: WorkflowVariableRef) {
  if (variable?.valueOptions?.length) {
    return variable.valueOptions.map((item) => ({
      value: encodeConditionRight(item.value),
      label: item.label,
    }))
  }
  if (variable?.type === "boolean") {
    return [
      { value: "true", label: "是" },
      { value: "false", label: "否" },
    ]
  }
  return []
}

function encodeConditionRight(value: unknown) {
  if (typeof value === "string") return value
  if (typeof value === "number" || typeof value === "boolean") return String(value)
  return JSON.stringify(value)
}

function decodeConditionRight(value: string, variable?: WorkflowVariableRef) {
  if (variable?.type === "boolean") {
    return value === "true"
  }
  if (variable?.type === "number" || variable?.type === "integer") {
    return Number(value)
  }
  const option = variable?.valueOptions?.find((item) => encodeConditionRight(item.value) === value)
  return option ? option.value : value
}

function normalizeBranch(branch: WorkflowConditionBranch): WorkflowConditionBranch {
  if (branch.default) {
    const { condition: _condition, ...rest } = branch
    return rest
  }
  return {
    ...branch,
    condition: branch.condition ?? { operator: "eq" },
  }
}
