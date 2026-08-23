"use client"

import {
  CheckCheckIcon,
  MessageCircleMoreIcon,
  MoreHorizontalIcon,
  RefreshCwIcon,
  SearchIcon,
} from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react"
import { toast } from "sonner"

import { ConversationCloseDialog } from "@/components/conversation-actions/close-dialog"
import { ConversationTransferDialog } from "@/components/conversation-actions/transfer-dialog"
import {
  DashboardPage,
  DashboardTableShell,
  DashboardTableStateRow,
  DashboardToolbar,
} from "@/components/dashboard-page"
import { ListPagination } from "@/components/list-pagination"
import {
  OptionCombobox,
  type ComboboxOption,
} from "@/components/option-combobox"
import { TagSelector } from "@/components/tag-selector"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ButtonGroup } from "@/components/ui/button-group"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  createAdminWebSocketUrl,
  dispatchConversation,
  fetchAgentProfilesAll,
  fetchAgentTeamsAll,
  fetchConversationDetail,
  fetchConversationMessages,
  fetchConversations,
  fetchTagsAll,
  markConversationRead,
  type AdminAgentProfile,
  type AdminAgentTeam,
  type AdminConversation,
  type AdminConversationDetail,
  type AdminMessage,
  type PageResult,
  type TagTree,
} from "@/lib/api/admin"
import { useI18n } from "@/i18n/provider"
import { formatDateTime } from "@/lib/utils"
import { ConversationDetailDialog } from "./_components/detail"

const RECONNECT_BASE_DELAY = 2000
const RECONNECT_MAX_DELAY = 30000

function getStatusMeta(
  status: number,
  t: (key: string, values?: Record<string, string | number>) => string
) {
  switch (status) {
    case 1:
      return { label: t("conversation.filterAiServing"), variant: "secondary" as const }
    case 2:
      return { label: t("conversation.filterPending"), variant: "outline" as const }
    case 3:
      return { label: t("conversation.filterActive"), variant: "secondary" as const }
    case 4:
      return { label: t("conversation.filterClosed"), variant: "outline" as const }
    default:
      return { label: t("conversationMonitor.unknown"), variant: "outline" as const }
  }
}

function getServiceModeLabel(
  mode: number,
  t: (key: string, values?: Record<string, string | number>) => string
) {
  switch (mode) {
    case 1:
      return t("conversationMonitor.serviceAi")
    case 2:
      return t("conversationMonitor.serviceHuman")
    case 3:
      return t("conversationMonitor.serviceAiFirst")
    default:
      return t("conversationMonitor.serviceUndefined")
  }
}

function getStatusOptions(
  t: (key: string, values?: Record<string, string | number>) => string
) {
  return [
    { value: "all", label: t("conversationMonitor.allStatuses") },
    { value: "1", label: t("conversation.filterAiServing") },
    { value: "2", label: t("conversation.filterPending") },
    { value: "3", label: t("conversation.filterActive") },
    { value: "4", label: t("conversation.filterClosed") },
  ]
}

export default function DashboardConversationsPage() {
  const t = useI18n()
  const statusOptions = useMemo(() => getStatusOptions(t), [t])
  const [keywordInput, setKeywordInput] = useState("")
  const [statusFilterInput, setStatusFilterInput] = useState("all")
  const [tagFilterInput, setTagFilterInput] = useState("0")
  const [assigneeFilterInput, setAssigneeFilterInput] = useState("0")
  const [agentTeamFilterInput, setAgentTeamFilterInput] = useState("0")
  const [keyword, setKeyword] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [tagFilter, setTagFilter] = useState("0")
  const [assigneeFilter, setAssigneeFilter] = useState("0")
  const [agentTeamFilter, setAgentTeamFilter] = useState("0")
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [tags, setTags] = useState<TagTree[]>([])
  const [assigneeOptions, setAssigneeOptions] = useState<ComboboxOption[]>([
    { value: "0", label: t("conversationMonitor.allAssignees") },
  ])
  const [agentTeamOptions, setAgentTeamOptions] = useState<ComboboxOption[]>([
    { value: "0", label: t("conversationMonitor.allTeams") },
  ])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailItem, setDetailItem] = useState<AdminConversation | null>(null)
  const [detailData, setDetailData] = useState<AdminConversationDetail | null>(null)
  const [detailMessages, setDetailMessages] = useState<AdminMessage[]>([])
  const [detailMessagesNextCursor, setDetailMessagesNextCursor] = useState("")
  const [detailMessagesHasMore, setDetailMessagesHasMore] = useState(false)
  const [detailMessagesLoadingMore, setDetailMessagesLoadingMore] = useState(false)
  const [assignOpen, setAssignOpen] = useState(false)
  const [assignItem, setAssignItem] = useState<AdminConversation | null>(null)
  const [closeOpen, setCloseOpen] = useState(false)
  const [closeItem, setCloseItem] = useState<AdminConversation | null>(null)
  const [transferOpen, setTransferOpen] = useState(false)
  const [transferItem, setTransferItem] = useState<AdminConversation | null>(null)
  const [result, setResult] = useState<PageResult<AdminConversation>>({
    results: [],
    page: { page: 1, limit: 20, total: 0 },
  })
  const websocketRef = useRef<WebSocket | null>(null)
  const reconnectTimerRef = useRef<number | null>(null)
  const pingTimerRef = useRef<number | null>(null)
  const reconnectAttemptRef = useRef(0)
  const detailItemRef = useRef<AdminConversation | null>(null)
  const subscribedConversationIdRef = useRef<number | null>(null)

  const loadConversations = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchConversations({
        keyword: keyword.trim() || undefined,
        status: statusFilter === "all" ? undefined : statusFilter,
        tagId: tagFilter === "0" ? undefined : tagFilter,
        currentAssigneeId: assigneeFilter === "0" ? undefined : assigneeFilter,
        agentTeamId: agentTeamFilter === "0" ? undefined : agentTeamFilter,
        page,
        limit,
      })
      setResult(data)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("conversationMonitor.loadListFailed"))
    } finally {
      setLoading(false)
    }
  }, [keyword, limit, page, statusFilter, tagFilter, assigneeFilter, agentTeamFilter, t])

  useEffect(() => {
    let cancelled = false

    async function loadFilterOptions() {
      try {
        const [tagData, assigneeData, teamData] = await Promise.all([
          fetchTagsAll(),
          fetchAgentProfilesAll(),
          fetchAgentTeamsAll(),
        ])
        if (!cancelled) {
          setTags(Array.isArray(tagData) ? tagData : [])
          setAssigneeOptions([
            { value: "0", label: t("conversationMonitor.allAssignees") },
            ...assigneeData.map((item: AdminAgentProfile) => ({
              value: String(item.userId),
              label: item.displayName || item.nickname || item.username || `#${item.userId}`,
            })),
          ])
          setAgentTeamOptions([
            { value: "0", label: t("conversationMonitor.allTeams") },
            ...teamData.map((item: AdminAgentTeam) => ({
              value: String(item.id),
              label: item.name,
            })),
          ])
        }
      } catch (error) {
        if (!cancelled) {
          toast.error(error instanceof Error ? error.message : t("conversationMonitor.loadFiltersFailed"))
        }
      }
    }

    void loadFilterOptions()

    return () => {
      cancelled = true
    }
  }, [t])

  useEffect(() => {
    detailItemRef.current = detailItem
  }, [detailItem])

  useEffect(() => {
    void loadConversations()
  }, [loadConversations])

  useEffect(() => {
    let cancelled = false

    const clearTimers = () => {
      if (reconnectTimerRef.current) {
        window.clearTimeout(reconnectTimerRef.current)
        reconnectTimerRef.current = null
      }
      if (pingTimerRef.current) {
        window.clearInterval(pingTimerRef.current)
        pingTimerRef.current = null
      }
    }

    const scheduleReconnect = () => {
      if (cancelled || reconnectTimerRef.current) {
        return
      }
      const delay = Math.min(
        RECONNECT_BASE_DELAY * 2 ** reconnectAttemptRef.current,
        RECONNECT_MAX_DELAY
      )
      reconnectTimerRef.current = window.setTimeout(() => {
        reconnectTimerRef.current = null
        reconnectAttemptRef.current += 1
        connect()
      }, delay)
    }

    const connect = () => {
      if (cancelled) {
        return
      }

      let socket: WebSocket
      try {
        socket = new WebSocket(createAdminWebSocketUrl())
      } catch (error) {
        toast.error(error instanceof Error ? error.message : t("conversationMonitor.realtimeConnectFailed"))
        scheduleReconnect()
        return
      }
      websocketRef.current = socket

      socket.onopen = () => {
        reconnectAttemptRef.current = 0
        if (pingTimerRef.current) {
          window.clearInterval(pingTimerRef.current)
        }
        pingTimerRef.current = window.setInterval(() => {
          if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: "ping" }))
          }
        }, 20000)

        const conversationId = detailItemRef.current?.id
        if (conversationId) {
          socket.send(
            JSON.stringify({
              type: "subscribe",
              topics: [`conversation:${conversationId}`],
            })
          )
          subscribedConversationIdRef.current = conversationId
        } else {
          subscribedConversationIdRef.current = null
        }
      }

      socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data) as {
            eventId?: string
            type?: string
            data?: { conversationId?: number }
          }
          const eventType = payload.type ?? ""
          const conversationId = payload.data?.conversationId ?? 0
          const eventId = payload.eventId?.trim() ?? ""

          if (
            eventType === "" ||
            eventType === "connected" ||
            eventType === "pong" ||
            eventType === "subscribed" ||
            eventType === "unsubscribed"
          ) {
            return
          }

          if (eventId && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: "ack", eventId }))
          }

          void loadConversations()
          const currentDetail = detailItemRef.current
          if (conversationId > 0 && currentDetail?.id === conversationId) {
            void loadDetail(currentDetail)
          }
        } catch {
          // ignore invalid ws payload
        }
      }

      socket.onclose = () => {
        if (pingTimerRef.current) {
          window.clearInterval(pingTimerRef.current)
          pingTimerRef.current = null
        }
        if (websocketRef.current === socket) {
          websocketRef.current = null
        }
        subscribedConversationIdRef.current = null
        scheduleReconnect()
      }
    }

    connect()

    return () => {
      cancelled = true
      clearTimers()
      reconnectAttemptRef.current = 0
      const socket = websocketRef.current
      websocketRef.current = null
      if (socket) {
        socket.close()
      }
      subscribedConversationIdRef.current = null
    }
  }, [loadConversations, t])

  useEffect(() => {
    const socket = websocketRef.current
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      return
    }

    const previousConversationId = subscribedConversationIdRef.current
    const nextConversationId = detailOpen ? detailItem?.id ?? null : null
    if (previousConversationId && previousConversationId !== nextConversationId) {
      socket.send(
        JSON.stringify({
          type: "unsubscribe",
          topics: [`conversation:${previousConversationId}`],
        })
      )
    }
    if (nextConversationId && nextConversationId !== previousConversationId) {
      socket.send(
        JSON.stringify({
          type: "subscribe",
          topics: [`conversation:${nextConversationId}`],
        })
      )
      subscribedConversationIdRef.current = nextConversationId
      return
    }
    if (!nextConversationId) {
      subscribedConversationIdRef.current = null
    }
  }, [detailItem, detailOpen])

  function handleStatusFilterChange(value: string | null) {
    setStatusFilterInput(value ?? "all")
  }

  function applyFilters() {
    setKeyword(keywordInput)
    setStatusFilter(statusFilterInput)
    setTagFilter(tagFilterInput)
    setAssigneeFilter(assigneeFilterInput)
    setAgentTeamFilter(agentTeamFilterInput)
    setPage(1)
  }

  function handleFilterKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") {
      return
    }

    event.preventDefault()
    applyFilters()
  }

  function handlePageChange(nextPage: number) {
    if (nextPage < 1 || nextPage === page) {
      return
    }
    setPage(nextPage)
  }

  function handleLimitChange(nextLimit: number) {
    if (nextLimit <= 0 || nextLimit === limit) {
      return
    }
    setLimit(nextLimit)
    setPage(1)
  }

  async function loadDetail(item: AdminConversation) {
    setDetailLoading(true)
    setDetailMessagesNextCursor("")
    setDetailMessagesHasMore(false)
    try {
      const [detail, messages] = await Promise.all([
        fetchConversationDetail(item.id),
        fetchConversationMessages({ conversationId: item.id, limit: 20 }),
      ])
      setDetailData(detail)
      setDetailMessages(Array.isArray(messages.results) ? messages.results : [])
      setDetailMessagesNextCursor(messages.cursor ?? "")
      setDetailMessagesHasMore(Boolean(messages.hasMore))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("conversationMonitor.loadDetailFailed"))
    } finally {
      setDetailLoading(false)
    }
  }

  const loadMoreDetailMessages = useCallback(async () => {
    if (!detailItem || detailMessagesLoadingMore || !detailMessagesHasMore) {
      return
    }
    const cursor = Number.parseInt(detailMessagesNextCursor, 10)
    if (!detailMessagesNextCursor.trim() || !Number.isFinite(cursor) || cursor <= 0) {
      return
    }
    setDetailMessagesLoadingMore(true)
    try {
      const page = await fetchConversationMessages({
        conversationId: detailItem.id,
        cursor,
        limit: 20,
      })
      const nextResults = Array.isArray(page.results) ? page.results : []
      setDetailMessages((prev) => [...nextResults, ...prev])
      setDetailMessagesNextCursor(page.cursor ?? "")
      setDetailMessagesHasMore(Boolean(page.hasMore))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("conversationMonitor.loadMoreMessagesFailed"))
    } finally {
      setDetailMessagesLoadingMore(false)
    }
  }, [
    detailItem,
    detailMessagesHasMore,
    detailMessagesLoadingMore,
    detailMessagesNextCursor,
    t,
  ])

  async function openDetail(item: AdminConversation) {
    setDetailItem(item)
    setDetailData(null)
    setDetailMessages([])
    setDetailMessagesNextCursor("")
    setDetailMessagesHasMore(false)
    setDetailMessagesLoadingMore(false)
    setDetailOpen(true)
    await loadDetail(item)
  }

  function handleDetailOpenChange(open: boolean) {
    if (actionLoadingId) {
      return
    }
    if (!open) {
      setDetailOpen(false)
      setDetailItem(null)
      setDetailData(null)
      setDetailMessages([])
      setDetailMessagesNextCursor("")
      setDetailMessagesHasMore(false)
      setDetailMessagesLoadingMore(false)
      return
    }
    setDetailOpen(true)
  }

  function openAssign(item: AdminConversation) {
    setAssignItem(item)
    setAssignOpen(true)
  }

  function handleAssignOpenChange(open: boolean) {
    if (actionLoadingId) {
      return
    }
    if (!open) {
      setAssignOpen(false)
      setAssignItem(null)
      return
    }
    setAssignOpen(true)
  }

  function openTransfer(item: AdminConversation) {
    setTransferItem(item)
    setTransferOpen(true)
  }

  function openClose(item: AdminConversation) {
    setCloseItem(item)
    setCloseOpen(true)
  }

  function handleCloseOpenChange(open: boolean) {
    if (actionLoadingId) {
      return
    }
    if (!open) {
      setCloseOpen(false)
      setCloseItem(null)
      return
    }
    setCloseOpen(true)
  }

  function handleTransferOpenChange(open: boolean) {
    if (actionLoadingId) {
      return
    }
    if (!open) {
      setTransferOpen(false)
      setTransferItem(null)
      return
    }
    setTransferOpen(true)
  }

  async function refreshDetail() {
    if (!detailOpen || !detailItem) {
      return
    }
    await loadDetail(detailItem)
  }

  async function handleRefresh() {
    setRefreshing(true)
    try {
      await loadConversations()
      await refreshDetail()
    } finally {
      setRefreshing(false)
    }
  }

  async function handleRead(item: AdminConversation) {
    setActionLoadingId(item.id)
    try {
      await markConversationRead(item.id)
      toast.success(t("conversationMonitor.markedRead", { name: item.customerName || `#${item.id}` }))
      await loadConversations()
      if (detailItem?.id === item.id) {
        await refreshDetail()
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("conversationMonitor.markReadFailed"))
    } finally {
      setActionLoadingId(null)
    }
  }

  async function handleDispatch(item: AdminConversation) {
    setActionLoadingId(item.id)
    try {
      await dispatchConversation(item.id)
      toast.success(t("conversationMonitor.dispatchTriggered", { name: item.customerName || `#${item.id}` }))
      await loadConversations()
      if (detailItem?.id === item.id) {
        await refreshDetail()
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("conversationMonitor.dispatchFailed"))
    } finally {
      setActionLoadingId(null)
    }
  }

  async function handleConversationChanged(conversationId: number) {
    await loadConversations()
    if (detailItem?.id === conversationId) {
      await refreshDetail()
    }
  }

  return (
    <>
      <DashboardPage>
        <DashboardToolbar
          actions={
            <Button
              variant="outline"
              onClick={() => void handleRefresh()}
              disabled={loading || refreshing}
            >
              <RefreshCwIcon className={loading || refreshing ? "animate-spin" : ""} />
              {t("conversationMonitor.refresh")}
            </Button>
          }
        >
          <div className="relative w-full sm:w-72">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={keywordInput}
              onChange={(event) => setKeywordInput(event.target.value)}
              onKeyDown={handleFilterKeyDown}
              placeholder={t("conversationMonitor.keywordPlaceholder")}
              className="pl-9"
            />
          </div>
          <div className="w-full sm:w-36">
            <OptionCombobox
              value={statusFilterInput}
              options={statusOptions}
              placeholder={t("conversationMonitor.allStatuses")}
              onChange={handleStatusFilterChange}
            />
          </div>
          <div className="w-full sm:w-64">
            <TagSelector
              mode="single"
              value={Number(tagFilterInput)}
              onChange={(value) => setTagFilterInput(String(value))}
              tags={tags}
              placeholder={t("conversationMonitor.selectTag")}
              searchPlaceholder={t("conversationMonitor.searchTagPath")}
              emptyText={t("conversationMonitor.emptyTags")}
              rootOption={{ value: 0, label: t("conversationMonitor.allTags") }}
            />
          </div>
          <div className="w-full sm:w-56">
            <OptionCombobox
              value={assigneeFilterInput}
              options={assigneeOptions}
              placeholder={t("conversationMonitor.selectAssignee")}
              searchPlaceholder={t("conversationMonitor.searchAssignee")}
              emptyText={t("conversationMonitor.emptyAssignees")}
              onChange={setAssigneeFilterInput}
            />
          </div>
          <div className="w-full sm:w-56">
            <OptionCombobox
              value={agentTeamFilterInput}
              options={agentTeamOptions}
              placeholder={t("conversationMonitor.selectTeam")}
              searchPlaceholder={t("conversationMonitor.searchTeam")}
              emptyText={t("conversationMonitor.emptyTeams")}
              onChange={setAgentTeamFilterInput}
            />
          </div>
          <Button variant="outline" onClick={applyFilters} disabled={loading}>
            <SearchIcon />
            {t("conversationMonitor.query")}
          </Button>
        </DashboardToolbar>

        <DashboardTableShell
          pagination={
            <ListPagination
              page={result.page.page}
              total={result.page.total}
              limit={result.page.limit}
              loading={loading || refreshing}
              onPageChange={handlePageChange}
              onLimitChange={handleLimitChange}
            />
          }
        >
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow>
                  <TableHead>{t("conversationMonitor.columnConversation")}</TableHead>
                  <TableHead>{t("conversationMonitor.columnStatus")}</TableHead>
                  <TableHead>{t("conversationMonitor.columnServiceMode")}</TableHead>
                  <TableHead>{t("conversationMonitor.columnAssignee")}</TableHead>
                  <TableHead>{t("conversationMonitor.columnUnread")}</TableHead>
                  <TableHead>{t("conversationMonitor.columnLastActive")}</TableHead>
                  <TableHead className="w-28 text-right">
                    {t("conversationMonitor.columnActions")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.results.map((item) => {
                  const statusMeta = getStatusMeta(item.status, t)

                  return (
                    <TableRow key={item.id}>
                      <TableCell className="max-w-60">
                        <div className="min-w-0">
                          <div className="font-medium">
                            {item.customerName ||
                              t("conversationMonitor.customerFallback", {
                                id: item.customerId || item.id,
                              })}
                          </div>
                          <div className="mt-1 text-sm text-muted-foreground">
                            {t("conversationMonitor.channelIdValue", {
                              id: item.channelId || "-",
                            })}
                          </div>
                          <div className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                            {item.lastMessageSummary || t("conversationMonitor.noLatestSummary")}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusMeta.variant}>{statusMeta.label}</Badge>
                      </TableCell>
                      <TableCell>{getServiceModeLabel(item.serviceMode, t)}</TableCell>
                      <TableCell>{item.currentAssigneeName || "-"}</TableCell>
                      <TableCell>
                        {t("conversationMonitor.unreadSummary", {
                          agent: item.agentUnreadCount,
                          customer: item.customerUnreadCount,
                        })}
                      </TableCell>
                      <TableCell>{formatDateTime(item.lastMessageAt)}</TableCell>
                      <TableCell className="text-right">
                        <ButtonGroup className="ml-auto">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => void openDetail(item)}
                            disabled={actionLoadingId === item.id}
                          >
                            {t("conversationMonitor.view")}
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              render={<Button variant="outline" size="icon-sm" />}
                              aria-label={t("conversationMonitor.moreActions", {
                                name: item.customerName || item.id,
                              })}
                            >
                              <MoreHorizontalIcon />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-44 min-w-44">
                              <DropdownMenuItem
                                onClick={() => openAssign(item)}
                                disabled={actionLoadingId === item.id || item.status !== 2}
                              >
                                <MessageCircleMoreIcon />
                                {actionLoadingId === item.id
                                  ? t("conversationMonitor.processing")
                                  : t("conversationMonitor.assign")}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => void handleDispatch(item)}
                                disabled={actionLoadingId === item.id || item.status !== 2}
                              >
                                <RefreshCwIcon />
                                {actionLoadingId === item.id
                                  ? t("conversationMonitor.processing")
                                  : t("conversationMonitor.retryDispatch")}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => void handleRead(item)}
                                disabled={actionLoadingId === item.id}
                              >
                                <CheckCheckIcon />
                                {actionLoadingId === item.id
                                  ? t("conversationMonitor.processing")
                                  : t("conversationMonitor.markRead")}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => openTransfer(item)}
                                disabled={actionLoadingId === item.id || item.status !== 3}
                              >
                                <MessageCircleMoreIcon />
                                {actionLoadingId === item.id
                                  ? t("conversationMonitor.processing")
                                  : t("conversationMonitor.transfer")}
                              </DropdownMenuItem>
                              {item.status !== 4 ? (
                                <DropdownMenuItem
                                  onClick={() => openClose(item)}
                                  disabled={actionLoadingId === item.id}
                                >
                                  <RefreshCwIcon />
                                  {actionLoadingId === item.id
                                    ? t("conversationMonitor.processing")
                                    : t("conversationMonitor.close")}
                                </DropdownMenuItem>
                              ) : null}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </ButtonGroup>
                      </TableCell>
                    </TableRow>
                  )
                })}
                {loading || result.results.length === 0 ? (
                  <DashboardTableStateRow
                    colSpan={7}
                    loading={loading}
                    loadingText={t("conversationMonitor.loadingRows")}
                    emptyText={t("conversationMonitor.emptyRows")}
                  />
                ) : null}
              </TableBody>
            </Table>
        </DashboardTableShell>
      </DashboardPage>

      <ConversationDetailDialog
        open={detailOpen}
        loading={detailLoading}
        saving={actionLoadingId === detailItem?.id}
        item={detailItem}
        detail={detailData}
        messages={detailMessages}
        messagesHasMore={detailMessagesHasMore}
        loadingMoreMessages={detailMessagesLoadingMore}
        onLoadMoreMessages={loadMoreDetailMessages}
        onOpenChange={handleDetailOpenChange}
        onOpenAssign={() => {
          if (!detailItem) {
            return
          }
          openAssign(detailItem)
        }}
        onDispatch={async () => {
          if (!detailItem) {
            return
          }
          await handleDispatch(detailItem)
        }}
        onOpenTransfer={() => {
          if (!detailItem) {
            return
          }
          openTransfer(detailItem)
        }}
        onRead={async () => {
          if (!detailItem) {
            return
          }
          await handleRead(detailItem)
        }}
        onOpenClose={() => {
          if (!detailItem) {
            return
          }
          openClose(detailItem)
        }}
      />
      <ConversationCloseDialog
        open={closeOpen}
        conversationId={closeItem?.id ?? null}
        onOpenChange={handleCloseOpenChange}
        onSuccess={async () => {
          const conversationId = closeItem?.id
          setCloseOpen(false)
          setCloseItem(null)
          if (conversationId) {
            await handleConversationChanged(conversationId)
          }
        }}
      />
      <ConversationTransferDialog
        open={assignOpen}
        mode="assign"
        conversationId={assignItem?.id ?? null}
        onOpenChange={handleAssignOpenChange}
        onSuccess={async () => {
          const conversationId = assignItem?.id
          setAssignOpen(false)
          setAssignItem(null)
          if (conversationId) {
            await handleConversationChanged(conversationId)
          }
        }}
      />
      <ConversationTransferDialog
        open={transferOpen}
        mode="transfer"
        conversationId={transferItem?.id ?? null}
        onOpenChange={handleTransferOpenChange}
        onSuccess={async () => {
          const conversationId = transferItem?.id
          setTransferOpen(false)
          setTransferItem(null)
          if (conversationId) {
            await handleConversationChanged(conversationId)
          }
        }}
      />
    </>
  )
}
