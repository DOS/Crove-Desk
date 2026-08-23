"use client"

import { useEffect, useState, type ReactNode } from "react"
import Link from "next/link"
import { ArrowRightIcon, BookOpenIcon, CircleHelpIcon, HeadphonesIcon, MessageCircleMoreIcon, ThumbsUpIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { SupportPageContent, SupportPageShell } from "@/app/(support)/support/_components/support-page-shell"
import { SupportEmptyState as EmptyState, PostStatusBadge as PostStatusBadge, SupportSearchInput } from "@/app/(support)/support/_components/support-ui"
import { flattenSupportHelpNavigation, supportHelpPageHref } from "@/app/(support)/support/_components/support-help-navigation"
import { useI18n } from "@/i18n/provider"
import { fetchSupportHelpNavigation, fetchSupportHelpPages, type SupportHelpPage } from "@/lib/api/support"
import { fetchPosts, newPostHref, postHref, postsHref, type Post } from "@/lib/api/support-community"
import { cn } from "@/lib/utils"

export function SupportHelpCenter() {
  const t = useI18n()
  const [pages, setPages] = useState<SupportHelpPage[]>([])
  const [posts, setPosts] = useState<Post[]>([])
  const [helpPagePaths, setHelpPagePaths] = useState<Map<number, string>>(new Map())
  const [query, setQuery] = useState("")

  useEffect(() => {
    void Promise.all([
      fetchSupportHelpPages({ limit: 6 }),
      fetchPosts({ limit: 6 }),
      fetchSupportHelpNavigation(),
    ])
      .then(([helpPage, postPage, navigation]) => {
        setPages(helpPage.results)
        setPosts(postPage.results)
        setHelpPagePaths(new Map(flattenSupportHelpNavigation(navigation).map((item) => [item.id, item.helpPath || ""])))
      })
      .catch(() => {
        setPages([])
        setPosts([])
        setHelpPagePaths(new Map())
      })
  }, [])

  return (
    <SupportPageShell>
      <section className="relative border-y border-sky-100 bg-[radial-gradient(circle_at_50%_-30%,#ddecff,transparent_55%)] px-5 py-12 sm:px-8 sm:py-18 dark:border-border dark:bg-[radial-gradient(circle_at_50%_-30%,rgba(36,117,252,.26),transparent_55%)]">
        <div className="relative mx-auto max-w-3xl text-center">
          <Badge variant="secondary" className="mb-5 bg-white/70 px-3 py-1 text-primary shadow-sm dark:bg-card/80">
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
              className={cn(buttonVariants({ size: "lg" }), "h-13 rounded-md px-6 shadow-sm")}
              href={`${postsHref()}${query ? `?title=${encodeURIComponent(query)}` : ""}`}
            >
              {t("supportPublic.actions.search")}
            </Link>
          </div>
        </div>
      </section>

      <SupportPageContent className="py-10 sm:py-14">
        <section className="grid gap-3 sm:grid-cols-3" aria-label={t("supportPublic.home.quickPanelTitle")}>
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

        <section className="mt-14 grid gap-8 lg:grid-cols-[0.72fr_1.28fr] lg:items-start">
          <div className="rounded-3xl bg-slate-900 p-7 text-slate-50 dark:bg-primary">
            <MessageCircleMoreIcon className="size-6 text-sky-300" />
            <p className="mt-8 text-sm font-medium text-sky-200">{t("supportPublic.home.quickPanelTitle")}</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">{t("supportPublic.home.createPost")}</h2>
            <p className="mt-3 text-sm leading-6 text-slate-300">{t("supportPublic.home.quickPanelDescription")}</p>
            <div className="mt-6 grid gap-2">
              <QuickLink href={`${postsHref()}?status=normal`} label={t("supportPublic.home.openPosts")} />
              <QuickLink href="/support/help" label={t("supportPublic.home.browseDocs")} />
              <QuickLink href={newPostHref()} label={t("supportPublic.home.createPost")} />
            </div>
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <PublicSection title={t("supportPublic.home.recommendedPages")} href="/support/help">
              {pages.length ? pages.map((item) => <HelpPageRow key={item.id} item={{ ...item, helpPath: helpPagePaths.get(item.id) }} />) : <EmptyState text={t("supportPublic.empty.noPages")} />}
            </PublicSection>
            <PublicSection title={t("supportPublic.home.hotPosts")} href={postsHref()}>
              {posts.length ? posts.map((item) => <PostRow key={item.id} item={item} />) : <EmptyState text={t("supportPublic.empty.noPosts")} />}
            </PublicSection>
          </div>
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
      className="group rounded-md border border-border bg-card p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-3 focus-visible:ring-ring/50"
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

function QuickLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="flex items-center justify-between rounded-md border border-white/10 px-3 py-2.5 text-sm text-slate-200 transition hover:border-sky-300/40 hover:bg-white/10 hover:text-white">
      <span>{label}</span>
      <ArrowRightIcon className="size-4" />
    </Link>
  )
}

function PublicSection({ title, href, children }: { title: string; href: string; children: ReactNode }) {
  const t = useI18n()
  return (
    <section className="rounded-md border border-border bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-semibold">{title}</h2>
        <Link className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "text-muted-foreground hover:text-primary")} href={href}>
          {t("supportPublic.actions.viewAll")} <ArrowRightIcon />
        </Link>
      </div>
      <div className="grid gap-0">{children}</div>
    </section>
  )
}

function HelpPageRow({ item }: { item: SupportHelpPage }) {
  const t = useI18n()
  return (
    <a href={supportHelpPageHref(item)} className="block border-t px-1 py-3 first:border-t-0 hover:bg-muted/60">
      <div className="line-clamp-1 font-medium text-primary">{item.title}</div>
      <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">{item.summary || t("supportPublic.help.openPage")}</p>
    </a>
  )
}

function PostRow({ item }: { item: Post }) {
  return (
    <a href={postHref(item.id)} className="block border-t px-1 py-3 first:border-t-0 hover:bg-muted/60">
      <div className="flex items-start justify-between gap-3">
        <div className="line-clamp-1 font-medium">{item.title}</div>
        <PostStatusBadge status={item.status} />
      </div>
      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{item.content}</p>
      <div className="mt-2 flex gap-3 text-xs text-muted-foreground">
        <span><MessageCircleMoreIcon className="mr-1 inline size-3" />{item.commentCount}</span>
        <span><ThumbsUpIcon className="mr-1 inline size-3" />{item.reactionCount}</span>
      </div>
    </a>
  )
}
