"use client"

import Image from "next/image"
import { useEffect, useState, type ReactNode } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { KeyRoundIcon, Loader2Icon, TriangleAlertIcon } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { SupportPageContent, SupportPageShell } from "@/app/(support)/support/_components/support-page-shell"
import { useSupportAuth } from "@/app/(support)/support/_components/support-auth-provider"
import { SupportFormField as LabeledField } from "@/app/(support)/support/_components/support-ui"
import { getSupportLoginDestination } from "@/app/(support)/support/_components/support-community-route"
import { useI18n } from "@/i18n/provider"
import { fetchPublicConfig, type PublicConfig } from "@/lib/api/config"
import { loginSupportCustomer, registerSupportCustomer } from "@/lib/api/support"
import { cn } from "@/lib/utils"

function detectWxWorkEnvironment() {
  if (typeof navigator === "undefined") return false
  return navigator.userAgent.toLowerCase().includes("wxwork")
}

export function SupportLoginPage() {
  const t = useI18n()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { ready, session } = useSupportAuth()
  const [mode, setMode] = useState<"login" | "register">("login")
  const [publicConfig, setPublicConfig] = useState<PublicConfig | null>(null)
  const [publicConfigError, setPublicConfigError] = useState("")
  const [isWxWorkEnv, setIsWxWorkEnv] = useState(false)
  const [name, setName] = useState("")
  const [account, setAccount] = useState("")
  const [registerEmail, setRegisterEmail] = useState("")
  const [password, setPassword] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const nextDestination = getSupportLoginDestination(searchParams.get("next"))
  const wxworkError = searchParams.get("wxworkError")
  const oidcError = searchParams.get("oidcError")
  const passwordLoginEnabled = publicConfig?.passwordLoginEnabled !== false
  const providerCount = Number(publicConfig?.wxworkEnabled) + Number(publicConfig?.oidcEnabled)
  const hasAnyLoginMethod = passwordLoginEnabled || providerCount > 0

  useEffect(() => {
    if (ready && session) router.replace(nextDestination)
  }, [nextDestination, ready, router, session])

  useEffect(() => {
    if (!passwordLoginEnabled && mode === "register") setMode("login")
  }, [mode, passwordLoginEnabled])

  useEffect(() => {
    if (wxworkError) toast.error(wxworkError)
  }, [wxworkError])

  useEffect(() => {
    if (oidcError) toast.error(oidcError)
  }, [oidcError])

  useEffect(() => {
    setIsWxWorkEnv(detectWxWorkEnvironment())
  }, [])

  useEffect(() => {
    let cancelled = false

    void fetchPublicConfig()
      .then((config) => {
        if (cancelled) return
        setPublicConfig(config)
        setPublicConfigError("")
      })
      .catch((error) => {
        if (cancelled) return
        setPublicConfig(null)
        setPublicConfigError(error instanceof Error ? error.message : t("api.requestFailed"))
      })

    return () => {
      cancelled = true
    }
  }, [t])

  const submit = async () => {
    if (submitting || !passwordLoginEnabled) return
    setSubmitting(true)
    try {
      await (mode === "login"
        ? loginSupportCustomer({ email: account, password })
        : registerSupportCustomer({ name, email: registerEmail, password }))
      toast.success(t("supportPublic.toast.loggedIn"))
      router.replace(nextDestination)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("auth.loginFailed"))
    } finally {
      setSubmitting(false)
    }
  }

  const startWxWorkLogin = () => {
    const path = isWxWorkEnv ? "/api/auth/wxwork_login" : "/api/auth/wxwork_qr_login"
    window.location.href = `${path}?next=${encodeURIComponent(nextDestination)}`
  }

  const startOIDCLogin = () => {
    window.location.href = `/api/auth/oidc_login?next=${encodeURIComponent(nextDestination)}`
  }

  return (
    <SupportPageShell section="login">
      <SupportPageContent className="flex min-h-[calc(100svh-3.5rem)] items-start justify-center py-8 sm:items-center sm:py-12">
        <section className="w-full max-w-[440px] rounded-md bg-card px-5 py-6 sm:px-7 sm:py-8">
          <div className="mb-6 flex flex-col items-center gap-3 text-center">
            <Image src="/images/logo.svg" alt="" width={56} height={56} className="size-14 opacity-80" priority />
            <h1 className="text-2xl font-semibold tracking-tight">{t("supportPublic.login.welcomeBack")}</h1>
          </div>
          {!publicConfig && !publicConfigError ? (
            <LoginState icon={<Loader2Icon className="size-5 animate-spin" />} title={t("auth.loadingOptions")} />
          ) : null}
          {publicConfigError ? (
            <LoginState icon={<TriangleAlertIcon className="size-5" />} title={t("auth.optionsLoadFailed")} description={publicConfigError} destructive />
          ) : null}
          {publicConfig && !hasAnyLoginMethod ? (
            <LoginState icon={<TriangleAlertIcon className="size-5" />} title={t("supportPublic.login.noMethodsTitle")} description={t("supportPublic.login.noMethodsDescription")} />
          ) : null}
          {publicConfig && hasAnyLoginMethod ? (
            <div className="grid gap-5">
              {passwordLoginEnabled ? (
                <form
                  className="grid gap-4"
                  onSubmit={(event) => {
                    event.preventDefault()
                    void submit()
                  }}
                >
                  {mode === "register" ? (
                    <LabeledField label={t("supportPublic.login.name")}>
                      <Input value={name} onChange={(event) => setName(event.target.value)} placeholder={t("supportPublic.login.namePlaceholder")} className="bg-card" />
                    </LabeledField>
                  ) : null}
                  <LabeledField label={mode === "login" ? t("supportPublic.login.account") : t("supportPublic.login.email")}>
                    <Input
                      value={mode === "login" ? account : registerEmail}
                      onChange={(event) => (mode === "login" ? setAccount(event.target.value) : setRegisterEmail(event.target.value))}
                      placeholder={mode === "login" ? t("supportPublic.login.accountPlaceholder") : t("supportPublic.login.emailPlaceholder")}
                      autoComplete={mode === "login" ? "username" : "email"}
                      className="bg-card"
                    />
                  </LabeledField>
                  <LabeledField label={t("supportPublic.login.password")}>
                    <Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder={t("supportPublic.login.passwordPlaceholder")} autoComplete={mode === "login" ? "current-password" : "new-password"} className="bg-card" />
                  </LabeledField>
                  <Button type="submit" disabled={submitting}>
                    {submitting ? t("supportPublic.actions.processing") : mode === "login" ? t("supportPublic.login.loginAction") : t("supportPublic.login.registerAction")}
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => setMode(mode === "login" ? "register" : "login")}>
                    {mode === "login" ? t("supportPublic.login.switchToRegister") : t("supportPublic.login.switchToLogin")}
                  </Button>
                </form>
              ) : null}
              {providerCount > 0 ? (
                <div className="grid gap-3">
                  {passwordLoginEnabled ? <div className="flex items-center gap-3 text-xs text-muted-foreground before:h-px before:flex-1 before:bg-border after:h-px after:flex-1 after:bg-border">{t("auth.continueWith")}</div> : null}
                  <div className="grid gap-3">
                    {publicConfig.wxworkEnabled ? (
                      <Button type="button" variant="outline" onClick={startWxWorkLogin} aria-label={t("auth.wxworkSignIn")}>
                        <Image src="/images/wxwork.svg" alt="" width={16} height={16} className="size-4 shrink-0" />
                        {t("auth.wxworkSignIn")}
                      </Button>
                    ) : null}
                    {publicConfig.oidcEnabled ? (
                      <Button type="button" variant="outline" onClick={startOIDCLogin} aria-label={t("auth.oidcSignIn")}>
                        <KeyRoundIcon className="size-4 shrink-0" />
                        {t("auth.oidcSignIn")}
                      </Button>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </section>
      </SupportPageContent>
    </SupportPageShell>
  )
}

function LoginState({ icon, title, description, destructive }: { icon: ReactNode; title: string; description?: string; destructive?: boolean }) {
  return (
    <div className={cn("flex min-h-64 flex-col items-center justify-center gap-3 text-center", destructive ? "text-destructive" : "text-muted-foreground")}>
      {icon}
      <div className="grid gap-1">
        <p className="text-sm font-medium text-foreground">{title}</p>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
    </div>
  )
}
