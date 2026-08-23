"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  CalendarDaysIcon,
  CalendarRangeIcon,
  CalendarSearchIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  LayersIcon,
  ListIcon,
  PlusIcon,
  RefreshCwIcon,
  SearchIcon,
} from "lucide-react"
import { toast } from "sonner"

import {
  DashboardCrudPage,
  type DashboardCrudColumn,
  type DashboardCrudFilter,
} from "@/components/dashboard/crud"
import { Button } from "@/components/ui/button"
import { ButtonGroup } from "@/components/ui/button-group"
import { OptionCombobox } from "@/components/option-combobox"
import {
  createAgentTeamSchedule,
  deleteAgentTeamSchedule,
  fetchAgentTeamScheduleCalendar,
  fetchAgentTeamSchedules,
  fetchAgentTeamsAll,
  updateAgentTeamSchedule,
  type AdminAgentTeam,
  type AdminAgentTeamSchedule,
  type CreateAdminAgentTeamSchedulePayload,
  type UpdateAdminAgentTeamSchedulePayload,
} from "@/lib/api/admin"
import { useI18n } from "@/i18n/provider"
import { formatDateTime } from "@/lib/utils"
import { BatchScheduleDialog } from "./_components/batch-schedule-dialog"
import { ScheduleCalendar } from "./_components/calendar"
import {
  addDays,
  addMonths,
  formatDateTimeValue,
  formatWeekTitle,
  startOfDay,
  startOfMonth,
  startOfMonthCalendar,
  startOfWeek,
  endOfMonthCalendar,
} from "./_components/calendar-date-range"
import { EditDialog } from "./_components/edit"

type ViewMode = "month" | "week" | "list"

function parseLocalDateTime(value: string) {
  const ret = new Date(value.replace(" ", "T"))
  return Number.isNaN(ret.getTime()) ? null : ret
}

function isHistoricalSchedule(item: AdminAgentTeamSchedule) {
  const startAt = parseLocalDateTime(item.startAt)
  return !!startAt && startAt < startOfDay(new Date())
}

export default function DashboardAgentTeamSchedulesPage() {
  const t = useI18n()
  const [viewMode, setViewMode] = useState<ViewMode>("month")
  const [teamFilterInput, setTeamFilterInput] = useState("all")
  const [teamFilter, setTeamFilter] = useState("all")
  const [listReloadKey, setListReloadKey] = useState(0)
  const [monthStart, setMonthStart] = useState(() => startOfMonth(new Date()))
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()))
  const [calendarLoading, setCalendarLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [batchDialogOpen, setBatchDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<AdminAgentTeamSchedule | null>(null)
  const [dialogDefaults, setDialogDefaults] = useState<Partial<CreateAdminAgentTeamSchedulePayload> | null>(null)
  const [teams, setTeams] = useState<AdminAgentTeam[]>([])
  const [calendarItems, setCalendarItems] = useState<AdminAgentTeamSchedule[]>([])

  const visibleTeams = useMemo(() => {
    if (teamFilter === "all") {
      return teams
    }
    return teams.filter((team) => String(team.id) === teamFilter)
  }, [teamFilter, teams])

  const refreshing = calendarLoading

  const listFilters = useMemo<DashboardCrudFilter[]>(
    () => [
      {
        name: "teamId",
        label: t("agentTeamSchedule.filterTeam"),
        defaultValue: teamFilter,
        allValue: "all",
        type: "select",
        options: [
          { value: "all", label: t("agentTeamSchedule.allTeams") },
          ...teams.map((team) => ({ value: String(team.id), label: team.name })),
        ],
      },
    ],
    [t, teamFilter, teams],
  )

  const listColumns = useMemo<DashboardCrudColumn<AdminAgentTeamSchedule>[]>(
    () => [
      {
        key: "team",
        label: t("agentTeamSchedule.team"),
        render: (item) => (
          <div className="min-w-0">
            <div className="font-medium">
              {item.teamName || t("agentTeamSchedule.teamFallback", { id: item.teamId })}
            </div>
            <div className="text-xs text-muted-foreground">
              {t("agentTeamSchedule.teamId", { id: item.teamId })}
            </div>
          </div>
        ),
      },
      {
        key: "timeRange",
        label: t("agentTeamSchedule.timeRange"),
        render: (item) => (
          <>
            <div className="text-sm">{formatDateTime(item.startAt)}</div>
            <div className="text-sm text-muted-foreground">
              {formatDateTime(item.endAt)}
            </div>
          </>
        ),
      },
    ],
    [t],
  )

  const loadCalendarData = useCallback(async () => {
    setCalendarLoading(true)
    const rangeStart = viewMode === "week" ? weekStart : startOfMonthCalendar(monthStart)
    const rangeEnd = viewMode === "week" ? addDays(weekStart, 7) : endOfMonthCalendar(monthStart)
    try {
      const data = await fetchAgentTeamScheduleCalendar({
        startAt: formatDateTimeValue(rangeStart),
        endAt: formatDateTimeValue(rangeEnd),
        teamId: teamFilter === "all" ? undefined : teamFilter,
      })
      setCalendarItems(data)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("agentTeamSchedule.loadCalendarFailed"))
    } finally {
      setCalendarLoading(false)
    }
  }, [monthStart, t, teamFilter, viewMode, weekStart])

  const loadTeams = useCallback(async () => {
    try {
      const data = await fetchAgentTeamsAll()
      setTeams(data)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("agentTeamSchedule.loadTeamsFailed"))
    }
  }, [t])

  const refreshActiveView = useCallback(async () => {
    await loadCalendarData()
    if (viewMode === "list") {
      setListReloadKey((value) => value + 1)
    }
  }, [loadCalendarData, viewMode])

  useEffect(() => {
    void loadCalendarData()
  }, [loadCalendarData])

  useEffect(() => {
    void loadTeams()
  }, [loadTeams])

  function applyFilters() {
    setTeamFilter(teamFilterInput)
    setListReloadKey((value) => value + 1)
  }

  function openCreateDialog(defaults?: Partial<CreateAdminAgentTeamSchedulePayload>) {
    setEditingItem(null)
    setDialogDefaults(defaults ?? null)
    setDialogOpen(true)
  }

  function openEditDialog(item: AdminAgentTeamSchedule) {
    if (isHistoricalSchedule(item)) {
      toast.error(t("agentTeamSchedule.historyReadonly"))
      return
    }
    setDialogDefaults(null)
    setEditingItem(item)
    setDialogOpen(true)
  }

  function handleDialogOpenChange(open: boolean) {
    if (saving) {
      return
    }
    if (!open) {
      setEditingItem(null)
      setDialogDefaults(null)
    }
    setDialogOpen(open)
  }

  async function handleSubmit(payload: CreateAdminAgentTeamSchedulePayload) {
    if (saving) {
      return
    }
    setSaving(true)
    try {
      if (editingItem) {
        await updateAgentTeamSchedule({ id: editingItem.id, ...payload })
        toast.success(t("agentTeamSchedule.updated"))
      } else {
        await createAgentTeamSchedule(payload)
        toast.success(t("agentTeamSchedule.created"))
      }
      setDialogOpen(false)
      setEditingItem(null)
      setDialogDefaults(null)
      await refreshActiveView()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("agentTeamSchedule.saveFailed"))
    } finally {
      setSaving(false)
    }
  }

  async function handleBatchSuccess() {
    await refreshActiveView()
  }

  async function handleDeleteById(id: number) {
    setActionLoadingId(id)
    try {
      await deleteAgentTeamSchedule(id)
      toast.success(t("agentTeamSchedule.deleted"))
      setDialogOpen(false)
      setEditingItem(null)
      setDialogDefaults(null)
      await refreshActiveView()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("agentTeamSchedule.deleteFailed"))
    } finally {
      setActionLoadingId(null)
    }
  }

  async function handleCalendarUpdate(payload: UpdateAdminAgentTeamSchedulePayload) {
    const startAt = parseLocalDateTime(payload.startAt)
    if (startAt && startAt < startOfDay(new Date())) {
      toast.error(t("agentTeamSchedule.historyReadonly"))
      return
    }
    setActionLoadingId(payload.id)
    try {
      await updateAgentTeamSchedule(payload)
      toast.success(t("agentTeamSchedule.updated"))
      await loadCalendarData()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("agentTeamSchedule.updateFailed"))
      await loadCalendarData()
    } finally {
      setActionLoadingId(null)
    }
  }

  function goToToday() {
    const today = new Date()
    setMonthStart(startOfMonth(today))
    setWeekStart(startOfWeek(today))
  }

  return (
    <>
      <div className="flex h-[calc(100vh-var(--header-height))] min-h-0 flex-1 flex-col gap-4 overflow-hidden p-4 lg:p-6">
        <div className="shrink-0 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <ButtonGroup>
              <Button
                variant={viewMode === "month" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("month")}
              >
                <CalendarDaysIcon />
                {t("agentTeamSchedule.month")}
              </Button>
              <Button
                variant={viewMode === "week" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("week")}
              >
                <CalendarRangeIcon />
                {t("agentTeamSchedule.week")}
              </Button>
              <Button
                variant={viewMode === "list" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("list")}
              >
                <ListIcon />
                {t("agentTeamSchedule.list")}
              </Button>
            </ButtonGroup>
            {viewMode === "month" ? (
              <ButtonGroup>
                <Button variant="outline" size="icon-sm" onClick={() => setMonthStart(addMonths(monthStart, -1))} aria-label={t("agentTeamSchedule.prevMonth")}>
                  <ChevronLeftIcon />
                </Button>
                <Button variant="outline" size="sm" onClick={() => setMonthStart(startOfMonth(new Date()))}>
                  {t("agentTeamSchedule.thisMonth")}
                </Button>
                <Button variant="outline" size="icon-sm" onClick={() => setMonthStart(addMonths(monthStart, 1))} aria-label={t("agentTeamSchedule.nextMonth")}>
                  <ChevronRightIcon />
                </Button>
              </ButtonGroup>
            ) : null}
            {viewMode === "week" ? (
              <ButtonGroup>
                <Button variant="outline" size="icon-sm" onClick={() => setWeekStart(addDays(weekStart, -7))} aria-label={t("agentTeamSchedule.prevWeek")}>
                  <ChevronLeftIcon />
                </Button>
                <Button variant="outline" size="sm" onClick={() => setWeekStart(startOfWeek(new Date()))}>
                  {t("agentTeamSchedule.thisWeek")}
                </Button>
                <Button variant="outline" size="icon-sm" onClick={() => setWeekStart(addDays(weekStart, 7))} aria-label={t("agentTeamSchedule.nextWeek")}>
                  <ChevronRightIcon />
                </Button>
              </ButtonGroup>
            ) : null}
            {viewMode === "month" ? (
              <div className="text-sm text-muted-foreground">
                {t("agentTeamSchedule.monthTitle", {
                  year: monthStart.getFullYear(),
                  month: String(monthStart.getMonth() + 1).padStart(2, "0"),
                })}
              </div>
            ) : null}
            {viewMode === "week" ? (
              <div className="text-sm text-muted-foreground">{formatWeekTitle(weekStart)}</div>
            ) : null}
            {viewMode !== "list" ? (
              <Button variant="outline" size="sm" onClick={goToToday}>
                <CalendarSearchIcon />
                {t("agentTeamSchedule.today")}
              </Button>
            ) : null}
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center xl:justify-end">
            <div className="w-full sm:w-48">
              <OptionCombobox
                value={teamFilterInput}
                options={[
                  { value: "all", label: t("agentTeamSchedule.allTeams") },
                  ...teams.map((team) => ({ value: String(team.id), label: team.name })),
                ]}
                placeholder={t("agentTeamSchedule.filterTeam")}
                searchPlaceholder={t("agentTeamSchedule.searchTeam")}
                emptyText={t("agentTeamSchedule.emptyTeam")}
                onChange={(value) => setTeamFilterInput(value)}
              />
            </div>
            <Button variant="outline" onClick={applyFilters} disabled={refreshing}>
              <SearchIcon />
              {t("agentTeamSchedule.query")}
            </Button>
            <Button
              variant="outline"
              onClick={() => void refreshActiveView()}
              disabled={refreshing}
            >
              <RefreshCwIcon className={refreshing ? "animate-spin" : ""} />
              {t("agentTeamSchedule.refresh")}
            </Button>
            <Button variant="outline" onClick={() => setBatchDialogOpen(true)}>
              <LayersIcon />
              {t("agentTeamSchedule.batch")}
            </Button>
            <Button onClick={() => openCreateDialog()}>
              <PlusIcon />
              {t("agentTeamSchedule.new")}
            </Button>
          </div>
        </div>

        {viewMode === "month" || viewMode === "week" ? (
          <div className="min-h-0 flex-1 overflow-auto">
            <ScheduleCalendar
              variant={viewMode}
              monthStart={monthStart}
              calendarStart={viewMode === "week" ? weekStart : startOfMonthCalendar(monthStart)}
              calendarEnd={viewMode === "week" ? addDays(weekStart, 7) : endOfMonthCalendar(monthStart)}
              teams={visibleTeams}
              schedules={calendarItems}
              loading={calendarLoading}
              savingId={actionLoadingId}
              onCreate={openCreateDialog}
              onEdit={openEditDialog}
              onMove={handleCalendarUpdate}
              onResize={handleCalendarUpdate}
              t={t}
            />
          </div>
        ) : (
          <div className="min-h-0 flex-1 space-y-4 overflow-auto">
            <DashboardCrudPage<AdminAgentTeamSchedule, CreateAdminAgentTeamSchedulePayload>
              key={`${teamFilter}-${listReloadKey}`}
              layout="fragment"
              showToolbar={false}
              filters={listFilters}
              columns={listColumns}
              fetchList={(query) =>
                fetchAgentTeamSchedules({
                  teamId:
                    typeof query.teamId === "string" ? query.teamId : undefined,
                  page: Number(query.page),
                  limit: Number(query.limit),
                })
              }
              getItemId={(item) => item.id}
              createItem={createAgentTeamSchedule}
              updateItem={async (item, payload) => {
                await updateAgentTeamSchedule({ id: item.id, ...payload })
                await loadCalendarData()
              }}
              canEdit={(item) => !isHistoricalSchedule(item)}
              deleteItem={async (item) => {
                await deleteAgentTeamSchedule(item.id)
                await loadCalendarData()
              }}
              canDelete={(item) => !isHistoricalSchedule(item)}
              renderEditDialog={({ open, saving: dialogSaving, itemId, onOpenChange, onSubmit }) => (
                <EditDialog
                  open={open}
                  saving={dialogSaving}
                  itemId={itemId}
                  defaultValues={null}
                  onOpenChange={onOpenChange}
                  onSubmit={onSubmit}
                />
              )}
              labels={{
                refresh: t("agentTeamSchedule.refresh"),
                create: t("agentTeamSchedule.new"),
                query: t("agentTeamSchedule.query"),
                loading: t("agentTeamSchedule.loading"),
                empty: t("agentTeamSchedule.emptyRows"),
                actions: t("agentTeamSchedule.actions"),
                edit: t("agentTeamSchedule.edit"),
                delete: t("agentTeamSchedule.delete"),
                processing: t("agentTeamSchedule.deleting"),
                moreActions: (item) =>
                  t("agentTeamSchedule.moreActions", { name: item.startAt }),
                loadFailed: t("agentTeamSchedule.loadFailed"),
                saveFailed: t("agentTeamSchedule.saveFailed"),
                deleteFailed: t("agentTeamSchedule.deleteFailed"),
                created: () => t("agentTeamSchedule.created"),
                updated: () => t("agentTeamSchedule.updated"),
                deleted: () => t("agentTeamSchedule.deleted"),
              }}
            />
          </div>
        )}
      </div>
      <EditDialog
        open={dialogOpen}
        saving={saving || actionLoadingId === editingItem?.id}
        itemId={editingItem?.id ?? null}
        defaultValues={dialogDefaults}
        onOpenChange={handleDialogOpenChange}
        onSubmit={handleSubmit}
        onDelete={handleDeleteById}
      />
      <BatchScheduleDialog
        open={batchDialogOpen}
        onOpenChange={setBatchDialogOpen}
        onSuccess={handleBatchSuccess}
      />
    </>
  )
}
