"use client"

import { Area, AreaChart, Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"

import type { DashboardStatusDistributionItem, DashboardTrendItem } from "@/lib/api/dashboard"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { useI18n } from "@/i18n/provider"

type TrendPanelProps = {
  title: string
  description: string
  trend: DashboardTrendItem[]
  distribution: DashboardStatusDistributionItem[]
}

export function TrendPanel({
  title,
  description,
  trend,
  distribution,
}: TrendPanelProps) {
  const t = useI18n()
  const trendConfig = {
    newCount: {
      label: t("dashboardHome.chartNew"),
      color: "hsl(24 95% 53%)",
    },
    closedCount: {
      label: t("dashboardHome.chartClosed"),
      color: "hsl(190 95% 39%)",
    },
  } satisfies ChartConfig
  const distributionConfig = {
    count: {
      label: t("dashboardHome.chartCount"),
      theme: {
        light: "hsl(222 47% 11%)",
        dark: "hsl(210 40% 98%)",
      },
    },
  } satisfies ChartConfig
  const localizedDistribution = distribution.map((item) => ({
    ...item,
    label: getStatusLabel(item.status, item.label, t),
  }))

  return (
    <div className="grid gap-4 xl:grid-cols-[1.5fr_0.9fr]">
      <Card className="rounded-md shadow-none">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={trendConfig} className="h-72 w-full">
            <AreaChart data={trend}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Area
                type="monotone"
                dataKey="newCount"
                stroke="var(--color-newCount)"
                fill="var(--color-newCount)"
                fillOpacity={0.18}
                strokeWidth={2}
              />
              <Area
                type="monotone"
                dataKey="closedCount"
                stroke="var(--color-closedCount)"
                fill="var(--color-closedCount)"
                fillOpacity={0.08}
                strokeWidth={2}
              />
            </AreaChart>
          </ChartContainer>
        </CardContent>
      </Card>

      <Card className="rounded-md shadow-none">
        <CardHeader>
          <CardTitle>{t("dashboardHome.statusDistribution")}</CardTitle>
          <CardDescription>{t("dashboardHome.statusDistributionDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ChartContainer config={distributionConfig} className="h-72 w-full">
            <BarChart data={localizedDistribution} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid horizontal={false} />
              <YAxis
                type="category"
                dataKey="label"
                tickLine={false}
                axisLine={false}
                width={64}
              />
              <XAxis type="number" hide />
              <ChartTooltip content={<ChartTooltipContent hideLabel />} />
              <Bar
                dataKey="count"
                fill="var(--color-count)"
                radius={[0, 8, 8, 0]}
              />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  )
}

function getStatusLabel(
  status: number,
  fallback: string,
  t: (key: string) => string
) {
  switch (status) {
    case 1:
      return t("dashboardHome.statusAiServing")
    case 2:
      return t("dashboardHome.statusPending")
    case 3:
      return t("dashboardHome.statusActive")
    case 4:
      return t("dashboardHome.statusClosed")
    default:
      return fallback
  }
}
