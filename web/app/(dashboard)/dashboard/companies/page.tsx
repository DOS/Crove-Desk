"use client"

import { BanIcon, CheckCircle2Icon } from "lucide-react"

import {
  createDashboardStatusColumn,
  createDashboardStatusToggleAction,
  DashboardCrudPage,
} from "@/components/dashboard/crud"
import {
  createCompany,
  deleteCompany,
  fetchCompanies,
  fetchCompany,
  updateCompany,
  updateCompanyStatus,
  type AdminCompany,
  type CreateAdminCompanyPayload,
} from "@/lib/api/company"
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

export default function DashboardCompaniesPage() {
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
    <DashboardCrudPage<AdminCompany, CreateAdminCompanyPayload>
      filters={[
        {
          name: "name",
          label: t("company.filterName"),
          placeholder: t("company.filterName"),
          defaultValue: "",
          trim: true,
          className: "w-full sm:w-72",
        },
        {
          name: "code",
          label: t("company.filterCode"),
          placeholder: t("company.filterCode"),
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
          key: "id",
          label: "ID",
          className: "w-20",
          render: (item) => item.id,
        },
        {
          key: "name",
          label: t("company.columnName"),
          render: (item) => <span className="font-medium">{item.name}</span>,
        },
        {
          key: "code",
          label: t("company.columnCode"),
          render: (item) => (
            <span className="text-muted-foreground">{item.code || "-"}</span>
          ),
        },
        {
          key: "customerCount",
          label: t("company.columnCustomerCount"),
          className: "w-28",
          render: (item) => item.customerCount,
        },
        createDashboardStatusColumn<AdminCompany, Status>({
          label: t("company.columnStatus"),
          className: "w-24",
          getStatus: (item) => item.status as Status,
          getLabel: (status) =>
            StatusLabels[status] ? getStatusLabel(status, t) : t("company.unknownStatus"),
          getBadgeVariant: (status) =>
            status === Status.Ok
              ? "default"
              : status === Status.Deleted
                ? "outline"
                : "secondary",
        }),
        {
          key: "remark",
          label: t("company.columnRemark"),
          render: (item) => (
            <div className="line-clamp-2 max-w-[320px] text-muted-foreground">
              {item.remark || "-"}
            </div>
          ),
        },
      ]}
      fetchList={fetchCompanies}
      getItemId={(item) => item.id}
      createItem={createCompany}
      updateItem={(item, payload) => updateCompany({ id: item.id, ...payload })}
      deleteItem={(item) => deleteCompany(item.id)}
      canDelete={(item) => item.status !== Status.Deleted}
      form={{
        fetchDetail: fetchCompany,
        fields: [
          {
            name: "name",
            label: t("company.columnName"),
            placeholder: t("company.namePlaceholder"),
            required: true,
            requiredMessage: t("company.nameRequired"),
            trim: true,
          },
          {
            name: "code",
            label: t("company.columnCode"),
            placeholder: t("company.optional"),
            trim: true,
          },
          {
            name: "remark",
            label: t("company.columnRemark"),
            placeholder: t("company.remarkPlaceholder"),
            type: "textarea",
            rows: 4,
            trim: true,
          },
        ],
        transformSubmitValues: (values) => ({
          name: String(values.name ?? ""),
          code: String(values.code ?? ""),
          remark: String(values.remark ?? ""),
        }),
        labels: {
          createTitle: t("company.createTitle"),
          editTitle: t("company.editTitle"),
          create: t("company.create"),
          save: t("company.save"),
          saving: t("company.saving"),
          cancel: t("company.cancel"),
          loadingDetail: t("company.loadingDetail"),
          required: t("company.nameRequired"),
          invalidNumber: t("company.nameRequired"),
          minValue: () => t("company.nameRequired"),
          maxValue: () => t("company.nameRequired"),
        },
      }}
      rowActions={[
        createDashboardStatusToggleAction<AdminCompany, Status>({
          disabled: (item) => item.status === Status.Deleted,
          icon: (item) =>
            item.status === Status.Ok ? <BanIcon /> : <CheckCircle2Icon />,
          label: (item) =>
            item.status === Status.Ok ? t("company.disable") : t("company.enable"),
          getNextStatus: (item) =>
            item.status === Status.Ok ? Status.Disabled : Status.Ok,
          updateStatus: (item, nextStatus) => updateCompanyStatus(item.id, nextStatus),
          successMessage: (item, nextStatus) =>
            t(nextStatus === Status.Ok ? "company.enabled" : "company.disabled", {
              name: item.name,
            }),
          errorMessage: t("company.statusUpdateFailed"),
        }),
      ]}
      labels={{
        refresh: t("company.refresh"),
        create: t("company.new"),
        query: t("company.query"),
        loading: t("company.loading"),
        empty: t("company.empty"),
        actions: t("company.columnActions"),
        edit: t("company.edit"),
        delete: t("company.delete"),
        processing: t("company.processing"),
        moreActions: (item) => t("company.moreActions", { name: item.name }),
        loadFailed: t("company.loadFailed"),
        saveFailed: t("company.saveFailed"),
        deleteFailed: t("company.deleteFailed"),
        created: (payload) => t("company.created", { name: payload.name }),
        updated: (item) => t("company.updated", { name: item.name }),
        deleted: (item) => t("company.deleted", { name: item.name }),
      }}
    />
  )
}
