"use client"

import { FileTextIcon, RefreshCwIcon } from "lucide-react"

import {
  createDashboardStatusColumn,
  createDashboardStatusToggleAction,
  DashboardCrudPage,
} from "@/components/dashboard/crud"
import { Badge } from "@/components/ui/badge"
import {
  createQuickReply,
  deleteQuickReply,
  fetchQuickReply,
  fetchQuickReplies,
  updateQuickReply,
  type AdminQuickReply,
  type CreateAdminQuickReplyPayload,
} from "@/lib/api/admin"
import { getEnumOptions } from "@/lib/enums"
import { Status, StatusLabels } from "@/lib/generated/enums"
import { useI18n } from "@/i18n/provider"

function getStatusLabel(status: Status, t: (key: string) => string) {
  if (status === Status.Disabled) {
    return t("status.disabled")
  }
  if (status === Status.Deleted) {
    return t("status.deleted")
  }
  return t("status.ok")
}

export default function DashboardQuickRepliesPage() {
  const t = useI18n()
  const listStatusOptions = [
    { value: "all", label: t("status.all") },
    ...getEnumOptions(StatusLabels)
      .filter((item) => Number(item.value) !== Status.Deleted)
      .map((item) => ({
        value: String(item.value),
        label: getStatusLabel(item.value as Status, t),
      })),
  ]

  return (
    <DashboardCrudPage<AdminQuickReply, CreateAdminQuickReplyPayload>
      filters={[
        {
          name: "title",
          label: t("quickReply.filterTitle"),
          placeholder: t("quickReply.filterTitle"),
          defaultValue: "",
          trim: true,
          className: "w-full sm:w-72",
        },
        {
          name: "groupName",
          label: t("quickReply.filterGroup"),
          placeholder: t("quickReply.filterGroup"),
          defaultValue: "",
          trim: true,
          className: "w-full sm:w-44",
        },
        {
          name: "status",
          label: t("status.all"),
          type: "select",
          defaultValue: "all",
          allValue: "all",
          options: listStatusOptions,
          className: "w-full sm:w-36",
        },
      ]}
      columns={[
        {
          key: "quickReply",
          label: t("quickReply.columnQuickReply"),
          render: (item) => (
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex size-8 items-center justify-center rounded-md bg-muted text-muted-foreground">
                <FileTextIcon className="size-4" />
              </div>
              <div className="min-w-0">
                <div className="font-medium">{item.title}</div>
                <div className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                  {item.content}
                </div>
              </div>
            </div>
          ),
        },
        {
          key: "groupName",
          label: t("quickReply.columnGroup"),
          render: (item) => <Badge variant="outline">{item.groupName}</Badge>,
        },
        createDashboardStatusColumn<AdminQuickReply, Status>({
          label: t("quickReply.columnStatus"),
          getStatus: (item) => item.status as Status,
          getLabel: (status) => getStatusLabel(status, t),
          getBadgeVariant: (status) => (status === Status.Ok ? "default" : "outline"),
        }),
        {
          key: "sortNo",
          label: t("quickReply.columnSort"),
          render: (item) => item.sortNo,
        },
        {
          key: "createdBy",
          label: t("quickReply.columnCreator"),
          render: (item) => item.createdBy || "-",
        },
      ]}
      fetchList={fetchQuickReplies}
      getItemId={(item) => item.id}
      createItem={createQuickReply}
      updateItem={(item, payload) => updateQuickReply({ id: item.id, ...payload })}
      deleteItem={(item) => deleteQuickReply(item.id)}
      form={{
        fetchDetail: fetchQuickReply,
        fields: [
          {
            name: "groupName",
            label: t("quickReply.groupName"),
            placeholder: t("quickReply.groupNamePlaceholder"),
            required: true,
            requiredMessage: t("quickReply.groupNameRequired"),
            trim: true,
          },
          {
            name: "title",
            label: t("quickReply.title"),
            placeholder: t("quickReply.titlePlaceholder"),
            required: true,
            requiredMessage: t("quickReply.titleRequired"),
            trim: true,
          },
          {
            name: "content",
            label: t("quickReply.content"),
            placeholder: t("quickReply.contentPlaceholder"),
            type: "textarea",
            rows: 6,
            required: true,
            requiredMessage: t("quickReply.contentRequired"),
            trim: true,
          },
          {
            name: "status",
            label: t("quickReply.columnStatus"),
            type: "select",
            defaultValue: String(Status.Ok),
            valueType: "number",
            required: true,
            requiredMessage: t("quickReply.statusRequired"),
            options: listStatusOptions.filter((item) => item.value !== "all"),
            valueFromItem: (item) => String(item.status),
          },
          {
            name: "sortNo",
            label: t("quickReply.columnSort"),
            placeholder: t("quickReply.sortPlaceholder"),
            type: "number",
            defaultValue: "0",
            min: 0,
            step: 1,
            required: true,
            requiredMessage: t("quickReply.sortRequired"),
            pattern: /^\d+$/,
            patternMessage: t("quickReply.sortInvalid"),
          },
        ],
        transformSubmitValues: (values) => ({
          groupName: String(values.groupName ?? ""),
          title: String(values.title ?? ""),
          content: String(values.content ?? ""),
          status: Number(values.status),
          sortNo: Number(values.sortNo),
        }),
        labels: {
          createTitle: t("quickReply.createTitle"),
          editTitle: t("quickReply.editTitle"),
          create: t("quickReply.create"),
          save: t("quickReply.save"),
          saving: t("quickReply.saving"),
          cancel: t("quickReply.cancel"),
          loadingDetail: t("quickReply.loadingDetail"),
          required: t("quickReply.titleRequired"),
          invalidNumber: t("quickReply.sortInvalid"),
          minValue: () => t("quickReply.sortInvalid"),
          maxValue: () => t("quickReply.sortInvalid"),
        },
      }}
      rowActions={[
        createDashboardStatusToggleAction<AdminQuickReply, Status>({
          icon: <RefreshCwIcon />,
          label: (item) =>
            item.status === Status.Ok
              ? t("quickReply.disable")
              : t("quickReply.enable"),
          getNextStatus: (item) =>
            item.status === Status.Ok ? Status.Disabled : Status.Ok,
          updateStatus: (item, nextStatus) =>
            updateQuickReply({
              id: item.id,
              groupName: item.groupName,
              title: item.title,
              content: item.content,
              sortNo: item.sortNo,
              status: nextStatus,
            }),
          successMessage: (item, nextStatus) =>
            t(
              nextStatus === Status.Ok
                ? "quickReply.enabled"
                : "quickReply.disabled",
              { title: item.title }
            ),
          errorMessage: t("quickReply.statusUpdateFailed"),
        }),
      ]}
      labels={{
        refresh: t("quickReply.refresh"),
        create: t("quickReply.new"),
        query: t("quickReply.query"),
        loading: t("quickReply.loading"),
        empty: t("quickReply.empty"),
        actions: t("quickReply.columnActions"),
        edit: t("quickReply.edit"),
        delete: t("quickReply.delete"),
        processing: t("quickReply.processing"),
        moreActions: (item) =>
          t("quickReply.moreActions", { title: item.title }),
        loadFailed: t("quickReply.loadFailed"),
        saveFailed: t("quickReply.saveFailed"),
        deleteFailed: t("quickReply.deleteFailed"),
        created: (payload) => t("quickReply.created", { title: payload.title }),
        updated: (item) => t("quickReply.updated", { title: item.title }),
        deleted: (item) => t("quickReply.deleted", { title: item.title }),
      }}
    />
  )
}
