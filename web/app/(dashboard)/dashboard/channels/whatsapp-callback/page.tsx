"use client"

import { Suspense, useEffect, useRef, useState, useSyncExternalStore } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  Loader2Icon,
  PhoneIcon,
} from "lucide-react"

import { Button, buttonVariants } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  connectWhatsAppOAuth,
  type WhatsAppOAuthConnectResult,
} from "@/lib/api/admin"
import { cn } from "@/lib/utils"
import { useI18n } from "@/i18n/provider"
import { WHATSAPP_OAUTH_MESSAGE } from "../_components/whatsapp-oauth"

type Exchange = {
  status: "exchanging" | "success" | "error"
  result: WhatsAppOAuthConnectResult | null
  failure: string
}

const IDLE_EXCHANGE: Exchange = { status: "exchanging", result: null, failure: "" }

function parseChannelId(state: string | null): number | undefined {
  if (!state) {
    return undefined
  }
  const separator = state.indexOf(":")
  if (separator < 0) {
    return undefined
  }
  const parsed = Number.parseInt(state.slice(separator + 1), 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined
}

function subscribeNoop() {
  return () => {}
}

function getIsPopup() {
  return window.opener !== null && window.opener !== window
}

function getIsPopupOnServer() {
  return false
}

function WhatsAppOAuthCallback() {
  const searchParams = useSearchParams()
  const t = useI18n()
  const [exchange, setExchange] = useState<Exchange>(IDLE_EXCHANGE)
  const started = useRef(false)
  // window.opener only exists in a browser, and this page is statically
  // exported, so the server snapshot has to differ from the client one.
  const openedAsPopup = useSyncExternalStore(
    subscribeNoop,
    getIsPopup,
    getIsPopupOnServer
  )

  // A rejection or a missing code is knowable from the URL alone, so it is
  // derived during render instead of being written into state from an effect.
  const oauthError = searchParams.get("error")
  const code = searchParams.get("code")
  const precheckFailure = oauthError
    ? oauthError === "access_denied"
      ? t("channel.whatsappCallbackDenied")
      : searchParams.get("error_description") || oauthError
    : code
      ? ""
      : t("channel.whatsappCallbackMissingCode")

  useEffect(() => {
    if (precheckFailure) {
      return
    }
    // StrictMode mounts effects twice and Meta accepts an authorization code
    // only once, so the exchange must run a single time per window.
    if (started.current) {
      return
    }
    started.current = true

    const oauthState = searchParams.get("state")
    // This page's own URL without the query is exactly the redirect_uri that
    // built the authorization link, and Meta requires the two to match.
    const redirectUri = window.location.origin + window.location.pathname

    void (async () => {
      try {
        const result = await connectWhatsAppOAuth({
          code: code as string,
          state: oauthState ?? undefined,
          channelId: parseChannelId(oauthState),
          redirectUri,
        })
        setExchange({ status: "success", result, failure: "" })
        window.opener?.postMessage(
          { type: WHATSAPP_OAUTH_MESSAGE, payload: result },
          window.location.origin
        )
      } catch (error) {
        setExchange({
          status: "error",
          result: null,
          failure: error instanceof Error ? error.message : String(error),
        })
      }
    })()
  }, [code, precheckFailure, searchParams])

  const status = precheckFailure ? "error" : exchange.status
  const failure = precheckFailure || exchange.failure
  const result = precheckFailure ? null : exchange.result

  const senderNumbers =
    result?.accounts.flatMap((account) =>
      account.phoneNumbers.map((number) => ({
        key: `${account.wabaId}:${number.phoneNumberId}`,
        wabaName: account.wabaName || account.wabaId,
        displayPhoneNumber: number.displayPhoneNumber,
        phoneNumberId: number.phoneNumberId,
      }))
    ) ?? []

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-4 sm:p-6">
      <Card className="w-full max-w-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {status === "success" ? (
              <CheckCircle2Icon className="size-4 text-primary" aria-hidden />
            ) : status === "error" ? (
              <AlertTriangleIcon className="size-4 text-destructive" aria-hidden />
            ) : (
              <Loader2Icon className="size-4 animate-spin" aria-hidden />
            )}
            {status === "success"
              ? t("channel.whatsappCallbackSuccessTitle")
              : status === "error"
                ? t("channel.whatsappCallbackFailedTitle")
                : t("channel.whatsappCallbackTitle")}
          </CardTitle>
          <CardDescription>
            {status === "success"
              ? result?.connected
                ? t("channel.whatsappCallbackSuccessSaved")
                : t("channel.whatsappCallbackSuccessForm")
              : status === "error"
                ? failure
                : t("channel.whatsappCallbackExchanging")}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {status === "success" && senderNumbers.length > 0 ? (
            <div className="space-y-2">
              <div className="text-sm font-medium">
                {t("channel.whatsappCallbackAccountsTitle")}
              </div>
              <ul className="divide-y rounded-md border">
                {senderNumbers.map((item) => (
                  <li
                    key={item.key}
                    className="flex flex-wrap items-baseline gap-x-2 gap-y-1 p-3 text-sm"
                  >
                    <PhoneIcon
                      className="size-3.5 shrink-0 self-center text-muted-foreground"
                      aria-hidden
                    />
                    <span className="font-medium">
                      {item.displayPhoneNumber || item.phoneNumberId}
                    </span>
                    <span className="text-muted-foreground">{item.wabaName}</span>
                    <span className="ml-auto font-mono text-xs text-muted-foreground">
                      {item.phoneNumberId}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {status === "success" && senderNumbers.length === 0 ? (
            <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
              {t("channel.whatsappCallbackNoAccounts")}
            </p>
          ) : null}

          {result?.warnings && result.warnings.length > 0 ? (
            <div className="space-y-2">
              <div className="text-sm font-medium">
                {t("channel.whatsappCallbackWarningsTitle")}
              </div>
              <ul className="space-y-1.5 rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
                {result.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-2 pt-1">
            {openedAsPopup ? (
              <Button
                type="button"
                variant="default"
                size="sm"
                onClick={() => window.close()}
              >
                {t("channel.whatsappCallbackClose")}
              </Button>
            ) : null}
            <Link
              href="/dashboard/channels"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              {t("channel.whatsappCallbackBack")}
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default function WhatsAppOAuthCallbackPage() {
  return (
    <Suspense fallback={null}>
      <WhatsAppOAuthCallback />
    </Suspense>
  )
}
