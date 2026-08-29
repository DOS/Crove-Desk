"use client"

import { useState } from "react"

import {
  GitBranchIcon,
  HistoryIcon,
  UsersIcon,
} from "lucide-react"

import { DashboardCrudPage } from "@/components/dashboard/crud"
import { ProjectDialog } from "@/components/project-dialog"
import { Badge } from "@/components/ui/badge"
import {
  deleteAIWorkflow,
  fetchAIWorkflows,
  type AIWorkflow,
  type CreateAIWorkflowPayload,
} from "@/lib/api/admin"
import { useI18n } from "@/i18n/provider"
import { formatDateTime } from "@/lib/utils"

import { WorkflowUsageDialog } from "./_components/workflow-usage-dialog"
import { WorkflowVersionsDialog } from "./_components/workflow-versions-dialog"
import { WorkflowWorkbench } from "./_components/workflow-workbench"

export default function DashboardAIWorkflowsPage() {
  const t = useI18n()
  const [reloadKey, setReloadKey] = useState(0)
  const [versionsWorkflow, setVersionsWorkflow] =
    useState<AIWorkflow | null>(null)
  const [usageWorkflow, setUsageWorkflow] = useState<AIWorkflow | null>(null)

  return (
    <>
      <DashboardCrudPage<AIWorkflow, CreateAIWorkflowPayload>
        filters={[
          {
            name: "name",
            label: t("aiWorkflow.filterName"),
            placeholder: t("aiWorkflow.searchName"),
            defaultValue: "",
            trim: true,
            className: "w-full sm:w-72",
          },
        ]}
        columns={[
          {
            key: "workflow",
            label: t("aiWorkflow.columnWorkflow"),
            render: (item) => (
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex size-8 items-center justify-center rounded-md bg-muted text-muted-foreground">
                  <GitBranchIcon className="size-4" />
                </div>
                <div className="min-w-0">
                  <div className="font-medium">{item.name}</div>
                  <div className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                    {item.description || t("aiWorkflow.noDescription")}
                  </div>
                </div>
              </div>
            ),
          },
          {
            key: "status",
            label: t("aiWorkflow.columnStatus"),
            render: (item) => (
              <Badge
                variant={item.publishedVersionId ? "secondary" : "outline"}
              >
                {item.publishedVersionId ? t("aiWorkflow.published") : t("aiWorkflow.draft")}
              </Badge>
            ),
          },
          {
            key: "version",
            label: t("aiWorkflow.currentVersion"),
            render: (item) =>
              item.publishedVersionId
                ? t("aiWorkflow.publishedVersion", { version: item.publishedVersionId })
                : "-",
          },
          {
            key: "updatedAt",
            label: t("common.actions"),
            render: (item) => formatDateTime(item.updatedAt),
          },
        ]}
        fetchList={(query) =>
          fetchAIWorkflows({
            name: typeof query.name === "string" ? query.name : undefined,
            page: Number(query.page),
            limit: Number(query.limit),
          })
        }
        getItemId={(item) => item.id}
        createItem={async () => undefined}
        updateItem={async () => undefined}
        deleteItem={(item) => deleteAIWorkflow(item.id)}
        rowActions={[
          {
            key: "versions",
            label: t("aiWorkflow.versionHistory"),
            icon: <HistoryIcon />,
            run: ({ item }) => setVersionsWorkflow(item),
          },
          {
            key: "usage",
            label: t("aiWorkflow.usage"),
            icon: <UsersIcon />,
            run: ({ item }) => setUsageWorkflow(item),
          },
        ]}
        reloadKey={reloadKey}
        renderEditDialog={({ open, item, itemId, onOpenChange }) => (
          <ProjectDialog
            open={open}
            onOpenChange={onOpenChange}
            title={item ? t("aiWorkflow.editTitle") : t("aiWorkflow.createTitle")}
            defaultFullscreen
            bodyScrollable={false}
            headerClassName="sr-only"
          >
            <WorkflowWorkbench
              workflowID={itemId ?? undefined}
              onSaved={() => setReloadKey((value) => value + 1)}
            />
          </ProjectDialog>
        )}
        labels={{
          refresh: t("aiWorkflow.refresh"),
          create: t("aiWorkflow.create"),
          query: t("aiWorkflow.query"),
          loading: t("aiWorkflow.loading"),
          empty: t("aiWorkflow.empty"),
          actions: t("aiWorkflow.actions"),
          edit: t("aiWorkflow.edit"),
          delete: t("aiWorkflow.delete"),
          processing: t("aiWorkflow.processing"),
          moreActions: (item) => t("aiWorkflow.moreActions", { name: item.name }),
          loadFailed: t("aiWorkflow.loadFailed"),
          saveFailed: t("aiWorkflow.saveFailed"),
          deleteFailed: t("aiWorkflow.deleteFailed"),
          created: (payload) => t("aiWorkflow.created", { name: payload.name }),
          updated: (item) => t("aiWorkflow.updated", { name: item.name }),
          deleted: (item) => t("aiWorkflow.deleted", { name: item.name }),
        }}
      />

      <WorkflowVersionsDialog
        workflow={versionsWorkflow}
        open={versionsWorkflow !== null}
        onOpenChange={(open) => {
          if (!open) setVersionsWorkflow(null)
        }}
        onRestored={() => setReloadKey((value) => value + 1)}
      />
      <WorkflowUsageDialog
        workflow={usageWorkflow}
        open={usageWorkflow !== null}
        onOpenChange={(open) => {
          if (!open) setUsageWorkflow(null)
        }}
      />
    </>
  )
}
