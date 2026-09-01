"use client"

import { type ReactNode } from "react"

import { SupportHeader } from "@/app/(support)/support/_components/support-header"
import { CommunityCategoryMenuContent, CommunityCategoryNav } from "@/app/(support)/support/_components/community-category-nav"
import { useCommunityCategoryRoute } from "@/app/(support)/support/_components/support-community-route"
import { useI18n } from "@/i18n/provider"
import { cn } from "@/lib/utils"

export function CommunityFrame({
  active,
  categoryRoute,
  children,
  toc,
}: {
  active?: number | "all"
  categoryRoute: ReturnType<typeof useCommunityCategoryRoute>
  children: ReactNode
  toc?: ReactNode
}) {
  const t = useI18n()
  const categoryNavigation = (
    <CommunityCategoryMenuContent
      categories={categoryRoute.categories}
      active={active ?? categoryRoute.activeCategoryId}
      loading={categoryRoute.categoriesLoading}
      failed={categoryRoute.categoriesFailed}
      onChange={categoryRoute.changeCategory}
      onRetry={categoryRoute.loadCategories}
    />
  )

  return (
    <main className="min-h-svh bg-background text-foreground">
      <SupportHeader
        section="community"
        mobileNavigation={{
          title: t("supportPublic.posts.categoryNavigation"),
          content: <div className="grid gap-0.5">{categoryNavigation}</div>,
        }}
      />
      <div
        className={cn(
          "mx-auto grid max-w-[var(--support-docs-max-width)] xl:grid-cols-[var(--support-doc-nav-width)_minmax(0,1fr)]",
          toc ? "2xl:grid-cols-[var(--support-doc-nav-wide-width)_minmax(0,1fr)_var(--support-doc-toc-width)]" : "2xl:grid-cols-[var(--support-doc-nav-wide-width)_minmax(0,1fr)]"
        )}
      >
        <CommunityCategoryNav
          categories={categoryRoute.categories}
          active={active ?? categoryRoute.activeCategoryId}
          loading={categoryRoute.categoriesLoading}
          failed={categoryRoute.categoriesFailed}
          onChange={categoryRoute.changeCategory}
          onRetry={categoryRoute.loadCategories}
        />
        <section className="min-w-0 bg-background">
          {children}
        </section>
        {toc ? <div className="hidden 2xl:block">{toc}</div> : null}
      </div>
    </main>
  )
}
