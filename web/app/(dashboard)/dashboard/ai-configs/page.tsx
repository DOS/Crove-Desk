"use client";

import { useMemo } from "react";

import {
  DashboardCrudPage,
  createDashboardStatusColumn,
  type DashboardCrudColumn,
  type DashboardCrudFilter,
} from "@/components/dashboard/crud";
import { Badge } from "@/components/ui/badge";
import {
  createAIConfig,
  deleteAIConfig,
  fetchAIConfigs,
  updateAIConfig,
  updateAIConfigSort,
  updateAIConfigStatus,
  type AIConfig,
  type CreateAIConfigPayload,
} from "@/lib/api/admin";
import { AIModelType, AIProvider, Status } from "@/lib/generated/enums";
import { useI18n } from "@/i18n/provider";
import { EditDialog } from "./_components/edit";

type TFunction = (key: string, values?: Record<string, string | number>) => string;

function getStatusOptions(t: TFunction) {
  return [
    { value: "all", label: t("aiConfig.allStatuses") },
    { value: String(Status.Ok), label: t("aiConfig.enabled") },
    { value: String(Status.Disabled), label: t("aiConfig.disabled") },
    { value: String(Status.Deleted), label: t("aiConfig.deletedStatus") },
  ];
}

function getProviderOptions(t: TFunction, includeAll = true) {
  const options = [
    { value: String(AIProvider.OpenAI), label: t("aiConfig.providerOpenAI") },
  ];
  return includeAll
    ? [{ value: "all", label: t("aiConfig.allProviders") }, ...options]
    : options;
}

function getModelTypeOptions(t: TFunction, includeAll = true) {
  const options = [
    { value: String(AIModelType.LLM), label: t("aiConfig.modelTypeLlm") },
    {
      value: String(AIModelType.Embedding),
      label: t("aiConfig.modelTypeEmbedding"),
    },
    { value: String(AIModelType.Rerank), label: t("aiConfig.modelTypeRerank") },
  ];
  return includeAll
    ? [{ value: "all", label: t("aiConfig.allTypes") }, ...options]
    : options;
}

function getStatusLabel(value: Status, t: TFunction) {
  return (
    getStatusOptions(t).find((item) => item.value === String(value))?.label ??
    String(value)
  );
}

function getProviderLabel(value: AIProvider, t: TFunction) {
  return (
    getProviderOptions(t, false).find((item) => item.value === String(value))
      ?.label ?? String(value)
  );
}

function getModelTypeLabel(value: AIModelType, t: TFunction) {
  return (
    getModelTypeOptions(t, false).find((item) => item.value === String(value))
      ?.label ?? String(value)
  );
}

function getNextStatus(item: AIConfig) {
  return item.status === Status.Ok ? Status.Disabled : Status.Ok;
}

export default function DashboardAIConfigsPage() {
  const t = useI18n();
  const listStatusOptions = useMemo(() => getStatusOptions(t), [t]);
  const providerFilterOptions = useMemo(() => getProviderOptions(t), [t]);
  const modelTypeFilterOptions = useMemo(() => getModelTypeOptions(t), [t]);

  const filters = useMemo<DashboardCrudFilter[]>(
    () => [
      {
        name: "name",
        label: t("aiConfig.filterName"),
        placeholder: t("aiConfig.filterName"),
        defaultValue: "",
        trim: true,
        className: "w-full sm:w-72",
      },
      {
        name: "modelType",
        label: t("aiConfig.allTypes"),
        type: "select",
        defaultValue: "all",
        allValue: "all",
        options: modelTypeFilterOptions,
        className: "w-full sm:w-40",
      },
      {
        name: "provider",
        label: t("aiConfig.allProviders"),
        type: "select",
        defaultValue: "all",
        allValue: "all",
        options: providerFilterOptions,
        className: "w-full sm:w-40",
      },
      {
        name: "status",
        label: t("aiConfig.allStatuses"),
        type: "select",
        defaultValue: "all",
        allValue: "all",
        options: listStatusOptions,
        className: "w-full sm:w-32",
      },
    ],
    [listStatusOptions, modelTypeFilterOptions, providerFilterOptions, t],
  );

  const columns = useMemo<DashboardCrudColumn<AIConfig>[]>(
    () => [
      {
        key: "config",
        label: t("aiConfig.columnConfig"),
        render: (item) => (
          <div className="space-y-1 text-sm font-medium">{item.name}</div>
        ),
      },
      {
        key: "provider",
        label: t("aiConfig.columnProvider"),
        render: (item) => (
          <Badge variant="outline">
            {getProviderLabel(item.provider as AIProvider, t)}
          </Badge>
        ),
      },
      {
        key: "model",
        label: t("aiConfig.columnModel"),
        render: (item) => (
          <div className="space-y-1">
            <Badge variant="secondary">
              {getModelTypeLabel(item.modelType as AIModelType, t)}
            </Badge>
            <div className="text-sm">{item.modelName}</div>
            {item.dimension > 0 ? (
              <div className="text-xs text-muted-foreground">
                {t("aiConfig.dimension", { count: item.dimension })}
              </div>
            ) : null}
          </div>
        ),
      },
      {
        key: "access",
        label: t("aiConfig.columnAccess"),
        render: (item) => (
          <div className="space-y-1 text-sm">
            <div className="line-clamp-1">{item.baseUrl}</div>
            <div className="text-xs text-muted-foreground">
              {t("aiConfig.apiKey", { key: item.hasApiKey ? "****" : "-" })}
            </div>
          </div>
        ),
      },
      {
        key: "limits",
        label: t("aiConfig.columnLimits"),
        render: (item) => (
          <div className="space-y-1 text-xs text-muted-foreground">
            <div>
              {t("aiConfig.contextTokens", {
                count: item.maxContextTokens || 0,
              })}
            </div>
            <div>
              {t("aiConfig.outputTokens", {
                count: item.maxOutputTokens || 0,
              })}
            </div>
            <div>
              {t("aiConfig.timeoutRetry", {
                timeout: item.timeoutMs,
                retries: item.maxRetryCount,
              })}
            </div>
            <div>
              RPM {item.rpmLimit || 0} / TPM {item.tpmLimit || 0}
            </div>
          </div>
        ),
      },
      createDashboardStatusColumn<AIConfig, number>({
        label: t("aiConfig.columnStatus"),
        getStatus: (item) => item.status,
        getLabel: (status) => getStatusLabel(status as Status, t),
        getBadgeVariant: (status) =>
          status === Status.Ok ? "default" : "outline",
        isEnabled: (status) => status === Status.Ok,
        toggle: {
          getNextStatus,
          updateStatus: (item, nextStatus) =>
            updateAIConfigStatus(item.id, nextStatus),
          successMessage: (item, nextStatus) =>
            t("aiConfig.statusChanged", {
              name: item.name,
              status:
                nextStatus === Status.Ok
                  ? t("aiConfig.enabled")
                  : t("aiConfig.disabled"),
            }),
          errorMessage: t("aiConfig.statusUpdateFailed"),
          ariaLabel: (item) => t("aiConfig.toggleStatus", { name: item.name }),
        },
      }),
    ],
    [t],
  );

  return (
    <DashboardCrudPage<AIConfig, CreateAIConfigPayload>
      filters={filters}
      columns={columns}
      fetchList={(query) =>
        fetchAIConfigs({
          name: typeof query.name === "string" ? query.name : undefined,
          status: typeof query.status === "string" ? query.status : undefined,
          provider:
            typeof query.provider === "string" ? query.provider : undefined,
          modelType:
            typeof query.modelType === "string" ? query.modelType : undefined,
          page: Number(query.page),
          limit: Number(query.limit),
        })
      }
      getItemId={(item) => item.id}
      createItem={createAIConfig}
      updateItem={(item, payload) => updateAIConfig({ id: item.id, ...payload })}
      deleteItem={(item) => deleteAIConfig(item.id)}
      canDelete={(item) => item.status !== Status.Ok}
      deleteConfirm={(item) => ({
        title: t("aiConfig.confirmDeleteTitle"),
        description: t("aiConfig.confirmDeleteDescription", {
          name: item.name,
        }),
        confirmText: t("aiConfig.confirmDelete"),
        cancelText: t("aiConfig.cancel"),
        variant: "destructive",
      })}
      sort={{
        enabled: true,
        onReorder: (items) => updateAIConfigSort(items.map((item) => item.id)),
        successMessage: t("aiConfig.sortUpdated"),
        errorMessage: t("aiConfig.sortUpdateFailed"),
        handleLabel: t("aiConfig.dragSort", { name: "" }),
      }}
      renderEditDialog={({ open, saving, itemId, onOpenChange, onSubmit }) => (
        <EditDialog
          open={open}
          saving={saving}
          itemId={itemId}
          onOpenChange={onOpenChange}
          onSubmit={onSubmit}
        />
      )}
      labels={{
        refresh: t("aiConfig.refresh"),
        create: t("aiConfig.new"),
        query: t("aiConfig.query"),
        loading: t("aiConfig.loadingRows"),
        empty: t("aiConfig.emptyRows"),
        actions: t("aiConfig.columnActions"),
        edit: t("aiConfig.edit"),
        delete: t("aiConfig.delete"),
        processing: t("aiConfig.deleting"),
        moreActions: (item) => t("aiConfig.moreActions", { name: item.name }),
        loadFailed: t("aiConfig.loadFailed"),
        saveFailed: t("aiConfig.saveFailed"),
        deleteFailed: t("aiConfig.deleteFailed"),
        created: (payload) => t("aiConfig.created", { name: payload.name }),
        updated: (item) => t("aiConfig.updated", { name: item.name }),
        deleted: (item) => t("aiConfig.deleted", { name: item.name }),
      }}
    />
  );
}
