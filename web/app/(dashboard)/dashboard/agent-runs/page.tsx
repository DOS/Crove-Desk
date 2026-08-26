"use client"

import { useEffect, useState } from "react"
import { AlertTriangleIcon, BotMessageSquareIcon, Clock3Icon, WorkflowIcon, WrenchIcon } from "lucide-react"
import { toast } from "sonner"

import { DashboardListPage } from "@/components/dashboard/list"
import { JsonTreeViewer } from "@/components/json-tree-viewer"
import { OptionCombobox } from "@/components/option-combobox"
import { ProjectDialog } from "@/components/project-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { fetchAgentRun, fetchAgentRunMetrics, fetchAgentRuns, fetchAIWorkflowRun, saveAgentRunQualityFeedback, type AgentRun, type AgentRunMetrics, type AgentStep, type AgentToolCall, type AIWorkflowRun } from "@/lib/api/admin"
import { formatDateTime } from "@/lib/utils"
import { useI18n } from "@/i18n/provider"
import { WorkflowRunAuditGraph } from "../ai-workflow-runs/_components/workflow-run-audit-graph"

function statusVariant(status: string) {
  if (status === "failed") return "destructive" as const
  if (status === "interrupted") return "outline" as const
  if (status === "completed") return "default" as const
  return "secondary" as const
}

export default function DashboardAgentRunsPage() {
  const t = useI18n()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [run, setRun] = useState<AgentRun | null>(null)
	const [workflowAuditOpen, setWorkflowAuditOpen] = useState(false)
	const [workflowAuditLoading, setWorkflowAuditLoading] = useState(false)
	const [workflowRun, setWorkflowRun] = useState<AIWorkflowRun | null>(null)
	const [metrics, setMetrics] = useState<AgentRunMetrics | null>(null)

	useEffect(() => {
		void fetchAgentRunMetrics().then(setMetrics).catch(() => setMetrics(null))
	}, [])

  async function openDetail(id: number) {
    setOpen(true)
    setLoading(true)
    try {
      setRun(await fetchAgentRun(id))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("agentRun.loadDetailFailed"))
      setOpen(false)
    } finally {
      setLoading(false)
    }
  }

	async function openWorkflowAudit(id: number) {
		if (id <= 0) return
		setWorkflowAuditOpen(true)
		setWorkflowAuditLoading(true)
		try {
			setWorkflowRun(await fetchAIWorkflowRun(id))
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "加载 Workflow 节点审计失败")
			setWorkflowAuditOpen(false)
		} finally {
			setWorkflowAuditLoading(false)
		}
	}

  return (
    <>
		{metrics ? <div className="grid grid-cols-2 gap-px border-b bg-border sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-10">
			<Metric label={t("agentRun.metricCompletionRate")} value={`${Math.round(metrics.completionRate * 100)}%`} detail={`${metrics.completedRuns}/${metrics.totalRuns}`} />
			<Metric label={t("agentRun.metricResolutionRate")} value={metrics.reviewedRuns ? `${Math.round(metrics.resolutionRate * 100)}%` : "-"} detail={`${metrics.resolvedRuns}/${metrics.reviewedRuns}`} />
			<Metric label={t("agentRun.metricUnsupportedRate")} value={metrics.reviewedRuns ? `${Math.round(metrics.unsupportedEvidenceRate * 100)}%` : "-"} detail={`${metrics.unsupportedEvidenceRuns}/${metrics.reviewedRuns}`} />
			<Metric label={t("agentRun.metricToolSuccessRate")} value={metrics.toolCalls ? `${Math.round(metrics.toolSuccessRate * 100)}%` : "-"} detail={`${metrics.toolCalls}`} />
			<Metric label={t("agentRun.metricAvgSteps")} value={metrics.averageSteps.toFixed(1)} detail={`${metrics.totalRuns}`} />
			<Metric label={t("agentRun.metricP95Latency")} value={`${metrics.p95DurationMs} ms`} detail={`avg ${metrics.averageDurationMs} ms`} />
			<Metric label={t("agentRun.metricToken")} value={`${metrics.promptTokens + metrics.completionTokens}`} detail={`${metrics.promptTokens}/${metrics.completionTokens}`} />
			<Metric label={t("agentRun.metricHandoffRate")} value={`${Math.round(metrics.handoffRate * 100)}%`} detail="Handoff" />
			<Metric label={t("agentRun.metricFallbackRate")} value={`${Math.round(metrics.knowledgeFallbackRate * 100)}%`} detail="Fallback" />
			<Metric label={t("agentRun.metricInterruptRecoveryRate")} value={metrics.resumedInterrupts ? `${Math.round(metrics.interruptRecoveryRate * 100)}%` : "-"} detail={`${metrics.resolvedInterrupts}/${metrics.resumedInterrupts}`} />
		</div> : null}
      <DashboardListPage<AgentRun>
        filters={[
          { name: "conversationId", label: t("agentRun.conversation"), defaultValue: "", valueType: "number", className: "w-full sm:w-40" },
          { name: "aiAgentId", label: t("agentRun.agent"), defaultValue: "", valueType: "number", className: "w-full sm:w-40" },
          { name: "status", label: t("agentRun.status"), defaultValue: "", className: "w-full sm:w-40" },
        ]}
        fetchList={fetchAgentRuns}
        getItemId={(item) => item.id}
        getRowClassName={() => "cursor-pointer"}
        onRowClick={(item) => void openDetail(item.id)}
        columns={[
          { key: "startedAt", label: t("agentRun.startedAt"), className: "w-42 text-xs text-muted-foreground", render: (item) => formatDateTime(item.startedAt || item.createdAt) },
          { key: "agent", label: t("agentRun.agent"), className: "w-28", render: (item) => `#${item.aiAgentId || "-"}` },
          { key: "conversation", label: t("agentRun.conversation"), className: "w-28", render: (item) => `#${item.conversationId || "-"}` },
          { key: "status", label: t("agentRun.status"), className: "w-30", render: (item) => <Badge variant={statusVariant(item.status)}>{item.status || "-"}</Badge> },
          { key: "duration", label: t("agentRun.duration"), className: "w-24 text-right", render: (item) => `${item.durationMs || 0} ms` },
          { key: "tokens", label: t("agentRun.tokens"), className: "w-28 text-right", render: (item) => `${item.promptTokens || 0}/${item.completionTokens || 0}` },
          { key: "error", label: t("agentRun.error"), className: "w-72 max-w-72", render: (item) => item.errorMessage ? <span className="block truncate text-xs text-destructive" title={item.errorMessage}>{item.errorMessage}</span> : "-" },
        ]}
        labels={{ refresh: t("agentRun.refresh"), query: t("agentRun.query"), loading: t("agentRun.loading"), empty: t("agentRun.empty"), loadFailed: t("agentRun.loadFailed") }}
      />
		<AgentRunDetailDialog open={open} loading={loading} run={run} onOpenWorkflowAudit={openWorkflowAudit} onQualityFeedbackSaved={(id) => void openDetail(id)} onOpenChange={(next) => { setOpen(next); if (!next) setRun(null) }} t={t} />
		<WorkflowAuditDialog open={workflowAuditOpen} loading={workflowAuditLoading} run={workflowRun} onOpenChange={(next) => { setWorkflowAuditOpen(next); if (!next) setWorkflowRun(null) }} />
    </>
  )
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) { return <div className="bg-background px-4 py-3"><div className="text-xs text-muted-foreground">{label}</div><div className="mt-1 text-lg font-semibold">{value}</div><div className="text-xs text-muted-foreground">{detail}</div></div> }

function AgentRunDetailDialog({ open, loading, run, onOpenChange, onOpenWorkflowAudit, onQualityFeedbackSaved, t }: { open: boolean; loading: boolean; run: AgentRun | null; onOpenChange: (open: boolean) => void; onOpenWorkflowAudit: (workflowRunId: number) => void; onQualityFeedbackSaved: (agentRunId: number) => void; t: (key: string) => string }) {
  return <ProjectDialog open={open} onOpenChange={onOpenChange} size="xl" allowFullscreen defaultFullscreen title={<span className="flex items-center gap-2"><BotMessageSquareIcon className="size-4" />{t("agentRun.detailTitle")}</span>} description={run ? `Run #${run.id}` : t("agentRun.detailDescription")} footer={<Button variant="outline" onClick={() => onOpenChange(false)}>{t("agentRun.close")}</Button>}>
    {loading ? <div className="py-10 text-sm text-muted-foreground">{t("agentRun.loadingDetail")}</div> : run ? <div className="space-y-4">
		<div className="flex flex-wrap gap-2 rounded-md border bg-muted/20 px-3 py-2 text-xs"><Meta label={t("agentRun.status")} value={run.status} /><Meta label={t("agentRun.agent")} value={`#${run.aiAgentId}`} /><Meta label={t("agentRun.revision")} value={`#${run.agentRevisionId || "-"}`} /><Meta label={t("agentRun.duration")} value={`${run.durationMs || 0} ms`} /><Meta label={t("agentRun.tokens")} value={`${run.promptTokens || 0}/${run.completionTokens || 0}`} /></div>
		{run.workflowRunId > 0 ? <section className="flex items-center justify-between gap-3 border px-3 py-2"><div><div className="text-sm font-medium">{t("agentRun.workflowAudit")}</div><div className="text-xs text-muted-foreground">Workflow Run #{run.workflowRunId}</div></div><Button type="button" variant="outline" size="sm" onClick={() => onOpenWorkflowAudit(run.workflowRunId)}><WorkflowIcon />{t("agentRun.viewWorkflowAudit")}</Button></section> : null}
		<QualityFeedbackPanel run={run} onSaved={onQualityFeedbackSaved} t={t} />
      {run.errorMessage ? <div className="flex gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"><AlertTriangleIcon className="size-4 shrink-0" />{run.errorMessage}</div> : null}
      <Preview title={t("agentRun.trace")} raw={run.traceData} />
      <section className="space-y-2"><h3 className="text-sm font-medium">{t("agentRun.steps")}</h3>{(run.steps ?? []).map((step) => <StepBlock key={step.id} step={step} t={t} />)}{!run.steps?.length ? <p className="text-sm text-muted-foreground">{t("agentRun.emptySteps")}</p> : null}</section>
      <section className="space-y-2"><h3 className="text-sm font-medium">{t("agentRun.toolCalls")}</h3>{(run.toolCalls ?? []).map((call) => <ToolCallBlock key={call.id} call={call} t={t} />)}{!run.toolCalls?.length ? <p className="text-sm text-muted-foreground">{t("agentRun.emptyToolCalls")}</p> : null}</section>
    </div> : <div className="py-10 text-sm text-muted-foreground">{t("agentRun.notFound")}</div>}
  </ProjectDialog>
}

function QualityFeedbackPanel({ run, onSaved, t }: { run: AgentRun; onSaved: (agentRunId: number) => void; t: (key: string) => string }) {
	const [resolutionStatus, setResolutionStatus] = useState<"unknown" | "resolved" | "unresolved">("unknown")
	const [evidenceStatus, setEvidenceStatus] = useState<"unknown" | "supported" | "unsupported">("unknown")
	const [comment, setComment] = useState("")
	const [saving, setSaving] = useState(false)

	useEffect(() => {
		setResolutionStatus(run.qualityFeedback?.resolutionStatus ?? "unknown")
		setEvidenceStatus(run.qualityFeedback?.evidenceStatus ?? "unknown")
		setComment(run.qualityFeedback?.comment ?? "")
	}, [run.id, run.qualityFeedback])

	async function save() {
		setSaving(true)
		try {
			await saveAgentRunQualityFeedback({ agentRunId: run.id, resolutionStatus, evidenceStatus, comment })
			toast.success(t("agentRun.qualitySaved"))
			onSaved(run.id)
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Save failed")
		} finally {
			setSaving(false)
		}
	}

	return <section className="space-y-3 border p-3"><div><h3 className="text-sm font-medium">{t("agentRun.qualityTitle")}</h3><p className="text-xs text-muted-foreground">{t("agentRun.qualityDescription")}</p></div><div className="grid gap-3 sm:grid-cols-2"><OptionCombobox value={resolutionStatus} placeholder={t("agentRun.selectResolution")} options={[{ value: "unknown", label: "Resolution: Unknown" }, { value: "resolved", label: "Resolution: Resolved" }, { value: "unresolved", label: "Resolution: Unresolved" }]} onChange={(value) => setResolutionStatus(value === "resolved" || value === "unresolved" ? value : "unknown")} /><OptionCombobox value={evidenceStatus} placeholder={t("agentRun.selectEvidence")} options={[{ value: "unknown", label: "Evidence: Unknown" }, { value: "supported", label: "Evidence: Supported" }, { value: "unsupported", label: "Evidence: Unsupported" }]} onChange={(value) => setEvidenceStatus(value === "supported" || value === "unsupported" ? value : "unknown")} /></div><Textarea rows={3} value={comment} onChange={(event) => setComment(event.target.value)} placeholder={t("agentRun.qualityCommentPlaceholder")} /><div className="flex items-center justify-between gap-3"><span className="text-xs text-muted-foreground">{run.qualityFeedback?.updatedAt ? `Last annotated: ${run.qualityFeedback.updatedAt}` : "-"}</span><Button type="button" size="sm" disabled={saving} onClick={save}>{t("agentRun.saveQuality")}</Button></div></section>
}

function WorkflowAuditDialog({ open, loading, run, onOpenChange }: { open: boolean; loading: boolean; run: AIWorkflowRun | null; onOpenChange: (open: boolean) => void }) {
	const t = useI18n()
	return <ProjectDialog open={open} onOpenChange={onOpenChange} size="xl" allowFullscreen defaultFullscreen title={<span className="flex items-center gap-2"><WorkflowIcon className="size-4" />{t("agentRun.workflowAudit")}</span>} description={run ? `Workflow Run #${run.id}` : t("agentRun.workflowAudit")} footer={<Button variant="outline" onClick={() => onOpenChange(false)}>{t("common.close")}</Button>}>
		{loading ? <div className="py-10 text-sm text-muted-foreground">{t("common.loading")}</div> : run ? <div className="space-y-3"><div className="flex flex-wrap gap-2 rounded-md border bg-muted/20 px-3 py-2 text-xs"><Meta label={t("common.status")} value={run.statusName} /><Meta label="Workflow" value={run.workflowName || `#${run.workflowId}`} /><Meta label={t("agentRun.revision")} value={`v${run.workflowVersion || "-"}`} /><Meta label={t("agentRun.duration")} value={`${run.durationMs || 0} ms`} /></div>{run.errorMessage ? <div className="flex gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"><AlertTriangleIcon className="size-4 shrink-0" />{run.errorMessage}</div> : null}<WorkflowRunAuditGraph run={run} /></div> : <div className="py-10 text-sm text-muted-foreground">{t("common.emptyData")}</div>}
	</ProjectDialog>
}

function Meta({ label, value }: { label: string; value: string }) { return <span className="inline-flex items-center gap-1 rounded-md border bg-background px-2 py-1"><span className="text-muted-foreground">{label}</span><span className="font-medium">{value || "-"}</span></span> }
function StepBlock({ step, t }: { step: AgentStep; t: (key: string) => string }) { return <div className="rounded-md border p-3"><div className="flex flex-wrap items-center gap-2"><Clock3Icon className="size-4 text-muted-foreground" /><span className="font-medium">{step.stepCode || step.stepType}</span><Badge variant={statusVariant(step.status)}>{step.status}</Badge><span className="text-xs text-muted-foreground">{step.durationMs || 0} ms</span></div>{step.errorMessage ? <p className="mt-2 text-xs text-destructive">{step.errorMessage}</p> : null}<div className="mt-3 grid gap-3 lg:grid-cols-2"><Preview title={t("agentRun.input")} raw={step.inputPreview} /><Preview title={t("agentRun.output")} raw={step.outputPreview} /></div></div> }
function ToolCallBlock({ call, t }: { call: AgentToolCall; t: (key: string) => string }) { return <div className="rounded-md border p-3"><div className="flex flex-wrap items-center gap-2"><WrenchIcon className="size-4 text-muted-foreground" /><span className="font-medium">{call.toolCode}</span><Badge variant={statusVariant(call.status)}>{call.status}</Badge><span className="text-xs text-muted-foreground">{call.riskLevel}</span></div>{call.errorMessage ? <p className="mt-2 text-xs text-destructive">{call.errorMessage}</p> : null}<div className="mt-3 grid gap-3 lg:grid-cols-2"><Preview title={t("agentRun.arguments")} raw={call.argumentsPreview} /><Preview title={t("agentRun.result")} raw={call.resultPreview} /></div></div> }
function Preview({ title, raw }: { title: string; raw: string }) { const value = parseJSON(raw); return <div className="min-w-0"><div className="mb-1 text-xs text-muted-foreground">{title}</div>{value !== null ? <JsonTreeViewer value={value} collapsed={2} /> : raw?.trim() ? <pre className="max-h-52 overflow-auto rounded-md border bg-muted/20 p-2 text-xs whitespace-pre-wrap break-all">{raw}</pre> : <div className="rounded-md border bg-muted/20 px-2 py-1.5 text-xs text-muted-foreground">-</div>}</div> }
function parseJSON(raw: string): unknown | null { try { return raw?.trim() ? JSON.parse(raw) : null } catch { return null } }
