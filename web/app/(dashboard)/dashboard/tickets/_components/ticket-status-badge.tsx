"use client"

import { Badge } from "@/components/ui/badge"
import { useI18n } from "@/i18n/provider"
import type { TicketStatus } from "@/lib/api/ticket"

const statusMap = {
  pending: { labelKey: "ticket.statusPending", className: "border-amber-200 bg-amber-50 text-amber-700" },
  in_progress: { labelKey: "ticket.statusInProgress", className: "border-blue-200 bg-blue-50 text-blue-700" },
  done: { labelKey: "ticket.statusDone", className: "border-emerald-200 bg-emerald-50 text-emerald-700" },
} as const

export function ticketStatusLabel(status: string) {
  return status
}

export function getTicketStatusMeta(status: string) {
  return statusMap[status as TicketStatus]
}

export function TicketStatusBadge({ status }: { status: string }) {
  const t = useI18n()
  const option = getTicketStatusMeta(status)

  return (
    <Badge variant="outline" className={option?.className ?? "border-border bg-muted text-muted-foreground"}>
      {option ? t(option.labelKey) : status}
    </Badge>
  )
}
