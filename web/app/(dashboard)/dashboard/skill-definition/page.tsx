"use client";

import { BrainCircuitIcon, BugIcon, RotateCcwIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import {
  DashboardCrudPage,
  createDashboardStatusColumn,
  type DashboardCrudColumn,
  type DashboardCrudFilter,
} from "@/components/dashboard/crud";
import { Badge } from "@/components/ui/badge";
import {
  createSkillDefinition,
  deleteSkillDefinition,
  fetchSkillDefinitions,
  restoreSkillDefinition,
  updateSkillDefinition,
  updateSkillDefinitionStatus,
  type CreateSkillDefinitionPayload,
  type SkillDefinition,
} from "@/lib/api/admin";
import { useI18n } from "@/i18n/provider";
import { Status } from "@/lib/generated/enums";
import { formatDateTime } from "@/lib/utils";
import { EditDialog } from "./_components/edit";
import { DebugDialog } from "./_components/debug-dialog";

type TFunction = (key: string, values?: Record<string, string | number>) => string;

function statusLabel(status: number, t: TFunction) {
  if (status === Status.Ok) return t("skillDefinition.statusOk");
  if (status === Status.Disabled) return t("skillDefinition.statusDisabled");
  if (status === Status.Deleted) return t("skillDefinition.statusDeleted");
  return String(status);
}

function getStatusFilterOptions(t: TFunction) {
  return [
    { value: "all", label: t("skillDefinition.allStatus") },
    { value: String(Status.Ok), label: t("skillDefinition.statusOk") },
    { value: String(Status.Disabled), label: t("skillDefinition.statusDisabled") },
    { value: String(Status.Deleted), label: t("skillDefinition.statusDeleted") },
  ];
}

function statusBadgeVariant(status: number) {
  if (status === Status.Deleted) return "destructive";
  if (status === Status.Ok) return "default";
  return "outline";
}

function getNextStatus(item: SkillDefinition) {
  return item.status === Status.Ok ? Status.Disabled : Status.Ok;
}

export default function DashboardSkillsPage() {
  const t = useI18n();
  const [debugDialogOpen, setDebugDialogOpen] = useState(false);
  const [debuggingItem, setDebuggingItem] = useState<SkillDefinition | null>(
    null,
  );
  const statusFilterOptions = useMemo(() => getStatusFilterOptions(t), [t]);

  const filters = useMemo<DashboardCrudFilter[]>(
    () => [
      {
        name: "name",
        label: t("skillDefinition.filterName"),
        placeholder: t("skillDefinition.filterName"),
        defaultValue: "",
        trim: true,
        className: "w-full sm:w-72",
      },
      {
        name: "status",
        label: t("skillDefinition.allStatus"),
        type: "select",
        defaultValue: "all",
        allValue: "all",
        valueType: "number",
        options: statusFilterOptions,
        className: "w-full sm:w-36",
      },
    ],
    [statusFilterOptions, t],
  );

  const columns = useMemo<DashboardCrudColumn<SkillDefinition>[]>(
    () => [
      {
        key: "skill",
        label: "Skill",
        render: (item) => (
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex size-10 items-center justify-center rounded-md bg-muted text-muted-foreground">
              <BrainCircuitIcon className="size-4" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <div className="font-medium">{item.name}</div>
                <Badge variant="secondary">
                  {t("skillDefinition.whitelistCount", {
                    count: item.toolWhitelist.length,
                  })}
                </Badge>
                <Badge variant="secondary">
                  {t("skillDefinition.exampleCount", {
                    count: item.examples.length,
                  })}
                </Badge>
              </div>
              <div className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">
                {item.description || t("skillDefinition.noDescription")}
              </div>
              {item.toolWhitelist.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {item.toolWhitelist.slice(0, 3).map((toolCode) => (
                    <Badge key={toolCode} variant="outline">
                      {toolCode}
                    </Badge>
                  ))}
                  {item.toolWhitelist.length > 3 ? (
                    <Badge variant="outline">
                      +{item.toolWhitelist.length - 3}
                    </Badge>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        ),
      },
      createDashboardStatusColumn<SkillDefinition, number>({
        label: t("skillDefinition.status"),
        getStatus: (item) => item.status,
        getLabel: (status) => statusLabel(status, t),
        getBadgeVariant: statusBadgeVariant,
        isEnabled: (status) => status === Status.Ok,
        toggle: {
          disabled: (item) => item.status === Status.Deleted,
          getNextStatus,
          updateStatus: (item, nextStatus) =>
            updateSkillDefinitionStatus(item.id, nextStatus),
          successMessage: (item, nextStatus) =>
            t(nextStatus === Status.Ok ? "skillDefinition.enabled" : "skillDefinition.disabled", {
              name: item.name,
            }),
          errorMessage: t("skillDefinition.statusUpdateFailed"),
          ariaLabel: (item) =>
            t("skillDefinition.toggleStatus", { name: item.name }),
        },
      }),
      {
        key: "updatedAt",
        label: t("skillDefinition.updatedAt"),
        render: (item) => (
          <div className="space-y-1 text-sm">
            <div>{formatDateTime(item.updatedAt)}</div>
            <div className="text-xs text-muted-foreground">
              {item.updateUserName || "-"}
            </div>
          </div>
        ),
      },
    ],
    [t],
  );

  return (
    <>
      <DashboardCrudPage<SkillDefinition, CreateSkillDefinitionPayload>
        filters={filters}
        columns={columns}
        fetchList={(query) =>
          fetchSkillDefinitions({
            name: typeof query.name === "string" ? query.name : undefined,
            status: typeof query.status === "number" ? query.status : undefined,
            page: Number(query.page),
            limit: Number(query.limit),
          })
        }
        getItemId={(item) => item.id}
        createItem={createSkillDefinition}
        updateItem={(item, payload) =>
          updateSkillDefinition({ id: item.id, ...payload })
        }
        deleteItem={(item) => deleteSkillDefinition(item.id)}
        canDelete={(item) => item.status !== Status.Deleted}
        rowActions={[
          {
            key: "debug",
            icon: <BugIcon />,
            label: t("skillDefinition.debug"),
            run: ({ item }) => {
              setDebuggingItem(item);
              setDebugDialogOpen(true);
            },
          },
          {
            key: "restore",
            icon: <RotateCcwIcon />,
            label: t("skillDefinition.restore"),
            visible: (item) => item.status === Status.Deleted,
            run: async ({ item, reload }) => {
              await restoreSkillDefinition(item.id);
              toast.success(t("skillDefinition.restored", { name: item.name }));
              await reload();
            },
          },
        ]}
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
          refresh: t("skillDefinition.refresh"),
          create: t("skillDefinition.new"),
          query: t("skillDefinition.query"),
          loading: t("skillDefinition.loadingRows"),
          empty: t("skillDefinition.emptyRows"),
          actions: t("skillDefinition.actions"),
          edit: t("skillDefinition.edit"),
          delete: t("skillDefinition.delete"),
          processing: t("skillDefinition.processing"),
          moreActions: (item) =>
            t("skillDefinition.moreActions", { name: item.name }),
          loadFailed: t("skillDefinition.loadFailed"),
          saveFailed: t("skillDefinition.saveFailed"),
          deleteFailed: t("skillDefinition.deleteFailed"),
          created: (payload) =>
            t("skillDefinition.created", { name: payload.name }),
          updated: (item) => t("skillDefinition.updated", { name: item.name }),
          deleted: (item) => t("skillDefinition.deleted", { name: item.name }),
        }}
      />
      <DebugDialog
        open={debugDialogOpen}
        skillDefinitionId={debuggingItem?.id ?? 0}
        skillName={debuggingItem?.name ?? ""}
        onOpenChange={(open) => {
          if (!open) setDebuggingItem(null);
          setDebugDialogOpen(open);
        }}
      />
    </>
  );
}
