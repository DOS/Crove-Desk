"use client"

import Link from "next/link"
import { ArrowRightIcon, ShieldAlertIcon } from "lucide-react"

import type { DashboardAlert } from "@/lib/api/dashboard"
import { Badge } from "@/components/ui/badge"
import { useI18n } from "@/i18n/provider"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

type AlertListProps = {
  alerts: DashboardAlert[]
}

function getAlertBadgeVariant(level: DashboardAlert["level"]) {
  if (level === "error") {
    return "destructive" as const
  }
  if (level === "warning") {
    return "secondary" as const
  }
  return "outline" as const
}

export function AlertList({ alerts }: AlertListProps) {
  const t = useI18n()

  return (
    <Card className="rounded-md shadow-none">
      <CardHeader>
        <CardTitle>{t("dashboardHome.riskAlerts")}</CardTitle>
        <CardDescription>{t("dashboardHome.riskAlertsDescription")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {alerts.length === 0 ? (
          <div className="rounded-md border border-dashed px-4 py-10 text-center">
            <ShieldAlertIcon className="mx-auto mb-3 size-8 text-muted-foreground" />
            <div className="text-sm font-medium">{t("dashboardHome.noRiskTitle")}</div>
            <div className="mt-1 text-sm text-muted-foreground">
              {t("dashboardHome.noRiskDescription")}
            </div>
          </div>
        ) : (
          alerts.map((item) => (
            <Link key={item.id} href={item.link} className="block">
              <div className="rounded-md border p-4 transition-colors hover:border-primary/40">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="font-medium">{item.title}</div>
                      <Badge variant={getAlertBadgeVariant(item.level)}>
                        {item.count}
                      </Badge>
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      {item.description}
                    </div>
                  </div>
                  <ArrowRightIcon className="mt-0.5 size-4 text-muted-foreground" />
                </div>
              </div>
            </Link>
          ))
        )}
      </CardContent>
    </Card>
  )
}
