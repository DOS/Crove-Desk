"use client"

import { PlusIcon, SearchXIcon } from "lucide-react"
import { useSearchParams } from "next/navigation"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"

import {
  DashboardListPage,
  type DashboardListColumn,
  type DashboardListFilter,
} from "@/components/dashboard/list"
import { type ComboboxOption } from "@/components/option-combobox"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  fetchAgentProfilesAll,
  fetchTagsAll,
  type AdminAgentProfile,
  type TagTree,
} from "@/lib/api/admin"
import {
  createTicket,
  fetchTicketSummary,
  fetchTickets,
  type CreateTicketPayload,
  type TicketItem,
  type TicketListQuery,
  type TicketStatus,
  type TicketSummary,
} from "@/lib/api/ticket"
import { useI18n } from "@/i18n/provider"
import { formatDateTime } from "@/lib/utils"
import { EditDialog } from "./_components/edit"
import { TicketDetailDialog } from "./_components/ticket-detail-dialog"
import { TicketStatusBadge } from "./_components/ticket-status-badge"

type QuickViewKey =
  | "all"
  | "pending"
  | "in_progress"
  | "done"
  | "unassigned"
  | "mine"
  | "stale"

const emptySummary: TicketSummary = {
  all: 0,
  pending: 0,
  inProgress: 0,
  done: 0,
  unassigned: 0,
  mine: 0,
  stale: 0,
}

type TFunction = (key: string, values?: Record<string, string | number>) => string

function getAssigneeAllOption(t: TFunction): ComboboxOption {
  return { value: "0", label: t("ticket.allAssignees") }
}

function getStaleHourOptions(t: TFunction): ComboboxOption[] {
  return [
    { value: "24", label: t("ticket.hours", { hours: 24 }) },
    { value: "48", label: t("ticket.hours", { hours: 48 }) },
    { value: "168", label: t("ticket.hours", { hours: 168 }) },
  ]
}

function sourceLabel(source: string, t: TFunction) {
  switch (source) {
    case "manual":
      return t("ticket.manual")
    case "conversation":
      return t("ticket.conversation")
    default:
      return source || "-"
  }
}

function assigneeLabel(ticket: TicketItem, t: TFunction) {
  if (ticket.currentAssigneeName) {
    return ticket.currentAssigneeName
  }
  if (ticket.currentAssigneeId > 0) {
    return t("ticket.agentFallback", { id: ticket.currentAssigneeId })
  }
  return t("ticket.unassigned")
}

function quickViewLabel(label: string, count: number) {
  return `${label} ${count}`
}

export default function TicketsPage() {
  const t = useI18n()
  const searchParams = useSearchParams()
  const [summary, setSummary] = useState<TicketSummary>(emptySummary)
  const [assigneeOptions, setAssigneeOptions] = useState<ComboboxOption[]>([])
  const [tags, setTags] = useState<TagTree[]>([])
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [savingCreate, setSavingCreate] = useState(false)
  const listReloadRef = useRef<() => Promise<void>>(async () => undefined)

  const assigneeAllOption = useMemo(() => getAssigneeAllOption(t), [t])
  const staleHourOptions = useMemo(() => getStaleHourOptions(t), [t])

  const quickViews = useMemo(
    () =>
      [
        {
          value: "all",
          label: quickViewLabel(t("ticket.quickAll"), summary.all),
        },
        {
          value: "pending",
          label: quickViewLabel(t("ticket.quickPending"), summary.pending),
        },
        {
          value: "in_progress",
          label: quickViewLabel(
            t("ticket.quickInProgress"),
            summary.inProgress,
          ),
        },
        {
          value: "done",
          label: quickViewLabel(t("ticket.quickDone"), summary.done),
        },
        {
          value: "unassigned",
          label: quickViewLabel(
            t("ticket.quickUnassigned"),
            summary.unassigned,
          ),
        },
        {
          value: "mine",
          label: quickViewLabel(t("ticket.quickMine"), summary.mine),
        },
        {
          value: "stale",
          label: quickViewLabel(t("ticket.quickStale"), summary.stale),
        },
      ] satisfies Array<{ value: QuickViewKey; label: string }>,
    [summary, t],
  )

  const filters = useMemo<DashboardListFilter[]>(
    () => [
      {
        name: "quickView",
        label: t("ticket.quickAll"),
        type: "segment",
        defaultValue: "all",
        allValue: "all",
        options: quickViews,
        className: "flex w-full flex-wrap gap-2",
      },
      {
        name: "keyword",
        label: t("ticket.searchPlaceholder"),
        placeholder: t("ticket.searchPlaceholder"),
        defaultValue: "",
        trim: true,
        className: "w-full sm:w-72",
      },
      {
        name: "currentAssigneeId",
        label: t("ticket.allAssignees"),
        type: "select",
        defaultValue: "0",
        allValue: "0",
        valueType: "number",
        options: assigneeOptions,
        className: "w-full sm:w-44",
      },
      {
        name: "tagId",
        label: t("ticket.allTags"),
        type: "tag",
        defaultValue: "0",
        allValue: "0",
        valueType: "number",
        tags,
        searchPlaceholder: t("ticket.searchTags"),
        emptyText: t("ticket.emptyTags"),
        className: "w-full sm:w-44",
      },
      {
        name: "staleHours",
        label: t("ticket.staleThreshold"),
        type: "select",
        defaultValue: "24",
        options: staleHourOptions,
        className: "w-full sm:w-40",
      },
    ],
    [assigneeOptions, quickViews, staleHourOptions, tags, t],
  )

  const fetchList = useCallback(
    async (query: Record<string, string | number | boolean | string[] | number[] | undefined>) => {
      const quickView = String(query.quickView ?? "all") as QuickViewKey
      const staleThreshold = Number(query.staleHours ?? 24)
      const ticketQuery: TicketListQuery = {
        page: Number(query.page),
        limit: Number(query.limit),
        keyword: typeof query.keyword === "string" ? query.keyword : undefined,
        currentAssigneeId:
          typeof query.currentAssigneeId === "number"
            ? query.currentAssigneeId
            : undefined,
        tagId: typeof query.tagId === "number" ? query.tagId : undefined,
      }

      if (
        quickView === "pending" ||
        quickView === "in_progress" ||
        quickView === "done"
      ) {
        ticketQuery.status = quickView as TicketStatus
      }
      if (quickView === "unassigned") {
        ticketQuery.unassigned = 1
      }
      if (quickView === "mine") {
        ticketQuery.mine = 1
      }
      if (quickView === "stale") {
        ticketQuery.staleHours = staleThreshold
      }

      const [ticketData, summaryData] = await Promise.all([
        fetchTickets(ticketQuery),
        fetchTicketSummary({ staleHours: staleThreshold }),
      ])
      setSummary(summaryData ?? emptySummary)
      return ticketData
    },
    [],
  )

  const columns = useMemo<DashboardListColumn<TicketItem>[]>(
    () => [
      {
        key: "ticket",
        label: t("ticket.columnTicket"),
        render: (ticket) => (
          <div className="min-w-0 space-y-1">
            <div className="truncate text-sm font-medium">{ticket.title}</div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="font-mono">{ticket.ticketNo}</span>
              <span>
                {ticket.customer?.name ||
                  (ticket.customerId
                    ? t("ticket.customerFallback", { id: ticket.customerId })
                    : t("ticket.noCustomer"))}
              </span>
              <span>{sourceLabel(ticket.source, t)}</span>
              {ticket.channel ? <span>{ticket.channel}</span> : null}
            </div>
            {ticket.tags && ticket.tags.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {ticket.tags.slice(0, 3).map((tag) => (
                  <Badge key={tag.id} variant="outline" className="px-1.5 py-0 text-[11px]">
                    {tag.name}
                  </Badge>
                ))}
                {ticket.tags.length > 3 ? (
                  <Badge variant="outline" className="px-1.5 py-0 text-[11px]">
                    +{ticket.tags.length - 3}
                  </Badge>
                ) : null}
              </div>
            ) : null}
          </div>
        ),
      },
      {
        key: "status",
        label: t("ticket.columnStatus"),
        className: "w-28",
        render: (ticket) => <TicketStatusBadge status={ticket.status} />,
      },
      {
        key: "assignee",
        label: t("ticket.columnAssignee"),
        className: "max-w-36 truncate text-sm text-muted-foreground",
        render: (ticket) => assigneeLabel(ticket, t),
      },
      {
        key: "updatedAt",
        label: t("ticket.columnUpdated"),
        className: "w-40 text-sm text-muted-foreground",
        render: (ticket) =>
          ticket.updatedAt ? formatDateTime(ticket.updatedAt) : "-",
      },
      {
        key: "actions",
        label: t("ticket.columnActions"),
        className: "w-24 text-right",
        render: (ticket) => (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setSelectedTicketId(ticket.id)
              setDetailOpen(true)
            }}
          >
            {t("ticket.detail")}
          </Button>
        ),
      },
    ],
    [t],
  )

  useEffect(() => {
    const ticketId = Number(searchParams.get("ticketId"))
    if (ticketId > 0) {
      setSelectedTicketId(ticketId)
      setDetailOpen(true)
    }
  }, [searchParams])

  useEffect(() => {
    let active = true
    Promise.all([fetchAgentProfilesAll(), fetchTagsAll()])
      .then(([agents, tags]) => {
        if (!active) {
          return
        }
        setAssigneeOptions([
          assigneeAllOption,
          ...(Array.isArray(agents) ? agents : []).map((agent: AdminAgentProfile) => ({
            value: String(agent.userId),
            label:
              agent.displayName ||
              agent.nickname ||
              agent.username ||
              t("ticket.agentFallback", { id: agent.userId }),
          })),
        ])
        setTags(Array.isArray(tags) ? tags : [])
      })
      .catch((error) => {
        toast.error(error instanceof Error ? error.message : t("ticket.loadFiltersFailed"))
      })
    return () => {
      active = false
    }
  }, [assigneeAllOption, t])

  async function handleCreateTicket(payload: CreateTicketPayload) {
    setSavingCreate(true)
    try {
      await createTicket(payload)
      toast.success(t("ticket.created"))
      setCreateOpen(false)
      await listReloadRef.current()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("ticket.createFailed"))
    } finally {
      setSavingCreate(false)
    }
  }

  return (
    <>
      <DashboardListPage<TicketItem>
        filters={filters}
        fetchList={fetchList}
        columns={columns}
        getItemId={(ticket) => ticket.id}
        pageSize={50}
        renderToolbarActions={(context) => {
          listReloadRef.current = context.reload
          return (
            <>
              <Button type="button" variant="outline" onClick={context.resetFilters}>
                <SearchXIcon className="size-4" />
                {t("ticket.reset")}
              </Button>
              <Button type="button" onClick={() => setCreateOpen(true)}>
                <PlusIcon className="size-4" />
                {t("ticket.newTicket")}
              </Button>
            </>
          )
        }}
        labels={{
          refresh: t("ticket.refresh"),
          query: t("ticket.query"),
          loading: t("ticket.loadingRows"),
          empty: t("ticket.emptyRows"),
          loadFailed: t("ticket.loadFailed"),
        }}
      />

      <EditDialog
        open={createOpen}
        saving={savingCreate}
        itemId={null}
        onOpenChange={setCreateOpen}
        onSubmit={handleCreateTicket}
      />
      <TicketDetailDialog
        open={detailOpen}
        ticketId={selectedTicketId}
        onOpenChange={(open) => {
          setDetailOpen(open)
          if (!open) {
            setSelectedTicketId(null)
          }
        }}
        onChanged={() => listReloadRef.current()}
      />
    </>
  )
}
