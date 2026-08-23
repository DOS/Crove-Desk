"use client"

import { type ReactNode } from "react"
import { ArrowRightIcon, EyeIcon, MessageCircleMoreIcon, ThumbsUpIcon } from "lucide-react"

import { supportQuestionHref } from "@/app/(support)/support/_components/support-question-route"
import { useI18n } from "@/i18n/provider"
import { type SupportQuestion } from "@/lib/api/support"
import { cn, formatDateTime } from "@/lib/utils"

export function QuestionCard({ item }: { item: SupportQuestion }) {
  const t = useI18n()
  const actionLabel = item.answerCount > 0 || item.status === "resolved" ? t("supportPublic.actions.viewDiscussion") : t("supportPublic.actions.answerQuestion")
  return (
    <article className="group rounded-md border border-border bg-card px-3.5 py-3 transition hover:border-neutral-300 hover:bg-muted/30">
      <a href={supportQuestionHref(item.id)} className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
          <div className="min-w-0">
            <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
              <QuestionStatusPill status={item.status} />
              {item.bestAnswerId > 0 ? <span className="inline-flex h-5 items-center rounded bg-neutral-100 px-1.5 text-[11px] font-medium text-primary">{t("supportPublic.answer.best")}</span> : null}
              <span className="truncate text-xs text-muted-foreground">{item.categoryName || t("supportPublic.common.uncategorized")}</span>
            </div>
            <h2 className="mt-1.5 line-clamp-1 text-[15px] font-semibold leading-6">{item.title}</h2>
            <p className="mt-1 line-clamp-1 text-sm leading-5 text-muted-foreground">{questionExcerpt(item.content)}</p>
          </div>
          <div className="flex items-center gap-2 md:justify-end">
            <QuestionMetric icon={<MessageCircleMoreIcon className="size-3.5" />} value={item.answerCount} label={t("supportPublic.questions.answers")} />
            <QuestionMetric icon={<ThumbsUpIcon className="size-3.5" />} value={item.voteCount} label={t("supportPublic.questions.votes")} />
            <QuestionMetric className="hidden sm:inline-flex" icon={<EyeIcon className="size-3.5" />} value={item.viewCount} label={t("supportPublic.questions.views")} />
          </div>
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-border/70 pt-2">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            <span className="truncate">{t("supportPublic.questions.askedBy", { name: item.userName || t("supportPublic.common.user") })}</span>
            <span className="hidden text-neutral-300 sm:inline">/</span>
            <span>{t("supportPublic.questions.updatedAt", { date: formatDateTime(item.updatedAt || item.createdAt) })}</span>
          </div>
          <span className="inline-flex h-7 items-center gap-1 rounded-md px-1.5 text-xs font-medium text-primary group-hover:bg-primary/10">
            {actionLabel}
            <ArrowRightIcon className="size-3.5" />
          </span>
        </div>
      </a>
    </article>
  )
}

export function QuestionMetric({ icon, value, label, className }: { icon: ReactNode; value: number; label: string; className?: string }) {
  return (
    <span className={cn("inline-flex h-7 items-center gap-1 rounded-md bg-muted px-2.5 text-xs text-muted-foreground", className)} title={label} aria-label={`${label}: ${value}`}>
      {icon}
      {value}
    </span>
  )
}

export function QuestionStatusPill({ status }: { status: string }) {
  const t = useI18n()
  if (status === "resolved") return <span className="inline-flex h-5 items-center rounded bg-emerald-50 px-1.5 text-[11px] font-medium text-emerald-700">{t("supportPublic.status.resolved")}</span>
  if (status === "closed") return <span className="inline-flex h-5 items-center rounded bg-neutral-100 px-1.5 text-[11px] font-medium text-muted-foreground">{t("supportPublic.status.closed")}</span>
  return <span className="inline-flex h-5 items-center rounded bg-amber-50 px-1.5 text-[11px] font-medium text-amber-700">{t("supportPublic.status.normal")}</span>
}

export function QuestionListLoading() {
  return (
    <div className="grid gap-2" aria-hidden="true">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="rounded-md border border-border bg-card px-3.5 py-3">
          <div className="h-4 w-28 animate-pulse rounded bg-muted" />
          <div className="mt-3 h-5 w-4/5 animate-pulse rounded bg-muted" />
          <div className="mt-2 h-4 w-2/3 animate-pulse rounded bg-muted" />
        </div>
      ))}
    </div>
  )
}

function questionExcerpt(content: string) {
  return content.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()
}
