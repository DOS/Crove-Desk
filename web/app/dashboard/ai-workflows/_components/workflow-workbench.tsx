"use client"

import { useCallback, useEffect, useState } from "react"

import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  createAIWorkflow,
  fetchAIWorkflow,
  fetchAIWorkflowDefaultDefinition,
  publishAIWorkflow,
  updateAIWorkflow,
  type AIWorkflow,
  type AIWorkflowDefinition,
} from "@/lib/api/admin"

import { OfficialWorkflowEditor } from "./official-workflow-editor"

const emptyDefinition: AIWorkflowDefinition = {
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
  edges: [
    {
      sourceNodeID: "start_1",
      targetNodeID: "end_1",
      sourcePortID: "edge_start_end",
    },
  ],
}

type WorkflowWorkbenchProps = {
  workflowID?: number
  onSaved?: () => void
}

export function WorkflowWorkbench({
  workflowID,
  onSaved,
}: WorkflowWorkbenchProps) {
  const [active, setActive] = useState<AIWorkflow | null>(null)
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [definition, setDefinition] =
    useState<AIWorkflowDefinition>(emptyDefinition)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [metadataOpen, setMetadataOpen] = useState(false)
  const [metadataName, setMetadataName] = useState("")
  const [metadataDescription, setMetadataDescription] = useState("")

  const load = useCallback(async () => {
    setLoaded(false)
    if (!workflowID) {
      setDefinition(await fetchAIWorkflowDefaultDefinition())
      setLoaded(true)
      return
    }

    const item = await fetchAIWorkflow(workflowID)
    setActive(item)
    setName(item.name)
    setDescription(item.description)
    setDefinition(item.draftDefinition)
    setDirty(false)
    setLoaded(true)
  }, [workflowID])

  const handleDefinitionChange = useCallback(
    (next: AIWorkflowDefinition) => {
      setDefinition(next)
      setDirty(true)
    },
    []
  )

  useEffect(() => {
    void load().catch((error) =>
      toast.error(error instanceof Error ? error.message : "加载工作流失败")
    )
  }, [load])

  function openMetadata() {
    setMetadataName(name)
    setMetadataDescription(description)
    setMetadataOpen(true)
  }

  function applyMetadata() {
    setName(metadataName)
    setDescription(metadataDescription)
    setDirty(true)
    setMetadataOpen(false)
  }

  async function save() {
    if (!name.trim()) {
      toast.error("请填写工作流名称")
      return
    }
    const savedName = name.trim()
    const savedDescription = description.trim()
    setSaving(true)
    try {
      if (active) {
        await updateAIWorkflow({
          id: active.id,
          name: savedName,
          description: savedDescription,
          definition,
        })
        setActive((current) =>
          current
            ? {
                ...current,
                name: savedName,
                description: savedDescription,
                draftDefinition: definition,
                updatedAt: new Date().toISOString(),
              }
            : current
        )
        setName(savedName)
        setDescription(savedDescription)
        setDirty(false)
      } else {
        const created = await createAIWorkflow({
          name: savedName,
          description: savedDescription,
          definition,
        })
        setActive(created)
        setName(created.name)
        setDescription(created.description)
        setDirty(false)
      }
      onSaved?.()
      toast.success("保存成功")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "保存失败")
    } finally {
      setSaving(false)
    }
  }

  async function publish() {
    if (!active) {
      toast.error("请先保存")
      return
    }
    setSaving(true)
    try {
      const version = await publishAIWorkflow(active.id, definition)
      setActive((current) =>
        current
          ? {
              ...current,
              draftDefinition: definition,
              publishedVersionId: version.id,
              updatedAt: version.updatedAt,
            }
          : current
      )
      setDirty(false)
      onSaved?.()
      toast.success(`已发布 v${version.version}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "发布失败")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background">
      <header className="shrink-0 border-b px-4 py-1.5">
        <div className="flex items-center gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-lg font-semibold">
                {name || "新建工作流"}
              </h1>
              <Badge
                variant={active?.publishedVersionId ? "secondary" : "outline"}
              >
                {active?.publishedVersionId ? "已发布" : "草稿"}
              </Badge>
              {dirty ? (
                <span className="text-xs text-amber-600">未保存</span>
              ) : null}
            </div>
            <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">
              {description || "暂未填写业务说明"}
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button variant="outline" onClick={openMetadata}>
              编辑信息
            </Button>
            <Button
              variant="outline"
              disabled={saving}
              onClick={() => void save()}
            >
              保存
            </Button>
            <Button
              disabled={saving || !active}
              onClick={() => void publish()}
            >
              发布版本
            </Button>
          </div>
          <div className="w-8 shrink-0" aria-hidden="true" />
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-hidden">
        {loaded ? (
          <OfficialWorkflowEditor
            documentKey={workflowID ? `workflow-${workflowID}` : "new"}
            definition={definition}
            onDefinitionChange={handleDefinitionChange}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            正在加载节点能力…
          </div>
        )}
      </div>

      <Dialog open={metadataOpen} onOpenChange={setMetadataOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>编辑工作流信息</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              value={metadataName}
              onChange={(event) => setMetadataName(event.target.value)}
              placeholder="工作流名称"
            />
            <Textarea
              value={metadataDescription}
              onChange={(event) => setMetadataDescription(event.target.value)}
              placeholder="适用场景、目标与业务边界"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMetadataOpen(false)}>
              取消
            </Button>
            <Button onClick={applyMetadata}>确认</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
