"use client"

import { CircleHelpIcon, FileTextIcon, RefreshCwIcon } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"

import { DashboardCrudPage } from "@/components/dashboard/crud"
import { Badge } from "@/components/ui/badge"
import { EditDialog } from "./_components/knowledge-base-edit"
import {
  createKnowledgeBase,
  deleteKnowledgeBase,
  fetchKnowledgeBases,
  rebuildKnowledgeBaseIndex,
  updateKnowledgeBase,
  updateKnowledgeBaseSort,
  type CreateKnowledgeBasePayload,
  type KnowledgeBase,
} from "@/lib/api/admin"
import { KnowledgeBaseType, Status } from "@/lib/generated/enums"
import { useI18n } from "@/i18n/provider"
import { formatDateTime } from "@/lib/utils"

export default function DashboardKnowledgePage() {
  const t = useI18n()

  const statusOptions = [
    { value: "all", label: t("knowledge.allStatus") },
    { value: String(Status.Ok), label: t("knowledge.statusOk") },
    { value: String(Status.Disabled), label: t("knowledge.statusDisabled") },
    { value: String(Status.Deleted), label: t("knowledge.statusDeleted") },
  ]

  return (
    <DashboardCrudPage<KnowledgeBase, CreateKnowledgeBasePayload>
      filters={[
        {
          name: "name",
          label: t("knowledge.searchBase"),
          placeholder: t("knowledge.searchBase"),
          defaultValue: "",
          trim: true,
          className: "w-full sm:w-80",
        },
        {
          name: "status",
          label: t("knowledge.allStatus"),
          type: "select",
          defaultValue: "all",
          allValue: "all",
          options: statusOptions,
          className: "w-full sm:w-36",
        },
      ]}
      columns={[
        {
          key: "knowledgeBase",
          label: t("knowledge.columnBase"),
          className: "w-[36rem] max-w-[36rem]",
          render: (item) => {
            const isFAQ = item.knowledgeType === KnowledgeBaseType.FAQ
            const Icon = isFAQ ? CircleHelpIcon : FileTextIcon
            return (
              <div className="flex w-full min-w-0 items-start gap-3">
                <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                  <Icon className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/dashboard/knowledge/detail?id=${item.id}`}
                    className="block truncate font-medium hover:underline"
                  >
                    {item.name}
                  </Link>
                  <p className="mt-1 truncate text-xs text-muted-foreground">
                    {item.description || t("knowledge.noDescription")}
                  </p>
                </div>
              </div>
            )
          },
        },
        {
          key: "type",
          label: t("knowledge.columnType"),
          render: (item) => <Badge variant="outline">{item.knowledgeTypeName}</Badge>,
        },
        {
          key: "contentCount",
          label: t("knowledge.columnContent"),
          render: (item) => (
            <span className="text-muted-foreground">
              {item.knowledgeType === KnowledgeBaseType.FAQ
                ? `${item.faqCount} ${t("knowledge.faq")}`
                : `${item.documentCount} ${t("knowledge.document")}`}
            </span>
          ),
        },
        {
          key: "status",
          label: t("knowledge.columnStatus"),
          render: (item) => (
            <Badge variant={item.status === Status.Ok ? "secondary" : "outline"}>
              {item.statusName}
            </Badge>
          ),
        },
        {
          key: "updatedAt",
          label: t("knowledge.columnUpdatedAt"),
          className: "whitespace-nowrap",
          render: (item) => (
            <span className="text-sm text-muted-foreground">{formatDateTime(item.updatedAt)}</span>
          ),
        },
      ]}
      fetchList={fetchKnowledgeBases}
      getItemId={(item) => item.id}
      createItem={createKnowledgeBase}
      updateItem={(item, payload) => updateKnowledgeBase({ id: item.id, ...payload })}
      deleteItem={(item) => deleteKnowledgeBase(item.id)}
      renderEditDialog={({ open, saving, itemId, onOpenChange, onSubmit }) => (
        <EditDialog
          open={open}
          saving={saving}
          itemId={itemId}
          onOpenChange={onOpenChange}
          onSubmit={onSubmit}
        />
      )}
      rowActions={[
        {
          key: "rebuild-index",
          label: (item) => t("knowledge.rebuildIndex"),
          icon: <RefreshCwIcon />,
          run: async ({ item }) => {
            await rebuildKnowledgeBaseIndex(item.id)
            toast.success(t("knowledge.rebuildStarted", { name: item.name }))
          },
        },
      ]}
      sort={{
        enabled: true,
        onReorder: (items) => updateKnowledgeBaseSort(items.map((item) => item.id)),
        successMessage: t("knowledge.sortUpdated"),
        errorMessage: t("knowledge.sortUpdateFailed"),
        handleLabel: t("knowledge.sortHandle"),
      }}
      pageSize={1000}
      labels={{
        refresh: t("knowledge.refreshBases"),
        create: t("knowledge.createBaseTitle"),
        query: t("knowledge.query"),
        loading: t("knowledge.loading"),
        empty: t("knowledge.emptyBases"),
        actions: t("knowledge.columnActions"),
        edit: t("knowledge.edit"),
        delete: t("knowledge.delete"),
        processing: t("knowledge.processing"),
        moreActions: (item) => t("knowledge.moreActions", { name: item.name }),
        loadFailed: t("knowledge.loadBasesFailed"),
        saveFailed: t("knowledge.baseSaveFailed"),
        deleteFailed: t("knowledge.baseDeleteFailed"),
        created: (payload) => t("knowledge.baseCreated", { name: payload.name }),
        updated: (item, payload) => t("knowledge.baseUpdated", { name: payload.name || item.name }),
        deleted: (item) => t("knowledge.baseDeleted", { name: item.name }),
      }}
    />
  )
}
