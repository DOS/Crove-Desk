"use client"

import { Loader2Icon } from "lucide-react"
import { usePathname, useRouter } from "next/navigation"
import type { CSSProperties, ReactNode } from "react"
import { useEffect } from "react"

import { AppSidebar } from "@/components/app-sidebar"
import { useAuth } from "@/components/auth-provider"
import { NotificationProvider } from "@/components/notification-provider"
import { SiteHeader } from "@/components/site-header"
import { useI18n } from "@/i18n/provider"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"

export default function DashboardLayout({
  children,
}: {
  children: ReactNode
}) {
  const t = useI18n()
  const { ready, session } = useAuth()
  const pathname = usePathname()
  const router = useRouter()
  const isLoginRoute = pathname?.startsWith("/dashboard/login") ?? false

  useEffect(() => {
    if (ready && !session && !isLoginRoute) {
      router.replace("/dashboard/login")
    }
  }, [isLoginRoute, ready, router, session])

  if (isLoginRoute) {
    return <>{children}</>
  }

  if (!ready || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-md bg-muted text-muted-foreground">
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
    <SidebarProvider
      className="h-svh min-h-0 overflow-hidden"
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 54)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as CSSProperties
      }
    >
      <NotificationProvider>
        <AppSidebar variant="inset" />
        <SidebarInset className="overflow-hidden border-l border-border/70 bg-background">
          <SiteHeader />
          <div className="@container/main flex min-h-0 flex-1 flex-col overflow-auto">
            {children}
          </div>
        </SidebarInset>
      </NotificationProvider>
    </SidebarProvider>
  )
}
