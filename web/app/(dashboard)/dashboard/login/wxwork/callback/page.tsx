"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { Suspense, useEffect, useRef } from "react"
import { toast } from "sonner"

import { exchangeWxWorkTicket } from "@/lib/api/auth"
import { useI18n } from "@/i18n/provider"

export default function WxWorkLoginCallbackPage() {
  return (
    <Suspense fallback={<WxWorkLoginCallbackFallback />}>
      <WxWorkLoginCallbackContent />
    </Suspense>
  )
}

function WxWorkLoginCallbackContent() {
  const t = useI18n()
  const router = useRouter()
  const searchParams = useSearchParams()
  const ranRef = useRef(false)

  useEffect(() => {
    if (ranRef.current) {
      return
    }
    ranRef.current = true

    const ticket = searchParams.get("ticket")?.trim() ?? ""
    const next = searchParams.get("next")
    const nextPath = next && next.startsWith("/") ? next : "/dashboard"

    if (!ticket) {
      toast.error(t("auth.wxworkMissingTicket"))
      router.replace("/dashboard/login")
      return
    }

    void exchangeWxWorkTicket(ticket)
      .then(() => {
        toast.success(t("auth.loginSuccess"))
        router.replace(nextPath)
      })
      .catch((error) => {
        toast.error(error instanceof Error ? error.message : t("auth.wxworkFailed"))
        router.replace("/dashboard/login")
      })
  }, [router, searchParams, t])

  return (
    <WxWorkLoginCallbackFallback />
  )
}

function WxWorkLoginCallbackFallback() {
  const t = useI18n()

  return (
    <div className="flex min-h-svh items-center justify-center bg-[linear-gradient(145deg,#fff7ed_0%,#ffffff_32%,#ecfeff_100%)] px-6">
      <div className="w-full max-w-md rounded-[28px] border border-white/70 bg-white/90 p-8 text-center shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur">
        <h1 className="text-2xl font-semibold tracking-tight">{t("auth.wxworkSigningIn")}</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          {t("auth.checkingTicket")}
        </p>
      </div>
    </div>
  )
}
