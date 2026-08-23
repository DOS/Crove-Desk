"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { ChevronDownIcon, EyeIcon, LoaderCircleIcon, MessageCircleMoreIcon, ThumbsUpIcon } from "lucide-react"
import { toast } from "sonner"

import { ContentEditor } from "@/components/content-editor"
import { Button } from "@/components/ui/button"
import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb"
import { PublicArticleToc, hasArticleTocHeadings } from "@/app/(support)/support/_components/support-article-toc"
import { SupportQuestionFrame } from "@/app/(support)/support/_components/question-frame"
import { SupportQuestionArticleContent } from "@/app/(support)/support/_components/question-article-content"
import { ensureSupportLogin, useSupportQuestionCategoryRoute } from "@/app/(support)/support/_components/support-question-route"
import { SupportEmptyState as EmptyState, SupportQuestionStatusBadge as QuestionStatusBadge } from "@/app/(support)/support/_components/support-ui"
import { AnswerCard } from "@/app/(support)/support/question/detail/_components/answer-item"
import { QuestionMetric } from "@/app/(support)/support/questions/_components/question-ui"
import { useI18n } from "@/i18n/provider"
import { createSupportAnswer, fetchSupportAnswers, fetchSupportQuestion, voteSupportQuestion, type SupportAnswer, type SupportQuestion } from "@/lib/api/support"
import { readSession } from "@/lib/auth"
import { formatDateTime, cn } from "@/lib/utils"
import type { ContentValue } from "@/components/content-editor"

type SupportAnswerSort = "default" | "latest" | "hot"

export function SupportQuestionDetail() {
  const t = useI18n()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const categoryRoute = useSupportQuestionCategoryRoute()
  const questionId = useMemo(() => {
    const queryId = Number(searchParams.get("id"))
    if (queryId > 0) {
      return queryId
    }
    const pathId = Number(pathname.split("/").filter(Boolean).at(-1))
    return pathId > 0 ? pathId : 0
  }, [pathname, searchParams])
  const [question, setQuestion] = useState<SupportQuestion | null>(null)
  const [answers, setAnswers] = useState<SupportAnswer[]>([])
  const [content, setContent] = useState<ContentValue>({ mode: "html", raw: "" })
  const [answerSort, setAnswerSort] = useState<SupportAnswerSort>("default")
  const [answerPage, setAnswerPage] = useState({ page: 1, limit: 20, total: 0 })
  const [answersLoading, setAnswersLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const questionArticleId = question ? `support-question-${question.id}` : ""
  const questionToc = question && hasArticleTocHeadings(question.content, question.contentType)
    ? <PublicArticleToc articleId={questionArticleId} content={question.content} contentType={question.contentType} />
    : null
  const currentUserId = readSession()?.user.id ?? 0

  const loadAnswers = useCallback((page = 1, append = false) => {
    if (questionId > 0) {
      setAnswersLoading(true)
      void fetchSupportAnswers({ questionId, sort: answerSort, page, limit: answerPage.limit })
        .then((result) => {
          setAnswers((current) => append ? [...current, ...result.results] : result.results)
          setAnswerPage(result.page)
        })
        .finally(() => setAnswersLoading(false))
    }
  }, [answerPage.limit, answerSort, questionId])

  const reload = useCallback(() => {
    if (questionId <= 0) return
    void Promise.all([
      fetchSupportQuestion(questionId),
      fetchSupportAnswers({ questionId, sort: answerSort, page: 1, limit: answerPage.limit }),
    ]).then(([detail, answerResult]) => {
      setQuestion(detail.question)
      setAnswers(answerResult.results)
      setAnswerPage(answerResult.page)
    })
  }, [answerPage.limit, answerSort, questionId])

  useEffect(() => {
    if (questionId <= 0) return
    void fetchSupportQuestion(questionId).then((detail) => {
      setQuestion(detail.question)
    })
  }, [questionId])

  useEffect(() => {
    loadAnswers(1)
  }, [loadAnswers])

  const submitAnswer = async () => {
    if (!question || submitting) return
    setSubmitting(true)
    try {
      await ensureSupportLogin()
      await createSupportAnswer({ questionId: question.id, contentType: content.mode, content: content.raw })
      setContent({ mode: "html", raw: "" })
      toast.success(t("supportPublic.toast.answerCreated"))
      reload()
    } finally {
      setSubmitting(false)
    }
  }
  const hasMoreAnswers = answers.length < answerPage.total

  return (
    <SupportQuestionFrame active={question?.categoryId ?? "all"} categoryRoute={categoryRoute} toc={questionToc}>
      <div className="px-4 py-7 sm:px-6 sm:py-10 lg:px-8 2xl:px-10">
        {question ? (
          <article className="w-full max-w-6xl">
            <Breadcrumb className="text-xs">
              <BreadcrumbList className="gap-y-1">
                <BreadcrumbItem>
                  <Link href="/support/questions" className="transition-colors hover:text-foreground">{t("supportPublic.questions.title")}</Link>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage>{question.categoryName || t("supportPublic.common.uncategorized")}</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>

            <header className="mt-6">
              <h1 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">{question.title}</h1>
            </header>

            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <QuestionStatusBadge status={question.status} />
              <span>{question.categoryName || t("supportPublic.common.uncategorized")}</span>
              <span className="text-muted-foreground/40">/</span>
              <span>{t("supportPublic.questions.askedBy", { name: question.userName || t("supportPublic.common.user") })}</span>
              <span className="text-muted-foreground/40">/</span>
              <span>{t("supportPublic.questions.updatedAt", { date: formatDateTime(question.updatedAt || question.createdAt) })}</span>
            </div>

            <div className="mt-8">
              <SupportQuestionArticleContent id={questionArticleId} content={question.content} contentType={question.contentType} />
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-2">
              <Button variant="secondary" size="sm" className="rounded-md" onClick={() => void ensureSupportLogin().then(() => voteSupportQuestion(question.id)).then(reload)}>
                <ThumbsUpIcon /> {question.voteCount}
              </Button>
              <QuestionMetric icon={<MessageCircleMoreIcon className="size-3.5" />} value={question.answerCount} label={t("supportPublic.questions.answers")} />
              <QuestionMetric icon={<EyeIcon className="size-3.5" />} value={question.viewCount} label={t("supportPublic.questions.views")} />
            </div>

            <section className="mt-8 border-t border-border/70 pt-6" aria-label={t("supportPublic.questions.answers")}>
              <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold tracking-tight">{t("supportPublic.questions.answers")}</h2>
                  <div className="mt-1 text-sm text-muted-foreground">{t("supportPublic.answer.count", { count: answerPage.total || question.answerCount })}</div>
                </div>
                <div className="inline-flex w-fit gap-1 rounded-md bg-muted p-0.5">
                  {(["default", "latest", "hot"] as const).map((sort) => (
                    <button
                      key={sort}
                      type="button"
                      className={cn(
                        "h-7 rounded-md px-2.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        answerSort === sort ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
                      )}
                      aria-pressed={answerSort === sort}
                      onClick={() => setAnswerSort(sort)}
                    >
                      {t(`supportPublic.answer.sort.${sort}`)}
                    </button>
                  ))}
                </div>
              </div>
              {answers.length ? (
                <div className="divide-y divide-border/70">
                  {answers.map((answer) => (
                    <AnswerCard key={answer.id} answer={answer} question={question} currentUserId={currentUserId} onChanged={reload} />
                  ))}
                </div>
              ) : answersLoading ? (
                <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
                  <LoaderCircleIcon className="size-4 animate-spin" />
                  {t("supportPublic.loading.answers")}
                </div>
              ) : <EmptyState text={t("supportPublic.empty.noAnswers")} />}
              {hasMoreAnswers ? (
                <div className="mt-4 flex justify-center">
                  <Button variant="secondary" size="sm" className="rounded-md" disabled={answersLoading} onClick={() => loadAnswers(answerPage.page + 1, true)}>
                    {answersLoading ? <LoaderCircleIcon className="animate-spin" /> : <ChevronDownIcon />}
                    {answersLoading ? t("supportPublic.loading.answers") : t("supportPublic.actions.loadMore")}
                  </Button>
                </div>
              ) : null}
            </section>

            <section className="mt-6 border-t border-border/70 pt-5" aria-labelledby="support-answer-editor-title">
              <h2 id="support-answer-editor-title" className="text-base font-semibold">{t("supportPublic.answer.title")}</h2>
              <div className="mt-3 min-w-0">
                <ContentEditor
                  value={content}
                  onChange={setContent}
                  placeholder={t("supportPublic.answer.placeholder")}
                  disabled={submitting}
                  allowedModes={["html", "markdown"]}
                  height={260}
                  className="min-w-0"
                />
              </div>
              <div className="mt-3 flex justify-end">
                <Button disabled={submitting || !content.raw.trim()} onClick={() => void submitAnswer()}>
                  {submitting ? t("supportPublic.actions.publishing") : t("supportPublic.actions.publishAnswer")}
                </Button>
              </div>
            </section>
          </article>
        ) : (
          <div className="grid min-h-[60svh] place-items-center">
            <EmptyState text={t("supportPublic.loading.question")} />
          </div>
        )}
      </div>
    </SupportQuestionFrame>
  )
}
