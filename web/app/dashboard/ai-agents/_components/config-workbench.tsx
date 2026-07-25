"use client"

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react"
import {
  BotMessageSquareIcon,
  GitBranchIcon,
  HistoryIcon,
  PlugIcon,
	RotateCcwIcon,
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
	fetchAIAgentRevisions,
  fetchAIConfigsAll,
	fetchKnowledgeBasesAll,
  fetchAIWorkflowDefaultDefinition,
  fetchAIWorkflowNodeSpecs,
	fetchAIWorkflowTemplates,
  fetchAIWorkflowVersions,
	fetchAIWorkflows,
  fetchAgentTeamsAll,
  fetchMCPCatalog,
  fetchSkillDefinitionsAll,
	publishAIAgent,
	rollbackAIAgent,
	rollbackAIAgentRollout,
  updateAIAgent,
  validateAIWorkflow,
  type AIAgent,
	type AIAgentWorkflowBindingInput,
	type AgentRevision,
  type AIConfig,
  type AIWorkflowDefinition,
	type AIWorkflow,
  type AIWorkflowNodeSpec,
	type AIWorkflowTemplate,
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
  schemaVersion: 2,
  nodes: [
    {
      id: "start_1",
      type: "start",
      meta: { position: { x: 0, y: 80 } },
      data: { title: "开始", config: {}, inputsValues: {} },
    },
    {
      id: "end_1",
      type: "end",
      meta: { position: { x: 260, y: 80 } },
      data: { title: "结束", config: {}, inputsValues: {} },
    },
  ],
  edges: [{ sourceNodeID: "start_1", targetNodeID: "end_1", sourcePortID: "edge_start_end" }],
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
	const [agentRevisions, setAgentRevisions] = useState<AgentRevision[]>([])
  const [nodeSpecs, setNodeSpecs] = useState<AIWorkflowNodeSpec[]>([])
  const [loading, setLoading] = useState(true)
  const [savingAgent, setSavingAgent] = useState(false)
  const [savingWorkflow, setSavingWorkflow] = useState(false)
  const [versionDialogOpen, setVersionDialogOpen] = useState(false)

  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [aiConfigId, setAIConfigId] = useState("")
	const [runtimeMode, setRuntimeMode] = useState<"workflow" | "autonomous" | "hybrid">("autonomous")
  const [serviceMode, setServiceMode] = useState(String(IMConversationServiceMode.AIFirst))
  const [systemPrompt, setSystemPrompt] = useState("")
  const [welcomeMessage, setWelcomeMessage] = useState("")
  const [replyTimeoutSeconds, setReplyTimeoutSeconds] = useState("180")
	const [rolloutPercent, setRolloutPercent] = useState("5")
  const [handoffMode, setHandoffMode] = useState(String(AIAgentHandoffMode.WaitPool))
  const [fallbackMode, setFallbackMode] = useState(String(AIAgentFallbackMode.NoAnswer))
  const [fallbackMessage, setFallbackMessage] = useState("")
  const [selectedTeamIds, setSelectedTeamIds] = useState<number[]>([])
  const [selectedSkillIds, setSelectedSkillIds] = useState<number[]>([])
	const [selectedKnowledgeBaseIds, setSelectedKnowledgeBaseIds] = useState<number[]>([])
  const [directTools, setDirectTools] = useState<DirectToolItem[]>([])
	const [workflowBindings, setWorkflowBindings] = useState<AIAgentWorkflowBindingInput[]>([])
	const [publishedWorkflows, setPublishedWorkflows] = useState<AIWorkflow[]>([])
	const [workflowToAdd, setWorkflowToAdd] = useState("")

  const [definition, setDefinition] = useState<AIWorkflowDefinition>(fallbackDefinition)
  const [workflowRevision, setWorkflowRevision] = useState(0)
	const [workflowTemplates, setWorkflowTemplates] = useState<AIWorkflowTemplate[]>([])
	const [selectedWorkflowTemplate, setSelectedWorkflowTemplate] = useState("")

  const [aiConfigs, setAIConfigs] = useState<AIConfig[]>([])
  const [agentTeams, setAgentTeams] = useState<AdminAgentTeam[]>([])
  const [skills, setSkills] = useState<SkillDefinition[]>([])
	const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([])
  const [toolCatalog, setToolCatalog] = useState<MCPToolCatalogItem[]>([])
  const [teamToAdd, setTeamToAdd] = useState("")
  const [skillToAdd, setSkillToAdd] = useState("")
	const [knowledgeBaseToAdd, setKnowledgeBaseToAdd] = useState("")
  const [directToolGroupToAdd, setDirectToolGroupToAdd] = useState("")
  const [directToolToAdd, setDirectToolToAdd] = useState("")
	const previousRolloutPercent = agent?.previousRolloutPercent ?? 0

  useEffect(() => {
    setCurrentAgentId(agentId ?? null)
  }, [agentId])

  const replaceWorkflowDefinition = useCallback((nextDefinition: AIWorkflowDefinition) => {
    setDefinition(nextDefinition)
    setWorkflowRevision((current) => current + 1)
  }, [])

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [
        specs,
        defaultDefinition,
		templates,
        configs,
        teams,
        skillList,
		knowledgeBaseList,
        catalog,
		workflowPage,
      ] = await Promise.all([
        fetchAIWorkflowNodeSpecs(),
        fetchAIWorkflowDefaultDefinition().catch(() => fallbackDefinition),
		fetchAIWorkflowTemplates(),
        fetchAIConfigsAll({ modelType: AIModelType.LLM }),
        fetchAgentTeamsAll(),
        fetchSkillDefinitionsAll({ status: Status.Ok }),
		fetchKnowledgeBasesAll({ status: Status.Ok }),
        fetchMCPCatalog(),
		fetchAIWorkflows({ limit: 100 }),
      ])

      setNodeSpecs(specs ?? [])
		setWorkflowTemplates(templates ?? [])
      setAIConfigs(configs ?? [])
      setAgentTeams(teams ?? [])
      setSkills(skillList ?? [])
		setKnowledgeBases(knowledgeBaseList ?? [])
      setToolCatalog(catalog ?? [])
		setPublishedWorkflows((workflowPage.results ?? []).filter((item) => item.publishedVersionId > 0))

      if (!currentAgentId || currentAgentId <= 0) {
        setAgent(null)
        setWorkflowVersions([])
		setAgentRevisions([])
        setName("")
        setDescription("")
		setAIConfigId("")
		setRuntimeMode("autonomous")
        setServiceMode(String(IMConversationServiceMode.AIFirst))
        setSystemPrompt("")
        setWelcomeMessage("")
        setReplyTimeoutSeconds("180")
		setRolloutPercent("5")
        setHandoffMode(String(AIAgentHandoffMode.WaitPool))
        setFallbackMode(String(AIAgentFallbackMode.NoAnswer))
        setFallbackMessage("")
        setSelectedTeamIds([])
        setSelectedSkillIds([])
		setSelectedKnowledgeBaseIds([])
        setDirectTools([])
		setWorkflowBindings([])
        replaceWorkflowDefinition(defaultDefinition ?? fallbackDefinition)
        return
      }

		const [agentDetail, revisionList] = await Promise.all([
        fetchAIAgent(currentAgentId),
		fetchAIAgentRevisions(currentAgentId),
      ])

      setAgent(agentDetail)
		setAgentRevisions(revisionList ?? [])
		setWorkflowVersions([])
      setName(agentDetail.name)
      setDescription(agentDetail.description || "")
		setAIConfigId(toText(agentDetail.aiConfigId))
		setRuntimeMode(agentDetail.runtimeMode === "autonomous" || agentDetail.runtimeMode === "hybrid" ? agentDetail.runtimeMode : "workflow")
      setServiceMode(String(agentDetail.serviceMode || IMConversationServiceMode.AIFirst))
      setSystemPrompt(agentDetail.systemPrompt || "")
      setWelcomeMessage(agentDetail.welcomeMessage || "")
      setReplyTimeoutSeconds(String(agentDetail.replyTimeoutSeconds ?? 180))
		setRolloutPercent(String(agentDetail.rolloutPercent || 100))
      setHandoffMode(String(agentDetail.handoffMode || AIAgentHandoffMode.WaitPool))
      setFallbackMode(String(agentDetail.fallbackMode || AIAgentFallbackMode.NoAnswer))
      setFallbackMessage(agentDetail.fallbackMessage || "")
      setSelectedTeamIds((agentDetail.teams ?? []).map((team) => team.id))
      setSelectedSkillIds(agentDetail.skillIds ?? [])
		setSelectedKnowledgeBaseIds(agentDetail.knowledgeBaseIds ?? [])
      setDirectTools(agentDetail.directTools ?? [])
		setWorkflowBindings((agentDetail.workflowBindings ?? []).map(({ workflowVersionId, toolName, triggerInstruction, priority, enabled }) => ({ workflowVersionId, toolName, triggerInstruction, priority, enabled })))
		replaceWorkflowDefinition(defaultDefinition ?? fallbackDefinition)
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
	const runtimeModeOptions = useMemo(
		() => [
			{ value: "autonomous", label: "自主接待" },
			{ value: "hybrid", label: "自主接待 + 工作流" },
			{ value: "workflow", label: "仅工作流" },
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
			{ value: String(AIAgentFallbackMode.Handoff), label: "转人工客服" },
    ],
    []
  )
  const aiConfigOptions = useMemo(
    () => aiConfigs.map((item) => ({ value: String(item.id), label: `${item.name} · ${item.modelName}` })),
    [aiConfigs]
  )
  const teamOptions = useMemo(
    () => agentTeams.map((item) => ({ value: String(item.id), label: item.name })),
    [agentTeams]
  )
  const skillOptions = useMemo(
    () => skills.map((item) => ({ value: String(item.id), label: item.name })),
    [skills]
  )
	const knowledgeBaseOptions = useMemo(
		() => knowledgeBases.map((item) => ({ value: String(item.id), label: item.name })),
		[knowledgeBases]
	)
  const directToolOptions = useMemo<DirectToolOption[]>(
    () =>
      toolCatalog
        .filter(
          (tool) =>
            !tool.autoInjected &&
            (tool.sourceType === "mcp" || tool.toolCode === "builtin/conversation_context" || tool.toolCode === "graph/prepare_ticket_draft")
        )
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

	function addWorkflowBinding(value: string) {
		const workflow = publishedWorkflows.find((item) => item.publishedVersionId === Number(value))
		if (!workflow || workflowBindings.some((item) => item.workflowVersionId === workflow.publishedVersionId)) return
		setWorkflowBindings((current) => [...current, { workflowVersionId: workflow.publishedVersionId, toolName: workflow.name, triggerInstruction: "", priority: current.length + 1, enabled: true }])
		setWorkflowToAdd("")
	}

  function buildPayload(): CreateAIAgentPayload {
    return {
      name: name.trim(),
      description: description.trim(),
      aiConfigId: Number(aiConfigId),
		runtimeMode,
      serviceMode: Number(serviceMode),
      systemPrompt: systemPrompt.trim(),
      welcomeMessage: welcomeMessage.trim(),
      replyTimeoutSeconds: Number(replyTimeoutSeconds),
		rolloutPercent: Number(rolloutPercent),
      teamIds: uniqueNumbers(selectedTeamIds),
      handoffMode: Number(handoffMode),
      fallbackMode: Number(fallbackMode),
      fallbackMessage: fallbackMessage.trim(),
		knowledgeBaseIds: uniqueNumbers(selectedKnowledgeBaseIds),
      skillIds: uniqueNumbers(selectedSkillIds),
		directTools,
		workflowBindings,
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

  async function publishAutonomousAgent() {
		if (!agent || (runtimeMode !== "autonomous" && runtimeMode !== "hybrid")) return
		setSavingAgent(true)
		try {
			await publishAIAgent(agent.id)
			await loadData()
			toast.success("Agent published")
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Failed to publish Autonomous Agent")
		} finally {
			setSavingAgent(false)
		}
	}

	async function rollbackAgentRevision(revisionId: number) {
		if (!agent || revisionId <= 0 || revisionId === agent.publishedRevisionId) return
		setSavingAgent(true)
		try {
			await rollbackAIAgent(agent.id, revisionId)
			toast.success("已回滚到选中的 Agent 版本")
			await loadData()
			onAgentSaved?.()
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "回滚 Agent 版本失败")
		} finally {
			setSavingAgent(false)
		}
	}

	async function rollbackAgentRollout() {
		if (!agent || agent.previousRolloutPercent < 1) return
		setSavingAgent(true)
		try {
			await rollbackAIAgentRollout(agent.id)
			toast.success("已恢复上一次灰度比例")
			await loadData()
			onAgentSaved?.()
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "恢复灰度比例失败")
		} finally {
			setSavingAgent(false)
		}
	}

  const sections: { key: SectionKey; title: string; icon: ReactNode }[] = [
    { key: "basic", title: "基础信息", icon: <SettingsIcon /> },
    { key: "capabilities", title: "能力来源", icon: <PlugIcon /> },
	{ key: "workflow", title: "关联工作流", icon: <GitBranchIcon /> },
  ]

  const selectedTeamOptions = selectedOptions(selectedTeamIds, teamOptions)
  const selectedSkillOptions = selectedOptions(selectedSkillIds, skillOptions)
  const workflowPublished = isWorkflowPublished(agent)
	const autonomousPublished = runtimeMode === "autonomous" && (agent?.publishedRevisionId ?? 0) > 0
	const hybridPublished = runtimeMode === "hybrid" && workflowPublished && (agent?.publishedRevisionId ?? 0) > 0
	const runtimePublished = runtimeMode === "workflow" ? workflowPublished : runtimeMode === "hybrid" ? hybridPublished : autonomousPublished
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
            <Badge variant={runtimePublished ? "default" : "outline"}>
	              {runtimeMode === "autonomous" ? (autonomousPublished ? "已发布" : "未发布") : runtimeMode === "hybrid" ? (hybridPublished ? "已发布" : "未发布") : workflowStateText}
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
				  {agent && (runtimeMode === "autonomous" || runtimeMode === "hybrid") ? <Button type="button" variant="outline" disabled={savingAgent || loading} onClick={publishAutonomousAgent}>发布 Agent</Button> : null}
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
        {agent && !runtimePublished ? (
          <div className="shrink-0 border-b border-amber-200 bg-amber-50 px-5 py-2 text-sm text-amber-900">
			{runtimeMode === "autonomous" ? "未发布 Agent，AI 不会自动回复。保存配置后发布 Agent，再绑定渠道或启用自动回复。" : runtimeMode === "hybrid" ? "未发布 Hybrid Agent，AI 不会自动回复。保存配置后请关联已发布工作流，再发布 Agent。" : "未发布工作流，AI 不会自动回复。请先关联一个已发布工作流。"}
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

        <main
          className={`min-h-0 flex-1 bg-background ${
            activeSection === "workflow" ? "overflow-hidden" : "overflow-y-auto"
          }`}
        >
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
					<FieldBlock label="运行模式">
					  <OptionCombobox value={runtimeMode} options={runtimeModeOptions} placeholder="选择运行模式" onChange={(value) => setRuntimeMode(value === "autonomous" || value === "hybrid" ? value : "workflow")} />
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
					<FieldBlock label="会话灰度比例（%）">
					  <div className="flex items-center gap-2">
						<Input type="number" min={1} max={100} step={1} value={rolloutPercent} onChange={(event) => setRolloutPercent(event.target.value)} />
						{previousRolloutPercent > 0 ? (
						  <Button type="button" variant="outline" size="sm" disabled={savingAgent} onClick={rollbackAgentRollout}>
							<RotateCcwIcon />
							恢复 {previousRolloutPercent}%
						  </Button>
						) : null}
					  </div>
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
				  <div className="text-sm font-medium">知识库</div>
				  <AddRow
					value={knowledgeBaseToAdd}
					options={knowledgeBaseOptions.filter((option) => !selectedKnowledgeBaseIds.includes(Number(option.value)))}
					placeholder="选择知识库"
					onValueChange={setKnowledgeBaseToAdd}
					onAdd={() => {
					  addSelected(knowledgeBaseToAdd, selectedKnowledgeBaseIds, setSelectedKnowledgeBaseIds)
					  setKnowledgeBaseToAdd("")
					}}
				  />
				  <BadgeList empty="未配置知识库。" items={selectedOptions(selectedKnowledgeBaseIds, knowledgeBaseOptions)} onRemove={(id) => setSelectedKnowledgeBaseIds((current) => current.filter((item) => item !== id))} />
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
                <ConfigSection>
                  <div className="flex items-start justify-between gap-4">
                    <div><h2 className="text-base font-semibold">关联工作流</h2><p className="mt-1 text-sm text-muted-foreground">仅可关联已发布版本。工作流内容在“工作流”中心独立维护，保存 Agent 草稿后才会更新关联。</p></div>
                    <Button type="button" variant="outline" onClick={() => window.location.assign("/dashboard/ai-workflows")}>管理工作流</Button>
                  </div>
                  <div className="flex max-w-xl items-center gap-2">
                    <OptionCombobox value={workflowToAdd} options={publishedWorkflows.filter((item) => !workflowBindings.some((binding) => binding.workflowVersionId === item.publishedVersionId)).map((item) => ({ value: String(item.publishedVersionId), label: `${item.name} · v#${item.publishedVersionId}` }))} placeholder="选择已发布工作流" onChange={setWorkflowToAdd} />
                    <Button type="button" variant="outline" disabled={!workflowToAdd} onClick={() => addWorkflowBinding(workflowToAdd)}>关联</Button>
                  </div>
                  <div className="space-y-2">
                    {workflowBindings.length === 0 ? <div className="rounded-md border border-dashed p-5 text-sm text-muted-foreground">尚未关联工作流。自主接待无需配置；Hybrid 至少需要关联一个已发布工作流。</div> : workflowBindings.map((binding) => {
                      const workflow = publishedWorkflows.find((item) => item.publishedVersionId === binding.workflowVersionId)
                      return <div key={binding.workflowVersionId} className="flex items-center gap-3 rounded-md border p-3"><GitBranchIcon className="size-4 text-muted-foreground" /><div className="min-w-0 flex-1"><div className="font-medium">{workflow?.name || binding.toolName || `工作流版本 #${binding.workflowVersionId}`}</div><div className="text-xs text-muted-foreground">固定版本 #{binding.workflowVersionId}</div></div><Button type="button" variant="ghost" size="sm" onClick={() => setWorkflowBindings((current) => current.filter((item) => item.workflowVersionId !== binding.workflowVersionId))}>移除</Button></div>
                    })}
                  </div>
				  <div className="flex justify-end gap-2"><Button type="button" disabled={savingAgent || loading} onClick={saveAgentSettings}>保存 Agent 配置</Button>{agent && runtimeMode === "hybrid" ? <Button type="button" disabled={savingAgent || loading} onClick={publishAutonomousAgent}>发布 Agent</Button> : null}</div>
                </ConfigSection>
              ) : null}

              <Dialog open={versionDialogOpen} onOpenChange={setVersionDialogOpen}>
                <DialogContent className="max-h-[80vh] overflow-hidden sm:max-w-4xl">
                  <DialogHeader>
                    <DialogTitle>版本记录</DialogTitle>
                  </DialogHeader>
                  <VersionRecordsTable
                    agent={agent}
                    workflowVersions={workflowVersions}
					agentRevisions={agentRevisions}
					onRollback={rollbackAgentRevision}
					rollbackDisabled={savingAgent || loading}
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
	agentRevisions,
	onRollback,
	rollbackDisabled,
}: {
  agent: AIAgent | null
  workflowVersions: AIWorkflowVersion[]
	agentRevisions: AgentRevision[]
	onRollback: (revisionId: number) => void
	rollbackDisabled: boolean
}) {
  return (
		<div className="max-h-[60vh] space-y-4 overflow-auto">
			<div className="rounded-md border">
				<div className="border-b px-3 py-2 text-sm font-medium">Agent 版本</div>
				{agentRevisions.length > 0 ? (
					<Table>
						<TableHeader className="bg-muted/40">
							<TableRow>
								<TableHead className="w-28">版本</TableHead>
								<TableHead>发布时间</TableHead>
								<TableHead>发布人</TableHead>
								<TableHead>关联流程</TableHead>
								<TableHead className="text-right">操作</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{agentRevisions.map((revision) => {
								const active = agent?.publishedRevisionId === revision.id
								return (
									<TableRow key={revision.id}>
										<TableCell className="font-medium">r{revision.revision}{active ? <Badge variant="secondary" className="ml-2">当前生效</Badge> : null}</TableCell>
										<TableCell className="text-muted-foreground">{revision.publishedAt || "-"}</TableCell>
										<TableCell>{revision.publishedByName || "-"}</TableCell>
										<TableCell>{revision.workflowVersionId > 0 ? `#${revision.workflowVersionId}` : "-"}</TableCell>
										<TableCell className="text-right">
											<Button type="button" variant="outline" size="sm" disabled={active || rollbackDisabled} onClick={() => onRollback(revision.id)}>回滚</Button>
										</TableCell>
									</TableRow>
								)
							})}
						</TableBody>
					</Table>
				) : <div className="p-4 text-sm text-muted-foreground">暂无已发布 Agent 版本。</div>}
			</div>
			<div className="rounded-md border">
				<div className="border-b px-3 py-2 text-sm font-medium">流程版本</div>
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
