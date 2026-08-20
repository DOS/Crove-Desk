"use client"

import { DashboardPlaceholder } from "@/components/dashboard-placeholder"
import { useI18n } from "@/i18n/provider"

export default function DashboardHelpPage() {
  const t = useI18n()

  return (
    <DashboardPlaceholder
      eyebrow="Help"
      title={t("help.title")}
      description={t("help.description")}
      nextSteps={[
        t("help.step1"),
        t("help.step2"),
        t("help.step3"),
      ]}
    />
  )
}
