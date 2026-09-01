"use client"

import { useCallback, useEffect, useState } from "react"

import { toast } from "sonner"

import { ProjectDialog } from "@/components/project-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useI18n } from "@/i18n/provider"
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
  const t = useI18n()
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
      toast.error(error instanceof Error ? error.message : t("aiWorkflow.loadFailed"))
    } finally {
      setLoading(false)
    }
  }, [open, t, workflow])

  useEffect(() => {
    void load()
  }, [load])

  async function restore(version: AIWorkflowVersion) {
    if (!workflow || restoringId !== null) return
    setRestoringId(version.id)
    try {
      await restoreAIWorkflowVersion(workflow.id, version.id)
      onRestored()
      toast.success(t("aiWorkflow.restoredDraftSuccess", { version: String(version.version) }))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("aiWorkflow.restoreFailed"))
    } finally {
      setRestoringId(null)
    }
  }

  return (
    <ProjectDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("aiWorkflow.versionsTitle")}
      description={workflow?.name}
      size="lg"
      bodyClassName="min-h-[360px]"
    >
      {loading ? (
        <div className="flex min-h-64 items-center justify-center text-sm text-muted-foreground">
          {t("aiWorkflow.loadingVersions")}
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
                  {t("aiWorkflow.publisher", { name: version.publishedByName || "-" })}
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={restoringId !== null}
                onClick={() => void restore(version)}
              >
                {restoringId === version.id ? t("aiWorkflow.restoring") : t("aiWorkflow.restoreToDraft")}
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex min-h-64 items-center justify-center text-sm text-muted-foreground">
          {t("aiWorkflow.noVersionsYet")}
        </div>
      )}
    </ProjectDialog>
  )
}
