"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { SupportPageContent, SupportPageShell } from "@/app/(support)/support/_components/support-page-shell"
import { useSupportAuth } from "@/app/(support)/support/_components/support-auth-provider"
import { SupportFormField as LabeledField } from "@/app/(support)/support/_components/support-ui"
import { getSupportLoginDestination } from "@/app/(support)/support/_components/support-question-route"
import { useI18n } from "@/i18n/provider"
import { loginSupportCustomer, registerSupportCustomer } from "@/lib/api/support"

export function SupportLoginPage() {
  const t = useI18n()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { ready, session } = useSupportAuth()
  const [mode, setMode] = useState<"login" | "register">("login")
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (ready && session) router.replace(getSupportLoginDestination(searchParams.get("next")))
  }, [ready, router, searchParams, session])

  const submit = async () => {
    if (submitting) return
    setSubmitting(true)
    try {
      await (mode === "login"
        ? loginSupportCustomer({ email, password })
        : registerSupportCustomer({ name, email, password }))
      toast.success(t("supportPublic.toast.loggedIn"))
      router.replace(getSupportLoginDestination(searchParams.get("next")))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <SupportPageShell section="login">
      <SupportPageContent className="py-10 sm:py-12">
        <div className="mx-auto max-w-md rounded-md border bg-card p-5 shadow-sm sm:p-6">
          <div className="grid gap-4">
            {mode === "register" && (
              <LabeledField label={t("supportPublic.login.name")}>
                <Input value={name} onChange={(event) => setName(event.target.value)} placeholder={t("supportPublic.login.namePlaceholder")} className="bg-card" />
              </LabeledField>
            )}
            <LabeledField label={t("supportPublic.login.email")}>
              <Input value={email} onChange={(event) => setEmail(event.target.value)} placeholder={t("supportPublic.login.emailPlaceholder")} className="bg-card" />
            </LabeledField>
            <LabeledField label={t("supportPublic.login.password")}>
              <Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder={t("supportPublic.login.passwordPlaceholder")} className="bg-card" />
            </LabeledField>
            <Button disabled={submitting} onClick={() => void submit()}>
              {submitting ? t("supportPublic.actions.processing") : mode === "login" ? t("supportPublic.login.loginAction") : t("supportPublic.login.registerAction")}
            </Button>
            <Button variant="ghost" onClick={() => setMode(mode === "login" ? "register" : "login")}>
              {mode === "login" ? t("supportPublic.login.switchToRegister") : t("supportPublic.login.switchToLogin")}
            </Button>
          </div>
        </div>
      </SupportPageContent>
    </SupportPageShell>
  )
}
