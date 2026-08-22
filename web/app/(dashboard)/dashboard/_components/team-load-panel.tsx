"use client"

import { Badge } from "@/components/ui/badge"
import { useI18n } from "@/i18n/provider"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type { DashboardOverview } from "@/lib/api/dashboard"

type TeamLoadPanelProps = {
  agentStats: DashboardOverview["agentStats"]
}

function getLoadTone(loadRate: number) {
  if (loadRate >= 85) {
    return "bg-red-500"
  }
  if (loadRate >= 60) {
    return "bg-amber-500"
  }
  return "bg-emerald-500"
}

export function TeamLoadPanel({ agentStats }: TeamLoadPanelProps) {
  const t = useI18n()

  return (
    <Card className="rounded-md shadow-none">
      <CardHeader>
        <CardTitle>{t("dashboardHome.teamLoad")}</CardTitle>
        <CardDescription>
          {t("dashboardHome.teamLoadDescription", {
            online: agentStats.onlineAgents,
            busy: agentStats.busyAgents,
            offline: agentStats.offlineAgents,
          })}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {agentStats.teamLoads.length === 0 ? (
          <div className="rounded-md border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
            {t("dashboardHome.noTeamData")}
          </div>
        ) : (
          agentStats.teamLoads.map((item) => (
            <div key={item.teamId} className="rounded-md border p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="font-medium">{item.teamName}</div>
                    {item.hasScheduleNow ? (
                      <Badge variant="secondary">{t("dashboardHome.scheduled")}</Badge>
                    ) : (
                      <Badge variant="outline">{t("dashboardHome.notScheduled")}</Badge>
                    )}
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    {t("dashboardHome.teamStats", {
                      total: item.totalAgents,
                      online: item.onlineAgents,
                      busy: item.busyAgents,
                      offline: item.offlineAgents,
                    })}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-semibold">{item.loadRate.toFixed(1)}%</div>
                  <div className="text-xs text-muted-foreground">
                    {t("dashboardHome.load", {
                      processing: item.processingConversations,
                      capacity: item.maxConcurrentCapacity || 0,
                    })}
                  </div>
                </div>
              </div>

              <div className="mt-4 h-2 rounded-full bg-muted">
                <div
                  className={`h-2 rounded-full ${getLoadTone(item.loadRate)}`}
                  style={{ width: `${Math.min(item.loadRate, 100)}%` }}
                />
              </div>

              <div className="mt-4 grid gap-3 text-sm md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-md bg-muted/35 px-3 py-2">
                  <div className="text-muted-foreground">{t("dashboardHome.waiting")}</div>
                  <div className="mt-1 text-lg font-semibold">{item.waitingConversations}</div>
                </div>
                <div className="rounded-md bg-muted/35 px-3 py-2">
                  <div className="text-muted-foreground">{t("dashboardHome.processing")}</div>
                  <div className="mt-1 text-lg font-semibold">{item.processingConversations}</div>
                </div>
                <div className="rounded-md bg-muted/35 px-3 py-2">
                  <div className="text-muted-foreground">{t("dashboardHome.capacity")}</div>
                  <div className="mt-1 text-lg font-semibold">{item.maxConcurrentCapacity}</div>
                </div>
                <div className="rounded-md bg-muted/35 px-3 py-2">
                  <div className="text-muted-foreground">{t("dashboardHome.busyAgents")}</div>
                  <div className="mt-1 text-lg font-semibold">{item.busyAgents}</div>
                </div>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}
