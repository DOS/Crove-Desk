"use client"

import { useState } from "react"
import { GitBranchIcon } from "lucide-react"

import { DashboardCrudPage } from "@/components/dashboard/crud"
import { ProjectDialog } from "@/components/project-dialog"
import { Badge } from "@/components/ui/badge"
import { deleteAIWorkflow, fetchAIWorkflows, type AIWorkflow, type CreateAIWorkflowPayload } from "@/lib/api/admin"
import { formatDateTime } from "@/lib/utils"

import { WorkflowWorkbench } from "./_components/workflow-workbench"

export default function DashboardAIWorkflowsPage() {
  const [reloadKey, setReloadKey] = useState(0)
  return <DashboardCrudPage<AIWorkflow, CreateAIWorkflowPayload>
    filters={[{ name: "name", label: "工作流名称", placeholder: "搜索工作流名称", defaultValue: "", trim: true, className: "w-full sm:w-72" }]}
    columns={[
      { key: "workflow", label: "工作流", render: (item) => <div className="flex items-start gap-3"><div className="mt-0.5 flex size-8 items-center justify-center rounded-md bg-muted text-muted-foreground"><GitBranchIcon className="size-4" /></div><div className="min-w-0"><div className="font-medium">{item.name}</div><div className="mt-1 line-clamp-2 text-sm text-muted-foreground">{item.description || "暂无业务说明"}</div></div></div> },
      { key: "status", label: "状态", render: (item) => <Badge variant={item.publishedVersionId ? "secondary" : "outline"}>{item.publishedVersionId ? "已发布" : "草稿"}</Badge> },
      { key: "version", label: "当前版本", render: (item) => item.publishedVersionId ? `已发布 #${item.publishedVersionId}` : "-" },
      { key: "updatedAt", label: "更新时间", render: (item) => formatDateTime(item.updatedAt) },
    ]}
    fetchList={(query) => fetchAIWorkflows({ name: typeof query.name === "string" ? query.name : undefined, page: Number(query.page), limit: Number(query.limit) })}
    getItemId={(item) => item.id}
    createItem={async () => undefined}
    updateItem={async () => undefined}
    deleteItem={(item) => deleteAIWorkflow(item.id)}
    reloadKey={reloadKey}
    renderEditDialog={({ open, item, itemId, onOpenChange }) => <ProjectDialog open={open} onOpenChange={onOpenChange} title={item ? "编辑工作流" : "新建工作流"} size="xxl" defaultFullscreen allowFullscreen bodyScrollable={false} headerClassName="sr-only"><WorkflowWorkbench workflowID={itemId ?? undefined} onSaved={() => setReloadKey((value) => value + 1)} /></ProjectDialog>}
    labels={{ refresh: "刷新", create: "创建工作流", query: "查询", loading: "正在加载工作流…", empty: "暂无工作流", actions: "操作", edit: "编辑", delete: "删除", processing: "处理中…", moreActions: (item) => `${item.name} 的更多操作`, loadFailed: "加载工作流失败", saveFailed: "保存工作流失败", deleteFailed: "删除工作流失败", created: (payload) => `已创建 ${payload.name}`, updated: (item) => `已更新 ${item.name}`, deleted: (item) => `已删除 ${item.name}` }}
  />
}
