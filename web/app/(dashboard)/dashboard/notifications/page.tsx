"use client"

import { useRouter } from "next/navigation"
import { BellIcon, CheckCheckIcon } from "lucide-react"
import { toast } from "sonner"

import { DashboardListPage } from "@/components/dashboard/list"
import { useNotifications } from "@/components/notification-provider"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationItem,
  type NotificationReadStatus,
} from "@/lib/api/notification"
import { formatDateTime } from "@/lib/utils"
import { useI18n } from "@/i18n/provider"

export default function DashboardNotificationsPage() {
  const t = useI18n()
  const router = useRouter()
  const { refreshUnreadCount } = useNotifications()
  const readStatusOptions: Array<{ value: NotificationReadStatus; label: string }> = [
    { value: "all", label: t("notification.all") },
    { value: "unread", label: t("notification.unread") },
    { value: "read", label: t("notification.read") },
  ]

  async function openNotification(item: NotificationItem) {
    try {
      if (!item.readAt) {
        await markNotificationRead(item.id)
        await refreshUnreadCount()
      }
      if (item.actionUrl) {
        router.push(item.actionUrl)
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("notification.openFailed"))
    }
  }

  async function markAllRead(reload: () => Promise<void>) {
    try {
      await markAllNotificationsRead()
      await refreshUnreadCount()
      await reload()
      toast.success(t("notification.markAllReadSuccess"))
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("notification.markAllReadFailed")
      )
    }
  }

  return (
    <DashboardListPage<NotificationItem>
      filters={[
        {
          name: "readStatus",
          label: t("notification.all"),
          type: "segment",
          defaultValue: "all",
          allValue: "all",
          options: readStatusOptions,
        },
      ]}
      fetchList={fetchNotifications}
      renderToolbarActions={({ result, reload }) => (
        <Button
          variant="outline"
          onClick={() => void markAllRead(reload)}
          disabled={result.page.total === 0}
        >
          <CheckCheckIcon />
          {t("notification.markAllRead")}
        </Button>
      )}
      renderContent={({ result, loading }) =>
        result.results.length > 0 ? (
          <div className="divide-y">
            {result.results.map((item) => {
              const unread = !item.readAt
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => void openNotification(item)}
                  className="grid w-full gap-2 px-4 py-3 text-left transition-colors hover:bg-muted/60"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <BellIcon className="size-4 text-muted-foreground" />
                    <span className="font-medium">
                      {item.title || t("notification.fallbackTitle")}
                    </span>
                    {unread ? (
                      <Badge>{t("notification.unread")}</Badge>
                    ) : (
                      <Badge variant="outline">{t("notification.read")}</Badge>
                    )}
                    <span className="ml-auto text-xs text-muted-foreground">
                      {formatDateTime(item.createdAt)}
                    </span>
                  </div>
                  <div className="whitespace-pre-line text-sm text-muted-foreground">
                    {item.content || "-"}
                  </div>
                </button>
              )
            })}
          </div>
        ) : (
          <div className="flex min-h-48 items-center justify-center text-sm text-muted-foreground">
            {loading ? t("notification.loading") : t("notification.empty")}
          </div>
        )
      }
      labels={{
        refresh: t("notification.refresh"),
        loading: t("notification.loading"),
        empty: t("notification.empty"),
        loadFailed: t("notification.loadFailed"),
      }}
    />
  )
}
