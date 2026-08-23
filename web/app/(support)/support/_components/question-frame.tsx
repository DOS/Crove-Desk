"use client"

import { type ReactNode } from "react"

import { SupportHeader } from "@/app/(support)/support/_components/support-header"
import { SupportQuestionCategoryNav } from "@/app/(support)/support/_components/support-question-category-nav"
import { useSupportQuestionCategoryRoute } from "@/app/(support)/support/_components/support-question-route"
import { cn } from "@/lib/utils"

export function SupportQuestionFrame({
  active,
  categoryRoute,
  children,
  toc,
}: {
  active?: number | "all"
  categoryRoute: ReturnType<typeof useSupportQuestionCategoryRoute>
  children: ReactNode
  toc?: ReactNode
}) {
  return (
    <main className="min-h-svh bg-background text-foreground">
      <SupportHeader section="questions" />
      <div
        className={cn(
          "mx-auto grid max-w-[var(--support-docs-max-width)] xl:grid-cols-[var(--support-doc-nav-width)_minmax(0,1fr)]",
          toc ? "2xl:grid-cols-[var(--support-doc-nav-wide-width)_minmax(0,1fr)_var(--support-doc-toc-width)]" : "2xl:grid-cols-[var(--support-doc-nav-wide-width)_minmax(0,1fr)]"
        )}
      >
        <SupportQuestionCategoryNav
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
