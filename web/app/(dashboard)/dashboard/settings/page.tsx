"use client"

import { DashboardPlaceholder } from "@/components/dashboard-placeholder"
import { useI18n } from "@/i18n/provider"

export default function DashboardSettingsPage() {
  const t = useI18n()

  return (
    <DashboardPlaceholder
      eyebrow="Settings"
      title={t("settings.title")}
      description={t("settings.description")}
      nextSteps={[
        t("settings.step1"),
        t("settings.step2"),
        t("settings.step3"),
      ]}
    />
  )
}
