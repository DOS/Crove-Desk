"use client"

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react"
import {
  ArrowDownIcon,
  ArrowUpIcon,
  BotMessageSquareIcon,
  GitBranchIcon,
  HistoryIcon,
  PlugIcon,
  SaveIcon,
  SettingsIcon,
  Trash2Icon,
} from "lucide-react"
import { toast } from "sonner"

import { ContentEditor } from "@/components/content-editor"
import { OptionCombobox } from "@/components/option-combobox"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
  fetchAIAgentWorkflow,
  fetchAIConfigsAll,
  fetchAIWorkflowDefaultDefinition,
  fetchAIWorkflowNodeSpecs,
  fetchAIWorkflowVersions,
  fetchAgentTeamsAll,
  fetchKnowledgeBasesAll,
  fetchMCPCatalog,
  fetchSkillDefinitionsAll,
  publishAIAgentWorkflow,
  saveAIAgentWorkflow,
  updateAIAgent,
  validateAIWorkflow,
  type AIAgent,
  type AIConfig,
  type AIWorkflowDefinition,
  type AIWorkflowNodeSpec,
  type AIWorkflowVersion,
  type AdminAgentTeam,
  type CreateAIAgentPayload,
  type KnowledgeBase,
  type MCPToolCatalogItem,
  type MCPToolSourceType,
  type SkillDefinition,
} from "@/lib/api/admin"
import {
  AIAgentFallbackMode,
  AIAgentHandoffMode,
  AIModelType,
  IMConversationServiceMode,
  Status,
} from "@/lib/generated/enums"
import { WorkflowEditor } from "../../ai-workflows/_components/workflow-editor"

type DirectToolItem = CreateAIAgentPayload["directTools"][number]

type DirectToolOption = {
  value: string
  label: string
  meta: DirectToolItem
  sourceType: MCPToolSourceType
  groupLabel: string
}

type SectionKey =
  | "basic"
  | "capabilities"
  | "workflow"

const fallbackDefinition: AIWorkflowDefinition = {
  schemaVersion: 1,
  entryNodeId: "start_1",
  nodes: [
    {
      id: "start_1",
      type: "start",
      name: "开始",
      position: { x: 0, y: 80 },
      config: {},
    },
    {
      id: "end_1",
      type: "end",
      name: "结束",
      position: { x: 260, y: 80 },
      config: {},
    },
  ],
  edges: [{ id: "edge_start_end", source: "start_1", target: "end_1" }],
}

function toText(value: string | number | undefined | null) {
  if (value === undefined || value === null || value === 0) return ""
  return String(value)
}

function uniqueNumbers(input: number[]) {
  return Array.from(new Set(input.filter((id) => Number.isFinite(id) && id > 0)))
}

function isWorkflowPublished(agent: AIAgent | null) {
  return Boolean(agent?.workflowPublished ?? (agent?.workflowVersionId ?? 0) > 0)
}

export function AIAgentConfigWorkbench({
  agentId,
  onAgentSaved,
  onAgentCreated,
}: {
  agentId?: number | null
  onAgentSaved?: () => void
  onAgentCreated?: (agent: AIAgent) => void
}) {
  const [currentAgentId, setCurrentAgentId] = useState(agentId ?? null)
  const [activeSection, setActiveSection] = useState<SectionKey>("basic")
  const [agent, setAgent] = useState<AIAgent | null>(null)
  const [workflowVersions, setWorkflowVersions] = useState<AIWorkflowVersion[]>([])
  const [nodeSpecs, setNodeSpecs] = useState<AIWorkflowNodeSpec[]>([])
  const [loading, setLoading] = useState(true)
  const [savingAgent, setSavingAgent] = useState(false)
  const [savingWorkflow, setSavingWorkflow] = useState(false)
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
  const [selectedKnowledgeIds, setSelectedKnowledgeIds] = useState<number[]>([])
  const [selectedTeamIds, setSelectedTeamIds] = useState<number[]>([])
  const [selectedSkillIds, setSelectedSkillIds] = useState<number[]>([])
  const [directTools, setDirectTools] = useState<DirectToolItem[]>([])

  const [definition, setDefinition] = useState<AIWorkflowDefinition>(fallbackDefinition)
  const [workflowEditorKey, setWorkflowEditorKey] = useState(0)

  const [aiConfigs, setAIConfigs] = useState<AIConfig[]>([])
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([])
  const [agentTeams, setAgentTeams] = useState<AdminAgentTeam[]>([])
  const [skills, setSkills] = useState<SkillDefinition[]>([])
  const [toolCatalog, setToolCatalog] = useState<MCPToolCatalogItem[]>([])
  const [knowledgeToAdd, setKnowledgeToAdd] = useState("")
  const [teamToAdd, setTeamToAdd] = useState("")
  const [skillToAdd, setSkillToAdd] = useState("")
  const [directToolGroupToAdd, setDirectToolGroupToAdd] = useState("")
  const [directToolToAdd, setDirectToolToAdd] = useState("")

  useEffect(() => {
    setCurrentAgentId(agentId ?? null)
  }, [agentId])

  const replaceWorkflowDefinition = useCallback((nextDefinition: AIWorkflowDefinition) => {
    setDefinition(nextDefinition)
    setWorkflowEditorKey((current) => current + 1)
  }, [])

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [
        specs,
        defaultDefinition,
        configs,
        bases,
        teams,
        skillList,
        catalog,
      ] = await Promise.all([
        fetchAIWorkflowNodeSpecs(),
        fetchAIWorkflowDefaultDefinition().catch(() => fallbackDefinition),
        fetchAIConfigsAll({ modelType: AIModelType.LLM }),
        fetchKnowledgeBasesAll({ status: Status.Ok }),
        fetchAgentTeamsAll(),
        fetchSkillDefinitionsAll({ status: Status.Ok }),
        fetchMCPCatalog(),
      ])

      setNodeSpecs(specs ?? [])
      setAIConfigs(configs ?? [])
      setKnowledgeBases(bases ?? [])
      setAgentTeams(teams ?? [])
      setSkills(skillList ?? [])
      setToolCatalog(catalog ?? [])

      if (!currentAgentId || currentAgentId <= 0) {
        setAgent(null)
        setWorkflowVersions([])
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
        setSelectedKnowledgeIds([])
        setSelectedTeamIds([])
        setSelectedSkillIds([])
        setDirectTools([])
        replaceWorkflowDefinition(defaultDefinition ?? fallbackDefinition)
        return
      }

      const [agentDetail, workflowDetail] = await Promise.all([
        fetchAIAgent(currentAgentId),
        fetchAIAgentWorkflow(currentAgentId),
      ])

      setAgent(agentDetail)
      if (workflowDetail?.id > 0) {
        const versionPage = await fetchAIWorkflowVersions({ workflowId: workflowDetail.id, limit: 20 })
        setWorkflowVersions(versionPage.results ?? [])
      } else {
        setWorkflowVersions([])
      }
      setName(agentDetail.name)
      setDescription(agentDetail.description || "")
      setAIConfigId(toText(agentDetail.aiConfigId))
      setServiceMode(String(agentDetail.serviceMode || IMConversationServiceMode.AIFirst))
      setSystemPrompt(agentDetail.systemPrompt || "")
      setWelcomeMessage(agentDetail.welcomeMessage || "")
      setReplyTimeoutSeconds(String(agentDetail.replyTimeoutSeconds ?? 180))
      setHandoffMode(String(agentDetail.handoffMode || AIAgentHandoffMode.WaitPool))
      setFallbackMode(String(agentDetail.fallbackMode || AIAgentFallbackMode.NoAnswer))
      setFallbackMessage(agentDetail.fallbackMessage || "")
      setSelectedKnowledgeIds(agentDetail.knowledgeIds ?? [])
      setSelectedTeamIds((agentDetail.teams ?? []).map((team) => team.id))
      setSelectedSkillIds(agentDetail.skillIds ?? [])
      setDirectTools(agentDetail.directTools ?? [])
      replaceWorkflowDefinition(workflowDetail.draftDefinition ?? defaultDefinition ?? fallbackDefinition)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load Agent config")
    } finally {
      setLoading(false)
    }
  }, [currentAgentId, replaceWorkflowDefinition])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const serviceModeOptions = useMemo(
    () => [
      { value: String(IMConversationServiceMode.AIOnly), label: "仅 AI" },
      { value: String(IMConversationServiceMode.HumanOnly), label: "仅人工" },
      { value: String(IMConversationServiceMode.AIFirst), label: "AI 优先" },
    ],
    []
  )
  const handoffModeOptions = useMemo(
    () => [
      { value: String(AIAgentHandoffMode.WaitPool), label: "进入待接入池" },
      { value: String(AIAgentHandoffMode.DefaultTeamPool), label: "进入默认客服组待接入池" },
      { value: String(AIAgentHandoffMode.AIHoldAndNotify), label: "AI继续接待并提醒人工" },
    ],
    []
  )
  const fallbackModeOptions = useMemo(
    () => [
      { value: String(AIAgentFallbackMode.NoAnswer), label: "直接说明知识不足" },
      { value: String(AIAgentFallbackMode.SuggestRetry), label: "引导用户补充信息" },
    ],
    []
  )
  const aiConfigOptions = useMemo(
    () => aiConfigs.map((item) => ({ value: String(item.id), label: `${item.name} · ${item.modelName}` })),
    [aiConfigs]
  )
  const knowledgeOptions = useMemo(
    () => knowledgeBases.map((item) => ({ value: String(item.id), label: item.name })),
    [knowledgeBases]
  )
  const teamOptions = useMemo(
    () => agentTeams.map((item) => ({ value: String(item.id), label: item.name })),
    [agentTeams]
  )
  const skillOptions = useMemo(
    () => skills.map((item) => ({ value: String(item.id), label: item.name })),
    [skills]
  )
  const directToolOptions = useMemo<DirectToolOption[]>(
    () =>
      toolCatalog
        .filter((tool) => !tool.autoInjected && tool.sourceType === "mcp")
        .map((tool) => ({
          value: tool.toolCode,
          label: `${tool.title || tool.toolName} · ${tool.toolCode}`,
          sourceType: tool.sourceType,
          groupLabel: tool.sourceType === "builtin" ? "内置工具" : tool.serverCode,
          meta: {
            toolCode: tool.toolCode,
            serverCode: tool.serverCode,
            toolName: tool.toolName,
            title: tool.title || tool.toolName,
            description: tool.description || "",
            arguments: undefined,
          },
        })),
    [toolCatalog]
  )
  const directToolGroupOptions = useMemo(
    () =>
      Array.from(
        new Map(
          directToolOptions.map((option) => [
            option.groupLabel,
            { value: option.groupLabel, label: option.groupLabel },
          ])
        ).values()
      ),
    [directToolOptions]
  )
  const addableDirectToolOptions = useMemo(
    () =>
      directToolOptions.filter(
        (option) =>
          option.groupLabel === directToolGroupToAdd &&
          !directTools.some((tool) => tool.toolCode === option.value)
      ),
    [directToolGroupToAdd, directToolOptions, directTools]
  )

  function selectedOptions(ids: number[], options: { value: string; label: string }[]) {
    return ids
      .map((id) => options.find((option) => Number(option.value) === id))
      .filter((option): option is { value: string; label: string } => !!option)
  }

  function addSelected(value: string, current: number[], setNext: (ids: number[]) => void) {
    const id = Number(value)
    if (!Number.isFinite(id) || id <= 0 || current.includes(id)) return
    setNext([...current, id])
  }

  function moveKnowledge(index: number, direction: -1 | 1) {
    const targetIndex = index + direction
    if (targetIndex < 0 || targetIndex >= selectedKnowledgeIds.length) return
    const next = [...selectedKnowledgeIds]
    const current = next[index]
    next[index] = next[targetIndex]
    next[targetIndex] = current
    setSelectedKnowledgeIds(next)
  }

  function addDirectTool(value: string) {
    const option = directToolOptions.find((item) => item.value === value)
    if (!option) return
    setDirectTools((current) =>
      current.some((tool) => tool.toolCode === option.meta.toolCode)
        ? current
        : [...current, option.meta]
    )
    setDirectToolToAdd("")
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
      teamIds: uniqueNumbers(selectedTeamIds),
      handoffMode: Number(handoffMode),
      fallbackMode: Number(fallbackMode),
      fallbackMessage: fallbackMessage.trim(),
      knowledgeIds: uniqueNumbers(selectedKnowledgeIds),
      skillIds: uniqueNumbers(selectedSkillIds),
      directTools,
    }
  }

  async function saveAgentSettings() {
    setSavingAgent(true)
    try {
      const payload = buildPayload()
      if (agent) {
        await updateAIAgent({ id: agent.id, ...payload })
        toast.success("Agent config saved")
        await loadData()
      } else {
        const created = await createAIAgent(payload)
        setCurrentAgentId(created.id)
        setAgent(created)
        toast.success("Agent created")
        onAgentCreated?.(created)
      }
      onAgentSaved?.()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save Agent config")
    } finally {
      setSavingAgent(false)
    }
  }

  async function saveWorkflowDraft() {
    if (!currentAgentId) return
    setSavingWorkflow(true)
    try {
      await saveAIAgentWorkflow({
        agentId: currentAgentId,
        name: "",
        description: "",
        definition,
      })
      toast.success("Workflow draft saved")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save workflow draft")
    } finally {
      setSavingWorkflow(false)
    }
  }

  async function validateWorkflowDraft() {
    setSavingWorkflow(true)
    try {
      const result = await validateAIWorkflow(definition)
      toast[result.valid ? "success" : "error"](
        result.valid ? "Workflow is valid" : "Workflow has validation errors"
      )
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to validate workflow")
    } finally {
      setSavingWorkflow(false)
    }
  }

  async function restoreDefaultWorkflow() {
    if (savingWorkflow || loading) return
    setSavingWorkflow(true)
    try {
      const defaultDefinition = await fetchAIWorkflowDefaultDefinition()
      replaceWorkflowDefinition(defaultDefinition ?? fallbackDefinition)
      toast.success("已恢复默认流程，保存草稿或发布后生效")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "恢复默认流程失败")
    } finally {
      setSavingWorkflow(false)
    }
  }

  async function publishWorkflow() {
    if (!currentAgentId) return
    setSavingWorkflow(true)
    try {
      const saved = await saveAIAgentWorkflow({
        agentId: currentAgentId,
        name: "",
        description: "",
        definition,
      })
      const version = await publishAIAgentWorkflow(currentAgentId, definition)
      toast.success(`Published version ${version.version}`)
      setAgent((current) =>
        current ? { ...current, workflowVersionId: version.id } : current
      )
      if (saved.id > 0) {
        const versionPage = await fetchAIWorkflowVersions({
          workflowId: saved.id,
          limit: 20,
        })
        setWorkflowVersions(versionPage.results ?? [])
      } else {
        setWorkflowVersions((current) =>
          current.some((item) => item.id === version.id) ? current : [version, ...current]
        )
      }
      onAgentSaved?.()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to publish workflow")
    } finally {
      setSavingWorkflow(false)
    }
  }

  const sections: { key: SectionKey; title: string; icon: ReactNode }[] = [
    { key: "basic", title: "基础信息", icon: <SettingsIcon /> },
    { key: "capabilities", title: "能力来源", icon: <PlugIcon /> },
    { key: "workflow", title: "会话流程", icon: <GitBranchIcon /> },
  ]

  const selectedKnowledgeOptions = selectedOptions(selectedKnowledgeIds, knowledgeOptions)
  const selectedTeamOptions = selectedOptions(selectedTeamIds, teamOptions)
  const selectedSkillOptions = selectedOptions(selectedSkillIds, skillOptions)
  const workflowPublished = isWorkflowPublished(agent)
  const workflowStateText =
    agent?.workflowStateText || (workflowPublished ? "已发布" : "未发布")

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background">
      <div className="flex shrink-0 items-center justify-between gap-4 border-b px-5 py-2 pr-28">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex size-8 items-center justify-center rounded-md bg-muted text-muted-foreground">
            <BotMessageSquareIcon className="size-4" />
          </div>
          <div className="flex min-w-0 items-center gap-2">
            <h1 className="truncate text-base font-semibold">{agent?.name ?? "新建 AI Agent"}</h1>
            {agent?.statusName ? <Badge variant="secondary">{agent.statusName}</Badge> : null}
            <Badge variant={workflowPublished ? "default" : "outline"}>
              {workflowStateText}
            </Badge>
            {workflowPublished ? (
              <Badge variant="secondary">当前生效 #{agent?.workflowVersionId}</Badge>
            ) : null}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {activeSection === "workflow" ? (
            null
          ) : (
            <>
              <Button
                type="button"
                variant="outline"
                disabled={savingAgent || loading}
                onClick={saveAgentSettings}
              >
                <SaveIcon className="size-4" />
                保存配置
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col bg-background">
        {agent && !workflowPublished ? (
          <div className="shrink-0 border-b border-amber-200 bg-amber-50 px-5 py-2 text-sm text-amber-900">
            未发布流程，AI 不会自动回复。保存配置后请进入“会话流程”发布一个版本，再绑定渠道或启用自动回复。
          </div>
        ) : null}
        <div className="shrink-0 border-b bg-muted/30 px-4 py-2">
          <div className="flex min-w-0 items-center gap-1 overflow-x-auto overflow-y-hidden">
            {sections.map((section) => (
              <button
                key={section.key}
                type="button"
                onClick={() => setActiveSection(section.key)}
                className={`group flex h-8 shrink-0 items-center gap-2 rounded-md border px-2.5 text-sm shadow-xs transition-all ${
                  activeSection === section.key
                    ? "border-primary bg-primary font-medium text-primary-foreground shadow-xs"
                    : "border-border/70 bg-background text-foreground hover:border-primary/40 hover:bg-primary/5 hover:text-primary hover:shadow-sm"
                }`}
              >
                <span
                  className={`flex size-5 shrink-0 items-center justify-center rounded-sm transition-colors ${
                    activeSection === section.key
                      ? "bg-primary-foreground/15 text-primary-foreground"
                      : "bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary"
                  }`}
                >
                  {section.icon}
                </span>
                <span className="whitespace-nowrap leading-none">{section.title}</span>
              </button>
            ))}
          </div>
        </div>

        <main className="min-h-0 flex-1 overflow-y-auto bg-background">
          {loading ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              加载中...
            </div>
          ) : (
            <div className={activeSection === "workflow" ? "h-full min-h-0" : "w-full space-y-6 p-6"}>
              {activeSection === "basic" ? (
                <ConfigSection>
                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <FieldBlock label="名称">
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
                  </div>
                </ConfigSection>
              ) : null}

              {activeSection === "basic" ? (
                <ConfigSection>
                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <FieldBlock label="AI 配置">
                      <OptionCombobox
                        value={aiConfigId}
                        options={aiConfigOptions}
                        placeholder="选择 AI 配置"
                        searchPlaceholder="搜索 AI 配置"
                        emptyText="没有可用 AI 配置"
                        onChange={setAIConfigId}
                      />
                    </FieldBlock>
                    <FieldBlock label="回复超时秒数">
                      <Input
                        type="number"
                        min={0}
                        step={1}
                        value={replyTimeoutSeconds}
                        onChange={(event) => setReplyTimeoutSeconds(event.target.value)}
                      />
                    </FieldBlock>
                  </div>
                  <FieldBlock label="系统提示词">
                    <ContentEditor
                      value={{ mode: "markdown", raw: systemPrompt }}
                      allowedModes={["markdown"]}
                      height={360}
                      onChange={(next) => setSystemPrompt(next.raw)}
                    />
                  </FieldBlock>
                  <FieldBlock label="欢迎语">
                    <Textarea rows={5} value={welcomeMessage} onChange={(event) => setWelcomeMessage(event.target.value)} />
                  </FieldBlock>
                </ConfigSection>
              ) : null}

              {activeSection === "basic" ? (
                <ConfigSection>
                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <FieldBlock label="转人工执行方式">
                      <OptionCombobox value={handoffMode} options={handoffModeOptions} placeholder="选择转人工执行方式" onChange={setHandoffMode} />
                    </FieldBlock>
                    <FieldBlock label="知识不足回复策略">
                      <OptionCombobox value={fallbackMode} options={fallbackModeOptions} placeholder="选择知识不足回复策略" onChange={setFallbackMode} />
                    </FieldBlock>
                  </div>
                  <AddRow
                    value={teamToAdd}
                    options={teamOptions.filter((option) => !selectedTeamIds.includes(Number(option.value)))}
                    placeholder="选择客服组"
                    onValueChange={setTeamToAdd}
                    onAdd={() => {
                      addSelected(teamToAdd, selectedTeamIds, setSelectedTeamIds)
                      setTeamToAdd("")
                    }}
                  />
                  <BadgeList
                    empty="未配置客服组。"
                    items={selectedTeamOptions}
                    onRemove={(id) => setSelectedTeamIds((current) => current.filter((item) => item !== id))}
                  />
                  <FieldBlock label="知识不足回复文案">
                    <Textarea rows={5} value={fallbackMessage} onChange={(event) => setFallbackMessage(event.target.value)} />
                  </FieldBlock>
                  <FieldBlock label="描述">
                    <Textarea rows={4} value={description} onChange={(event) => setDescription(event.target.value)} />
                  </FieldBlock>
                </ConfigSection>
              ) : null}

              {activeSection === "capabilities" ? (
                <ConfigSection>
                  <AddRow
                    value={knowledgeToAdd}
                    options={knowledgeOptions.filter((option) => !selectedKnowledgeIds.includes(Number(option.value)))}
                    placeholder="选择知识库"
                    onValueChange={setKnowledgeToAdd}
                    onAdd={() => {
                      addSelected(knowledgeToAdd, selectedKnowledgeIds, setSelectedKnowledgeIds)
                      setKnowledgeToAdd("")
                    }}
                  />
                  <div className="space-y-2 rounded-md border p-3">
                    {selectedKnowledgeOptions.length === 0 ? (
                      <div className="text-sm text-muted-foreground">至少选择一个知识库。</div>
                    ) : (
                      selectedKnowledgeOptions.map((option, index) => (
                        <div key={option.value} className="flex items-center gap-2">
                          <Badge variant="secondary" className="min-w-8 justify-center">{index + 1}</Badge>
                          <div className="flex-1 text-sm">{option.label}</div>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon-sm"
                            disabled={index === 0}
                            onClick={() => moveKnowledge(index, -1)}
                          >
                            <ArrowUpIcon />
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon-sm"
                            disabled={index === selectedKnowledgeOptions.length - 1}
                            onClick={() => moveKnowledge(index, 1)}
                          >
                            <ArrowDownIcon />
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon-sm"
                            onClick={() => setSelectedKnowledgeIds((current) => current.filter((id) => id !== Number(option.value)))}
                          >
                            <Trash2Icon />
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                </ConfigSection>
              ) : null}

              {activeSection === "capabilities" ? (
                <ConfigSection>
                  <AddRow
                    value={skillToAdd}
                    options={skillOptions.filter((option) => !selectedSkillIds.includes(Number(option.value)))}
                    placeholder="选择 Skill"
                    onValueChange={setSkillToAdd}
                    onAdd={() => {
                      addSelected(skillToAdd, selectedSkillIds, setSelectedSkillIds)
                      setSkillToAdd("")
                    }}
                  />
                  <BadgeList
                    empty="未配置 Skill。"
                    items={selectedSkillOptions}
                    onRemove={(id) => setSelectedSkillIds((current) => current.filter((item) => item !== id))}
                  />
                </ConfigSection>
              ) : null}

              {activeSection === "capabilities" ? (
                <ConfigSection>
                  <div className="grid grid-cols-1 gap-3 lg:grid-cols-[220px_minmax(0,1fr)_auto]">
                    <OptionCombobox
                      value={directToolGroupToAdd}
                      options={directToolGroupOptions}
                      placeholder="选择工具分组"
                      onChange={(value) => {
                        setDirectToolGroupToAdd(value)
                        setDirectToolToAdd("")
                      }}
                    />
                    <OptionCombobox
                      value={directToolToAdd}
                      options={addableDirectToolOptions}
                      placeholder="选择 Direct Tool"
                      onChange={(value) => {
                        setDirectToolToAdd(value)
                        addDirectTool(value)
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      disabled={!directToolToAdd}
                      onClick={() => addDirectTool(directToolToAdd)}
                    >
                      添加
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {directTools.length === 0 ? (
                      <div className="text-sm text-muted-foreground">未配置 Direct Tool。</div>
                    ) : (
                      directTools.map((tool) => (
                        <Badge key={tool.toolCode} variant="secondary" className="gap-1 pr-1">
                          {tool.title || tool.toolCode}
                          <span className="text-[10px] text-muted-foreground/80">{tool.serverCode || "MCP"}</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-5"
                            onClick={() => setDirectTools((current) => current.filter((item) => item.toolCode !== tool.toolCode))}
                          >
                            <Trash2Icon className="size-3" />
                          </Button>
                        </Badge>
                      ))
                    )}
                  </div>
                </ConfigSection>
              ) : null}

              {activeSection === "workflow" ? (
                <WorkflowEditor
                  key={workflowEditorKey}
                  definition={definition}
                  nodeSpecs={nodeSpecs}
                  onDefinitionChange={setDefinition}
                  onRestoreDefault={restoreDefaultWorkflow}
                  restoreDefaultDisabled={savingWorkflow || loading}
                  onValidate={validateWorkflowDraft}
                  validateDisabled={savingWorkflow || loading || !currentAgentId}
                  onSaveDraft={saveWorkflowDraft}
                  saveDraftDisabled={savingWorkflow || loading || !currentAgentId}
                  onPublish={publishWorkflow}
                  publishDisabled={savingWorkflow || loading || !currentAgentId}
                  toolbarExtra={
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 rounded-none px-2 text-xs text-muted-foreground hover:text-foreground"
                      onClick={() => setVersionDialogOpen(true)}
                    >
                      <HistoryIcon className="size-3.5" />
                      版本记录
                    </Button>
                  }
                />
              ) : null}

              <Dialog open={versionDialogOpen} onOpenChange={setVersionDialogOpen}>
                <DialogContent className="max-h-[80vh] overflow-hidden sm:max-w-4xl">
                  <DialogHeader>
                    <DialogTitle>版本记录</DialogTitle>
                  </DialogHeader>
                  <VersionRecordsTable
                    agent={agent}
                    workflowVersions={workflowVersions}
                  />
                </DialogContent>
              </Dialog>

            </div>
          )}
        </main>
      </div>
    </div>
  )
}

function ConfigSection({
  children,
}: {
  children: ReactNode
}) {
  return (
    <section className="space-y-5">
      <div className="space-y-4">{children}</div>
    </section>
  )
}

function FieldBlock({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  )
}

function AddRow({
  value,
  options,
  placeholder,
  onValueChange,
  onAdd,
}: {
  value: string
  options: { value: string; label: string }[]
  placeholder: string
  onValueChange: (value: string) => void
  onAdd: () => void
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1">
        <OptionCombobox value={value} options={options} placeholder={placeholder} onChange={onValueChange} />
      </div>
      <Button type="button" variant="outline" disabled={!value} onClick={onAdd}>
        添加
      </Button>
    </div>
  )
}

function VersionRecordsTable({
  agent,
  workflowVersions,
}: {
  agent: AIAgent | null
  workflowVersions: AIWorkflowVersion[]
}) {
  return (
    <div className="max-h-[60vh] overflow-auto rounded-md border">
      {workflowVersions.length > 0 ? (
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow>
              <TableHead className="w-28">版本</TableHead>
              <TableHead>发布时间</TableHead>
              <TableHead>发布人</TableHead>
              <TableHead>状态</TableHead>
              <TableHead className="text-right">定义指纹</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {workflowVersions.map((version) => (
              <TableRow key={version.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">v{version.version}</span>
                    {agent?.workflowVersionId === version.id ? (
                      <Badge variant="secondary">当前生效</Badge>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {version.publishedAt || version.createdAt || "-"}
                </TableCell>
                <TableCell>{version.publishedByName || "-"}</TableCell>
                <TableCell>
                  <Badge variant={version.status === Status.Ok ? "outline" : "secondary"}>
                    {version.status === Status.Ok ? "启用" : "禁用"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right font-mono text-xs text-muted-foreground">
                  {version.definitionHash ? version.definitionHash.slice(0, 8) : "-"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <div className="p-4 text-sm text-muted-foreground">暂无已发布版本。</div>
      )}
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
          <Button type="button" variant="ghost" size="icon" className="size-5" onClick={() => onRemove(Number(item.value))}>
            <Trash2Icon className="size-3" />
          </Button>
        </Badge>
      ))}
    </div>
  )
}
