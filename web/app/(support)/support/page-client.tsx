"use client"

import { useState, type ReactNode } from "react"
import Link from "next/link"
import { ArrowRightIcon, BookOpenIcon, CircleHelpIcon, HeadphonesIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { SupportPageContent, SupportPageShell } from "@/app/(support)/support/_components/support-page-shell"
import { SupportSearchInput } from "@/app/(support)/support/_components/support-ui"
import { useI18n } from "@/i18n/provider"
import { postsHref } from "@/lib/api/support-community"
import { cn } from "@/lib/utils"

export function SupportHelpCenter() {
  const t = useI18n()
  const [query, setQuery] = useState("")

  return (
    <SupportPageShell>
      <section className="relative border-y border-sky-100 bg-[radial-gradient(circle_at_50%_-30%,#ddecff,transparent_55%)] px-5 py-12 sm:px-8 sm:py-18 dark:border-border dark:bg-[radial-gradient(circle_at_50%_-30%,rgba(36,117,252,.26),transparent_55%)]">
        <div className="relative mx-auto max-w-3xl text-center">
          <Badge variant="secondary" className="mb-5 bg-white/70 px-3 py-1 text-primary dark:bg-card/80">
            {t("supportPublic.home.badge")}
          </Badge>
          <h1 className="text-balance text-3xl font-semibold tracking-tight sm:text-5xl">
            {t("supportPublic.home.title")}
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-pretty text-sm leading-6 text-muted-foreground sm:text-base">
            {t("supportPublic.home.description")}
          </p>
          <div className="relative mx-auto mt-8 flex max-w-2xl flex-col gap-2 sm:flex-row">
            <SupportSearchInput
              value={query}
              onChange={setQuery}
              placeholder={t("supportPublic.home.searchPlaceholder")}
              hero
            />
            <Link
              className={cn(buttonVariants({ size: "lg" }), "h-13 rounded-md px-6")}
              href={`${postsHref()}${query ? `?title=${encodeURIComponent(query)}` : ""}`}
            >
              {t("supportPublic.actions.search")}
            </Link>
          </div>
        </div>
      </section>

      <SupportPageContent className="py-10 sm:py-14">
        <section className="grid gap-3 sm:grid-cols-3" aria-label={t("supportPublic.nav.siteNavigation")}>
          <SupportEntryCard
            href="/support/help"
            icon={<BookOpenIcon />}
            title={t("supportPublic.home.helpTitle")}
            description={t("supportPublic.home.helpDescription")}
            accent="sky"
          />
          <SupportEntryCard
            href={postsHref()}
            icon={<CircleHelpIcon />}
            title={t("supportPublic.home.postsTitle")}
            description={t("supportPublic.home.postsDescription")}
            accent="violet"
          />
          <SupportEntryCard
            href="/support/chat"
            icon={<HeadphonesIcon />}
            title={t("supportPublic.home.chatTitle")}
            description={t("supportPublic.home.chatDescription")}
            accent="emerald"
          />
        </section>
      </SupportPageContent>
    </SupportPageShell>
  )
}

function SupportEntryCard({
  href,
  icon,
  title,
  description,
  accent,
}: {
  href: string
  icon: ReactNode
  title: string
  description: string
  accent: "sky" | "violet" | "emerald"
}) {
  const accentClass = {
    sky: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
    violet: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
    emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  }[accent]

  return (
    <Link
      href={href}
      className="group rounded-md bg-card p-5 text-left transition-all hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <div className="flex items-start justify-between gap-4">
        <span className={cn("grid size-10 place-items-center rounded-md [&_svg]:size-5", accentClass)}>{icon}</span>
        <ArrowRightIcon className="mt-1 size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
      </div>
      <h3 className="mt-5 font-medium">{title}</h3>
      <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>
    </Link>
  )
}
