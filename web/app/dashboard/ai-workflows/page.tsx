"use client"

import { useCallback, useEffect, useState } from "react"
import { PlusIcon } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  createAIWorkflow,
  fetchAIWorkflow,
  fetchAIWorkflowNodeSpecs,
  fetchAIWorkflows,
  publishAIWorkflow,
  updateAIWorkflow,
  validateAIWorkflow,
  type AIWorkflow,
  type AIWorkflowDefinition,
  type AIWorkflowNodeSpec,
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
  const [saving, setSaving] = useState(false)

  const select = useCallback(async (id: number) => {
    const item = await fetchAIWorkflow(id)
    setActive(item)
    setName(item.name)
    setDescription(item.description)
    setDefinition(item.draftDefinition)
  }, [])

  const reload = useCallback(async () => {
    const [page, specs] = await Promise.all([fetchAIWorkflows({ limit: 100 }), fetchAIWorkflowNodeSpecs()])
    setItems(page.results)
    setNodeSpecs(specs)
    if (!active && page.results[0]) await select(page.results[0].id)
  }, [active, select])

  useEffect(() => { void reload().catch((error) => toast.error(error instanceof Error ? error.message : "加载工作流失败")) }, [reload])

  async function save() {
    if (!name.trim()) { toast.error("请填写工作流名称"); return }
    setSaving(true)
    try {
      if (active) {
        await updateAIWorkflow({ id: active.id, name: name.trim(), description: description.trim(), definition })
        await select(active.id)
      } else {
        const created = await createAIWorkflow({ name: name.trim(), description: description.trim(), definition })
        await select(created.id)
      }
      await reload()
      toast.success("工作流草稿已保存")
    } catch (error) { toast.error(error instanceof Error ? error.message : "保存工作流失败") } finally { setSaving(false) }
  }

  async function publish() {
    if (!active) { toast.error("请先保存工作流草稿"); return }
    setSaving(true)
    try {
      const version = await publishAIWorkflow(active.id, definition)
      await select(active.id)
      await reload()
      toast.success(`已发布工作流 v${version.version}`)
    } catch (error) { toast.error(error instanceof Error ? error.message : "发布工作流失败") } finally { setSaving(false) }
  }

  function create() { setActive(null); setName(""); setDescription(""); setDefinition(emptyDefinition) }

  return <div className="flex h-full min-h-0 bg-background">
    <aside className="w-72 shrink-0 border-r bg-muted/20 p-3">
      <div className="mb-3 flex items-center justify-between"><div><h1 className="font-semibold">工作流</h1><p className="text-xs text-muted-foreground">独立维护、发布后供 Agent 关联</p></div><Button size="icon" variant="outline" onClick={create}><PlusIcon className="size-4" /></Button></div>
      <div className="space-y-1">{items.map((item) => <button key={item.id} type="button" onClick={() => void select(item.id)} className={`w-full rounded-md p-3 text-left ${active?.id === item.id ? "bg-background shadow-sm" : "hover:bg-background/70"}`}><div className="truncate font-medium">{item.name}</div><div className="mt-1 text-xs text-muted-foreground">{item.publishedVersionId > 0 ? `已发布版本 #${item.publishedVersionId}` : "未发布"}</div></button>)}</div>
    </aside>
    <section className="flex min-w-0 flex-1 flex-col">
      <header className="flex shrink-0 items-center gap-3 border-b px-5 py-3"><div className="min-w-0 flex-1"><Input value={name} onChange={(event) => setName(event.target.value)} placeholder="工作流名称" className="max-w-sm" /><Textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="业务说明（可选）" className="mt-2 min-h-16 max-w-xl resize-none" /></div><Button variant="outline" disabled={saving} onClick={() => void save()}>保存草稿</Button><Button disabled={saving || !active} onClick={() => void publish()}>发布工作流</Button></header>
      <div className="min-h-0 flex-1"><WorkflowEditor definition={definition} nodeSpecs={nodeSpecs} onDefinitionChange={setDefinition} onValidate={() => void validateAIWorkflow(definition).then((result) => toast[result.valid ? "success" : "error"](result.valid ? "工作流校验通过" : "工作流存在校验错误"))} validateDisabled={saving} /></div>
    </section>
  </div>
}
