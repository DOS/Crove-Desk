"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { ArrowLeftIcon, PlusIcon, SearchIcon } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { cn, formatDateTime } from "@/lib/utils"
import {
  createAIWorkflow, fetchAIWorkflow, fetchAIWorkflowNodeSpecs, fetchAIWorkflows,
  fetchAIWorkflowUsage, fetchAIWorkflowVersions, publishAIWorkflow, restoreAIWorkflowVersion,
  updateAIWorkflow, validateAIWorkflow, type AIWorkflow, type AIWorkflowDefinition,
  type AIWorkflowNodeSpec, type AIWorkflowUsage, type AIWorkflowVersion,
} from "@/lib/api/admin"

import { WorkflowEditor } from "./_components/workflow-editor"

const emptyDefinition: AIWorkflowDefinition = {
  schemaVersion: 2,
  nodes: [
    { id: "start_1", type: "start", meta: { position: { x: 0, y: 80 } }, data: { title: "开始", config: {}, inputsValues: {} } },
    { id: "end_1", type: "end", meta: { position: { x: 260, y: 80 } }, data: { title: "结束", config: {}, inputsValues: {} } },
  ],
  edges: [{ sourceNodeID: "start_1", targetNodeID: "end_1", sourcePortID: "edge_start_end" }],
}

export default function DashboardAIWorkflowsPage() {
  const [items, setItems] = useState<AIWorkflow[]>([])
  const [nodeSpecs, setNodeSpecs] = useState<AIWorkflowNodeSpec[]>([])
  const [active, setActive] = useState<AIWorkflow | null>(null)
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [definition, setDefinition] = useState<AIWorkflowDefinition>(emptyDefinition)
  const [versions, setVersions] = useState<AIWorkflowVersion[]>([])
  const [usage, setUsage] = useState<AIWorkflowUsage[]>([])
  const [query, setQuery] = useState("")
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [metadataOpen, setMetadataOpen] = useState(false)
  const [metadataName, setMetadataName] = useState("")
  const [metadataDescription, setMetadataDescription] = useState("")

  const loadList = useCallback(async () => {
    const [page, specs] = await Promise.all([fetchAIWorkflows({ limit: 100 }), fetchAIWorkflowNodeSpecs()])
    setItems(page.results ?? [])
    setNodeSpecs(specs ?? [])
  }, [])

  const select = useCallback(async (id: number) => {
    const [item, versionPage, uses] = await Promise.all([
      fetchAIWorkflow(id), fetchAIWorkflowVersions({ workflowId: id, limit: 50 }), fetchAIWorkflowUsage(id),
    ])
    setActive(item); setName(item.name); setDescription(item.description); setDefinition(item.draftDefinition)
    setVersions(versionPage.results ?? []); setUsage(uses ?? []); setDirty(false)
  }, [])

  useEffect(() => {
    void loadList().then(async () => {
      if (!active) {
        const page = await fetchAIWorkflows({ limit: 1 })
        if (page.results?.[0]) await select(page.results[0].id)
      }
    }).catch((error) => toast.error(error instanceof Error ? error.message : "加载工作流失败"))
  }, [active, loadList, select])

  const visible = useMemo(() => items.filter((item) => item.name.toLowerCase().includes(query.trim().toLowerCase())), [items, query])
  const create = () => { setActive(null); setName(""); setDescription(""); setDefinition(emptyDefinition); setVersions([]); setUsage([]); setDirty(false) }
  const openMetadata = () => { setMetadataName(name); setMetadataDescription(description); setMetadataOpen(true) }
  const applyMetadata = () => { setName(metadataName); setDescription(metadataDescription); setDirty(true); setMetadataOpen(false) }

  async function save() {
    if (!name.trim()) return toast.error("请填写工作流名称")
    setSaving(true)
    try {
      if (active) { await updateAIWorkflow({ id: active.id, name: name.trim(), description: description.trim(), definition }); await select(active.id) }
      else { const created = await createAIWorkflow({ name: name.trim(), description: description.trim(), definition }); await loadList(); await select(created.id) }
      await loadList(); toast.success("草稿已保存")
    } catch (error) { toast.error(error instanceof Error ? error.message : "保存失败") } finally { setSaving(false) }
  }

  async function publish() {
    if (!active) return toast.error("请先保存草稿")
    setSaving(true)
    try { const version = await publishAIWorkflow(active.id, definition); await select(active.id); await loadList(); toast.success(`已发布 v${version.version}`) }
    catch (error) { toast.error(error instanceof Error ? error.message : "发布失败") } finally { setSaving(false) }
  }

  async function restore(version: AIWorkflowVersion) {
    if (!active) return
    try { await restoreAIWorkflowVersion(active.id, version.id); await select(active.id); toast.success(`已将 v${version.version} 恢复为草稿`) }
    catch (error) { toast.error(error instanceof Error ? error.message : "恢复失败") }
  }

  return <div className="h-full min-h-0 overflow-hidden bg-background"><div className="flex h-full min-h-0 overflow-hidden">
    <aside className="flex w-80 shrink-0 flex-col border-r bg-muted/15">
      <div className="shrink-0 space-y-3 border-b p-4"><div className="flex items-center justify-between"><div><h1 className="text-base font-semibold">工作流管理</h1><p className="mt-1 text-xs text-muted-foreground">独立维护，发布版本供 Agent 固定关联</p></div><Button size="icon" onClick={create}><PlusIcon className="size-4" /></Button></div><div className="relative"><SearchIcon className="absolute left-3 top-2.5 size-4 text-muted-foreground" /><Input value={query} onChange={(event) => setQuery(event.target.value)} className="pl-9" placeholder="搜索工作流" /></div></div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2">{visible.length ? visible.map((item) => <button key={item.id} type="button" onClick={() => void select(item.id)} className={cn("mb-1 w-full rounded-lg border p-3 text-left transition-colors", active?.id === item.id ? "border-primary/30 bg-primary/5" : "border-transparent hover:bg-muted")}><div className="truncate font-medium">{item.name}</div><div className="mt-1 line-clamp-2 text-xs text-muted-foreground">{item.description || "暂无业务说明"}</div><div className="mt-3 flex items-center justify-between text-xs"><Badge variant={item.publishedVersionId ? "secondary" : "outline"}>{item.publishedVersionId ? "已发布" : "草稿"}</Badge><span className="text-muted-foreground">{formatDateTime(item.updatedAt)}</span></div></button>) : <div className="p-8 text-center text-sm text-muted-foreground">没有匹配的工作流</div>}</div>
    </aside>
    <main className="flex min-w-0 flex-1 flex-col overflow-hidden">{active || name ? <>
      <header className="shrink-0 border-b bg-background px-6 py-4"><div className="flex items-center gap-4"><Button variant="ghost" size="icon" className="md:hidden" onClick={create}><ArrowLeftIcon className="size-4" /></Button><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><h2 className="truncate text-lg font-semibold">{name || "未命名工作流"}</h2><Badge variant={active?.publishedVersionId ? "secondary" : "outline"}>{active?.publishedVersionId ? "已发布" : "草稿"}</Badge>{dirty ? <span className="text-xs text-amber-600">未保存</span> : null}</div><p className="mt-1 line-clamp-1 text-sm text-muted-foreground">{description || "暂未填写业务说明"}</p></div><div className="flex shrink-0 gap-2"><Button variant="ghost" onClick={openMetadata}>编辑信息</Button><Button variant="outline" disabled={saving} onClick={() => void validateAIWorkflow(definition).then((result) => toast[result.valid ? "success" : "error"](result.valid ? "校验通过" : `发现 ${result.errors.length} 个问题`))}>校验</Button><Button variant="outline" disabled={saving} onClick={() => void save()}>保存草稿</Button><Button disabled={saving || !active} onClick={() => void publish()}>发布版本</Button></div></div></header>
      <Tabs defaultValue="editor" className="flex min-h-0 flex-1 flex-col"><div className="shrink-0 border-b px-6"><TabsList className="h-11 bg-transparent"><TabsTrigger value="editor">编辑画布</TabsTrigger><TabsTrigger value="versions">版本历史 ({versions.length})</TabsTrigger><TabsTrigger value="usage">使用情况 ({usage.length})</TabsTrigger></TabsList></div><TabsContent value="editor" className="min-h-0 flex-1 overflow-hidden data-[state=inactive]:hidden"><WorkflowEditor definition={definition} nodeSpecs={nodeSpecs} onDefinitionChange={(next) => { setDefinition(next); setDirty(true) }} onSaveDraft={() => void save()} onPublish={() => void publish()} saveDraftDisabled={saving} publishDisabled={saving || !active} /></TabsContent><TabsContent value="versions" className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-6">{versions.length ? versions.map((version) => <div key={version.id} className="mb-3 flex items-center gap-4 rounded-lg border p-4"><Badge>v{version.version}</Badge><div className="min-w-0 flex-1"><div className="text-sm font-medium">发布于 {formatDateTime(version.publishedAt || version.createdAt)}</div><div className="text-xs text-muted-foreground">发布人：{version.publishedByName || "-"} · 指纹 {version.definitionHash.slice(0, 10)}</div></div><Button variant="outline" size="sm" onClick={() => void restore(version)}>恢复为草稿</Button></div>) : <p className="text-sm text-muted-foreground">尚未发布版本。</p>}</TabsContent><TabsContent value="usage" className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-6">{usage.length ? usage.map((item) => <div key={`${item.aiAgentId}-${item.workflowVersionId}`} className="mb-3 flex items-center justify-between rounded-lg border p-4"><div><div className="font-medium">{item.aiAgentName}</div><div className="mt-1 text-sm text-muted-foreground">固定关联 v{item.workflowVersion}</div></div><Badge variant={item.enabled ? "secondary" : "outline"}>{item.enabled ? "启用" : "已停用"}</Badge></div>) : <p className="text-sm text-muted-foreground">暂未被任何 Agent 使用。</p>}</TabsContent></Tabs>
    </> : <div className="flex flex-1 items-center justify-center"><div className="text-center"><h2 className="font-semibold">创建第一个工作流</h2><p className="mt-2 text-sm text-muted-foreground">从空白画布开始，发布后再关联给 Agent。</p><Button className="mt-4" onClick={create}>创建工作流</Button></div></div>}</main>
    <Dialog open={metadataOpen} onOpenChange={setMetadataOpen}><DialogContent><DialogHeader><DialogTitle>编辑工作流信息</DialogTitle></DialogHeader><div className="space-y-4"><div className="space-y-2"><label className="text-sm font-medium">名称</label><Input value={metadataName} onChange={(event) => setMetadataName(event.target.value)} placeholder="工作流名称" /></div><div className="space-y-2"><label className="text-sm font-medium">业务说明</label><Textarea value={metadataDescription} onChange={(event) => setMetadataDescription(event.target.value)} placeholder="适用场景、目标与业务边界" /></div></div><DialogFooter><Button variant="outline" onClick={() => setMetadataOpen(false)}>取消</Button><Button onClick={applyMetadata}>确认</Button></DialogFooter></DialogContent></Dialog>
  </div></div>
}
