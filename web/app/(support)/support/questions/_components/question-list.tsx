"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { ChevronDownIcon, LoaderCircleIcon } from "lucide-react"
import { useSearchParams } from "next/navigation"

import { Button, buttonVariants } from "@/components/ui/button"
import { SupportEmptyState as EmptyState } from "@/app/(support)/support/_components/support-ui"
import { SupportQuestionFrame } from "@/app/(support)/support/_components/question-frame"
import { useSupportQuestionCategoryRoute } from "@/app/(support)/support/_components/support-question-route"
import { QuestionCard, QuestionListLoading } from "@/app/(support)/support/questions/_components/question-ui"
import { useI18n } from "@/i18n/provider"
import { fetchSupportQuestions, type SupportQuestion } from "@/lib/api/support"
import { cn } from "@/lib/utils"

export function SupportQuestionList() {
  const t = useI18n()
  const searchParams = useSearchParams()
  const categoryRoute = useSupportQuestionCategoryRoute()
  const requestSeq = useRef(0)
  const [questions, setQuestions] = useState<SupportQuestion[]>([])
  const [questionsLoading, setQuestionsLoading] = useState(true)
  const [questionsFailed, setQuestionsFailed] = useState(false)
  const [questionPage, setQuestionPage] = useState({ page: 1, limit: 20, total: 0 })
  const title = searchParams.get("title") || ""
  const [status, setStatus] = useState(searchParams.get("status") || "all")

  const loadQuestions = useCallback((page = 1, append = false) => {
    if (categoryRoute.categorySlug && !categoryRoute.activeCategory) {
      setQuestions([])
      setQuestionPage((current) => ({ ...current, page: 1, total: 0 }))
      setQuestionsLoading(categoryRoute.categoriesLoading)
      setQuestionsFailed(!categoryRoute.categoriesLoading)
      return
    }
    const seq = requestSeq.current + 1
    requestSeq.current = seq
    setQuestionsLoading(true)
    setQuestionsFailed(false)
    void fetchSupportQuestions({
      categoryId: categoryRoute.activeCategoryId === "all" ? undefined : categoryRoute.activeCategoryId,
      status: status === "all" ? undefined : status,
      title,
      page,
      limit: questionPage.limit,
    })
      .then((result) => {
        if (seq !== requestSeq.current) return
        setQuestions((current) => append ? [...current, ...result.results] : result.results)
        setQuestionPage(result.page)
      })
      .catch(() => {
        if (seq !== requestSeq.current) return
        if (!append) setQuestions([])
        setQuestionsFailed(true)
      })
      .finally(() => {
        if (seq === requestSeq.current) setQuestionsLoading(false)
      })
  }, [categoryRoute.activeCategory, categoryRoute.activeCategoryId, categoryRoute.categoriesLoading, categoryRoute.categorySlug, questionPage.limit, status, title])

  useEffect(() => {
    const timer = window.setTimeout(() => loadQuestions(1), 180)
    return () => window.clearTimeout(timer)
  }, [loadQuestions])

  const hasMoreQuestions = questions.length < questionPage.total
  const statusOptions = [
    { value: "all", label: t("supportPublic.status.all") },
    { value: "normal", label: t("supportPublic.status.normal") },
    { value: "resolved", label: t("supportPublic.status.resolved") },
  ]

  return (
    <SupportQuestionFrame categoryRoute={categoryRoute}>
      <div className="px-5 pt-4 sm:px-6 md:px-8 lg:px-10 2xl:px-12">
        <div className="flex flex-col gap-3 border-b pb-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex min-w-0 gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            {statusOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                className={cn(
                  "h-8 whitespace-nowrap rounded-md px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  status === option.value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
                aria-pressed={status === option.value}
                onClick={() => setStatus(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
          <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
            <Link className={cn(buttonVariants(), "h-9 px-3")} href="/support/questions/ask">{t("supportPublic.actions.askQuestion")}</Link>
          </div>
        </div>
      </div>
      <div className="px-5 py-3 sm:px-6 md:px-8 lg:px-10 2xl:px-12">
        {questions.length ? questions.map((item) => <QuestionCard key={item.id} item={item} />) : null}
        {questionsLoading && !questions.length ? <QuestionListLoading /> : null}
        {!questionsLoading && questionsFailed ? (
          <div className="rounded-md border border-destructive/25 bg-destructive/5 p-4 text-sm text-destructive">
            <div>{t("supportPublic.empty.questionsFailed")}</div>
            <Button variant="destructive" size="sm" className="mt-3" onClick={() => loadQuestions(1)}>
              {t("supportPublic.actions.retry")}
            </Button>
          </div>
        ) : null}
        {!questionsLoading && !questionsFailed && !questions.length ? <EmptyState text={t("supportPublic.empty.noQuestionsMatched")} /> : null}
        {hasMoreQuestions ? (
          <div className="flex justify-center py-2">
            <Button variant="ghost" size="sm" disabled={questionsLoading} onClick={() => loadQuestions(questionPage.page + 1, true)}>
              {questionsLoading ? <LoaderCircleIcon className="animate-spin" /> : <ChevronDownIcon />}
              {questionsLoading ? t("supportPublic.loading.questions") : t("supportPublic.actions.loadMore")}
            </Button>
          </div>
        ) : null}
      </div>
    </SupportQuestionFrame>
  )
}
