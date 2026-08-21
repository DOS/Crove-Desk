"use client"

import { FileQuestionIcon, LayoutGridIcon, MoreHorizontalIcon } from "lucide-react"
import { useEffect, useRef, useState } from "react"

import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useI18n } from "@/i18n/provider"
import type { SupportCategory } from "@/lib/api/support"
import { cn } from "@/lib/utils"

type SupportQuestionCategoryNavProps = {
  categories: SupportCategory[]
  active: number | "all"
  loading?: boolean
  failed?: boolean
  onChange: (value: number | "all") => void
  onRetry?: () => void
}

export function SupportQuestionCategoryNav({ categories, active, loading = false, failed = false, onChange, onRetry }: SupportQuestionCategoryNavProps) {
  const t = useI18n()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const mobileScrollRef = useRef<HTMLDivElement>(null)
  const activeNodeId = active === "all" ? "all" : String(active)

  useEffect(() => {
    const activeNode = mobileScrollRef.current?.querySelector<HTMLElement>(`[data-category-id="${activeNodeId}"]`)
    activeNode?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" })
  }, [activeNodeId, categories.length])

  const choose = (value: number | "all") => {
    onChange(value)
    setDrawerOpen(false)
  }

  const categoryItems = (mobile = false) => (
    <>
      <button type="button" data-category-id="all" onClick={() => choose("all")} className={categoryItemClassName(active === "all", mobile)} aria-pressed={active === "all"}>
        <LayoutGridIcon aria-hidden="true" className="size-4 shrink-0" />
        <span className="truncate">{t("supportPublic.common.allCategories")}</span>
      </button>
      {categories.map((category) => (
        <button key={category.id} type="button" data-category-id={category.id} onClick={() => choose(category.id)} className={categoryItemClassName(active === category.id, mobile)} aria-pressed={active === category.id}>
          <FileQuestionIcon aria-hidden="true" className="size-4 shrink-0" />
          <span className="truncate">{category.name}</span>
        </button>
      ))}
    </>
  )

  return (
    <aside className="min-w-0 self-start xl:sticky xl:top-14 xl:h-[calc(100svh-3.5rem)] xl:overflow-y-auto xl:border-r" aria-label={t("supportPublic.questions.categoryNavigation")}>
      <nav className="overflow-hidden border-b bg-background xl:border-b-0">
        <ScrollArea className="hidden max-h-[calc(100svh-3.5rem)] xl:block">
          <div className="grid gap-0.5 px-3 py-4">{categoryItems()}</div>
        </ScrollArea>
        <div className="grid h-12 grid-cols-[minmax(0,1fr)_auto] items-center gap-1 px-5 xl:hidden">
          <div ref={mobileScrollRef} className="overflow-x-auto overscroll-x-contain [scrollbar-width:thin]"><div className="flex w-max min-w-max gap-1">{categoryItems()}</div></div>
          <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
            <DrawerTrigger asChild><button type="button" className="inline-flex h-8 items-center gap-1 rounded-md bg-muted px-2 text-xs text-muted-foreground hover:bg-muted/80" aria-label={t("supportPublic.questions.moreCategories")}><MoreHorizontalIcon aria-hidden="true" className="size-4" /><span>{t("supportPublic.questions.more")}</span></button></DrawerTrigger>
            <DrawerContent className="pb-[max(1rem,env(safe-area-inset-bottom))]">
              <DrawerHeader><DrawerTitle>{t("supportPublic.questions.moreCategories")}</DrawerTitle></DrawerHeader>
              <div className="grid max-h-[min(56vh,27.5rem)] grid-cols-2 gap-2 overflow-y-auto px-4 pb-4">{categoryItems(true)}</div>
            </DrawerContent>
          </Drawer>
        </div>
      </nav>
      {loading ? <div className="px-3 py-2 text-xs text-muted-foreground">{t("supportPublic.loading.categories")}</div> : null}
      {failed ? <button type="button" className="mt-2 text-sm text-destructive underline-offset-4 hover:underline" onClick={onRetry}>{t("supportPublic.questions.categoriesFailed")}</button> : null}
    </aside>
  )
}

function categoryItemClassName(active: boolean, mobile: boolean) {
  return cn(
    "relative flex min-w-0 items-center gap-2 rounded-md text-left text-sm transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
    active ? "bg-primary/10 font-medium text-primary" : "text-muted-foreground",
    mobile ? "h-9 bg-muted px-2.5" : "min-h-9 px-2.5 py-1.5"
  )
}
