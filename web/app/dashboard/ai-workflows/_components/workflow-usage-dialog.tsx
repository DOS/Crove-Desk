"use client"

import { useCallback, useEffect, useState } from "react"

import { toast } from "sonner"

import { ProjectDialog } from "@/components/project-dialog"
import { Badge } from "@/components/ui/badge"
import {
  fetchAIWorkflowUsage,
  type AIWorkflow,
  type AIWorkflowUsage,
} from "@/lib/api/admin"

export function WorkflowUsageDialog({
  workflow,
  open,
  onOpenChange,
}: {
  workflow: AIWorkflow | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [usage, setUsage] = useState<AIWorkflowUsage[]>([])
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    if (!workflow || !open) return
    setLoading(true)
    try {
      setUsage((await fetchAIWorkflowUsage(workflow.id)) ?? [])
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "加载使用情况失败")
    } finally {
      setLoading(false)
    }
  }, [open, workflow])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <ProjectDialog
      open={open}
      onOpenChange={onOpenChange}
      title="使用情况"
      description={workflow?.name}
      size="lg"
      bodyClassName="min-h-[360px]"
    >
      {loading ? (
        <div className="flex min-h-64 items-center justify-center text-sm text-muted-foreground">
          正在加载使用情况…
        </div>
      ) : usage.length ? (
        <div className="space-y-3">
          {usage.map((item) => (
            <div
              key={`${item.aiAgentId}-${item.workflowVersionId}`}
              className="flex items-center justify-between rounded-md border p-4"
            >
              <div>
                <div className="font-medium">{item.aiAgentName}</div>
                <div className="mt-1 text-sm text-muted-foreground">
                  固定关联 v{item.workflowVersion}
                </div>
              </div>
              <Badge variant={item.enabled ? "secondary" : "outline"}>
                {item.enabled ? "启用" : "已停用"}
              </Badge>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex min-h-64 items-center justify-center text-sm text-muted-foreground">
          暂未被任何 Agent 使用
        </div>
      )}
    </ProjectDialog>
  )
}
