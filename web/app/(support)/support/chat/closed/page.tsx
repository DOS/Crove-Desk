"use client"

import { CheckCircle2Icon } from "lucide-react"

import { useI18n } from "@/i18n/provider"

export default function Page() {
  const t = useI18n()

  return (
    <main className="flex min-h-svh items-center justify-center bg-muted px-6 text-foreground">
      <section className="grid max-w-sm justify-items-center gap-4 text-center">
        <div className="flex size-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900">
          <CheckCircle2Icon className="size-7" />
        </div>
        <div className="grid gap-2">
          <h1 className="text-lg font-semibold text-foreground">{t("supportChat.closedTitle")}</h1>
          <p className="text-sm leading-6 text-muted-foreground">
            {t("supportChat.closedDescription")}
          </p>
        </div>
      </section>
    </main>
  )
}
