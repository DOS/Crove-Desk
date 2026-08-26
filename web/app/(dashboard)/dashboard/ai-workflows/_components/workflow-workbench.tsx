"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import { PencilIcon } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { OptionCombobox } from "@/components/option-combobox"
import { useI18n } from "@/i18n/provider"
import {
  createAIWorkflow,
  fetchAIWorkflow,
  fetchAIWorkflowDefaultDefinition,
  fetchAIWorkflowNodeSpecs,
  fetchAIWorkflowTemplates,
  publishAIWorkflow,
  updateAIWorkflow,
  type AIWorkflow,
  type AIWorkflowDefinition,
  type AIWorkflowNodeSpec,
  type AIWorkflowTemplate,
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
  const t = useI18n()
  const [active, setActive] = useState<AIWorkflow | null>(null)
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [definition, setDefinition] =
    useState<AIWorkflowDefinition>(emptyDefinition)
  const [nodeSpecs, setNodeSpecs] = useState<AIWorkflowNodeSpec[]>([])
  const [templates, setTemplates] = useState<AIWorkflowTemplate[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState("")
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [editingField, setEditingField] = useState<
    "name" | "description" | null
  >(null)
  const editSnapshotRef = useRef({ value: "", dirty: false })
  const cancellingEditRef = useRef(false)
  const savingRef = useRef(false)

  const load = useCallback(async () => {
    setLoaded(false)
    const [specs, availableTemplates] = await Promise.all([
      fetchAIWorkflowNodeSpecs(),
      fetchAIWorkflowTemplates(),
    ])
    setNodeSpecs(specs)
    setTemplates(availableTemplates)
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

  function beginEditing(field: "name" | "description") {
    cancellingEditRef.current = false
    editSnapshotRef.current = {
      value: field === "name" ? name : description,
      dirty,
    }
    setEditingField(field)
  }

  async function finishEditing(field: "name" | "description") {
    if (cancellingEditRef.current) {
      cancellingEditRef.current = false
      return
    }
    setEditingField(null)
    const currentValue = field === "name" ? name.trim() : description.trim()
    if (currentValue === editSnapshotRef.current.value) {
      setDirty(editSnapshotRef.current.dirty)
      return
    }
    if (field === "name" && !currentValue) {
      setName(editSnapshotRef.current.value)
      setDirty(editSnapshotRef.current.dirty)
      toast.error("请填写工作流名称")
      return
    }

    const nextName = field === "name" ? currentValue : name.trim()
    const nextDescription =
      field === "description" ? currentValue : description.trim()
    if (savingRef.current) return
    savingRef.current = true
    setSaving(true)
    try {
      if (active) {
        await updateAIWorkflow({
          id: active.id,
          name: nextName,
          description: nextDescription,
          definition: active.draftDefinition,
        })
        setActive((current) =>
          current
            ? {
                ...current,
                name: nextName,
                description: nextDescription,
                updatedAt: new Date().toISOString(),
              }
            : current
        )
      } else {
        const created = await createAIWorkflow({
          name: nextName,
          description: nextDescription,
          definition,
        })
        setActive(created)
      }
      setName(nextName)
      setDescription(nextDescription)
      setDirty(active ? editSnapshotRef.current.dirty : false)
      onSaved?.()
      toast.success(field === "name" ? "名称已保存" : "描述已保存")
    } catch (error) {
      setDirty(true)
      toast.error(error instanceof Error ? error.message : "保存失败")
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }

  function cancelEditing(field: "name" | "description") {
    cancellingEditRef.current = true
    if (field === "name") {
      setName(editSnapshotRef.current.value)
    } else {
      setDescription(editSnapshotRef.current.value)
    }
    setDirty(editSnapshotRef.current.dirty)
    setEditingField(null)
  }

  async function save() {
    if (savingRef.current) return
    if (!name.trim()) {
      toast.error("请填写工作流名称")
      return
    }
    const savedName = name.trim()
    const savedDescription = description.trim()
    savingRef.current = true
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
      savingRef.current = false
      setSaving(false)
    }
  }

  async function publish() {
    if (savingRef.current) return
    if (!active) {
      toast.error("请先保存")
      return
    }
    savingRef.current = true
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
      savingRef.current = false
      setSaving(false)
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background">
      <header className="shrink-0 border-b px-4 py-1.5">
        <div className="flex items-center gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              {editingField === "name" ? (
                <Input
                  autoFocus
                  aria-label="工作流名称"
                  value={name}
                  onFocus={(event) => event.currentTarget.select()}
                  onChange={(event) => {
                    setName(event.target.value)
                    setDirty(true)
                  }}
                  onBlur={() => void finishEditing("name")}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault()
                      event.currentTarget.blur()
                    } else if (event.key === "Escape") {
                      event.preventDefault()
                      event.stopPropagation()
                      cancelEditing("name")
                    }
                  }}
                  className="h-7 min-w-48 max-w-xl flex-1 px-2 text-lg font-semibold"
                />
              ) : (
                <button
                  type="button"
                  aria-label="Workflow Name"
                  onClick={() => beginEditing("name")}
                  className="group flex h-7 min-w-0 max-w-xl items-center gap-1.5 rounded-md px-1 text-left text-lg font-semibold hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="truncate">{name || t("aiWorkflow.createTitle")}</span>
                  <PencilIcon className="size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" />
                </button>
              )}
              <Badge
                variant={active?.publishedVersionId ? "secondary" : "outline"}
              >
                {active?.publishedVersionId ? t("aiWorkflow.published") : t("aiWorkflow.draft")}
              </Badge>
              {dirty ? (
                <span className="text-xs text-amber-600">{t("supportHelpWorkbench.unsaved")}</span>
              ) : null}
            </div>
            {editingField === "description" ? (
              <Input
                autoFocus
                aria-label="Workflow Description"
                value={description}
                onFocus={(event) => event.currentTarget.select()}
                onChange={(event) => {
                  setDescription(event.target.value)
                  setDirty(true)
                }}
                onBlur={() => void finishEditing("description")}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault()
                    event.currentTarget.blur()
                  } else if (event.key === "Escape") {
                    event.preventDefault()
                    event.stopPropagation()
                    cancelEditing("description")
                  }
                }}
                placeholder="Workflow description..."
                className="mt-0.5 h-6 max-w-2xl px-1 text-sm font-normal"
              />
            ) : (
              <button
                type="button"
                aria-label="Workflow Description"
                onClick={() => beginEditing("description")}
                className="group mt-0.5 flex h-6 max-w-2xl items-center gap-1.5 rounded-md px-1 text-left text-sm text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="truncate">
                  {description || t("aiWorkflow.noDescription")}
                </span>
                <PencilIcon className="size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" />
              </button>
            )}
          </div>
          <div className="flex shrink-0 gap-2">
            {!active ? (
              <OptionCombobox
                value={selectedTemplate}
                placeholder="Template"
                searchPlaceholder="Search template..."
                emptyText="No templates"
                triggerClassName="w-48"
                options={templates.map((template) => ({
                  value: template.code,
                  label: template.name,
                  description: template.description,
                }))}
                onChange={(code) => {
                  const template = templates.find((item) => item.code === code)
                  if (!template) return
                  setSelectedTemplate(code)
                  setDefinition(structuredClone(template.definition))
                  setName(template.name)
                  setDescription(template.description)
                  setDirty(true)
                }}
              />
            ) : null}
            <Button
              variant="outline"
              disabled={saving}
              onClick={() => void save()}
            >
              {t("common.save")}
            </Button>
            <Button
              disabled={saving || !active}
              onClick={() => void publish()}
            >
              {t("aiAgent.publishAgent")}
            </Button>
          </div>
          <div className="w-8 shrink-0" aria-hidden="true" />
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-hidden">
        {loaded ? (
          <OfficialWorkflowEditor
            documentKey={
              workflowID
                ? `workflow-${workflowID}`
                : `new-${selectedTemplate || "blank"}`
            }
            definition={definition}
            nodeSpecs={nodeSpecs}
            onDefinitionChange={handleDefinitionChange}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            正在加载节点能力…
          </div>
        )}
      </div>
    </div>
  )
}
