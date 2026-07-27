"use client"

import { useEffect, useState } from "react"

import {
  PlaygroundEntityContext,
  type WorkflowNodeEntity,
  useClientContext,
  useNodeRender,
} from "@flowgram.ai/free-layout-editor"
import { usePanelManager } from "@flowgram.ai/panel-manager-plugin"
import { PlusIcon, Trash2Icon, XIcon } from "lucide-react"

import { OptionCombobox } from "@/components/option-combobox"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  fetchKnowledgeBasesAll,
  type AIWorkflowDefinition,
  type AIWorkflowNodeSpec,
  type AIWorkflowValue,
  type KnowledgeBase,
} from "@/lib/api/admin"
import { Status } from "@/lib/generated/enums"

import { NODE_FORM_PANEL } from "./base-node"
import {
  WorkflowEditorSurfaceProvider,
  useWorkflowEditorContext,
} from "./editor-context"
import { WorkflowNodeIcon } from "./node-icon"
import {
  buildAvailableVariables,
  nextBranchID,
  normalizeConditionBranches,
  parseRefKey,
  refKey,
} from "./workflow-model"
import type { WorkflowConditionBranch } from "./types"

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

export function NodeFormPanel({ nodeId }: { nodeId: string }) {
  const { document } = useClientContext()
  const node = document.getNode(nodeId)
  if (!node) return null

  return (
    <PlaygroundEntityContext.Provider value={node}>
      <WorkflowEditorSurfaceProvider surface="sidebar">
        <NodeForm node={node} />
      </WorkflowEditorSurfaceProvider>
    </PlaygroundEntityContext.Provider>
  )
}

function NodeForm({ node }: { node: WorkflowNodeEntity }) {
  const panelManager = usePanelManager()
  const render = useNodeRender(node)
  const { document } = useClientContext()
  const { nodeSpecs } = useWorkflowEditorContext()
  const spec = nodeSpecs.find((item) => item.type === String(node.flowNodeType))
  const data = render.data ?? {}
  const definition = document.toJSON() as AIWorkflowDefinition
  const variables = buildAvailableVariables(definition, node.id, nodeSpecs)
  const canDelete = !["start", "end"].includes(String(node.flowNodeType))

  function updateData(next: Record<string, unknown>) {
    render.updateData({ ...data, ...next })
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#fbfbfb]">
      <div className="flex h-[58px] shrink-0 items-center gap-3 border-b border-[rgba(82,100,154,0.13)] px-4">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-[#f2f3ff] text-[#4e40e5]">
          <WorkflowNodeIcon name={spec?.icon} className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-[#060709]">
            {String(data.title || spec?.title || node.flowNodeType)}
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => panelManager.close(NODE_FORM_PANEL)}
          aria-label="关闭配置"
        >
          <XIcon className="size-4" />
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <FormSection title="基本信息">
          <FormField label="节点名称">
            <Input
              value={String(data.title ?? "")}
              placeholder={spec?.title}
              onChange={(event) => updateData({ title: event.target.value })}
            />
          </FormField>
        </FormSection>
        <InputSection
          spec={spec}
          inputsValues={data.inputsValues ?? {}}
          variables={variables}
          onChange={(inputsValues) => updateData({ inputsValues })}
        />
        {String(node.flowNodeType) === "knowledge_retrieve" ? (
          <KnowledgeSection
            config={asRecord(data.config)}
            onChange={(config) => updateData({ config })}
          />
        ) : null}
        {String(node.flowNodeType) === "condition" ? (
          <ConditionSection
            branches={normalizeConditionBranches({ data })}
            variables={variables}
            onChange={(branches) =>
              updateData({
                config: { ...asRecord(data.config), branches },
                portKeys: branches.map((branch) => branch.id),
                ports: branches.map((branch) => branch.id),
              })
            }
          />
        ) : null}
        <OutputSection spec={spec} />
      </div>
      {canDelete ? (
        <div className="shrink-0 border-t p-4">
          <Button
            variant="outline"
            className="w-full text-destructive hover:text-destructive"
            onClick={() => {
              render.deleteNode()
              panelManager.close(NODE_FORM_PANEL)
            }}
          >
            <Trash2Icon className="size-4" />
            删除节点
          </Button>
        </div>
      ) : null}
    </div>
  )
}

function InputSection({
  spec,
  inputsValues,
  variables,
  onChange,
}: {
  spec?: AIWorkflowNodeSpec
  inputsValues: Record<string, AIWorkflowValue>
  variables: ReturnType<typeof buildAvailableVariables>
  onChange: (value: Record<string, AIWorkflowValue>) => void
}) {
  if (!spec?.inputSchema?.length) return null
  const options = variables.map((variable) => ({
    value: `${variable.nodeId}.${variable.name}`,
    label: variable.label || variable.name,
    group: variable.nodeTitle,
    subtitle: `${variable.nodeId}.${variable.name}`,
    description: variable.description,
  }))
  return (
    <FormSection title="输入">
      {spec.inputSchema.map((input) => (
        <FormField
          key={input.name}
          label={input.label || input.name}
          required={input.required}
          hint={input.description}
        >
          <OptionCombobox
            value={refKey(inputsValues[input.name])}
            options={options}
            placeholder="选择上游变量"
            searchPlaceholder="搜索变量"
            preserveExternalSelection
            onChange={(value) => {
              const parsed = parseRefKey(value)
              if (!parsed) return
              onChange({ ...inputsValues, [input.name]: parsed })
            }}
          />
        </FormField>
      ))}
    </FormSection>
  )
}

function KnowledgeSection({
  config,
  onChange,
}: {
  config: Record<string, unknown>
  onChange: (value: Record<string, unknown>) => void
}) {
  const [items, setItems] = useState<KnowledgeBase[]>([])
  useEffect(() => {
    let active = true
    fetchKnowledgeBasesAll({ status: Status.Ok })
      .then((result) => active && setItems(result ?? []))
      .catch(() => active && setItems([]))
    return () => {
      active = false
    }
  }, [])
  const values = normalizeIDs(config.knowledgeBaseIds).map(String)
  return (
    <FormSection title="知识库">
      <FormField label="检索范围" required hint="可选择多个已启用知识库。">
        <OptionCombobox
          multiple
          values={values}
          options={items.map((item) => ({
            value: String(item.id),
            label: item.name,
          }))}
          placeholder="选择知识库"
          searchPlaceholder="搜索知识库"
          onValuesChange={(next) =>
            onChange({
              ...config,
              knowledgeBaseIds: next.map(Number).filter((id) => id > 0),
            })
          }
        />
      </FormField>
    </FormSection>
  )
}

function ConditionSection({
  branches,
  variables,
  onChange,
}: {
  branches: WorkflowConditionBranch[]
  variables: ReturnType<typeof buildAvailableVariables>
  onChange: (branches: WorkflowConditionBranch[]) => void
}) {
  const variableOptions = variables.map((variable) => ({
    value: `${variable.nodeId}.${variable.name}`,
    label: variable.label || variable.name,
    group: variable.nodeTitle,
    subtitle: `${variable.nodeId}.${variable.name}`,
  }))
  const fallback = branches.find((branch) => branch.default)
  const regular = branches.filter((branch) => !branch.default)

  function update(branch: WorkflowConditionBranch) {
    onChange(branches.map((item) => (item.id === branch.id ? branch : item)))
  }

  return (
    <FormSection
      title="条件分支"
      action={
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            const next: WorkflowConditionBranch = {
              id: nextBranchID(branches),
              name: `条件 ${regular.length + 1}`,
              targetNodeId: "",
              condition: { operator: "eq" },
            }
            onChange([...regular, next, fallback].filter(Boolean) as WorkflowConditionBranch[])
          }}
        >
          <PlusIcon className="size-4" />
          添加
        </Button>
      }
    >
      {[...regular, ...(fallback ? [fallback] : [])].map((branch) => (
        <div key={branch.id} className="rounded-md bg-slate-50 p-3">
          <div className="flex items-center gap-2">
            <Input
              value={branch.name ?? ""}
              onChange={(event) => update({ ...branch, name: event.target.value })}
            />
            {!branch.default ? (
              <Button
                variant="ghost"
                size="icon-sm"
                className="shrink-0 text-slate-500 hover:text-destructive"
                onClick={() => onChange(branches.filter((item) => item.id !== branch.id))}
              >
                <Trash2Icon className="size-4" />
              </Button>
            ) : null}
          </div>
          {branch.default ? (
            <p className="mt-2 text-xs text-slate-500">其他条件均不匹配时进入此分支。</p>
          ) : (
            <div className="mt-3 grid gap-2">
              <OptionCombobox
                value={refKey(branch.condition?.left)}
                options={variableOptions}
                placeholder="选择变量"
                preserveExternalSelection
                onChange={(value) =>
                  update({
                    ...branch,
                    condition: {
                      ...branch.condition,
                      left: parseRefKey(value),
                    },
                  })
                }
              />
              <OptionCombobox
                value={branch.condition?.operator ?? "eq"}
                options={operatorOptions}
                placeholder="选择运算符"
                onChange={(operator) =>
                  update({
                    ...branch,
                    condition: { ...branch.condition, operator },
                  })
                }
              />
              {!["exists", "empty"].includes(branch.condition?.operator ?? "") ? (
                <Input
                  value={String(branch.condition?.right ?? "")}
                  placeholder="比较值"
                  onChange={(event) =>
                    update({
                      ...branch,
                      condition: {
                        ...branch.condition,
                        right: event.target.value,
                      },
                    })
                  }
                />
              ) : null}
            </div>
          )}
        </div>
      ))}
    </FormSection>
  )
}

function OutputSection({ spec }: { spec?: AIWorkflowNodeSpec }) {
  if (!spec?.outputSchema?.length) return null
  return (
    <FormSection title="输出">
      <div className="divide-y rounded-md border">
        {spec.outputSchema.map((output) => (
          <div key={output.name} className="px-3 py-2.5">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="font-medium">{output.label || output.name}</span>
              <span className="font-mono text-xs text-slate-500">{output.type}</span>
            </div>
            {output.description ? (
              <p className="mt-1 text-xs leading-5 text-slate-500">{output.description}</p>
            ) : null}
          </div>
        ))}
      </div>
    </FormSection>
  )
}

function FormSection({
  title,
  action,
  children,
}: {
  title: string
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="border-b px-5 py-5 last:border-b-0">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        {action}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  )
}

function FormField({
  label,
  required,
  hint,
  children,
}: {
  label: string
  required?: boolean
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-2">
      <Label>
        {label}
        {required ? <span className="ml-1 text-destructive">*</span> : null}
      </Label>
      {children}
      {hint ? <p className="text-xs leading-5 text-slate-500">{hint}</p> : null}
    </div>
  )
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function normalizeIDs(value: unknown) {
  if (!Array.isArray(value)) return []
  return Array.from(
    new Set(value.map(Number).filter((item) => Number.isInteger(item) && item > 0))
  )
}
