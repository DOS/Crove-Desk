"use client"

import {
  startTransition,
  useEffect,
  useRef,
  useState,
} from "react"

import {
  Field,
  PlaygroundEntityContext,
  WorkflowDocument,
  type WorkflowNodeEntity,
  type WorkflowNodeJSON,
  WorkflowSelectService,
  useClientContext,
  useNodeRender,
  useRefresh,
  useService,
} from "@flowgram.ai/free-layout-editor"
import { usePanelManager } from "@flowgram.ai/panel-manager-plugin"
import {
  AlertCircleIcon,
  CopyIcon,
  MoreHorizontalIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react"

import { OptionCombobox } from "@/components/option-combobox"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import {
  fetchKnowledgeBasesAll,
  type AIWorkflowDefinition,
  type AIWorkflowNodeSpec,
  type AIWorkflowValue,
  type KnowledgeBase,
} from "@/lib/api/admin"
import { Status } from "@/lib/generated/enums"
import { cn } from "@/lib/utils"

import { NODE_FORM_PANEL } from "./base-node"
import {
  WorkflowEditorSurfaceProvider,
  useWorkflowEditorContext,
  useWorkflowEditorSurface,
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
  const { document, playground, selection } = useClientContext()
  const panelManager = usePanelManager()
  const refresh = useRefresh()
  const node = document.getNode(nodeId)

  useEffect(() => {
    const disposable = playground.config.onReadonlyOrDisabledChange(() => {
      panelManager.close(NODE_FORM_PANEL)
      refresh()
    })
    return () => disposable.dispose()
  }, [panelManager, playground, refresh])

  useEffect(() => {
    const disposable = selection.onSelectionChanged(() => {
      if (
        selection.selection.length !== 1 ||
        selection.selection[0] !== node
      ) {
        startTransition(() => panelManager.close(NODE_FORM_PANEL))
      }
    })
    return () => disposable.dispose()
  }, [node, panelManager, selection])

  useEffect(() => {
    if (!node) return
    const disposable = node.onDispose(() =>
      panelManager.close(NODE_FORM_PANEL)
    )
    return () => disposable.dispose()
  }, [node, panelManager])

  if (
    !node ||
    playground.config.readonly ||
    node.getNodeMeta<{ sidebarDisabled?: boolean }>().sidebarDisabled
  ) {
    return null
  }

  return (
    <PlaygroundEntityContext.Provider key={node.id} value={node}>
      <WorkflowEditorSurfaceProvider surface="sidebar">
        <SidebarNodeRenderer node={node} />
      </WorkflowEditorSurfaceProvider>
    </PlaygroundEntityContext.Provider>
  )
}

function SidebarNodeRenderer({ node }: { node: WorkflowNodeEntity }) {
  const render = useNodeRender(node)
  return (
    <div className="h-full w-full overflow-hidden rounded-lg border border-[rgba(82,100,154,0.13)] bg-[#fbfbfb]">
      {render.form?.render()}
    </div>
  )
}

export function WorkflowNodeForm({ spec }: { spec: AIWorkflowNodeSpec }) {
  const render = useNodeRender()
  const surface = useWorkflowEditorSurface()
  const isSidebar = surface === "sidebar"
  const { document } = useClientContext()
  const { nodeSpecs } = useWorkflowEditorContext()
  const definition = document.toJSON() as AIWorkflowDefinition
  const variables = buildAvailableVariables(definition, render.node.id, nodeSpecs)

  return (
    <div className={cn("w-full select-none", isSidebar && "h-full")}>
      <NodeFormHeader spec={spec} />
      <div
        className={cn(
          "w-full rounded-b-lg bg-[#fbfbfb] px-3 pb-3",
          isSidebar
            ? "h-[calc(100%-40px)] overflow-y-auto overscroll-contain pt-1"
            : "space-y-1.5"
        )}
      >
        {isSidebar && spec.description ? (
          <p className="px-1 pb-2 text-xs leading-5 text-[rgba(6,7,9,0.5)]">
            {spec.description}
          </p>
        ) : null}
        <InputFields spec={spec} variables={variables} />
        {spec.type === "knowledge_retrieve" ? <KnowledgeFields /> : null}
        {spec.type === "condition" ? (
          <ConditionFields variables={variables} />
        ) : null}
        <OutputFields spec={spec} />
      </div>
    </div>
  )
}

function NodeFormHeader({ spec }: { spec: AIWorkflowNodeSpec }) {
  const render = useNodeRender()
  const panelManager = usePanelManager()
  const { document } = useClientContext()
  const selection = useService(WorkflowSelectService)
  const surface = useWorkflowEditorSurface()
  const isSidebar = surface === "sidebar"
  const canDelete = !["start", "end"].includes(String(render.node.flowNodeType))
  const canCopy = canDelete
  const [editing, setEditing] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const titleRef = useRef<HTMLInputElement>(null)
  const closeMenuTimer = useRef<number | null>(null)

  useEffect(() => {
    if (editing) titleRef.current?.focus()
  }, [editing])

  useEffect(
    () => () => {
      if (closeMenuTimer.current) window.clearTimeout(closeMenuTimer.current)
    },
    []
  )

  function openMenu() {
    if (closeMenuTimer.current) window.clearTimeout(closeMenuTimer.current)
    setMenuOpen(true)
  }

  function scheduleCloseMenu() {
    if (closeMenuTimer.current) window.clearTimeout(closeMenuTimer.current)
    closeMenuTimer.current = window.setTimeout(() => setMenuOpen(false), 120)
  }

  return (
    <div className="flex h-10 w-full items-center gap-2 overflow-hidden rounded-t-lg bg-gradient-to-b from-[#f2f2ff] to-[#fbfbfb] px-2">
      <span className="flex size-6 shrink-0 items-center justify-center rounded bg-white/70 text-[#4e40e5]">
        <WorkflowNodeIcon name={spec.icon} className="size-3.5" />
      </span>
      <Field<string> name="title">
        {({ field, fieldState }) => (
          <div className="relative min-w-0 flex-1">
            {editing && !render.readonly ? (
              <Input
                ref={titleRef}
                value={field.value ?? ""}
                className="h-7 border-[#4e40e5] bg-white px-2 text-sm"
                onClick={(event) => event.stopPropagation()}
                onBlur={() => setEditing(false)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === "Escape") {
                    setEditing(false)
                  }
                }}
                onChange={(event) => field.onChange(event.target.value)}
              />
            ) : (
              <button
                type="button"
                className="block h-7 w-full truncate text-left text-sm font-medium text-[#060709]"
                title={field.value || spec.title}
                onDoubleClick={(event) => {
                  event.stopPropagation()
                  if (!render.readonly) setEditing(true)
                }}
              >
                {field.value || spec.title}
              </button>
            )}
            {fieldState?.invalid ? (
              <AlertCircleIcon className="absolute -left-1 -top-1 size-4 rounded-full bg-white text-destructive" />
            ) : null}
          </div>
        )}
      </Field>
      {!render.readonly ? (
        <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label="节点操作"
                className="shrink-0 text-muted-foreground"
                onMouseEnter={openMenu}
                onMouseLeave={scheduleCloseMenu}
                onClick={(event) => event.stopPropagation()}
              />
            }
          >
            <MoreHorizontalIcon />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-36"
            onMouseEnter={openMenu}
            onMouseLeave={scheduleCloseMenu}
          >
            <DropdownMenuItem
              onClick={(event) => {
                event.stopPropagation()
                setEditing(true)
              }}
            >
              <PencilIcon />
              编辑名称
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={!canCopy}
              onClick={(event) => {
                event.stopPropagation()
                duplicateNode(render.node, document, selection)
              }}
            >
              <CopyIcon />
              创建副本
            </DropdownMenuItem>
            <DropdownMenuItem
              variant="destructive"
              disabled={!canDelete}
              onClick={(event) => {
                event.stopPropagation()
                render.deleteNode()
                panelManager.close(NODE_FORM_PANEL)
              }}
            >
              <Trash2Icon />
              删除节点
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
      {isSidebar ? (
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label="关闭配置"
          className="shrink-0"
          onClick={() => panelManager.close(NODE_FORM_PANEL)}
        >
          <XIcon />
        </Button>
      ) : null}
    </div>
  )
}

function InputFields({
  spec,
  variables,
}: {
  spec: AIWorkflowNodeSpec
  variables: ReturnType<typeof buildAvailableVariables>
}) {
  if (!spec.inputSchema?.length) return null
  const options = variables.map((variable) => ({
    value: `${variable.nodeId}.${variable.name}`,
    label: variable.label || variable.name,
    group: variable.nodeTitle,
    subtitle: `${variable.nodeId}.${variable.name}`,
    description: variable.description,
  }))

  return (
    <>
      {spec.inputSchema.map((input) => (
        <Field<AIWorkflowValue | undefined>
          key={input.name}
          name={`inputsValues.${input.name}`}
        >
          {({ field, fieldState }) => (
            <NodeFormRow
              label={input.label || input.name}
              type={input.type}
              required={input.required}
              description={input.description}
            >
              <OptionCombobox
                value={refKey(field.value)}
                options={options}
                placeholder="选择上游变量"
                searchPlaceholder="搜索变量"
                preserveExternalSelection
                triggerClassName={cn(
                  "h-8 bg-white text-xs",
                  fieldState?.invalid && "border-destructive"
                )}
                onChange={(value) => {
                  const parsed = parseRefKey(value)
                  if (parsed) field.onChange(parsed)
                }}
              />
            </NodeFormRow>
          )}
        </Field>
      ))}
    </>
  )
}

function KnowledgeFields() {
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

  return (
    <Field<Record<string, unknown>> name="config">
      {({ field }) => {
        const config = asRecord(field.value)
        const values = normalizeIDs(config.knowledgeBaseIds).map(String)
        return (
          <NodeFormRow
            label="检索范围"
            type="array<int>"
            required
            description="可选择多个已启用知识库。"
          >
            <OptionCombobox
              multiple
              values={values}
              options={items.map((item) => ({
                value: String(item.id),
                label: item.name,
              }))}
              placeholder="选择知识库"
              searchPlaceholder="搜索知识库"
              triggerClassName="min-h-8 bg-white text-xs"
              onValuesChange={(next) =>
                field.onChange({
                  ...config,
                  knowledgeBaseIds: next
                    .map(Number)
                    .filter((id) => id > 0),
                })
              }
            />
          </NodeFormRow>
        )
      }}
    </Field>
  )
}

function ConditionFields({
  variables,
}: {
  variables: ReturnType<typeof buildAvailableVariables>
}) {
  const render = useNodeRender()
  const variableOptions = variables.map((variable) => ({
    value: `${variable.nodeId}.${variable.name}`,
    label: variable.label || variable.name,
    group: variable.nodeTitle,
    subtitle: `${variable.nodeId}.${variable.name}`,
  }))

  return (
    <Field<Record<string, unknown>> name="config">
      {({ field }) => {
        const config = asRecord(field.value)
        const branches = normalizeConditionBranches({
          data: { config },
        })
        const regular = branches.filter((branch) => !branch.default)
        const fallback = branches.find((branch) => branch.default)

        function commit(next: WorkflowConditionBranch[]) {
          const nextConfig = { ...config, branches: next }
          field.onChange(nextConfig)
          render.updateData({
            ...render.data,
            config: nextConfig,
            portKeys: next.map((branch) => branch.id),
            ports: next.map((branch) => branch.id),
          })
          window.requestAnimationFrame(() =>
            render.node.ports.updateDynamicPorts()
          )
        }

        function update(branch: WorkflowConditionBranch) {
          commit(
            branches.map((item) => (item.id === branch.id ? branch : item))
          )
        }

        return (
          <div className="space-y-1.5">
            {branches.map((branch, index) => (
              <div
                key={branch.id}
                className="relative flex items-start gap-2 py-0.5"
              >
                <div className="flex h-8 w-[50px] shrink-0 items-center gap-1 text-xs">
                  <Badge
                    variant="outline"
                    className="h-5 rounded px-1.5 font-mono text-[10px] uppercase text-[#4e40e5]"
                  >
                    {branch.default
                      ? "else"
                      : index === 0
                        ? "if"
                        : "elif"}
                  </Badge>
                </div>
                {branch.default ? (
                  <div className="flex h-8 min-w-0 flex-1 items-center text-xs text-muted-foreground">
                    其他条件均不匹配
                  </div>
                ) : (
                  <div className="grid min-w-0 flex-1 gap-1.5">
                    <OptionCombobox
                      value={refKey(branch.condition?.left)}
                      options={variableOptions}
                      placeholder="选择变量"
                      preserveExternalSelection
                      triggerClassName="h-8 bg-white text-xs"
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
                    <div className="flex gap-1.5">
                      <OptionCombobox
                        value={branch.condition?.operator ?? "eq"}
                        options={operatorOptions}
                        placeholder="运算符"
                        triggerClassName="h-8 min-w-0 flex-1 bg-white text-xs"
                        onChange={(operator) =>
                          update({
                            ...branch,
                            condition: {
                              ...branch.condition,
                              operator,
                            },
                          })
                        }
                      />
                      {!["exists", "empty"].includes(
                        branch.condition?.operator ?? ""
                      ) ? (
                        <Input
                          value={String(branch.condition?.right ?? "")}
                          placeholder="比较值"
                          className="h-8 min-w-0 flex-1 bg-white text-xs"
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
                  </div>
                )}
                {!branch.default && !render.readonly ? (
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label="删除条件"
                    className="mt-1 shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() =>
                      commit(
                        branches.filter((item) => item.id !== branch.id)
                      )
                    }
                  >
                    <Trash2Icon />
                  </Button>
                ) : null}
                <span
                  data-port-id={branch.id}
                  data-port-type="output"
                  className="absolute -right-3 top-4 size-0"
                />
              </div>
            ))}
            {!render.readonly ? (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-1.5 text-xs text-[#4e40e5]"
                onClick={() => {
                  const branch: WorkflowConditionBranch = {
                    id: nextBranchID(branches),
                    name: `条件 ${regular.length + 1}`,
                    targetNodeId: "",
                    condition: { operator: "eq" },
                  }
                  commit(
                    [...regular, branch, fallback].filter(
                      Boolean
                    ) as WorkflowConditionBranch[]
                  )
                }}
              >
                <PlusIcon />
                添加条件
              </Button>
            ) : null}
          </div>
        )
      }}
    </Field>
  )
}

function OutputFields({ spec }: { spec: AIWorkflowNodeSpec }) {
  if (!spec.outputSchema?.length) return null
  return (
    <div className="mt-1 border-t border-[rgba(82,100,154,0.13)] pt-2">
      {spec.outputSchema.map((output) => (
        <NodeFormRow
          key={output.name}
          label={output.label || output.name}
          type={output.type}
          description={output.description}
        >
          <div
            className="flex h-8 items-center truncate rounded-md bg-[#f3f3f6] px-2 font-mono text-xs text-muted-foreground"
            title={`${output.name}: ${output.description}`}
          >
            {output.name}
          </div>
        </NodeFormRow>
      ))}
    </div>
  )
}

function NodeFormRow({
  label,
  type,
  required,
  description,
  children,
}: {
  label: string
  type?: string
  required?: boolean
  description?: string
  children: React.ReactNode
}) {
  return (
    <div
      className="flex w-full items-start gap-2 py-0.5 text-xs"
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div
        className="flex min-h-8 w-[118px] min-w-[118px] items-center gap-1"
        title={description}
      >
        {type ? (
          <span className="flex size-[18px] shrink-0 items-center justify-center rounded bg-[#ececf1] font-mono text-[9px] uppercase text-muted-foreground">
            {typeIcon(type)}
          </span>
        ) : null}
        <span className="min-w-0 truncate text-[#060709]">{label}</span>
        {required ? <span className="text-destructive">*</span> : null}
      </div>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}

function duplicateNode(
  node: WorkflowNodeEntity,
  document: WorkflowDocument,
  selection: WorkflowSelectService
) {
  const source = document.toNodeJSON(node) as WorkflowNodeJSON
  const position = {
    x: Number(source.meta?.position?.x ?? node.transform.position.x) + 48,
    y: Number(source.meta?.position?.y ?? node.transform.position.y) + 48,
  }
  const used = new Set(document.getAllNodes().map((item) => item.id))
  const baseID = `${source.id}_copy`
  let id = baseID
  let index = 2
  while (used.has(id)) {
    id = `${baseID}_${index}`
    index += 1
  }
  const copied = document.createWorkflowNodeByType(
    String(node.flowNodeType),
    position,
    {
      ...source,
      id,
      meta: { ...source.meta, position },
    }
  )
  selection.selectNode(copied)
}

function typeIcon(type: string) {
  if (type === "string") return "S"
  if (type === "boolean") return "B"
  if (type === "number" || type === "integer") return "N"
  if (type.startsWith("array")) return "A"
  if (type === "object") return "O"
  return "•"
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function normalizeIDs(value: unknown) {
  if (!Array.isArray(value)) return []
  return Array.from(
    new Set(
      value
        .map(Number)
        .filter((item) => Number.isInteger(item) && item > 0)
    )
  )
}
