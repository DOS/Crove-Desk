"use client"

import { useCallback, useEffect, useState } from "react"
import { RefreshCwIcon } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent } from "@/components/ui/card"
import { useI18n } from "@/i18n/provider"
import {
  fetchDashboardOverview,
  type DashboardOverview,
  type DashboardRange,
} from "@/lib/api/dashboard"
import { SummaryCards } from "./summary-cards"
import { TrendPanel } from "./trend-panel"
import { TeamLoadPanel } from "./team-load-panel"
import { AlertList } from "./alert-list"

function LoadingCards() {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
      {Array.from({ length: 6 }).map((_, index) => (
        <Card key={index} className="rounded-md shadow-none">
          <CardContent className="space-y-3 p-4">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-4 w-full" />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

export function DashboardHome() {
  const t = useI18n()
  const [range, setRange] = useState<DashboardRange>("7d")
  const [data, setData] = useState<DashboardOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const loadData = useCallback(
    async (nextRange: DashboardRange, showRefreshing = false) => {
      if (showRefreshing) {
        setRefreshing(true)
      } else {
        setLoading(true)
      }
      try {
        const result = await fetchDashboardOverview(nextRange)
        setData(result)
      } catch (error) {
        toast.error(error instanceof Error ? error.message : t("dashboardHome.loadFailed"))
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [t]
  )

  useEffect(() => {
    void loadData(range)
  }, [loadData, range])

  const rangeOptions: Array<{ value: DashboardRange; label: string }> = [
    { value: "today", label: t("dashboardHome.rangeToday") },
    { value: "7d", label: t("dashboardHome.range7d") },
    { value: "30d", label: t("dashboardHome.range30d") },
  ]

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 lg:p-5">
      <div className="flex justify-end">
        <div className="flex flex-wrap items-center gap-2">
          <div className="rounded-md border bg-background p-1">
            {rangeOptions.map((item) => (
              <Button
                key={item.value}
                variant={range === item.value ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setRange(item.value)}
              >
                {item.label}
              </Button>
            ))}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void loadData(range, true)}
            disabled={loading || refreshing}
          >
            <RefreshCwIcon className={refreshing ? "mr-2 size-4 animate-spin" : "mr-2 size-4"} />
            {t("dashboardHome.refresh")}
          </Button>
        </div>
      </div>

      {loading && !data ? (
        <LoadingCards />
      ) : data ? (
        <>
          <SummaryCards summary={data.summary} />

          <TrendPanel
            title={t("dashboardHome.conversationTrend")}
            description={t("dashboardHome.conversationTrendDescription")}
            trend={data.conversationStats.trend}
            distribution={data.conversationStats.statusDistribution}
          />

          <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
            <TeamLoadPanel agentStats={data.agentStats} />

            <Card className="rounded-md shadow-none">
              <CardContent className="grid gap-3 p-4 sm:grid-cols-2">
                <div className="rounded-md border bg-background px-3 py-2.5">
                  <div className="text-sm text-muted-foreground">{t("dashboardHome.enabledAiAgents")}</div>
                  <div className="mt-1 text-2xl font-semibold">{data.aiStats.enabledAiAgents}</div>
                </div>
                <div className="rounded-md border bg-background px-3 py-2.5">
                  <div className="text-sm text-muted-foreground">{t("dashboardHome.enabledChannels")}</div>
                  <div className="mt-1 text-2xl font-semibold">{data.aiStats.enabledChannels}</div>
                </div>
                <div className="rounded-md border bg-background px-3 py-2.5">
                  <div className="text-sm text-muted-foreground">{t("dashboardHome.todayKnowledgeRetrieves")}</div>
                  <div className="mt-1 text-2xl font-semibold">
                    {data.aiStats.todayKnowledgeRetrieves}
                  </div>
                </div>
                <div className="rounded-md border bg-background px-3 py-2.5">
                  <div className="text-sm text-muted-foreground">{t("dashboardHome.todayKnowledgeRetrieveFailRate")}</div>
                  <div className="mt-1 text-2xl font-semibold">
                    {data.aiStats.todayKnowledgeRetrieveFailRate.toFixed(1)}%
                  </div>
                </div>
                <div className="rounded-md border bg-background px-3 py-2.5">
                  <div className="text-sm text-muted-foreground">{t("dashboardHome.todayAgentRunFailCount")}</div>
                  <div className="mt-1 text-2xl font-semibold">
                    {data.aiStats.todayAgentRunFailCount}
                  </div>
                </div>
                <div className="rounded-md border bg-background px-3 py-2.5">
                  <div className="text-sm text-muted-foreground">{t("dashboardHome.todayAiHandoffCount")}</div>
                  <div className="mt-1 text-2xl font-semibold">
                    {data.aiStats.todayAiHandoffCount}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <AlertList alerts={data.alerts} />
        </>
      ) : (
        <Card className="rounded-md shadow-none">
          <CardContent className="flex min-h-60 items-center justify-center p-6 text-sm text-muted-foreground">
            {t("dashboardHome.empty")}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
