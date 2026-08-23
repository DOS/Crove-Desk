"use client"

import {
  ArrowRightIcon,
  BookOpenIcon,
  CheckCircle2Icon,
  ChevronDownIcon,
  ChevronRightIcon,
  CircleHelpIcon,
  CopyIcon,
  CornerDownRightIcon,
  FlagIcon,
  EyeIcon,
  PencilIcon,
  FileTextIcon,
  FolderIcon,
  FolderOpenIcon,
  HeadphonesIcon,
  Trash2Icon,
  LoaderCircleIcon,
  MenuIcon,
  MessageCircleMoreIcon,
  ThumbsDownIcon,
  ThumbsUpIcon,
  XIcon,
} from "lucide-react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { toast } from "sonner"

import { ContentEditor } from "@/components/content-editor"
import { useImageLightboxOptional } from "@/components/image-lightbox"
import { SupportArticleContent } from "@/components/support-center/support-article-content"
import { flattenSupportHelpNavigation, SupportHelpLink, supportHelpPageHref, type HelpPageNavigationHandler, useSupportHelpRoute } from "@/components/support-center/support-help-navigation"
import { useSupportHelpReader } from "@/components/support-center/use-support-help-reader"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { SupportPageContent, SupportPageShell } from "@/components/support-center/support-page-shell"
import { SupportHeader } from "@/components/support-center/support-header"
import { SupportQuestionCategoryNav } from "@/components/support-center/support-question-category-nav"
import { useSupportAuth } from "@/components/support-center/support-auth-provider"
import { SupportEmptyState as EmptyState, SupportFormField as LabeledField, SupportQuestionStatusBadge as QuestionStatusBadge, SupportSearchInput } from "@/components/support-center/support-ui"
import { Input } from "@/components/ui/input"
import { useI18n } from "@/i18n/provider"
import {
  acceptSupportAnswer,
  createSupportAnswer,
  createSupportQuestion,
  deleteSupportAnswer,
  fetchSupportAnswers,
  fetchSupportHelpNavigation,
  fetchSupportHelpPages,
  fetchSupportMe,
  fetchSupportQuestion,
  fetchSupportQuestionCategories,
  fetchSupportQuestions,
  loginSupportCustomer,
  reportSupportAnswer,
  registerSupportCustomer,
  submitSupportHelpPageFeedback,
  updateSupportAnswer,
  voteSupportAnswer,
  voteSupportQuestion,
  type SupportAnswer,
  type SupportCategory,
  type SupportHelpPage,
  type SupportQuestion,
} from "@/lib/api/support"
import { readSession } from "@/lib/auth"
import { articleHeadingId, markdownHeadingText } from "@/lib/support-article"
import { cn, formatDateTime } from "@/lib/utils"
import type { ContentValue } from "@/components/content-editor"

type SupportAnswerSort = "default" | "latest" | "hot"

export function SupportHelpCenter() {
  const t = useI18n()
  const [pages, setPages] = useState<SupportHelpPage[]>([])
  const [questions, setQuestions] = useState<SupportQuestion[]>([])
  const [helpPagePaths, setHelpPagePaths] = useState<Map<number, string>>(new Map())
  const [query, setQuery] = useState("")

  useEffect(() => {
    void Promise.all([
      fetchSupportHelpPages({ limit: 6 }),
      fetchSupportQuestions({ limit: 6 }),
      fetchSupportHelpNavigation(),
    ])
      .then(([helpPage, questionPage, navigation]) => {
        setPages(helpPage.results)
        setQuestions(questionPage.results)
        setHelpPagePaths(new Map(flattenSupportHelpNavigation(navigation).map((item) => [item.id, item.helpPath || ""])))
      })
      .catch(() => {
        setPages([])
        setQuestions([])
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
              className={cn(buttonVariants({ size: "lg" }), "h-13 rounded-2xl px-6 shadow-sm")}
              href={`/support/questions${query ? `?title=${encodeURIComponent(query)}` : ""}`}
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
            href="/support/questions"
            icon={<CircleHelpIcon />}
            title={t("supportPublic.home.questionsTitle")}
            description={t("supportPublic.home.questionsDescription")}
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
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">{t("supportPublic.home.askQuestion")}</h2>
            <p className="mt-3 text-sm leading-6 text-slate-300">{t("supportPublic.home.quickPanelDescription")}</p>
            <div className="mt-6 grid gap-2">
              <QuickLink href="/support/questions?status=normal" label={t("supportPublic.home.unsolvedQuestions")} />
              <QuickLink href="/support/help" label={t("supportPublic.home.browseDocs")} />
              <QuickLink href="/support/questions/ask" label={t("supportPublic.home.askQuestion")} />
            </div>
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <PublicSection title={t("supportPublic.home.recommendedPages")} href="/support/help">
              {pages.length ? pages.map((item) => <HelpPageRow key={item.id} item={{ ...item, helpPath: helpPagePaths.get(item.id) }} />) : <EmptyState text={t("supportPublic.empty.noPages")} />}
            </PublicSection>
            <PublicSection title={t("supportPublic.home.hotQuestions")} href="/support/questions">
              {questions.length ? questions.map((item) => <QuestionRow key={item.id} item={item} />) : <EmptyState text={t("supportPublic.empty.noQuestions")} />}
            </PublicSection>
          </div>
        </section>
      </SupportPageContent>
    </SupportPageShell>
  )
}

export function SupportHelpList() {
  return <SupportHelpReader />
}

export function SupportHelpPageDetail() {
  return <SupportHelpReader />
}

function useSupportQuestionCategoryRoute() {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [categories, setCategories] = useState<SupportCategory[]>([])
  const [categoriesLoading, setCategoriesLoading] = useState(true)
  const [categoriesFailed, setCategoriesFailed] = useState(false)
  const categorySlug = questionCategorySlugFromPath(pathname) || searchParams.get("category") || ""
  const activeCategory = categorySlug ? categories.find((item) => item.slug === categorySlug) : undefined
  const activeCategoryId: number | "all" = categorySlug ? activeCategory?.id ?? "all" : "all"

  const loadCategories = useCallback(() => {
    setCategoriesLoading(true)
    setCategoriesFailed(false)
    void fetchSupportQuestionCategories()
      .then(setCategories)
      .catch(() => {
        setCategories([])
        setCategoriesFailed(true)
      })
      .finally(() => setCategoriesLoading(false))
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(loadCategories, 0)
    return () => window.clearTimeout(timer)
  }, [loadCategories])

  const changeCategory = useCallback((value: number | "all") => {
    const params = new URLSearchParams(searchParams.toString())
    params.delete("category")
    const query = params.toString()
    if (value === "all") {
      router.push(`/support/questions${query ? `?${query}` : ""}`)
      return
    }
    const category = categories.find((item) => item.id === value)
    router.push(`/support/questions/${encodeURIComponent(category?.slug || String(value))}${query ? `?${query}` : ""}`)
  }, [categories, router, searchParams])

  return {
    activeCategory,
    activeCategoryId,
    categories,
    categoriesFailed,
    categoriesLoading,
    categorySlug,
    changeCategory,
    loadCategories,
  }
}

function SupportQuestionFrame({
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

function SupportHelpReader() {
  const t = useI18n()
  const pathname = usePathname()
  const [query, setQuery] = useState("")
  const [searchResults, setSearchResults] = useState<SupportHelpPage[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [navigationOpen, setNavigationOpen] = useState(false)
  const { activePath, navigate, replace } = useSupportHelpRoute(pathname)
  const { page, pages, expanded, setExpanded, navigationLoading, pageLoading, failed } = useSupportHelpReader(activePath, replace)
  const navigateToHelpPage = useCallback<HelpPageNavigationHandler>((event, targetPage) => {
    navigate(event, targetPage)
    if (event.defaultPrevented) setNavigationOpen(false)
  }, [navigate])

  useEffect(() => {
    if (!page) return
    document.title = `${page.title} · ${t("supportPublic.help.title")}`
  }, [page, t])

  useEffect(() => {
    const keyword = query.trim()
    if (!keyword) return
    const timer = window.setTimeout(() => {
      void fetchSupportHelpPages({ keyword, limit: 50 })
        .then((result) => setSearchResults(result.results))
        .catch(() => setSearchResults([]))
        .finally(() => setSearchLoading(false))
    }, 250)
    return () => window.clearTimeout(timer)
  }, [query])

  const visiblePages = useMemo(() => {
    const keyword = query.trim().toLowerCase()
    if (!keyword) return pages
    const matched = new Set<number>()
    pages.forEach((item) => {
      if (`${item.title} ${item.summary} ${item.slug} ${(item.tags || []).join(" ")}`.toLowerCase().includes(keyword)) {
        matched.add(item.id)
        let parentId = item.parentId
        while (parentId) {
          matched.add(parentId)
          parentId = pages.find((candidate) => candidate.id === parentId)?.parentId ?? 0
        }
      }
    })
    return pages.filter((item) => matched.has(item.id))
  }, [pages, query])

  return (
    <SupportDocsFrame
      navigationOpen={navigationOpen}
      onNavigationOpenChange={setNavigationOpen}
      navigation={<HelpNavigation pages={visiblePages} rootPages={visiblePages.filter((item) => !item.parentId)} searchResults={searchResults.map((item) => pages.find((candidate) => candidate.id === item.id) || item).filter((item) => Boolean(item.helpPath))} title={query} expanded={expanded} selectedPageId={page?.id ?? 0} loading={navigationLoading || searchLoading} failed={failed} onTitleChange={(value) => { setQuery(value); setSearchResults([]); setSearchLoading(Boolean(value.trim())) }} onExpandedChange={setExpanded} onNavigate={navigateToHelpPage} />}
      toc={<PublicArticleToc content={page?.content ?? ""} contentType={page?.contentType} />}
    >
      <div aria-busy={pageLoading} className={cn(page && pageLoading && "opacity-60 transition-opacity")}>
        {page ? <HelpArticle page={page} pages={pages} previewId="support-help-page-detail-preview" onNavigate={navigateToHelpPage} /> : <div className="grid min-h-[60svh] place-items-center"><EmptyState text={pageLoading ? t("supportPublic.loading.page") : failed ? t("supportPublic.empty.pageNotFound") : t("supportPublic.empty.noPages")} /></div>}
      </div>
    </SupportDocsFrame>
  )
}

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
      <div className="grid gap-2 px-5 py-3 sm:px-6 md:px-8 lg:px-10 2xl:px-12">
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
  const questionToc = question && hasArticleTocHeadings(question.content, question.contentType)
    ? <PublicArticleToc content={question.content} contentType={question.contentType} />
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
              <SupportQuestionArticleContent id={`support-question-${question.id}`} content={question.content} contentType={question.contentType} />
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-2">
              <Button variant="secondary" size="sm" className="rounded-full" onClick={() => void ensureSupportLogin().then(() => voteSupportQuestion(question.id)).then(reload)}>
                <ThumbsUpIcon /> {question.voteCount}
              </Button>
              <QuestionMetric icon={<MessageCircleMoreIcon className="size-3.5" />} value={question.answerCount} label={t("supportPublic.questions.answers")} />
              <QuestionMetric icon={<EyeIcon className="size-3.5" />} value={question.viewCount} label={t("supportPublic.questions.views")} />
            </div>

            <section className="mt-12" aria-label={t("supportPublic.questions.answers")}>
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-base font-semibold">{t("supportPublic.questions.answers")}</h2>
                  <div className="mt-1 text-sm text-muted-foreground">{t("supportPublic.answer.count", { count: answerPage.total || question.answerCount })}</div>
                </div>
                <div className="flex gap-1 rounded-full bg-muted p-1">
                  {(["default", "latest", "hot"] as const).map((sort) => (
                    <button
                      key={sort}
                      type="button"
                      className={cn(
                        "h-7 rounded-full px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
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
                <div className="space-y-6">
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
                <div className="mt-5 flex justify-center">
                  <Button variant="ghost" size="sm" disabled={answersLoading} onClick={() => loadAnswers(answerPage.page + 1, true)}>
                    {answersLoading ? <LoaderCircleIcon className="animate-spin" /> : <ChevronDownIcon />}
                    {answersLoading ? t("supportPublic.loading.answers") : t("supportPublic.actions.loadMore")}
                  </Button>
                </div>
              ) : null}
            </section>

            <section className="mt-8 rounded-lg bg-muted/35 p-4 sm:p-5" aria-labelledby="support-answer-editor-title">
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

export function SupportAskQuestion() {
  const t = useI18n()
  const router = useRouter()
  const { ready, session } = useSupportAuth()
  const [categories, setCategories] = useState<SupportCategory[]>([])
  const [categoriesLoading, setCategoriesLoading] = useState(true)
  const [categoriesFailed, setCategoriesFailed] = useState(false)
  const [categoryId, setCategoryId] = useState(0)
  const [title, setTitle] = useState("")
  const [content, setContent] = useState<ContentValue>({ mode: "html", raw: "" })
  const [tags, setTags] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState("")

  useEffect(() => {
    if (ready && !session) {
      router.replace("/support/login?next=%2Fsupport%2Fquestions%2Fask")
    }
  }, [ready, router, session])

  const loadCategories = useCallback(() => {
    setCategoriesLoading(true)
    setCategoriesFailed(false)
    void fetchSupportQuestionCategories()
      .then((items) => {
        setCategories(items)
        setCategoryId((current) => current || items[0]?.id || 0)
      })
      .catch(() => {
        setCategories([])
        setCategoriesFailed(true)
      })
      .finally(() => setCategoriesLoading(false))
  }, [])

  useEffect(loadCategories, [loadCategories])

  const handleContentChange = useCallback((next: ContentValue) => {
    if (content.mode === next.mode && content.raw === next.raw) {
      return
    }
    setContent(next)
    setFormError("")
  }, [content.mode, content.raw])

  const submit = async () => {
    if (submitting) return
    if (!categoryId) {
      setFormError(t("supportPublic.ask.categoryRequired"))
      return
    }
    if (!title.trim()) {
      setFormError(t("supportPublic.ask.titleRequired"))
      return
    }
    if (!content.raw.trim()) {
      setFormError(t("supportPublic.ask.contentRequired"))
      return
    }
    setFormError("")
    setSubmitting(true)
    try {
      await ensureSupportLogin()
      const question = await createSupportQuestion({
        categoryId,
        title,
        contentType: content.mode,
        content: content.raw,
        tags: tags.split(",").map((item) => item.trim()).filter(Boolean),
      })
      toast.success(t("supportPublic.toast.questionCreated"))
      window.location.assign(supportQuestionHref(question.id))
    } catch (error) {
      const message = error instanceof Error ? error.message : t("api.requestFailed")
      setFormError(message)
    } finally {
      setSubmitting(false)
    }
  }

  if (!ready || !session) {
    return (
      <SupportPageShell section="ask">
        <SupportPageContent className="py-10 sm:py-12" width="docs">
          <div className="flex min-h-40 items-center justify-center gap-2 text-sm text-muted-foreground">
            <LoaderCircleIcon className="size-4 animate-spin" />
            {t("supportPublic.loading.session")}
          </div>
        </SupportPageContent>
      </SupportPageShell>
    )
  }

  return (
    <SupportPageShell section="ask">
      <SupportPageContent className="py-8 sm:py-10" width="docs">
        <form
        className="w-full rounded-md border bg-card p-4 sm:p-5"
        onSubmit={(event) => {
          event.preventDefault()
          void submit()
        }}
      >
        <div className="mb-3 border-b pb-3">
          <h1 className="text-lg font-medium">{t("supportPublic.ask.formTitle")}</h1>
        </div>

        <div className="grid gap-3">
          <fieldset aria-label={t("supportPublic.ask.category")}>
            <legend className="sr-only">{t("supportPublic.ask.category")}</legend>
            <div className="flex flex-wrap gap-1">
              {categories.map((item) => (
                <Button
                  key={item.id}
                  type="button"
                  size="sm"
                  variant={categoryId === item.id ? "default" : "secondary"}
                  className="rounded-md"
                  disabled={categoriesLoading || submitting}
                  aria-pressed={categoryId === item.id}
                  onClick={() => { setCategoryId(item.id); setFormError("") }}
                >
                  {item.name}
                </Button>
              ))}
            </div>
            {categoriesLoading ? <p className="mt-2 text-xs text-muted-foreground">{t("supportPublic.loading.categories")}</p> : null}
            {categoriesFailed ? <button type="button" className="mt-2 text-xs text-destructive underline-offset-4 hover:underline" onClick={loadCategories}>{t("supportPublic.ask.categoriesFailed")}</button> : null}
          </fieldset>

          <Input id="support-question-title" value={title} onChange={(event) => { setTitle(event.target.value); setFormError("") }} placeholder={t("supportPublic.ask.questionTitlePlaceholder")} className="rounded-md bg-card" disabled={submitting} aria-label={t("supportPublic.ask.questionTitle")} />

          <div className="grid min-w-0 gap-2" role="group" aria-labelledby="support-question-content-label">
            <span id="support-question-content-label" className="sr-only">{t("supportPublic.ask.content")}</span>
            <ContentEditor
              value={content}
              onChange={handleContentChange}
              placeholder={t("supportPublic.ask.contentPlaceholder")}
              disabled={submitting}
              allowedModes={["html", "markdown"]}
              height={420}
              className="min-w-0"
            />
          </div>

          <Input id="support-question-tags" value={tags} onChange={(event) => setTags(event.target.value)} placeholder={t("supportPublic.ask.tagsPlaceholder")} className="rounded-md bg-card" disabled={submitting} aria-label={t("supportPublic.ask.tags")} />

          {formError ? <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{formError}</div> : null}

          <div className="flex justify-end pt-1">
            <Button type="submit" disabled={submitting || categoriesLoading || categoriesFailed}>
              {submitting ? t("supportPublic.actions.publishing") : t("supportPublic.actions.publishQuestion")}
            </Button>
          </div>
        </div>
        </form>
      </SupportPageContent>
    </SupportPageShell>
  )
}

export function SupportLoginPage() {
  const t = useI18n()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { ready, session } = useSupportAuth()
  const [mode, setMode] = useState<"login" | "register">("login")
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (ready && session) router.replace(getSupportLoginDestination(searchParams.get("next")))
  }, [ready, router, searchParams, session])

  const submit = async () => {
    if (submitting) return
    setSubmitting(true)
    try {
      await (mode === "login"
        ? loginSupportCustomer({ email, password })
        : registerSupportCustomer({ name, email, password }))
      toast.success(t("supportPublic.toast.loggedIn"))
      router.replace(getSupportLoginDestination(searchParams.get("next")))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <SupportPageShell section="login">
      <SupportPageContent className="py-10 sm:py-12">
        <div className="mx-auto max-w-md rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
          <div className="grid gap-4">
            {mode === "register" && (
              <LabeledField label={t("supportPublic.login.name")}>
                <Input value={name} onChange={(event) => setName(event.target.value)} placeholder={t("supportPublic.login.namePlaceholder")} className="bg-card" />
              </LabeledField>
            )}
            <LabeledField label={t("supportPublic.login.email")}>
              <Input value={email} onChange={(event) => setEmail(event.target.value)} placeholder={t("supportPublic.login.emailPlaceholder")} className="bg-card" />
            </LabeledField>
            <LabeledField label={t("supportPublic.login.password")}>
              <Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder={t("supportPublic.login.passwordPlaceholder")} className="bg-card" />
            </LabeledField>
            <Button disabled={submitting} onClick={() => void submit()}>
              {submitting ? t("supportPublic.actions.processing") : mode === "login" ? t("supportPublic.login.loginAction") : t("supportPublic.login.registerAction")}
            </Button>
            <Button variant="ghost" onClick={() => setMode(mode === "login" ? "register" : "login")}>
              {mode === "login" ? t("supportPublic.login.switchToRegister") : t("supportPublic.login.switchToLogin")}
            </Button>
          </div>
        </div>
      </SupportPageContent>
    </SupportPageShell>
  )
}

function SupportDocsFrame({
  children,
  navigation,
  toc,
  navigationOpen,
  onNavigationOpenChange,
}: {
  children: ReactNode
  navigation: ReactNode
  toc: ReactNode
  navigationOpen: boolean
  onNavigationOpenChange: (open: boolean) => void
}) {
  const t = useI18n()
  return (
    <main className="min-h-svh bg-background text-foreground">
      <SupportHeader
        section="help"
        leading={navigation ? <Button variant="ghost" size="icon" className="xl:hidden" onClick={() => onNavigationOpenChange(true)} aria-label={t("supportPublic.a11y.openNavigation")}><MenuIcon /></Button> : null}
      />

      <div className="support-docs-grid mx-auto max-w-[var(--support-docs-max-width)]">
        {navigation ? <aside className="hidden border-r xl:sticky xl:top-14 xl:block xl:h-[calc(100svh-3.5rem)] xl:overflow-y-auto">{navigation}</aside> : null}
        <div className="min-w-0 px-5 py-9 sm:px-6 sm:py-12 md:px-8 lg:px-10 2xl:px-12">{children}</div>
        {toc ? <div className="hidden 2xl:block">{toc}</div> : null}
      </div>

      {navigationOpen ? (
        <div className="fixed inset-0 z-50 xl:hidden">
          <button className="absolute inset-0 bg-black/45" aria-label={t("supportPublic.a11y.closeNavigation")} onClick={() => onNavigationOpenChange(false)} />
          <aside className="relative h-full w-[min(88vw,360px)] overflow-y-auto border-r bg-background shadow-xl">
            <div className="flex h-14 items-center justify-between border-b px-4">
              <span className="font-semibold">{t("supportPublic.help.navigation")}</span>
              <Button variant="ghost" size="icon" onClick={() => onNavigationOpenChange(false)} aria-label={t("supportPublic.a11y.closeNavigation")}><XIcon /></Button>
            </div>
            {navigation}
          </aside>
        </div>
      ) : null}
    </main>
  )
}

function HelpNavigation({
  pages,
  rootPages,
  searchResults = [],
  title,
  expanded,
  selectedPageId,
  loading,
  failed,
  onTitleChange,
  onExpandedChange,
  onNavigate,
}: {
  pages: SupportHelpPage[]
  rootPages: SupportHelpPage[]
  searchResults?: SupportHelpPage[]
  title: string
  expanded: Set<number>
  selectedPageId: number
  loading: boolean
  failed: boolean
  onTitleChange: (value: string) => void
  onExpandedChange: (value: Set<number>) => void
  onNavigate: HelpPageNavigationHandler
}) {
  const t = useI18n()
  return (
    <div className="p-4">
      <SupportSearchInput value={title} onChange={onTitleChange} placeholder={t("supportPublic.help.searchPlaceholder")} compact />
      <div className="mt-4 grid gap-0.5">
        {title.trim() ? searchResults.map((page) => (
          <SupportHelpLink key={page.id} page={page} onNavigate={onNavigate} className={cn("rounded-lg px-2.5 py-2 text-sm transition-colors hover:bg-muted", selectedPageId === page.id && "bg-primary/10 text-primary")}>
            <span className="block truncate font-medium">{page.title}</span>
            {page.summary ? <span className="mt-1 block line-clamp-2 text-xs leading-5 text-muted-foreground">{page.summary}</span> : null}
          </SupportHelpLink>
        )) : rootPages.map((page) => (
          <PublicHelpPageNode key={page.id} page={page} depth={0} pages={pages} expanded={expanded} selectedPageId={selectedPageId} onToggle={(id) => {
            const next = new Set(expanded)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            onExpandedChange(next)
          }} onNavigate={onNavigate} />
        ))}
        {loading ? <div className="px-2 py-8 text-center text-sm text-muted-foreground">{t("supportPublic.loading.navigation")}</div> : null}
        {!loading && (title.trim() ? !searchResults.length : !pages.length) ? <EmptyState text={failed ? t("supportPublic.empty.pagesFailed") : t("supportPublic.empty.noPagesMatched")} compact /> : null}
      </div>
    </div>
  )
}

function HelpArticle({ page, pages, previewId, onNavigate }: { page: SupportHelpPage; pages: SupportHelpPage[]; previewId: string; onNavigate: HelpPageNavigationHandler }) {
  const t = useI18n()
  const lightbox = useImageLightboxOptional()
  const [feedbackPending, setFeedbackPending] = useState(false)
  const breadcrumbs = helpPageBreadcrumbs(pages, page)
  const currentIndex = pages.findIndex((item) => item.id === page.id)
  const previousPage = currentIndex > 0 ? pages[currentIndex - 1] : null
  const nextPage = currentIndex >= 0 ? pages[currentIndex + 1] : null
  const submitFeedback = async (helpful: boolean) => {
    if (feedbackPending) return
    setFeedbackPending(true)
    try {
      await submitSupportHelpPageFeedback(page.id, helpful)
      toast.success(t("supportPublic.toast.feedbackSaved"))
    } finally {
      setFeedbackPending(false)
    }
  }
  useEffect(() => {
    if (page.contentType !== "html") return
    const container = document.getElementById(previewId)
    if (!container) return
    const cleanup: Array<() => void> = []
    container.querySelectorAll<HTMLElement>("h2, h3").forEach((heading, index) => {
      heading.id = articleHeadingId(heading.textContent || "", index)
      heading.classList.add("scroll-mt-20")
    })
    container.querySelectorAll<HTMLPreElement>("pre").forEach((block) => {
      block.classList.add("group", "relative")
      const button = document.createElement("button")
      button.type = "button"
      button.className = "not-typeset absolute right-2 top-2 rounded-md border border-border bg-background/90 px-2 py-1 text-xs text-muted-foreground opacity-0 shadow-sm transition-opacity group-hover:opacity-100 focus:opacity-100"
      button.dataset.notTypeset = "true"
      button.textContent = t("supportPublic.help.copyCode")
      button.setAttribute("aria-label", t("supportPublic.help.copyCode"))
      const copy = () => void navigator.clipboard.writeText(block.querySelector("code")?.textContent || block.textContent || "").then(() => toast.success(t("supportPublic.toast.codeCopied")))
      button.addEventListener("click", copy)
      block.appendChild(button)
      cleanup.push(() => { button.removeEventListener("click", copy); button.remove() })
    })
    const articleImages = Array.from(container.querySelectorAll<HTMLImageElement>("img"))
    articleImages.forEach((image, imageIndex) => {
      if (!lightbox) return
      image.classList.add("cursor-zoom-in")
      const open = () => lightbox.openGallery(articleImages.map((item) => ({
        src: item.currentSrc || item.src,
        alt: item.alt,
      })), imageIndex)
      image.addEventListener("click", open)
      cleanup.push(() => image.removeEventListener("click", open))
    })
    container.querySelectorAll<HTMLTableElement>("table").forEach((table) => {
      if (table.parentElement?.classList.contains("typeset-scroll")) return
      const wrapper = document.createElement("div")
      wrapper.className = "typeset-scroll"
      table.before(wrapper)
      wrapper.appendChild(table)
      cleanup.push(() => {
        wrapper.before(table)
        wrapper.remove()
      })
    })
    return () => cleanup.forEach((dispose) => dispose())
  }, [lightbox, page.content, page.contentType, previewId, t])
  return (
    <article className="mx-auto max-w-[var(--support-article-width)]">
      <Breadcrumb>
        <BreadcrumbList className="gap-y-1">
          <BreadcrumbItem>
            <Link href="/support/help" className="transition-colors hover:text-foreground">{t("supportPublic.help.title")}</Link>
          </BreadcrumbItem>
          {breadcrumbs.map((item) => (
            <Fragment key={item.id}>
              <BreadcrumbSeparator />
              <BreadcrumbItem className="min-w-0">
                {item.id === page.id ? (
                  <BreadcrumbPage className="truncate">{item.title}</BreadcrumbPage>
                ) : (
                  <SupportHelpLink page={item} onNavigate={onNavigate} className="truncate transition-colors hover:text-foreground">
                    {item.title}
                  </SupportHelpLink>
                )}
              </BreadcrumbItem>
            </Fragment>
          ))}
        </BreadcrumbList>
      </Breadcrumb>
      <h1 className="mt-6 text-balance text-3xl font-bold tracking-tight sm:text-4xl">{page.title}</h1>
      <div className="my-3 text-xs text-muted-foreground">{t("supportPublic.help.updatedAt", { date: formatDateTime(page.publishedAt || page.updatedAt) })}</div>
      <SupportArticleContent id={previewId} content={page.content} contentType={page.contentType} />
      <ChildPageLinks pages={pages.filter((item) => item.parentId === page.id)} onNavigate={onNavigate} />
      <div className="mt-12 flex flex-col gap-4 border-t pt-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-sm font-medium">{t("supportPublic.help.feedbackTitle")}</div>
          <div className="mt-1 text-sm text-muted-foreground">{t("supportPublic.help.feedbackDescription")}</div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" disabled={feedbackPending} onClick={() => void submitFeedback(true)}><ThumbsUpIcon />{t("supportPublic.actions.helpful")}</Button>
          <Button variant="outline" disabled={feedbackPending} onClick={() => void submitFeedback(false)}><ThumbsDownIcon />{t("supportPublic.actions.notHelpful")}</Button>
        </div>
      </div>
      {(previousPage || nextPage) ? <nav className="mt-8 grid gap-3 sm:grid-cols-2">
        {previousPage ? <ArticlePager page={previousPage} direction="previous" onNavigate={onNavigate} /> : <span />}
        {nextPage ? <ArticlePager page={nextPage} direction="next" onNavigate={onNavigate} /> : null}
      </nav> : null}
    </article>
  )
}

function helpPageBreadcrumbs(pages: SupportHelpPage[], page: SupportHelpPage) {
  const pagesById = new Map(pages.map((item) => [item.id, item]))
  const ancestors: SupportHelpPage[] = []
  const visited = new Set<number>([page.id])
  let parentId = page.parentId
  while (parentId && !visited.has(parentId)) {
    const parent = pagesById.get(parentId)
    if (!parent) break
    ancestors.unshift(parent)
    visited.add(parent.id)
    parentId = parent.parentId
  }
  return [...ancestors, page]
}

function ArticlePager({ page, direction, onNavigate }: { page: SupportHelpPage; direction: "previous" | "next"; onNavigate: HelpPageNavigationHandler }) {
  const t = useI18n()
  return <SupportHelpLink page={page} onNavigate={onNavigate} className={cn("group rounded-xl border px-4 py-3 transition-colors hover:border-primary/40 hover:bg-muted/50", direction === "next" && "text-right")}>
    <span className="text-xs text-muted-foreground">{t(`supportPublic.help.${direction}`)}</span>
    <span className="mt-1 flex items-center justify-between gap-3 text-sm font-medium text-primary">{direction === "previous" ? <ChevronRightIcon className="size-4 rotate-180" /> : null}<span className={cn("truncate", direction === "next" && "ml-auto")}>{page.title}</span>{direction === "next" ? <ChevronRightIcon className="size-4" /> : null}</span>
  </SupportHelpLink>
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
      className="group rounded-2xl border border-border bg-card p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <div className="flex items-start justify-between gap-4">
        <span className={cn("grid size-10 place-items-center rounded-xl [&_svg]:size-5", accentClass)}>{icon}</span>
        <ArrowRightIcon className="mt-1 size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
      </div>
      <h3 className="mt-5 font-medium">{title}</h3>
      <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>
    </Link>
  )
}

function QuickLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="flex items-center justify-between rounded-xl border border-white/10 px-3 py-2.5 text-sm text-slate-200 transition hover:border-sky-300/40 hover:bg-white/10 hover:text-white">
      <span>{label}</span>
      <ArrowRightIcon className="size-4" />
    </Link>
  )
}

function PublicSection({ title, href, children }: { title: string; href: string; children: ReactNode }) {
  const t = useI18n()
  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
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

function QuestionRow({ item }: { item: SupportQuestion }) {
  return (
    <a href={supportQuestionHref(item.id)} className="block border-t px-1 py-3 first:border-t-0 hover:bg-muted/60">
      <div className="flex items-start justify-between gap-3">
        <div className="line-clamp-1 font-medium">{item.title}</div>
        <QuestionStatusBadge status={item.status} />
      </div>
      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{item.content}</p>
      <div className="mt-2 flex gap-3 text-xs text-muted-foreground">
        <span><MessageCircleMoreIcon className="mr-1 inline size-3" />{item.answerCount}</span>
        <span><ThumbsUpIcon className="mr-1 inline size-3" />{item.voteCount}</span>
      </div>
    </a>
  )
}

function QuestionCard({ item }: { item: SupportQuestion }) {
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

function QuestionMetric({ icon, value, label, className }: { icon: ReactNode; value: number; label: string; className?: string }) {
  return (
    <span className={cn("inline-flex h-7 items-center gap-1 rounded-full bg-muted px-2.5 text-xs text-muted-foreground", className)} title={label} aria-label={`${label}: ${value}`}>
      {icon}
      {value}
    </span>
  )
}

function QuestionStatusPill({ status }: { status: string }) {
  const t = useI18n()
  if (status === "resolved") return <span className="inline-flex h-5 items-center rounded bg-emerald-50 px-1.5 text-[11px] font-medium text-emerald-700">{t("supportPublic.status.resolved")}</span>
  if (status === "closed") return <span className="inline-flex h-5 items-center rounded bg-neutral-100 px-1.5 text-[11px] font-medium text-muted-foreground">{t("supportPublic.status.closed")}</span>
  return <span className="inline-flex h-5 items-center rounded bg-amber-50 px-1.5 text-[11px] font-medium text-amber-700">{t("supportPublic.status.normal")}</span>
}

function QuestionListLoading() {
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

function supportQuestionHref(id: number) {
  return `/support/question/${id}`
}

function questionCategorySlugFromPath(pathname: string) {
  const segments = pathname.split("/").filter(Boolean)
  if (segments[0] !== "support" || segments[1] !== "questions" || segments.length !== 3) {
    return ""
  }
  const slug = segments[2]
  return slug && slug !== "ask" && slug !== "detail" ? decodeURIComponent(slug) : ""
}

function SupportQuestionArticleContent({ content, contentType, id }: { content: string; contentType?: string; id: string }) {
  const resolvedContentType = contentType || questionContentType(content)
  useHtmlArticleEnhancements(id, content, resolvedContentType)
  return <SupportArticleContent id={id} content={content} contentType={resolvedContentType} />
}

function questionContentType(content: string) {
  return /<\/?[a-z][\s\S]*>/i.test(content) ? "html" : "markdown"
}

function useHtmlArticleEnhancements(id: string, content: string, contentType: string) {
  const t = useI18n()
  const lightbox = useImageLightboxOptional()
  useEffect(() => {
    if (contentType !== "html") return
    const container = document.getElementById(id)
    if (!container) return
    const cleanup: Array<() => void> = []
    container.querySelectorAll<HTMLPreElement>("pre").forEach((block) => {
      block.classList.add("group", "relative")
      if (block.querySelector("[data-support-copy-code]")) return
      const button = document.createElement("button")
      button.type = "button"
      button.className = "not-typeset absolute right-2 top-2 rounded-md border border-border bg-background/90 px-2 py-1 text-xs text-muted-foreground opacity-0 shadow-sm transition-opacity group-hover:opacity-100 focus:opacity-100"
      button.dataset.notTypeset = "true"
      button.dataset.supportCopyCode = "true"
      button.textContent = t("supportPublic.help.copyCode")
      button.setAttribute("aria-label", t("supportPublic.help.copyCode"))
      const copy = () => void navigator.clipboard.writeText(block.querySelector("code")?.textContent || block.textContent || "").then(() => toast.success(t("supportPublic.toast.codeCopied")))
      button.addEventListener("click", copy)
      block.appendChild(button)
      cleanup.push(() => { button.removeEventListener("click", copy); button.remove() })
    })
    const articleImages = Array.from(container.querySelectorAll<HTMLImageElement>("img"))
    articleImages.forEach((image, imageIndex) => {
      if (!lightbox) return
      image.classList.add("cursor-zoom-in")
      const open = () => lightbox.openGallery(articleImages.map((item) => ({
        src: item.currentSrc || item.src,
        alt: item.alt,
      })), imageIndex)
      image.addEventListener("click", open)
      cleanup.push(() => image.removeEventListener("click", open))
    })
    container.querySelectorAll<HTMLTableElement>("table").forEach((table) => {
      if (table.parentElement?.classList.contains("typeset-scroll")) return
      const wrapper = document.createElement("div")
      wrapper.className = "typeset-scroll"
      table.before(wrapper)
      wrapper.appendChild(table)
      cleanup.push(() => {
        wrapper.before(table)
        wrapper.remove()
      })
    })
    return () => cleanup.forEach((dispose) => dispose())
  }, [content, contentType, id, lightbox, t])
}

function PublicHelpPageNode({
  page,
  depth,
  pages,
  expanded,
  selectedPageId,
  onToggle,
  onNavigate,
}: {
  page: SupportHelpPage
  depth: number
  pages: SupportHelpPage[]
  expanded: Set<number>
  selectedPageId: number
  onToggle: (id: number) => void
  onNavigate: HelpPageNavigationHandler
}) {
  const t = useI18n()
  const open = expanded.has(page.id)
  const children = pages.filter((item) => item.parentId === page.id)
  const hasChildren = children.length > 0
  const selected = selectedPageId === page.id
  return (
    <div className={cn(depth === 0 && "mt-1 first:mt-0")}>
      <div
        className={cn(
          "group relative flex min-h-9 w-full items-center rounded-md pr-2 text-sm text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground",
          depth === 0 && hasChildren && "font-semibold text-foreground",
          selected && "bg-primary/10 font-medium text-primary before:absolute before:inset-y-1.5 before:left-0 before:w-0.5 before:rounded-full before:bg-primary"
        )}
        style={{ paddingLeft: `${depth * 16 + 4}px` }}
      >
        {hasChildren ? (
          <button
            type="button"
            className="flex size-7 shrink-0 items-center justify-center rounded-sm text-muted-foreground hover:bg-background/80 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() => onToggle(page.id)}
            aria-expanded={open}
            aria-label={open ? t("supportPublic.a11y.collapse") : t("supportPublic.a11y.expand")}
          >
            {open ? <ChevronDownIcon className="size-4" /> : <ChevronRightIcon className="size-4" />}
          </button>
        ) : <span className="size-7 shrink-0" />}
        <SupportHelpLink page={page} onNavigate={onNavigate} className="flex min-w-0 flex-1 items-center gap-2 py-1.5 text-left" aria-current={selected ? "page" : undefined}>
          {hasChildren ? (open ? <FolderOpenIcon className="size-4 shrink-0" /> : <FolderIcon className="size-4 shrink-0" />) : <FileTextIcon className="size-3.5 shrink-0 opacity-70" />}
          <span className="truncate">{page.title}</span>
        </SupportHelpLink>
      </div>
      {open && hasChildren ? (
        <div className="relative before:absolute before:inset-y-1 before:w-px before:bg-border/80" style={{ marginLeft: `${depth * 16 + 17}px` }}>
          <div style={{ marginLeft: `${-(depth * 16 + 17)}px` }}>
            {children.map((child) => (
              <PublicHelpPageNode key={child.id} page={child} depth={depth + 1} pages={pages} expanded={expanded} selectedPageId={selectedPageId} onToggle={onToggle} onNavigate={onNavigate} />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}

function ChildPageLinks({ pages, onNavigate }: { pages: SupportHelpPage[]; onNavigate: HelpPageNavigationHandler }) {
  const t = useI18n()
  if (!pages.length) return null
  return (
    <section className="mt-10 border-t pt-6" aria-labelledby="support-child-pages-title">
      <h2 id="support-child-pages-title" className="mb-4 text-sm font-semibold tracking-tight text-foreground">
        {t("supportPublic.help.childPages")}
      </h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {pages.map((page) => (
          <SupportHelpLink
            key={page.id}
            page={page}
            onNavigate={onNavigate}
            className="group flex min-w-0 items-start gap-3 rounded-xl border border-border/70 bg-card p-4 shadow-xs transition-[border-color,background-color,box-shadow,transform] hover:-translate-y-0.5 hover:border-primary/30 hover:bg-primary/[0.025] hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-muted/60 text-muted-foreground transition-colors group-hover:border-primary/20 group-hover:bg-primary/10 group-hover:text-primary">
              <FileTextIcon className="size-4" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold leading-6 text-foreground transition-colors group-hover:text-primary">
                {page.title}
              </span>
              {page.summary ? <span className="mt-0.5 line-clamp-3 text-sm leading-5 text-muted-foreground">{page.summary}</span> : null}
            </span>
            <ArrowRightIcon className="mt-2 size-4 shrink-0 text-muted-foreground/60 transition-[color,transform] group-hover:translate-x-0.5 group-hover:text-primary" aria-hidden="true" />
          </SupportHelpLink>
        ))}
      </div>
    </section>
  )
}

function PublicArticleToc({ content, contentType = "markdown" }: { content: string; contentType?: string }) {
  const t = useI18n()
  const tocRef = useRef<HTMLElement>(null)
  const headings = useMemo(() => getArticleTocHeadings(content, contentType), [content, contentType])
  const [activeId, setActiveId] = useState("")

  useEffect(() => {
    if (!headings.length) return
    let frame = 0
    const syncActiveHeading = () => {
      frame = 0
      const anchorOffset = 88
      let nextId = headings[0].id
      for (const heading of headings) {
        const element = document.getElementById(heading.id)
        if (!element || element.getBoundingClientRect().top > anchorOffset) break
        nextId = heading.id
      }
      setActiveId((current) => current === nextId ? current : nextId)
    }
    const scheduleSync = () => {
      if (frame) return
      frame = window.requestAnimationFrame(syncActiveHeading)
    }
    const initialFrame = window.requestAnimationFrame(() => {
      const hashId = decodeURIComponent(window.location.hash.slice(1))
      if (headings.some((heading) => heading.id === hashId)) {
        document.getElementById(hashId)?.scrollIntoView()
      }
      syncActiveHeading()
    })
    window.addEventListener("scroll", scheduleSync, { passive: true })
    window.addEventListener("resize", scheduleSync)
    return () => {
      window.cancelAnimationFrame(initialFrame)
      if (frame) window.cancelAnimationFrame(frame)
      window.removeEventListener("scroll", scheduleSync)
      window.removeEventListener("resize", scheduleSync)
    }
  }, [headings])

  useEffect(() => {
    const container = tocRef.current
    if (!container || !activeId) return
    const activeLink = Array.from(container.querySelectorAll<HTMLAnchorElement>("[data-toc-id]"))
      .find((link) => link.dataset.tocId === activeId)
    if (!activeLink) return
    const containerRect = container.getBoundingClientRect()
    const linkRect = activeLink.getBoundingClientRect()
    if (linkRect.top >= containerRect.top && linkRect.bottom <= containerRect.bottom) return
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    container.scrollTo({
      top: activeLink.offsetTop - container.clientHeight / 2 + activeLink.clientHeight / 2,
      behavior: reducedMotion ? "auto" : "smooth",
    })
  }, [activeId])

  return (
    <aside ref={tocRef} className="sticky top-14 max-h-[calc(100svh-3.5rem)] overflow-y-auto px-5 py-12">
      <div>
        <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("supportPublic.help.toc")}</div>
        {headings.length ? headings.map((item, index) => (
          <a
            key={`${item.title}-${index}`}
            href={`#${item.id}`}
            data-toc-id={item.id}
            aria-current={activeId === item.id ? "location" : undefined}
            className={cn(
              "block border-l py-1.5 pl-3 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-foreground",
              item.level === 3 && "pl-6",
              activeId === item.id && "border-primary bg-muted/50 font-medium text-foreground"
            )}
          >
            <span className="line-clamp-3">{item.title}</span>
          </a>
        )) : <div className="text-sm text-muted-foreground">{t("supportPublic.help.noToc")}</div>}
      </div>
    </aside>
  )
}

function hasArticleTocHeadings(content: string, contentType?: string) {
  return getArticleTocHeadings(content, contentType).length > 0
}

function getArticleTocHeadings(content: string, contentType = "markdown") {
  return contentType === "html"
    ? Array.from(content.matchAll(/<h([23])[^>]*>([\s\S]*?)<\/h\1>/gi)).map((match, index) => {
        const title = match[2].replace(/<[^>]+>/g, "").trim()
        return { level: Number(match[1]), title, id: articleHeadingId(title, index) }
      })
    : Array.from(content.matchAll(/^(#{2,3})\s+(.+)$/gm)).map((match, index) => {
        const title = markdownHeadingText(match[2])
        return { level: match[1].length, title, id: articleHeadingId(title, index) }
      })
}

function AnswerCard({ answer, question, currentUserId, onChanged }: { answer: SupportAnswer; question: SupportQuestion; currentUserId: number; onChanged: () => void }) {
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
  const isOfficial = answer.authorType === "employee"

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

  return (
    <article id={`answer-${answer.id}`} className={cn("scroll-mt-24 rounded-lg px-1 py-2", answer.isBestAnswer && "bg-emerald-50/70 px-4 py-4 dark:bg-emerald-950/25")}>
      <div className="flex gap-3 sm:gap-4">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
          {supportAuthorInitial(authorName)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
            <div className="min-w-0">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <span className="truncate font-medium">{authorName}</span>
                {isQuestionAuthor ? <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[11px] font-medium text-primary">{t("supportPublic.answer.authorBadge")}</span> : null}
                {isOfficial ? <span className="rounded bg-sky-50 px-1.5 py-0.5 text-[11px] font-medium text-sky-700 dark:bg-sky-950 dark:text-sky-300">{t("supportPublic.answer.officialBadge")}</span> : null}
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground">{formatDateTime(answer.createdAt)}</div>
            </div>
            {!isDeleted && answer.isBestAnswer && <Badge className="bg-emerald-600 text-white"><CheckCircle2Icon /> {t("supportPublic.answer.best")}</Badge>}
          </div>
          <div className="mt-4">
            {isDeleted ? (
              <div className="rounded-lg bg-muted/40 px-3 py-2 text-sm text-muted-foreground">{t("supportPublic.answer.deleted")}</div>
            ) : editing ? (
              <div className="rounded-lg bg-muted/40 p-3">
                <ContentEditor value={editContent} onChange={setEditContent} disabled={submitting} allowedModes={["html", "markdown"]} height={220} className="min-w-0" />
                <div className="mt-3 flex justify-end gap-2">
                  <Button variant="ghost" size="sm" disabled={submitting} onClick={() => setEditing(false)}>{t("supportPublic.actions.cancel")}</Button>
                  <Button size="sm" disabled={submitting || !editContent.raw.trim()} onClick={() => void submitEdit()}>{t("supportPublic.actions.save")}</Button>
                </div>
              </div>
            ) : (
              <SupportQuestionArticleContent id={`support-answer-content-${answer.id}`} content={answer.content} contentType={answer.contentType} />
            )}
          </div>
          {!isDeleted ? (
            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="ghost" size="sm" className="rounded-full text-muted-foreground hover:text-foreground" onClick={() => void ensureSupportLogin().then(() => voteSupportAnswer(answer.id)).then(onChanged)}>
                <ThumbsUpIcon /> {answer.voteCount}
              </Button>
              {answer.parentId === 0 ? (
                <Button variant="ghost" size="sm" className="rounded-full text-muted-foreground hover:text-foreground" onClick={() => setReplying((current) => !current)}>
                  <CornerDownRightIcon /> {t("supportPublic.actions.reply")}
                </Button>
              ) : null}
              <Button variant="ghost" size="sm" className="rounded-full text-muted-foreground hover:text-foreground" onClick={() => void copyLink()}>
                <CopyIcon /> {t("supportPublic.actions.copyLink")}
              </Button>
              <Button variant="ghost" size="sm" className="rounded-full text-muted-foreground hover:text-foreground" onClick={() => void reportAnswer()}>
                <FlagIcon /> {t("supportPublic.actions.report")}
              </Button>
              {isAuthor ? (
                <>
                  <Button variant="ghost" size="sm" className="rounded-full text-muted-foreground hover:text-foreground" onClick={() => setEditing(true)}>
                    <PencilIcon /> {t("supportPublic.actions.edit")}
                  </Button>
                  <Button variant="ghost" size="sm" className="rounded-full text-destructive hover:text-destructive" onClick={() => void deleteAnswer()}>
                    <Trash2Icon /> {t("supportPublic.actions.delete")}
                  </Button>
                </>
              ) : null}
              {canAccept ? (
                <Button variant="ghost" size="sm" className="rounded-full text-primary" onClick={() => void ensureSupportLogin().then(() => acceptSupportAnswer(question.id, answer.id)).then(onChanged)}>
                  {t("supportPublic.actions.accept")}
                </Button>
              ) : null}
            </div>
          ) : null}
          {replying ? (
            <div className="mt-4 rounded-lg bg-muted/35 p-3">
              <ContentEditor value={replyContent} onChange={setReplyContent} placeholder={t("supportPublic.answer.replyPlaceholder")} disabled={submitting} allowedModes={["html", "markdown"]} height={180} className="min-w-0" />
              <div className="mt-3 flex justify-end gap-2">
                <Button variant="ghost" size="sm" disabled={submitting} onClick={() => setReplying(false)}>{t("supportPublic.actions.cancel")}</Button>
                <Button size="sm" disabled={submitting || !replyContent.raw.trim()} onClick={() => void submitReply()}>{t("supportPublic.actions.publishReply")}</Button>
              </div>
            </div>
          ) : null}
          {replies.length ? (
            <div className="mt-5 space-y-4">
              {replies.map((reply) => (
                <AnswerCard key={reply.id} answer={reply} question={question} currentUserId={currentUserId} onChanged={onChanged} />
              ))}
            </div>
          ) : null}
          {!repliesExpanded && answer.replyCount > replies.length ? (
            <Button variant="ghost" size="sm" className="mt-3 rounded-full text-muted-foreground" onClick={() => void loadReplies()}>
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

async function ensureSupportLogin() {
  if (!readSession()?.accessToken) {
    window.location.assign(`/support/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`)
    throw new Error("login required")
  }
  try {
    await fetchSupportMe()
  } catch (error) {
    window.location.assign(`/support/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`)
    throw error
  }
}

function getSupportLoginDestination(next: string | null) {
  return next?.startsWith("/support/") && !next.startsWith("/support/login") ? next : "/support/questions"
}
