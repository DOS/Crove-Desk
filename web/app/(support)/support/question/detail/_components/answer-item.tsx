"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { CheckCircle2Icon, ChevronDownIcon, CopyIcon, CornerDownRightIcon, FlagIcon, PencilIcon, ThumbsUpIcon, Trash2Icon } from "lucide-react"

import { ContentEditor } from "@/components/content-editor"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { SupportQuestionArticleContent } from "@/app/(support)/support/_components/question-article-content"
import { ensureSupportLogin, supportQuestionHref } from "@/app/(support)/support/_components/support-question-route"
import { useI18n } from "@/i18n/provider"
import { acceptSupportAnswer, createSupportAnswer, deleteSupportAnswer, fetchSupportAnswers, reportSupportAnswer, updateSupportAnswer, voteSupportAnswer, type SupportAnswer, type SupportQuestion } from "@/lib/api/support"
import { cn, formatDateTime } from "@/lib/utils"
import type { ContentValue } from "@/components/content-editor"

export function AnswerCard({ answer, question, currentUserId, onChanged }: { answer: SupportAnswer; question: SupportQuestion; currentUserId: number; onChanged: () => void }) {
  const t = useI18n()
  const authorName = answer.authorName || t("supportPublic.common.user")
  const [replying, setReplying] = useState(false)
  const [editing, setEditing] = useState(false)
  const [replyContent, setReplyContent] = useState<ContentValue>({ mode: "html", raw: "" })
  const [editContent, setEditContent] = useState<ContentValue>({ mode: answer.contentType === "markdown" ? "markdown" : "html", raw: answer.content })
  const [submitting, setSubmitting] = useState(false)
  const [replies, setReplies] = useState(answer.replies || [])
  const [repliesExpanded, setRepliesExpanded] = useState((answer.replies || []).length >= answer.replyCount)
  const isDeleted = answer.status === "deleted"
  const isAuthor = !isDeleted && currentUserId > 0 && answer.authorId === currentUserId
  const canAccept = !isDeleted && currentUserId > 0 && currentUserId === question.userId && !answer.isBestAnswer && answer.parentId === 0
  const isQuestionAuthor = answer.authorId === question.userId
  const isReply = answer.parentId > 0

  useEffect(() => {
    setReplies(answer.replies || [])
    setRepliesExpanded((answer.replies || []).length >= answer.replyCount)
  }, [answer.id, answer.replyCount, answer.replies])

  const submitReply = async () => {
    if (submitting || !replyContent.raw.trim()) return
    setSubmitting(true)
    try {
      await ensureSupportLogin()
      await createSupportAnswer({ questionId: question.id, parentId: answer.id, contentType: replyContent.mode, content: replyContent.raw })
      setReplyContent({ mode: "html", raw: "" })
      setReplying(false)
      toast.success(t("supportPublic.toast.replyCreated"))
      onChanged()
    } finally {
      setSubmitting(false)
    }
  }

  const submitEdit = async () => {
    if (submitting || !editContent.raw.trim()) return
    setSubmitting(true)
    try {
      await updateSupportAnswer({ id: answer.id, contentType: editContent.mode, content: editContent.raw })
      setEditing(false)
      toast.success(t("supportPublic.toast.answerUpdated"))
      onChanged()
    } finally {
      setSubmitting(false)
    }
  }

  const deleteAnswer = async () => {
    if (!window.confirm(t("supportPublic.answer.deleteConfirm"))) return
    await deleteSupportAnswer(answer.id)
    toast.success(t("supportPublic.toast.answerDeleted"))
    onChanged()
  }

  const reportAnswer = async () => {
    await ensureSupportLogin()
    await reportSupportAnswer(answer.id)
    toast.success(t("supportPublic.toast.answerReported"))
  }

  const copyLink = async () => {
    const url = `${window.location.origin}${supportQuestionHref(question.id)}#answer-${answer.id}`
    await navigator.clipboard.writeText(url)
    toast.success(t("supportPublic.toast.linkCopied"))
  }

  const loadReplies = async () => {
    const result = await fetchSupportAnswers({ questionId: question.id, parentId: answer.id, page: 1, limit: 50 })
    setReplies(result.results)
    setRepliesExpanded(true)
  }

  const actionButtonClass = "h-7 rounded-md px-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"

  return (
    <article
      id={`answer-${answer.id}`}
      className={cn(
        "group/comment scroll-mt-24 py-4",
        isReply && "py-2.5",
        answer.isBestAnswer && !isDeleted && !isReply && "border-l-2 border-emerald-500 pl-3"
      )}
    >
      <div className={cn("flex", isReply ? "gap-2.5" : "gap-3")}>
        <div className={cn(
          "flex shrink-0 items-center justify-center rounded-full font-semibold",
          isReply ? "size-6 bg-muted text-xs text-muted-foreground" : "size-9 bg-primary text-sm text-primary-foreground"
        )}>
          {supportAuthorInitial(authorName)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
            <div className="min-w-0">
              <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                <span className={cn("truncate font-medium", isReply ? "text-sm text-foreground/90" : "text-sm text-foreground")}>{authorName}</span>
                {isQuestionAuthor ? <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[11px] font-medium text-primary">{t("supportPublic.answer.authorBadge")}</span> : null}
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground">{formatDateTime(answer.createdAt)}</div>
            </div>
            {!isDeleted && answer.isBestAnswer && !isReply ? <Badge className="rounded-md bg-emerald-600 text-white shadow-none"><CheckCircle2Icon /> {t("supportPublic.answer.best")}</Badge> : null}
          </div>
          <div className={cn("mt-3", isReply && "mt-2 text-sm")}>
            {isDeleted ? (
              <div className="rounded-md bg-muted/70 px-3 py-2 text-sm text-muted-foreground">{t("supportPublic.answer.deleted")}</div>
            ) : editing ? (
              <div className="rounded-md bg-muted/40 p-3">
                <ContentEditor value={editContent} onChange={setEditContent} disabled={submitting} allowedModes={["html", "markdown"]} height={220} className="min-w-0" />
                <div className="mt-3 flex justify-end gap-2">
                  <Button variant="ghost" size="sm" disabled={submitting} onClick={() => setEditing(false)}>{t("supportPublic.actions.cancel")}</Button>
                  <Button size="sm" disabled={submitting || !editContent.raw.trim()} onClick={() => void submitEdit()}>{t("supportPublic.actions.save")}</Button>
                </div>
              </div>
            ) : (
              <SupportQuestionArticleContent id={`support-answer-content-${answer.id}`} content={answer.content} contentType={answer.contentType} articleHeadingIds={false} />
            )}
          </div>
          {!isDeleted ? (
            <div className={cn("flex flex-wrap items-center gap-1", isReply ? "mt-3" : "mt-4")}>
              <Button variant="ghost" size="sm" className={actionButtonClass} onClick={() => void ensureSupportLogin().then(() => voteSupportAnswer(answer.id)).then(onChanged)}>
                <ThumbsUpIcon /> {answer.voteCount}
              </Button>
              {!isReply ? (
                <Button variant="ghost" size="sm" className={actionButtonClass} onClick={() => setReplying((current) => !current)}>
                  <CornerDownRightIcon /> {t("supportPublic.actions.reply")}
                </Button>
              ) : null}
              <Button variant="ghost" size="sm" className={actionButtonClass} onClick={() => void copyLink()}>
                <CopyIcon /> {t("supportPublic.actions.copyLink")}
              </Button>
              <Button variant="ghost" size="sm" className={actionButtonClass} onClick={() => void reportAnswer()}>
                <FlagIcon /> {t("supportPublic.actions.report")}
              </Button>
              {isAuthor ? (
                <>
                  <Button variant="ghost" size="sm" className={actionButtonClass} onClick={() => setEditing(true)}>
                    <PencilIcon /> {t("supportPublic.actions.edit")}
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 rounded-md px-2 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => void deleteAnswer()}>
                    <Trash2Icon /> {t("supportPublic.actions.delete")}
                  </Button>
                </>
              ) : null}
              {canAccept ? (
                <Button variant="secondary" size="sm" className="h-7 rounded-md px-2.5 text-xs text-primary" onClick={() => void ensureSupportLogin().then(() => acceptSupportAnswer(question.id, answer.id)).then(onChanged)}>
                  {t("supportPublic.actions.accept")}
                </Button>
              ) : null}
            </div>
          ) : null}
          {replying ? (
            <div className="mt-3 rounded-md bg-muted/40 p-3">
              <ContentEditor value={replyContent} onChange={setReplyContent} placeholder={t("supportPublic.answer.replyPlaceholder")} disabled={submitting} allowedModes={["html", "markdown"]} height={180} className="min-w-0" />
              <div className="mt-3 flex justify-end gap-2">
                <Button variant="ghost" size="sm" disabled={submitting} onClick={() => setReplying(false)}>{t("supportPublic.actions.cancel")}</Button>
                <Button size="sm" disabled={submitting || !replyContent.raw.trim()} onClick={() => void submitReply()}>{t("supportPublic.actions.publishReply")}</Button>
              </div>
            </div>
          ) : null}
          {replies.length ? (
            <div className="mt-3 divide-y divide-border/60 border-l border-border/70 pl-3 sm:pl-4">
              {replies.map((reply) => (
                <AnswerCard key={reply.id} answer={reply} question={question} currentUserId={currentUserId} onChanged={onChanged} />
              ))}
            </div>
          ) : null}
          {!repliesExpanded && answer.replyCount > replies.length ? (
            <Button variant="ghost" size="sm" className="mt-2 h-7 rounded-md px-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground" onClick={() => void loadReplies()}>
              <ChevronDownIcon /> {t("supportPublic.actions.viewReplies", { count: answer.replyCount })}
            </Button>
          ) : null}
        </div>
      </div>
    </article>
  )
}

function supportAuthorInitial(name: string) {
  return name.trim().slice(0, 1).toUpperCase() || "U"
}
