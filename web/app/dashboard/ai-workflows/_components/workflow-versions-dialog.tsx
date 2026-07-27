"use client"

import { useCallback, useEffect, useState } from "react"

import { toast } from "sonner"

import { ProjectDialog } from "@/components/project-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  fetchAIWorkflowVersions,
  restoreAIWorkflowVersion,
  type AIWorkflow,
  type AIWorkflowVersion,
} from "@/lib/api/admin"
import { formatDateTime } from "@/lib/utils"

export function WorkflowVersionsDialog({
  workflow,
  open,
  onOpenChange,
  onRestored,
}: {
  workflow: AIWorkflow | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onRestored: () => void
}) {
  const [versions, setVersions] = useState<AIWorkflowVersion[]>([])
  const [loading, setLoading] = useState(false)
  const [restoringId, setRestoringId] = useState<number | null>(null)

  const load = useCallback(async () => {
    if (!workflow || !open) return
    setLoading(true)
    try {
      const page = await fetchAIWorkflowVersions({
        workflowId: workflow.id,
        limit: 50,
      })
      setVersions(page.results ?? [])
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "加载版本历史失败")
    } finally {
      setLoading(false)
    }
  }, [open, workflow])

  useEffect(() => {
    void load()
  }, [load])

  async function restore(version: AIWorkflowVersion) {
    if (!workflow || restoringId !== null) return
    setRestoringId(version.id)
    try {
      await restoreAIWorkflowVersion(workflow.id, version.id)
      onRestored()
      toast.success(`已将 v${version.version} 恢复为草稿`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "恢复失败")
    } finally {
      setRestoringId(null)
    }
  }

  return (
    <ProjectDialog
      open={open}
      onOpenChange={onOpenChange}
      title="版本历史"
      description={workflow?.name}
      size="lg"
      bodyClassName="min-h-[360px]"
    >
      {loading ? (
        <div className="flex min-h-64 items-center justify-center text-sm text-muted-foreground">
          正在加载版本历史…
        </div>
      ) : versions.length ? (
        <div className="space-y-3">
          {versions.map((version) => (
            <div
              key={version.id}
              className="flex items-center gap-4 rounded-md border p-4"
            >
              <Badge>v{version.version}</Badge>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">
                  {formatDateTime(version.publishedAt || version.createdAt)}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  发布人：{version.publishedByName || "-"}
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={restoringId !== null}
                onClick={() => void restore(version)}
              >
                {restoringId === version.id ? "恢复中…" : "恢复为草稿"}
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex min-h-64 items-center justify-center text-sm text-muted-foreground">
          尚未发布版本
        </div>
      )}
    </ProjectDialog>
  )
}
