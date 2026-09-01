"use client"

import { DashboardPlaceholder } from "@/components/dashboard-placeholder"
import { useI18n } from "@/i18n/provider"

export default function DashboardDocsPage() {
  const t = useI18n()

  return (
    <DashboardPlaceholder
      eyebrow="Docs"
      title={t("docs.title")}
      description={t("docs.description")}
      nextSteps={[
        t("docs.step1"),
        t("docs.step2"),
        t("docs.step3"),
      ]}
    />
  )
}
