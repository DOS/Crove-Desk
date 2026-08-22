"use client";

import {
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
  UserCogIcon,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import {
  DashboardCrudPage,
  type DashboardCrudColumn,
  type DashboardCrudFilter,
} from "@/components/dashboard/crud";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  createAgentProfile,
  deleteAgentProfile,
  fetchAgentProfiles,
  updateAgentProfile,
  type AdminAgentProfile,
  type AdminAgentTeam,
  type CreateAdminAgentProfilePayload,
} from "@/lib/api/admin";
import { useI18n } from "@/i18n/provider";
import { ServiceStatus } from "@/lib/generated/enums";
import { formatDateTime } from "@/lib/utils";
import { EditDialog } from "./_components/edit";
import { AgentTeamSidebar } from "./_components/team-sidebar";

type TFunction = (key: string, values?: Record<string, string | number>) => string;

function getServiceStatusOptions(t: TFunction) {
  return [
    { value: "all", label: t("agentProfile.allStatuses") },
    { value: String(ServiceStatus.Idle), label: t("agentProfile.statusIdle") },
    { value: String(ServiceStatus.Busy), label: t("agentProfile.statusBusy") },
  ];
}

function getStatusLabel(value: number, t: TFunction) {
  return (
    getServiceStatusOptions(t).find((item) => item.value === String(value))
      ?.label ?? String(value)
  );
}

export default function DashboardAgentsPage() {
  const t = useI18n();
  const serviceStatusOptions = useMemo(() => getServiceStatusOptions(t), [t]);
  const [selectedTeam, setSelectedTeam] = useState<AdminAgentTeam | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const handleTeamsChange = useCallback((nextTeams: AdminAgentTeam[]) => {
    setSelectedTeam((current) => {
      if (nextTeams.length === 0) {
        return null;
      }
      if (!current) {
        return nextTeams[0];
      }
      return nextTeams.find((item) => item.id === current.id) ?? nextTeams[0];
    });
  }, []);

  const filters = useMemo<DashboardCrudFilter[]>(
    () => [
      {
        name: "displayName",
        label: t("agentProfile.filterDisplayName"),
        placeholder: t("agentProfile.filterDisplayName"),
        defaultValue: "",
        trim: true,
        className: "w-full sm:w-72",
      },
      {
        name: "agentCode",
        label: t("agentProfile.filterAgentCode"),
        placeholder: t("agentProfile.filterAgentCode"),
        defaultValue: "",
        trim: true,
        className: "w-full sm:w-44",
      },
      {
        name: "serviceStatus",
        label: t("agentProfile.allStatuses"),
        type: "select",
        defaultValue: "all",
        allValue: "all",
        options: serviceStatusOptions,
        className: "w-full sm:w-36",
      },
    ],
    [serviceStatusOptions, t],
  );

  const columns = useMemo<DashboardCrudColumn<AdminAgentProfile>[]>(
    () => [
      {
        key: "agent",
        label: t("agentProfile.columnAgent"),
        render: (item) => (
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex size-10 items-center justify-center overflow-hidden rounded-md bg-muted">
              {item.avatar ? (
                <img
                  src={item.avatar}
                  alt={item.displayName}
                  className="size-full object-cover"
                />
              ) : (
                <UserCogIcon className="size-4 text-muted-foreground" />
              )}
            </div>
            <div className="min-w-0">
              <div className="font-medium">{item.displayName}</div>
              <div className="text-xs text-muted-foreground">
                {item.nickname ||
                  item.username ||
                  t("agentProfile.userFallback", { id: item.userId })}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {t("agentProfile.agentCode", { code: item.agentCode })}
              </div>
            </div>
          </div>
        ),
      },
      {
        key: "rules",
        label: t("agentProfile.columnRules"),
        render: (item) => (
          <>
            <Badge variant="outline">
              {getStatusLabel(item.serviceStatus, t)}
            </Badge>
            <div className="mt-2 text-sm text-muted-foreground">
              {t("agentProfile.capacityPriority", {
                capacity: item.maxConcurrentCount,
                priority: item.priorityLevel,
              })}
            </div>
          </>
        ),
      },
      {
        key: "dispatch",
        label: t("agentProfile.columnDispatch"),
        render: (item) => (
          <div className="flex flex-wrap gap-1.5">
            <Badge variant={item.autoAssignEnabled ? "secondary" : "outline"}>
              {item.autoAssignEnabled
                ? t("agentProfile.autoAssign")
                : t("agentProfile.noAutoAssign")}
            </Badge>
            <Badge
              variant={item.receiveOfflineMessage ? "secondary" : "outline"}
            >
              {item.receiveOfflineMessage
                ? t("agentProfile.offlineReceive")
                : t("agentProfile.noOfflineReceive")}
            </Badge>
          </div>
        ),
      },
      {
        key: "recent",
        label: t("agentProfile.columnRecent"),
        render: (item) => (
          <>
            <div className="text-sm">
              {t("agentProfile.onlineAt", {
                time: formatDateTime(item.lastOnlineAt),
              })}
            </div>
            <div className="text-sm text-muted-foreground">
              {t("agentProfile.statusAt", {
                time: formatDateTime(item.lastStatusAt),
              })}
            </div>
          </>
        ),
      },
    ],
    [t],
  );

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      <div
        className={`shrink-0 overflow-hidden transition-[width] duration-200 ${
          sidebarCollapsed ? "w-0" : "w-80"
        }`}
      >
        <AgentTeamSidebar
          selectedTeamId={selectedTeam?.id ?? null}
          onSelectTeam={setSelectedTeam}
          onTeamsChange={handleTeamsChange}
        />
      </div>
      <div className="relative shrink-0 bg-background">
        <Button
          variant="outline"
          size="icon"
          className="absolute top-4 left-1/2 z-10 size-7 -translate-x-1/2 rounded-full shadow-sm"
          onClick={() => setSidebarCollapsed((value) => !value)}
          aria-label={
            sidebarCollapsed
              ? t("agentProfile.expandTeams")
              : t("agentProfile.collapseTeams")
          }
        >
          {sidebarCollapsed ? (
            <PanelLeftOpenIcon className="size-3.5" />
          ) : (
            <PanelLeftCloseIcon className="size-3.5" />
          )}
        </Button>
      </div>
      <div className="min-w-0 flex-1 p-4 lg:p-6">
        <div className="flex h-full flex-col gap-6">
          <DashboardCrudPage<AdminAgentProfile, CreateAdminAgentProfilePayload>
            key={selectedTeam?.id ?? "all"}
            layout="fragment"
            tableShellClassName="min-h-0"
            filters={filters}
            columns={columns}
            fetchList={(query) =>
              fetchAgentProfiles({
                teamId: selectedTeam?.id,
                displayName:
                  typeof query.displayName === "string"
                    ? query.displayName
                    : undefined,
                agentCode:
                  typeof query.agentCode === "string"
                    ? query.agentCode
                    : undefined,
                serviceStatus:
                  typeof query.serviceStatus === "string"
                    ? query.serviceStatus
                    : undefined,
                page: Number(query.page),
                limit: Number(query.limit),
              })
            }
            getItemId={(item) => item.id}
            createItem={createAgentProfile}
            updateItem={(item, payload) =>
              updateAgentProfile({ id: item.id, ...payload })
            }
            deleteItem={(item) => deleteAgentProfile(item.id)}
            renderEditDialog={({
              open,
              saving,
              itemId,
              onOpenChange,
              onSubmit,
            }) => (
              <EditDialog
                open={open}
                saving={saving}
                itemId={itemId}
                defaultTeamId={selectedTeam?.id ?? null}
                onOpenChange={onOpenChange}
                onSubmit={onSubmit}
              />
            )}
            labels={{
              refresh: t("agentProfile.refresh"),
              create: t("agentProfile.new"),
              query: t("agentProfile.query"),
              loading: t("agentProfile.loadingRows"),
              empty: selectedTeam
                ? t("agentProfile.emptyTeamRows")
                : t("agentProfile.emptyRows"),
              actions: t("agentProfile.columnActions"),
              edit: t("agentProfile.edit"),
              delete: t("agentProfile.delete"),
              processing: t("agentProfile.deleting"),
              moreActions: (item) =>
                t("agentProfile.moreActions", { name: item.displayName }),
              loadFailed: t("agentProfile.loadFailed"),
              saveFailed: t("agentProfile.saveFailed"),
              deleteFailed: t("agentProfile.deleteFailed"),
              created: (payload) =>
                t("agentProfile.created", { name: payload.displayName }),
              updated: (item) =>
                t("agentProfile.updated", { name: item.displayName }),
              deleted: (item) =>
                t("agentProfile.deleted", { name: item.displayName }),
            }}
          />
        </div>
      </div>
    </div>
  );
}
