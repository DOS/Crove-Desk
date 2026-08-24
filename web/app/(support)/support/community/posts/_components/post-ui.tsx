"use client"

import { type ReactNode } from "react"
import Link from "next/link"
import { EyeIcon, MessageCircleMoreIcon, ThumbsUpIcon } from "lucide-react"

import { useI18n } from "@/i18n/provider"
import { postHref, type Post } from "@/lib/api/support-community"
import { cn, formatDateTime } from "@/lib/utils"

export function PostCard({ item, compact = false }: { item: Post; compact?: boolean }) {
  const t = useI18n()
  return (
    <article className="border-b border-border/70 last:border-b-0">
      <div
        className={cn(
          "px-1",
          compact ? "py-2" : "py-3"
        )}
      >
        <div className="flex min-w-0 items-center gap-2">
          <PostStatusPill status={item.status} />
          <h2 className="min-w-0 flex-1 truncate text-[15px] font-semibold leading-6">
            <Link
              href={postHref(item.id)}
              className="truncate transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {item.title}
            </Link>
          </h2>
          {item.acceptedCommentId > 0 ? <span className="hidden h-5 shrink-0 items-center rounded bg-primary/10 px-1.5 text-[11px] font-medium text-primary sm:inline-flex">{t("supportPublic.comment.accepted")}</span> : null}
        </div>

        {compact ? null : <p className="mt-1 line-clamp-1 text-sm leading-5 text-muted-foreground">{postExcerpt(item.content)}</p>}

        <div className={cn("flex min-w-0 flex-wrap items-center gap-y-1 text-xs text-muted-foreground", compact ? "mt-1 gap-x-1.5" : "mt-2 gap-x-2")}>
          <span className="max-w-[10rem] truncate sm:max-w-[14rem]">{item.categoryName || t("supportPublic.common.uncategorized")}</span>
          <MetaSeparator />
          <span className="max-w-[10rem] truncate">{t("supportPublic.posts.createdBy", { name: item.userName || t("supportPublic.common.user") })}</span>
          <MetaSeparator />
          <span>{t("supportPublic.posts.updatedAt", { date: formatDateTime(item.updatedAt || item.createdAt) })}</span>
          <span className="hidden flex-1 sm:block" />
          <div className="flex items-center gap-1.5">
            <PostMetric compact={compact} icon={<MessageCircleMoreIcon className="size-3.5" />} value={item.commentCount} label={t("supportPublic.posts.comments")} />
            <PostMetric compact={compact} icon={<ThumbsUpIcon className="size-3.5" />} value={item.reactionCount} label={t("supportPublic.posts.likes")} />
            <PostMetric compact={compact} className="hidden sm:inline-flex" icon={<EyeIcon className="size-3.5" />} value={item.viewCount} label={t("supportPublic.posts.views")} />
          </div>
        </div>
      </div>
    </article>
  )
}

export function PostMetric({ icon, value, label, className, compact = false }: { icon: ReactNode; value: number; label: string; className?: string; compact?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md bg-muted text-muted-foreground",
        compact ? "h-6 px-2 text-xs" : "h-7 px-2.5 text-xs",
        className
      )}
      title={label}
      aria-label={`${label}: ${value}`}
    >
      {icon}
      {value}
    </span>
  )
}

function MetaSeparator() {
  return <span className="text-muted-foreground/35">/</span>
}

export function PostStatusPill({ status }: { status: string }) {
  const t = useI18n()
  if (status === "resolved") return <span className="inline-flex h-5 items-center rounded bg-emerald-50 px-1.5 text-[11px] font-medium text-emerald-700">{t("supportPublic.status.resolved")}</span>
  if (status === "closed") return <span className="inline-flex h-5 items-center rounded bg-muted px-1.5 text-[11px] font-medium text-muted-foreground">{t("supportPublic.status.closed")}</span>
  return <span className="inline-flex h-5 items-center rounded bg-amber-50 px-1.5 text-[11px] font-medium text-amber-700">{t("supportPublic.status.normal")}</span>
}

export function PostListLoading({ compact = false }: { compact?: boolean }) {
  return (
    <div className="divide-y divide-border/70" aria-hidden="true">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className={cn("px-1", compact ? "py-2" : "py-3")}>
          <div className="h-4 w-28 animate-pulse rounded bg-muted" />
          <div className={cn("h-5 w-4/5 animate-pulse rounded bg-muted", compact ? "mt-2" : "mt-3")} />
          <div className={cn("h-4 w-2/3 animate-pulse rounded bg-muted", compact ? "mt-1.5" : "mt-2")} />
        </div>
      ))}
    </div>
  )
}

function postExcerpt(content: string) {
  return content.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()
}
