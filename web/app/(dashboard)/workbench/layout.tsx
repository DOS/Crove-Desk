"use client"

import { Loader2Icon } from "lucide-react"
import { usePathname, useRouter } from "next/navigation"
import type { CSSProperties, ReactNode } from "react"
import { useEffect } from "react"

import { AgentRealtimeProvider } from "@/components/agent-realtime-provider"
import { useAuth } from "@/components/auth-provider"
import { NotificationProvider } from "@/components/notification-provider"
import { WorkbenchHeader } from "@/components/workbench-header"
import { WorkbenchRail } from "@/components/workbench-rail"
import { useI18n } from "@/i18n/provider"

export default function WorkbenchLayout({
  children,
}: {
  children: ReactNode
}) {
  const t = useI18n()
  const { ready, session } = useAuth()
  const pathname = usePathname()
  const router = useRouter()
  const isWorkbenchRoute = pathname?.startsWith("/workbench") ?? false

  useEffect(() => {
    if (ready && !session && isWorkbenchRoute) {
      router.replace("/dashboard/login")
    }
  }, [isWorkbenchRoute, ready, router, session])

  if (!ready || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[linear-gradient(160deg,#f3f1e8_0%,#f8faf5_46%,#e8f7f2_100%)] p-6">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Loader2Icon className="size-5 animate-spin" />
          </div>
          <div className="space-y-1">
            <p className="text-base font-medium">{t("auth.checkingSession")}</p>
            <p className="text-sm text-muted-foreground">
              {t("auth.syncingProfile")}
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className="flex h-svh min-h-0 overflow-hidden bg-background"
      style={
        {
          "--header-height": "calc(var(--spacing) * 12)",
        } as CSSProperties
      }
    >
      <NotificationProvider>
        <AgentRealtimeProvider />
        <WorkbenchRail />
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <WorkbenchHeader />
          <main className="flex min-h-0 flex-1 overflow-hidden">{children}</main>
        </div>
      </NotificationProvider>
    </div>
  )
}
