"use client";

import {
  MoreHorizontalIcon,
  Pencil,
  PlusIcon,
  RefreshCwIcon,
  SearchIcon,
  Trash2Icon,
  UsersRoundIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { EditDialog } from "./team-edit";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  createAgentTeam,
  deleteAgentTeam,
  fetchAgentTeams,
  updateAgentTeam,
  type AdminAgentTeam,
  type CreateAdminAgentTeamPayload,
} from "@/lib/api/admin";
import { Status } from "@/lib/generated/enums";
import { useI18n } from "@/i18n/provider";
import { cn } from "@/lib/utils";

type AgentTeamSidebarProps = {
  selectedTeamId: number | null;
  onSelectTeam: (team: AdminAgentTeam | null) => void;
  onTeamsChange?: (teams: AdminAgentTeam[]) => void;
};

function getStatusTabs(t: (key: string, values?: Record<string, string | number>) => string) {
  return [
    { value: "all", label: t("agentProfile.all") },
    { value: String(Status.Ok), label: t("agentProfile.enabled") },
    { value: String(Status.Disabled), label: t("agentProfile.disabled") },
  ] as const;
}

export function AgentTeamSidebar({
  selectedTeamId,
  onSelectTeam,
  onTeamsChange,
}: AgentTeamSidebarProps) {
  const t = useI18n();
  const statusTabs = getStatusTabs(t);
  const [keyword, setKeyword] = useState("");
  const [statusFilter, setStatusFilter] =
    useState<(typeof statusTabs)[number]["value"]>("all");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<AdminAgentTeam | null>(null);
  const [teams, setTeams] = useState<AdminAgentTeam[]>([]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchAgentTeams({ page: 1, limit: 200 });
      setTeams(data);
      onTeamsChange?.(data);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("agentProfile.loadTeamsFailed"));
    } finally {
      setLoading(false);
    }
  }, [onTeamsChange, t]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (selectedTeamId == null) {
      return;
    }
    const matchedTeam =
      teams.find((item) => item.id === selectedTeamId) ?? null;
    if (matchedTeam) {
      onSelectTeam(matchedTeam);
      return;
    }
    if (!loading && teams.length > 0) {
      onSelectTeam(teams[0]);
    }
  }, [loading, onSelectTeam, selectedTeamId, teams]);

  const filteredTeams = useMemo(() => {
    const output = keyword.trim().toLowerCase();
    return teams.filter((item) => {
      const matchedKeyword =
        output.length === 0 ||
        item.name.toLowerCase().includes(output) ||
        item.description.toLowerCase().includes(output);
      const matchedStatus =
        statusFilter === "all" || String(item.status) === statusFilter;
      return matchedKeyword && matchedStatus;
    });
  }, [keyword, statusFilter, teams]);

  function openCreateDialog() {
    setEditingItem(null);
    setDialogOpen(true);
  }

  function openEditDialog(item: AdminAgentTeam) {
    setEditingItem(item);
    setDialogOpen(true);
  }

  function handleDialogOpenChange(open: boolean) {
    if (saving) {
      return;
    }
    if (!open) {
      setEditingItem(null);
    }
    setDialogOpen(open);
  }

  async function handleSubmit(payload: CreateAdminAgentTeamPayload) {
    if (saving) {
      return;
    }
    setSaving(true);
    try {
      if (editingItem) {
        await updateAgentTeam({ id: editingItem.id, ...payload });
        toast.success(t("agentProfile.teamUpdated", { name: editingItem.name }));
      } else {
        await createAgentTeam(payload);
        toast.success(t("agentProfile.teamCreated", { name: payload.name }));
      }
      setDialogOpen(false);
      setEditingItem(null);
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("agentProfile.teamSaveFailed"));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(item: AdminAgentTeam) {
    setActionLoadingId(item.id);
    try {
      await deleteAgentTeam(item.id);
      toast.success(t("agentProfile.teamDeleted", { name: item.name }));
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("agentProfile.teamDeleteFailed"));
    } finally {
      setActionLoadingId(null);
    }
  }

  return (
    <>
      <div className="flex h-full flex-col border-r bg-muted/10">
        <div className="border-b px-3 py-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-sm font-medium">{t("agentProfile.teamTitle")}</div>
            </div>
          </div>
          <div className="relative mt-3">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder={t("agentProfile.searchTeams")}
              className="pl-9"
            />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {statusTabs.map((item) => (
              <Button
                key={item.value}
                variant={statusFilter === item.value ? "default" : "outline"}
                size="sm"
                onClick={() => setStatusFilter(item.value)}
              >
                {item.label}
              </Button>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={() => void loadData()}
              disabled={loading}
            >
              <RefreshCwIcon
                className={cn("size-4", loading && "animate-spin")}
              />
            </Button>

            <Button size="icon-sm" onClick={openCreateDialog}>
              <PlusIcon />
            </Button>
          </div>
        </div>
        <ScrollArea className="min-h-0 flex-1">
          <div className="px-2 py-2">
            {filteredTeams.map((item) => (
              <div
                key={item.id}
                className={cn(
                  "group mt-1 flex items-center gap-2 rounded-lg px-2 py-2 text-sm transition-colors hover:bg-accent",
                  selectedTeamId === item.id &&
                    "bg-accent text-accent-foreground",
                )}
              >
                <button
                  type="button"
                  className="flex min-w-0 flex-1 items-center gap-2 text-left"
                  onClick={() => onSelectTeam(item)}
                >
                  <UsersRoundIcon className="size-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">
                      {item.name}
                    </span>
                  </span>
                  <Badge
                    variant={
                      item.status === Status.Ok ? "secondary" : "outline"
                    }
                  >
                    {item.status === Status.Ok ? t("agentProfile.enabled") : t("agentProfile.disabled")}
                  </Badge>
                </button>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="opacity-0 group-hover:opacity-100"
                      />
                    }
                    aria-label={t("agentProfile.moreActions", { name: item.name })}
                  >
                    <MoreHorizontalIcon />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-40 min-w-40">
                    <DropdownMenuItem onClick={() => openEditDialog(item)}>
                      <Pencil />
                      {t("agentProfile.edit")}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => void handleDelete(item)}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2Icon />
                      {actionLoadingId === item.id ? t("agentProfile.deleting") : t("agentProfile.delete")}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))}
            {!loading && filteredTeams.length === 0 ? (
              <div className="px-2 py-10 text-center text-sm text-muted-foreground">
                {t("agentProfile.noTeams")}
              </div>
            ) : null}
          </div>
        </ScrollArea>
      </div>
      <EditDialog
        open={dialogOpen}
        saving={saving}
        itemId={editingItem?.id ?? null}
        onOpenChange={handleDialogOpenChange}
        onSubmit={handleSubmit}
      />
    </>
  );
}
