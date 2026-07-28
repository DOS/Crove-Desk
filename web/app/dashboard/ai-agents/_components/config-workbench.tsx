"use client"

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react"
import {
  HistoryIcon,
  MessageSquareTextIcon,
  PlugIcon,
  SaveIcon,
  SettingsIcon,
  Trash2Icon,
  UserRoundCheckIcon,
} from "lucide-react"
import { toast } from "sonner"

import { ContentEditor } from "@/components/content-editor"
import { OptionCombobox } from "@/components/option-combobox"
import { ProjectDialog } from "@/components/project-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import {
  createAIAgent,
  fetchAIAgent,
  fetchAIAgentRevisions,
  fetchAIConfigsAll,
  fetchAIWorkflows,
  fetchAgentTeamsAll,
  fetchKnowledgeBasesAll,
  fetchMCPCatalog,
  fetchSkillDefinitionsAll,
  publishAIAgent,
  rollbackAIAgent,
  updateAIAgent,
  type AIAgent,
  type AIAgentWorkflowBindingInput,
  type AgentRevision,
  type AIConfig,
  type AIWorkflow,
  type AdminAgentTeam,
  type CreateAIAgentPayload,
  type KnowledgeBase,
  type MCPToolCatalogItem,
  type SkillDefinition,
} from "@/lib/api/admin"
import {
  AIAgentFallbackMode,
  AIAgentHandoffMode,
  AIModelType,
  IMConversationServiceMode,
  Status,
} from "@/lib/generated/enums"
import { cn } from "@/lib/utils"

type SectionKey = "setup" | "persona" | "capability" | "service"
type MCPToolItem = CreateAIAgentPayload["mcpTools"][number]

type MCPToolOption = {
  value: string
  label: string
  group: string
  subtitle: string
  description?: string
  meta: MCPToolItem
}

function normalizeMCPToolsWithCatalog(
  tools: MCPToolItem[],
  catalog: MCPToolCatalogItem[],
) {
  return tools.map((tool) => {
    const catalogTool = catalog.find((item) => item.toolCode === tool.toolCode)
    if (!catalogTool || catalogTool.riskEditable) return tool
    return {
      ...tool,
      title: catalogTool.title || tool.title,
      description: catalogTool.description || tool.description,
      riskLevel: catalogTool.riskLevel,
      requireConfirmation: catalogTool.requireConfirmation,
    }
  })
}

function toText(value: string | number | undefined | null) {
  if (value === undefined || value === null || value === 0) return ""
  return String(value)
}

function uniqueNumbers(input: number[]) {
  return Array.from(new Set(input.filter((id) => Number.isFinite(id) && id > 0)))
}

export function AIAgentConfigWorkbench({
  agentId,
  onAgentSaved,
  onAgentCreated,
  onCancel,
}: {
  agentId?: number | null
  onAgentSaved?: () => void
  onAgentCreated?: (agent: AIAgent) => void
  onCancel?: () => void
}) {
  const [currentAgentId, setCurrentAgentId] = useState(agentId ?? null)
  const [activeSection, setActiveSection] = useState<SectionKey>("setup")
  const [agent, setAgent] = useState<AIAgent | null>(null)
  const [agentRevisions, setAgentRevisions] = useState<AgentRevision[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [versionDialogOpen, setVersionDialogOpen] = useState(false)

  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [aiConfigId, setAIConfigId] = useState("")
  const [serviceMode, setServiceMode] = useState(String(IMConversationServiceMode.AIFirst))
  const [systemPrompt, setSystemPrompt] = useState("")
  const [welcomeMessage, setWelcomeMessage] = useState("")
  const [replyTimeoutSeconds, setReplyTimeoutSeconds] = useState("180")
  const [handoffMode, setHandoffMode] = useState(String(AIAgentHandoffMode.WaitPool))
  const [fallbackMode, setFallbackMode] = useState(String(AIAgentFallbackMode.NoAnswer))
  const [fallbackMessage, setFallbackMessage] = useState("")
  const [selectedTeamIds, setSelectedTeamIds] = useState<number[]>([])
  const [selectedSkillIds, setSelectedSkillIds] = useState<number[]>([])
  const [selectedKnowledgeBaseIds, setSelectedKnowledgeBaseIds] = useState<number[]>([])
  const [mcpTools, setMCPTools] = useState<MCPToolItem[]>([])
  const [workflowBindings, setWorkflowBindings] = useState<AIAgentWorkflowBindingInput[]>([])

  const [aiConfigs, setAIConfigs] = useState<AIConfig[]>([])
  const [agentTeams, setAgentTeams] = useState<AdminAgentTeam[]>([])
  const [skills, setSkills] = useState<SkillDefinition[]>([])
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([])
  const [toolCatalog, setToolCatalog] = useState<MCPToolCatalogItem[]>([])
  const [publishedWorkflows, setPublishedWorkflows] = useState<AIWorkflow[]>([])

  const [teamToAdd, setTeamToAdd] = useState("")

  useEffect(() => {
    setCurrentAgentId(agentId ?? null)
  }, [agentId])

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [configs, teams, skillList, knowledgeBaseList, catalog, workflowPage] =
        await Promise.all([
          fetchAIConfigsAll({ modelType: AIModelType.LLM }),
          fetchAgentTeamsAll(),
          fetchSkillDefinitionsAll({ status: Status.Ok }),
          fetchKnowledgeBasesAll({ status: Status.Ok }),
          fetchMCPCatalog(),
          fetchAIWorkflows({ limit: 100 }),
        ])

      setAIConfigs(configs ?? [])
      setAgentTeams(teams ?? [])
      setSkills(skillList ?? [])
      setKnowledgeBases(knowledgeBaseList ?? [])
      setToolCatalog(catalog ?? [])
      setPublishedWorkflows(
        (workflowPage.results ?? []).filter((item) => item.publishedVersionId > 0),
      )

      if (!currentAgentId || currentAgentId <= 0) {
        setAgent(null)
        setAgentRevisions([])
        setName("")
        setDescription("")
        setAIConfigId("")
        setServiceMode(String(IMConversationServiceMode.AIFirst))
        setSystemPrompt("")
        setWelcomeMessage("")
        setReplyTimeoutSeconds("180")
        setHandoffMode(String(AIAgentHandoffMode.WaitPool))
        setFallbackMode(String(AIAgentFallbackMode.NoAnswer))
        setFallbackMessage("")
        setSelectedTeamIds([])
        setSelectedSkillIds([])
        setSelectedKnowledgeBaseIds([])
        setMCPTools([])
        setWorkflowBindings([])
        return
      }

      const [detail, revisions] = await Promise.all([
        fetchAIAgent(currentAgentId),
        fetchAIAgentRevisions(currentAgentId),
      ])
      setAgent(detail)
      setAgentRevisions(revisions ?? [])
      setName(detail.name)
      setDescription(detail.description || "")
      setAIConfigId(toText(detail.aiConfigId))
      setServiceMode(String(detail.serviceMode || IMConversationServiceMode.AIFirst))
      setSystemPrompt(detail.systemPrompt || "")
      setWelcomeMessage(detail.welcomeMessage || "")
      setReplyTimeoutSeconds(String(detail.replyTimeoutSeconds ?? 180))
      setHandoffMode(String(detail.handoffMode || AIAgentHandoffMode.WaitPool))
      setFallbackMode(String(detail.fallbackMode || AIAgentFallbackMode.NoAnswer))
      setFallbackMessage(detail.fallbackMessage || "")
      setSelectedTeamIds((detail.teams ?? []).map((team) => team.id))
      setSelectedSkillIds(detail.skillIds ?? [])
      setSelectedKnowledgeBaseIds(detail.knowledgeBaseIds ?? [])
      setMCPTools(normalizeMCPToolsWithCatalog(detail.mcpTools ?? [], catalog ?? []))
      setWorkflowBindings(
        (detail.workflowBindings ?? []).map(
          ({ workflowVersionId, toolName, triggerInstruction, priority, enabled }) => ({
            workflowVersionId,
            toolName,
            triggerInstruction,
            priority,
            enabled,
          }),
        ),
      )
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "加载 Agent 配置失败")
    } finally {
      setLoading(false)
    }
  }, [currentAgentId])

  useEffect(() => {
    void loadData()
  }, [loadData])

  async function refreshAgentPublicationState(id: number) {
    const [detail, revisions] = await Promise.all([
      fetchAIAgent(id),
      fetchAIAgentRevisions(id),
    ])
    setAgent((current) =>
      current
        ? { ...current, publishedRevisionId: detail.publishedRevisionId }
        : detail,
    )
    setAgentRevisions(revisions ?? [])
  }

  const serviceModeOptions = useMemo(
    () => [
      { value: String(IMConversationServiceMode.AIOnly), label: "仅 AI" },
      { value: String(IMConversationServiceMode.HumanOnly), label: "仅人工" },
      { value: String(IMConversationServiceMode.AIFirst), label: "AI 优先" },
    ],
    [],
  )
  const handoffModeOptions = useMemo(
    () => [
      { value: String(AIAgentHandoffMode.WaitPool), label: "进入待接入池" },
      {
        value: String(AIAgentHandoffMode.DefaultTeamPool),
        label: "进入默认客服组待接入池",
      },
      {
        value: String(AIAgentHandoffMode.AIHoldAndNotify),
        label: "AI继续接待并提醒人工",
      },
    ],
    [],
  )
  const fallbackModeOptions = useMemo(
    () => [
      { value: String(AIAgentFallbackMode.NoAnswer), label: "直接说明知识不足" },
      { value: String(AIAgentFallbackMode.SuggestRetry), label: "引导用户补充信息" },
      { value: String(AIAgentFallbackMode.Handoff), label: "转人工客服" },
    ],
    [],
  )
  const aiConfigOptions = useMemo(
    () =>
      aiConfigs.map((item) => ({
        value: String(item.id),
        label: `${item.name} · ${item.modelName}`,
      })),
    [aiConfigs],
  )
  const teamOptions = useMemo(
    () => agentTeams.map((item) => ({ value: String(item.id), label: item.name })),
    [agentTeams],
  )
  const skillOptions = useMemo(
    () => skills.map((item) => ({ value: String(item.id), label: item.name })),
    [skills],
  )
  const knowledgeBaseOptions = useMemo(
    () => knowledgeBases.map((item) => ({ value: String(item.id), label: item.name })),
    [knowledgeBases],
  )
  const mcpToolOptions = useMemo<MCPToolOption[]>(
    () =>
      toolCatalog
        .filter((tool) => !tool.autoInjected && tool.sourceType === "mcp")
        .map((tool) => ({
          value: tool.toolCode,
          label: tool.title || tool.toolName,
          group: tool.serverCode,
          subtitle: tool.toolCode,
          description: tool.description || undefined,
          meta: {
            toolCode: tool.toolCode,
            serverCode: tool.serverCode,
            toolName: tool.toolName,
            title: tool.title || tool.toolName,
            description: tool.description || "",
            riskLevel: tool.riskLevel,
            requireConfirmation: tool.requireConfirmation,
            arguments: undefined,
          },
        })),
    [toolCatalog],
  )
  const workflowOptions = useMemo(
    () =>
      publishedWorkflows.map((workflow) => ({
        value: String(workflow.publishedVersionId),
        label: workflow.name,
        subtitle: `固定版本 #${workflow.publishedVersionId}`,
      })),
    [publishedWorkflows],
  )

  function selectedOptions(ids: number[], options: { value: string; label: string }[]) {
    return ids
      .map((id) => options.find((option) => Number(option.value) === id))
      .filter((option): option is { value: string; label: string } => Boolean(option))
  }

  function addSelected(value: string, current: number[], setNext: (ids: number[]) => void) {
    const id = Number(value)
    if (!Number.isFinite(id) || id <= 0 || current.includes(id)) return
    setNext([...current, id])
  }

  function setMCPToolSelection(values: string[]) {
    setMCPTools(
      values.flatMap((value) => {
        const current = mcpTools.find((item) => item.toolCode === value)
        if (current) return [current]
        const option = mcpToolOptions.find((item) => item.value === value)
        return option ? [option.meta] : []
      }),
    )
  }

  function setWorkflowSelection(values: string[]) {
    const selectedVersionIds = values.map(Number).filter((value) => value > 0)
    setWorkflowBindings(
      selectedVersionIds.flatMap((workflowVersionId, index) => {
        const current = workflowBindings.find(
          (binding) => binding.workflowVersionId === workflowVersionId,
        )
        if (current) {
          return [{ ...current, priority: index + 1, enabled: true }]
        }
        const workflow = publishedWorkflows.find(
          (item) => item.publishedVersionId === workflowVersionId,
        )
        if (!workflow) return []
        return [
          {
            workflowVersionId,
            toolName: workflow.name,
            triggerInstruction: "",
            priority: index + 1,
            enabled: true,
          },
        ]
      }),
    )
  }

  function validateForm() {
    if (!name.trim()) {
      setActiveSection("setup")
      toast.error("请填写 Agent 名称")
      return false
    }
    if (!Number(aiConfigId)) {
      setActiveSection("setup")
      toast.error("请选择 AI 配置")
      return false
    }
    return true
  }

  function buildPayload(): CreateAIAgentPayload {
    return {
      name: name.trim(),
      description: description.trim(),
      aiConfigId: Number(aiConfigId),
      serviceMode: Number(serviceMode),
      systemPrompt: systemPrompt.trim(),
      welcomeMessage: welcomeMessage.trim(),
      replyTimeoutSeconds: Number(replyTimeoutSeconds),
      rolloutPercent: agent?.rolloutPercent || 100,
      teamIds: uniqueNumbers(selectedTeamIds),
      handoffMode: Number(handoffMode),
      fallbackMode: Number(fallbackMode),
      fallbackMessage: fallbackMessage.trim(),
      knowledgeBaseIds: uniqueNumbers(selectedKnowledgeBaseIds),
      skillIds: uniqueNumbers(selectedSkillIds),
      mcpTools,
      workflowBindings,
    }
  }

  async function saveAgentSettings() {
    if (!validateForm()) return
    setSaving(true)
    try {
      const payload = buildPayload()
      if (agent) {
        await updateAIAgent({ id: agent.id, ...payload })
        toast.success(
          agent.publishedRevisionId > 0
            ? "配置已保存，当前已发布版本继续生效"
            : "Agent 配置已保存",
        )
      } else {
        const created = await createAIAgent(payload)
        setCurrentAgentId(created.id)
        setAgent(created)
        toast.success("Agent 已创建")
        onAgentCreated?.(created)
      }
      onAgentSaved?.()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "保存 Agent 配置失败")
    } finally {
      setSaving(false)
    }
  }

  async function publishAgent() {
    if (!agent) return
    if (!validateForm()) return
    setSaving(true)
    try {
      const payload = buildPayload()
      await updateAIAgent({ id: agent.id, ...payload })
      await publishAIAgent(agent.id)
      await refreshAgentPublicationState(agent.id)
      toast.success("Agent 配置已保存并发布")
      onAgentSaved?.()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "保存并发布 Agent 失败")
    } finally {
      setSaving(false)
    }
  }

  async function rollbackAgentRevision(revisionId: number) {
    if (!agent || revisionId <= 0 || revisionId === agent.publishedRevisionId) return
    setSaving(true)
    try {
      await rollbackAIAgent(agent.id, revisionId)
      toast.success("已回滚到选中的 Agent 版本")
      await refreshAgentPublicationState(agent.id)
      onAgentSaved?.()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "回滚 Agent 版本失败")
    } finally {
      setSaving(false)
    }
  }

  const agentPublished = (agent?.publishedRevisionId ?? 0) > 0

  const sections: {
    key: SectionKey
    title: string
    icon: ReactNode
  }[] = [
    { key: "setup", title: "身份与运行", icon: <SettingsIcon /> },
    { key: "persona", title: "角色与回复", icon: <MessageSquareTextIcon /> },
    { key: "capability", title: "知识与能力", icon: <PlugIcon /> },
    { key: "service", title: "服务与兜底", icon: <UserRoundCheckIcon /> },
  ]

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        加载中...
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background">
      <header className="flex h-16 shrink-0 items-center justify-between gap-4 border-b px-5">
        <div className="flex min-w-0 items-center gap-3">
          {/* <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/5 text-primary">
            <BotMessageSquareIcon className="size-5" />
          </div> */}
          <div className="flex min-w-0 items-center gap-2">
            <h1 className="truncate text-base font-semibold">{agent?.name || "新建 AI Agent"}</h1>
            {agent?.statusName ? <Badge variant="secondary">{agent.statusName}</Badge> : null}
            <Badge variant={agentPublished ? "default" : "outline"}>
              {agentPublished ? "已发布" : agent ? "未发布" : "尚未创建"}
            </Badge>
          </div>
          {agent ? (
            <Button type="button" variant="link" onClick={() => setVersionDialogOpen(true)}>
              <HistoryIcon />
              版本记录
            </Button>
          ) : null}
        </div>
      </header>
      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-64 shrink-0 flex-col border-r bg-muted/20 p-4 md:flex">
          <div className="px-3 pb-2 text-[11px] font-semibold tracking-wider text-muted-foreground">
            AGENT 配置
          </div>
          <nav className="space-y-1">
            {sections.map((section, index) => (
              <button
                key={section.key}
                type="button"
                onClick={() => setActiveSection(section.key)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors",
                  activeSection === section.key
                    ? "bg-primary/5 font-medium text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <span
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted [&>svg]:size-4",
                    activeSection === section.key && "bg-background text-primary shadow-sm",
                  )}
                >
                  {section.icon}
                </span>
                <span className="flex-1">{section.title}</span>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {String(index + 1).padStart(2, "0")}
                </span>
              </button>
            ))}
          </nav>
          <div className="mt-auto flex items-center justify-between rounded-lg border bg-background p-3 text-xs">
            <span className="text-muted-foreground">状态</span>
            <span className={agentPublished ? "font-medium text-emerald-600" : "font-medium text-amber-600"}>
              {agentPublished ? "已发布" : agent ? "未发布" : "尚未创建"}
            </span>
          </div>
        </aside>

        <main className="min-w-0 flex-1 overflow-y-auto bg-background">
          <div className="mx-auto w-full max-w-4xl p-5 sm:p-8">
            {activeSection === "setup" ? (
              <div className="space-y-10">
                <FormSection
                  title="基本信息"
                  description="配置 Agent 的后台名称、服务方式和职责说明。"
                >
                  <div className="grid gap-5 md:grid-cols-2">
                    <FieldBlock label="Agent 名称" required>
                      <Input value={name} onChange={(event) => setName(event.target.value)} />
                    </FieldBlock>
                    <FieldBlock label="服务模式">
                      <OptionCombobox
                        value={serviceMode}
                        options={serviceModeOptions}
                        placeholder="选择服务模式"
                        onChange={setServiceMode}
                      />
                    </FieldBlock>
                    <FieldBlock label="描述" className="md:col-span-2">
                      <Textarea
                        rows={4}
                        value={description}
                        onChange={(event) => setDescription(event.target.value)}
                      />
                    </FieldBlock>
                  </div>
                </FormSection>

                <FormSection
                  title="模型与响应"
                  description="选择推理模型并设置单次回复的超时时间。"
                >
                  <div className="grid gap-5 md:grid-cols-2">
                    <FieldBlock label="AI 配置" required>
                      <OptionCombobox
                        value={aiConfigId}
                        options={aiConfigOptions}
                        placeholder="选择 AI 配置"
                        searchPlaceholder="搜索 AI 配置"
                        emptyText="没有可用 AI 配置"
                        onChange={setAIConfigId}
                      />
                    </FieldBlock>
                    <FieldBlock label="回复超时">
                      <div className="relative">
                        <Input
                          type="number"
                          min={0}
                          step={1}
                          className="pr-12"
                          value={replyTimeoutSeconds}
                          onChange={(event) => setReplyTimeoutSeconds(event.target.value)}
                        />
                        <span className="pointer-events-none absolute top-2.5 right-3 text-sm text-muted-foreground">
                          秒
                        </span>
                      </div>
                    </FieldBlock>
                  </div>
                </FormSection>
              </div>
            ) : null}

            {activeSection === "persona" ? (
              <div className="space-y-10">
                <FormSection
                  title="系统提示词"
                  description="定义 Agent 的角色、任务和回复边界，支持 Markdown。"
                >
                  <ContentEditor
                    value={{ mode: "markdown", raw: systemPrompt }}
                    allowedModes={["markdown"]}
                    height={360}
                    onChange={(next) => setSystemPrompt(next.raw)}
                  />
                </FormSection>
                <FormSection
                  title="欢迎语"
                  description="进入会话时发送的首次回复，留空时不主动发送。"
                >
                  <Textarea
                    rows={5}
                    value={welcomeMessage}
                    onChange={(event) => setWelcomeMessage(event.target.value)}
                  />
                </FormSection>
              </div>
            ) : null}

            {activeSection === "capability" ? (
              <div className="space-y-10">
                <FormSection
                  title="知识库"
                  description="Agent 回答时可以检索的知识范围。"
                >
                  <OptionCombobox
                    multiple
                    values={selectedKnowledgeBaseIds.map(String)}
                    options={knowledgeBaseOptions}
                    placeholder="选择知识库"
                    emptyText="没有可用知识库"
                    onValuesChange={(values) =>
                      setSelectedKnowledgeBaseIds(values.map(Number))
                    }
                  />
                </FormSection>

                <FormSection
                  title="Skill"
                  description="Agent 可以调用的标准能力。"
                >
                  <OptionCombobox
                    multiple
                    values={selectedSkillIds.map(String)}
                    options={skillOptions}
                    placeholder="选择 Skill"
                    emptyText="没有可用 Skill"
                    onValuesChange={(values) => setSelectedSkillIds(values.map(Number))}
                  />
                </FormSection>

                <FormSection
                  title="工作流"
                  description="关联工作流中心中已经发布的固定版本。"
                >
                  <OptionCombobox
                    multiple
                    values={workflowBindings.map((binding) =>
                      String(binding.workflowVersionId),
                    )}
                    options={workflowOptions}
                    placeholder="选择已发布工作流"
                    emptyText="没有已发布的工作流"
                    onValuesChange={setWorkflowSelection}
                  />
                </FormSection>

                <FormSection
                  title="MCP Tool"
                  description="选择允许 Agent 调用的 MCP Tool，选项与 MCP Tool 管理中的可用工具保持一致。"
                >
                  <OptionCombobox
                    multiple
                    values={mcpTools.map((tool) => tool.toolCode)}
                    options={mcpToolOptions}
                    placeholder="选择 MCP Tool"
                    emptyText="没有可用 MCP Tool"
                    onValuesChange={setMCPToolSelection}
                  />
                  {mcpTools.length > 0 ? (
                    <div className="space-y-2">
                      {mcpTools.map((tool) => {
                        const catalogTool = toolCatalog.find(
                          (item) => item.toolCode === tool.toolCode,
                        )
                        return (
                          <div
                            key={tool.toolCode}
                            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border px-3 py-2"
                          >
                            <div className="min-w-0">
                              <div className="truncate text-sm font-medium">
                                {tool.title || tool.toolCode}
                              </div>
                              <div className="truncate font-mono text-xs text-muted-foreground">
                                {tool.toolCode}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {catalogTool && !catalogTool.riskEditable ? (
                                <Badge variant="secondary">
                                  {tool.riskLevel === "read"
                                    ? "只读（系统定义）"
                                    : "写操作（系统定义）"}
                                </Badge>
                              ) : (
                                <>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant={
                                      tool.riskLevel === "read" ? "default" : "outline"
                                    }
                                    onClick={() =>
                                      setMCPTools((items) =>
                                        items.map((item) =>
                                          item.toolCode === tool.toolCode
                                            ? {
                                                ...item,
                                                riskLevel: "read",
                                                requireConfirmation: false,
                                              }
                                            : item,
                                        ),
                                      )
                                    }
                                  >
                                    只读
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant={
                                      tool.riskLevel === "write"
                                        ? "destructive"
                                        : "outline"
                                    }
                                    onClick={() =>
                                      setMCPTools((items) =>
                                        items.map((item) =>
                                          item.toolCode === tool.toolCode
                                            ? {
                                                ...item,
                                                riskLevel: "write",
                                                requireConfirmation: true,
                                              }
                                            : item,
                                        ),
                                      )
                                    }
                                  >
                                    写操作（需确认）
                                  </Button>
                                </>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : null}
                </FormSection>
              </div>
            ) : null}

            {activeSection === "service" ? (
              <div className="space-y-10">
                <FormSection
                  title="转人工"
                  description="配置需要人工介入时的接入方式和承接客服组。"
                >
                  <div className="grid gap-5 md:grid-cols-2">
                    <FieldBlock label="执行方式">
                      <OptionCombobox
                        value={handoffMode}
                        options={handoffModeOptions}
                        placeholder="选择转人工执行方式"
                        onChange={setHandoffMode}
                      />
                    </FieldBlock>
                    <FieldBlock label="客服组">
                      <div className="flex gap-2">
                        <div className="min-w-0 flex-1">
                          <OptionCombobox
                            value={teamToAdd}
                            options={teamOptions.filter(
                              (option) =>
                                !selectedTeamIds.includes(Number(option.value)),
                            )}
                            placeholder="选择客服组"
                            onChange={setTeamToAdd}
                          />
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          disabled={!teamToAdd}
                          onClick={() => {
                            addSelected(teamToAdd, selectedTeamIds, setSelectedTeamIds)
                            setTeamToAdd("")
                          }}
                        >
                          添加
                        </Button>
                      </div>
                    </FieldBlock>
                  </div>
                  <BadgeList
                    empty="未配置客服组"
                    items={selectedOptions(selectedTeamIds, teamOptions)}
                    onRemove={(id) =>
                      setSelectedTeamIds((current) =>
                        current.filter((item) => item !== id),
                      )
                    }
                  />
                </FormSection>

                <FormSection
                  title="知识不足"
                  description="配置 Agent 无法确定答案时的处理策略和回复内容。"
                >
                  <FieldBlock label="处理策略">
                    <OptionCombobox
                      value={fallbackMode}
                      options={fallbackModeOptions}
                      placeholder="选择知识不足回复策略"
                      onChange={setFallbackMode}
                    />
                  </FieldBlock>
                  <FieldBlock label="回复文案">
                    <Textarea
                      rows={5}
                      value={fallbackMessage}
                      onChange={(event) => setFallbackMessage(event.target.value)}
                    />
                  </FieldBlock>
                </FormSection>
              </div>
            ) : null}
          </div>
        </main>
      </div>

      <footer className="flex min-h-16 shrink-0 flex-wrap items-center justify-between gap-3 border-t bg-background px-5 py-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span
            className={cn(
              "size-2 rounded-full",
              agentPublished ? "bg-emerald-500" : "bg-amber-500",
            )}
          />
          <span>
            {agentPublished
              ? "已发布版本正在生效；再次发布后应用当前配置"
              : "发布时会先保存当前配置"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            取消
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={saving}
            onClick={saveAgentSettings}
          >
            <SaveIcon />
            保存配置
          </Button>
          {agent ? (
            <Button type="button" disabled={saving} onClick={publishAgent}>
              发布 Agent
            </Button>
          ) : null}
        </div>
      </footer>

      <ProjectDialog
        open={versionDialogOpen}
        onOpenChange={setVersionDialogOpen}
        title="版本记录"
        size="xl"
      >
        <VersionRecordsTable
          agent={agent}
          agentRevisions={agentRevisions}
          onRollback={rollbackAgentRevision}
          rollbackDisabled={saving}
        />
      </ProjectDialog>
    </div>
  )
}

function FormSection({
  title,
  description,
  action,
  children,
}: {
  title: string
  description: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="relative pl-3 text-[15px] font-semibold text-foreground before:absolute before:top-1 before:left-0 before:h-4 before:w-0.5 before:rounded-full before:bg-primary">
            {title}
          </h2>
          <p className="mt-1 pl-3 text-xs leading-5 text-muted-foreground">{description}</p>
        </div>
        {action}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  )
}

function FieldBlock({
  label,
  required,
  className,
  children,
}: {
  label: string
  required?: boolean
  className?: string
  children: ReactNode
}) {
  return (
    <div className={cn("space-y-2", className)}>
      <Label>
        {label}
        {required ? <span className="ml-1 text-destructive">*</span> : null}
      </Label>
      {children}
    </div>
  )
}

function BadgeList({
  empty,
  items,
  onRemove,
}: {
  empty: string
  items: { value: string; label: string }[]
  onRemove: (id: number) => void
}) {
  if (items.length === 0) {
    return <div className="text-sm text-muted-foreground">{empty}</div>
  }
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <Badge key={item.value} variant="secondary" className="gap-1 pr-1">
          {item.label}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-5"
            onClick={() => onRemove(Number(item.value))}
          >
            <Trash2Icon className="size-3" />
          </Button>
        </Badge>
      ))}
    </div>
  )
}

function VersionRecordsTable({
  agent,
  agentRevisions,
  onRollback,
  rollbackDisabled,
}: {
  agent: AIAgent | null
  agentRevisions: AgentRevision[]
  onRollback: (revisionId: number) => void
  rollbackDisabled: boolean
}) {
  return (
    <div className="max-h-[60vh] overflow-auto rounded-md border">
      {agentRevisions.length > 0 ? (
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow>
              <TableHead className="w-28">版本</TableHead>
              <TableHead>发布时间</TableHead>
              <TableHead>发布人</TableHead>
              <TableHead>定义摘要</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {agentRevisions.map((revision) => {
              const active = agent?.publishedRevisionId === revision.id
              return (
                <TableRow key={revision.id}>
                  <TableCell className="font-medium">
                    r{revision.revision}
                    {active ? (
                      <Badge variant="secondary" className="ml-2">
                        当前生效
                      </Badge>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {revision.publishedAt || "-"}
                  </TableCell>
                  <TableCell>{revision.publishedByName || "-"}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {revision.definitionHash?.slice(0, 12) || "-"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={active || rollbackDisabled}
                      onClick={() => onRollback(revision.id)}
                    >
                      回滚
                    </Button>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      ) : (
        <div className="p-5 text-sm text-muted-foreground">暂无已发布 Agent 版本。</div>
      )}
    </div>
  )
}
