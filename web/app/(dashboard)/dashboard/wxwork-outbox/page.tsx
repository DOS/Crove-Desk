"use client"

import { useState } from "react"
import { BanIcon, RotateCcwIcon } from "lucide-react"
import { toast } from "sonner"

import {
  DashboardListPage,
  type DashboardListRenderContext,
} from "@/components/dashboard/list"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  fetchWxWorkOutboxFailures,
  ignoreWxWorkOutbox,
  retryWxWorkOutbox,
  type ChannelMessageOutbox,
} from "@/lib/api/admin"
import { formatDateTime } from "@/lib/utils"

const STATUS_OPTIONS = [
  { value: "failed", label: "失败" },
  { value: "ignored", label: "已忽略" },
  { value: "all", label: "全部" },
] as const

function statusLabel(status: string) {
  if (status === "failed") return "失败"
  if (status === "ignored") return "已忽略"
  return status || "-"
}

function statusVariant(status: string) {
  if (status === "failed") return "destructive" as const
  if (status === "ignored") return "outline" as const
  return "secondary" as const
}

function formatOptionalTime(value: string) {
  return value ? formatDateTime(value) : "-"
}

function OutboxActions({
  item,
  reload,
}: {
  item: ChannelMessageOutbox
  reload: DashboardListRenderContext<ChannelMessageOutbox>["reload"]
}) {
  const [runningAction, setRunningAction] = useState<"retry" | "ignore" | null>(null)

  async function runAction(action: "retry" | "ignore") {
    setRunningAction(action)
    try {
      if (action === "retry") {
        await retryWxWorkOutbox(item.id)
        toast.success("已重新加入发送队列")
      } else {
        await ignoreWxWorkOutbox(item.id)
        toast.success("已忽略该失败记录")
      }
      await reload()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "操作失败")
    } finally {
      setRunningAction(null)
    }
  }

  return (
    <div className="flex items-center justify-end gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={runningAction !== null}
        onClick={() => void runAction("retry")}
      >
        <RotateCcwIcon />
        重试
      </Button>
      {item.sendStatus === "failed" ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={runningAction !== null}
          onClick={() => void runAction("ignore")}
        >
          <BanIcon />
          忽略
        </Button>
      ) : null}
    </div>
  )
}

export default function DashboardWxWorkOutboxPage() {
  return (
    <DashboardListPage<ChannelMessageOutbox>
      filters={[
        {
          name: "sendStatus",
          label: "状态",
          defaultValue: "failed",
          type: "segment",
          options: STATUS_OPTIONS,
        },
        {
          name: "conversationId",
          label: "会话 ID",
          placeholder: "会话 ID",
          defaultValue: "",
          valueType: "number",
          className: "w-full sm:w-40",
        },
        {
          name: "messageId",
          label: "消息 ID",
          placeholder: "消息 ID",
          defaultValue: "",
          valueType: "number",
          className: "w-full sm:w-40",
        },
      ]}
      fetchList={fetchWxWorkOutboxFailures}
      getItemId={(item) => item.id}
      columns={[
        {
          key: "id",
          label: "Outbox",
          className: "w-28 text-xs text-muted-foreground",
          render: (item) => `#${item.id}`,
        },
        {
          key: "message",
          label: "消息",
          className: "w-48",
          render: (item) => (
            <div className="space-y-1 text-xs">
              <div>会话 #{item.conversationId || "-"}</div>
              <div className="text-muted-foreground">消息 #{item.messageId || "-"}</div>
            </div>
          ),
        },
        {
          key: "status",
          label: "状态",
          className: "w-28",
          render: (item) => (
            <Badge variant={statusVariant(item.sendStatus)}>
              {statusLabel(item.sendStatus)}
            </Badge>
          ),
        },
        {
          key: "retry",
          label: "重试",
          className: "w-44 text-xs",
          render: (item) => (
            <div className="space-y-1">
              <div>{item.retryCount} 次</div>
              <div className="text-muted-foreground">
                下次 {formatOptionalTime(item.nextRetryAt)}
              </div>
            </div>
          ),
        },
        {
          key: "error",
          label: "失败原因",
          className: "min-w-72 max-w-[32rem]",
          render: (item) =>
            item.lastError ? (
              <span className="block truncate text-xs text-destructive" title={item.lastError}>
                {item.lastError}
              </span>
            ) : (
              "-"
            ),
        },
        {
          key: "updatedAt",
          label: "更新时间",
          className: "w-44 text-xs text-muted-foreground",
          render: (item) => formatOptionalTime(item.updatedAt),
        },
        {
          key: "actions",
          label: <span className="block text-right">操作</span>,
          className: "w-44",
          render: (item, context) => (
            <OutboxActions item={item} reload={context.reload} />
          ),
        },
      ]}
      labels={{
        refresh: "刷新",
        query: "查询",
        loading: "正在加载企业微信 outbox...",
        empty: "暂无失败 outbox",
        loadFailed: "加载企业微信 outbox 失败",
      }}
    />
  )
}
