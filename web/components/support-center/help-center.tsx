"use client"

import {
  ArrowRightIcon,
  BookOpenIcon,
  CheckCircle2Icon,
  ChevronDownIcon,
  ChevronRightIcon,
  CircleHelpIcon,
  FileTextIcon,
  FolderIcon,
  FolderOpenIcon,
  HeadphonesIcon,
  MenuIcon,
  MessageCircleMoreIcon,
  ThumbsDownIcon,
  ThumbsUpIcon,
  XIcon,
} from "lucide-react"
import Link from "next/link"
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation"
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { toast } from "sonner"

import { OptionCombobox } from "@/components/option-combobox"
import { useImageLightboxOptional } from "@/components/image-lightbox"
import { SupportArticleContent } from "@/components/support-center/support-article-content"
import { SupportHelpLink, type HelpPageNavigationHandler, useSupportHelpRoute } from "@/components/support-center/support-help-navigation"
import { useSupportHelpReader } from "@/components/support-center/use-support-help-reader"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { SupportPageContent, SupportPageShell } from "@/components/support-center/support-page-shell"
import { SupportHeader } from "@/components/support-center/support-header"
import { SupportEmptyState as EmptyState, SupportFormField as LabeledField, SupportInfoCard as InfoCard, SupportQuestionStatusBadge as QuestionStatusBadge, SupportSearchInput } from "@/components/support-center/support-ui"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useI18n } from "@/i18n/provider"
import {
  acceptSupportAnswer,
  createSupportAnswer,
  createSupportQuestion,
  fetchSupportHelpPages,
  fetchSupportMe,
  fetchSupportQuestion,
  fetchSupportQuestionCategories,
  fetchSupportQuestions,
  loginSupportCustomer,
  registerSupportCustomer,
  submitSupportHelpPageFeedback,
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

export function SupportHelpCenter() {
  const t = useI18n()
  const [pages, setPages] = useState<SupportHelpPage[]>([])
  const [questions, setQuestions] = useState<SupportQuestion[]>([])
  const [query, setQuery] = useState("")

  useEffect(() => {
    void Promise.all([
      fetchSupportHelpPages({ limit: 6 }),
      fetchSupportQuestions({ limit: 6 }),
    ])
      .then(([helpPage, questionPage]) => {
        setPages(helpPage.results)
        setQuestions(questionPage.results)
      })
      .catch(() => {
        setPages([])
        setQuestions([])
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
              {pages.length ? pages.map((item) => <HelpPageRow key={item.id} item={item} />) : <EmptyState text={t("supportPublic.empty.noPages")} />}
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

function SupportHelpReader() {
  const t = useI18n()
  const pathname = usePathname()
  const [query, setQuery] = useState("")
  const [searchResults, setSearchResults] = useState<SupportHelpPage[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [navigationOpen, setNavigationOpen] = useState(false)
  const { activeSlug, navigate, replace } = useSupportHelpRoute(pathname)
  const { page, pages, expanded, setExpanded, navigationLoading, pageLoading, failed } = useSupportHelpReader(activeSlug, replace)
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
      navigation={<HelpNavigation pages={visiblePages} rootPages={visiblePages.filter((item) => !item.parentId)} searchResults={searchResults} title={query} expanded={expanded} selectedPageId={page?.id ?? 0} loading={navigationLoading || searchLoading} failed={failed} onTitleChange={(value) => { setQuery(value); setSearchResults([]); setSearchLoading(Boolean(value.trim())) }} onExpandedChange={setExpanded} onNavigate={navigateToHelpPage} />}
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
  const [categories, setCategories] = useState<SupportCategory[]>([])
  const [questions, setQuestions] = useState<SupportQuestion[]>([])
  const [categoryId, setCategoryId] = useState<number | "all">("all")
  const [title, setTitle] = useState(searchParams.get("title") || "")
  const [status, setStatus] = useState(searchParams.get("status") || "all")

  useEffect(() => {
    void fetchSupportQuestionCategories().then(setCategories)
  }, [])

  useEffect(() => {
    void fetchSupportQuestions({
      categoryId: categoryId === "all" ? undefined : categoryId,
      status: status === "all" ? undefined : status,
      title,
      limit: 20,
    }).then((page) => setQuestions(page.results))
  }, [categoryId, status, title])

  return (
    <SupportShell section="questions" title={t("supportPublic.questions.title")} description={t("supportPublic.questions.description")}>
      <div className="grid gap-6 lg:grid-cols-[256px_minmax(0,1fr)]">
        <CategoryRail categories={categories} active={categoryId} onChange={setCategoryId} />
        <section className="min-w-0">
          <div className="rounded-2xl border bg-card p-4 shadow-sm">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <SupportSearchInput value={title} onChange={setTitle} placeholder={t("supportPublic.questions.searchPlaceholder")} />
              <div className="flex shrink-0 flex-wrap gap-2">
                <Button variant={status === "all" ? "default" : "outline"} onClick={() => setStatus("all")}>{t("supportPublic.status.all")}</Button>
                <Button variant={status === "normal" ? "default" : "outline"} onClick={() => setStatus("normal")}>{t("supportPublic.status.normal")}</Button>
                <Button variant={status === "resolved" ? "default" : "outline"} onClick={() => setStatus("resolved")}>{t("supportPublic.status.resolved")}</Button>
                <Link className={buttonVariants()} href="/support/questions/ask">{t("supportPublic.actions.askQuestion")}</Link>
              </div>
            </div>
          </div>
          <div className="mt-4 grid gap-3">
            {questions.length ? questions.map((item) => <QuestionRow key={item.id} item={item} />) : <EmptyState text={t("supportPublic.empty.noQuestionsMatched")} />}
          </div>
        </section>
      </div>
    </SupportShell>
  )
}

export function SupportQuestionDetail() {
  const t = useI18n()
  const params = useParams<{ id: string }>()
  const [question, setQuestion] = useState<SupportQuestion | null>(null)
  const [answers, setAnswers] = useState<SupportAnswer[]>([])
  const [content, setContent] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const reload = () => {
    const id = Number(params.id)
    if (id > 0) {
      void fetchSupportQuestion(id).then((detail) => {
        setQuestion(detail.question)
        setAnswers(detail.answers)
      })
    }
  }

  useEffect(reload, [params.id])

  const submitAnswer = async () => {
    if (!question || submitting) return
    setSubmitting(true)
    try {
      await ensureSupportLogin()
      await createSupportAnswer({ questionId: question.id, content })
      setContent("")
      toast.success(t("supportPublic.toast.answerCreated"))
      reload()
    } finally {
      setSubmitting(false)
    }
  }

  if (!question) {
    return <SupportShell section="questions" title={t("supportPublic.questions.detailTitle")} description={t("supportPublic.loading.question")} />
  }

  return (
    <SupportShell section="questions" title={question.title} description={`${question.categoryName || t("supportPublic.common.uncategorized")} · ${question.userName || t("supportPublic.common.user")}`}>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
        <section className="min-w-0 space-y-4">
          <Card className="rounded-2xl border-border bg-card shadow-sm">
            <CardContent className="p-5">
              <div className="whitespace-pre-wrap text-sm leading-7">{question.content}</div>
              <div className="mt-5 flex flex-wrap items-center gap-2">
                <QuestionStatusBadge status={question.status} />
                <Button variant="outline" size="sm" onClick={() => void ensureSupportLogin().then(() => voteSupportQuestion(question.id)).then(reload)}>
                  <ThumbsUpIcon /> {question.voteCount}
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-3">
            {answers.length ? answers.map((answer) => (
              <AnswerCard key={answer.id} answer={answer} questionId={question.id} onChanged={reload} />
            )) : <EmptyState text={t("supportPublic.empty.noAnswers")} />}
          </div>

          <Card className="rounded-2xl border-border bg-card shadow-sm">
            <CardContent className="p-5">
              <h2 className="font-semibold">{t("supportPublic.answer.title")}</h2>
              <Textarea value={content} onChange={(event) => setContent(event.target.value)} rows={6} placeholder={t("supportPublic.answer.placeholder")} className="mt-3 bg-card" />
              <Button className="mt-3" disabled={submitting || !content.trim()} onClick={() => void submitAnswer()}>
                {submitting ? t("supportPublic.actions.publishing") : t("supportPublic.actions.publishAnswer")}
              </Button>
            </CardContent>
          </Card>
        </section>

        <aside className="space-y-3">
          <InfoCard label={t("supportPublic.questions.answers")} value={String(question.answerCount)} />
          <InfoCard label={t("supportPublic.questions.votes")} value={String(question.voteCount)} />
          <InfoCard label={t("supportPublic.questions.views")} value={String(question.viewCount)} />
        </aside>
      </div>
    </SupportShell>
  )
}

export function SupportAskQuestion() {
  const t = useI18n()
  const router = useRouter()
  const [categories, setCategories] = useState<SupportCategory[]>([])
  const [categoryId, setCategoryId] = useState(0)
  const [title, setTitle] = useState("")
  const [content, setContent] = useState("")
  const [tags, setTags] = useState("")
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    void fetchSupportQuestionCategories().then((items) => {
      setCategories(items)
      setCategoryId(items[0]?.id ?? 0)
    })
  }, [])

  const submit = async () => {
    if (submitting) return
    setSubmitting(true)
    try {
      await ensureSupportLogin()
      const question = await createSupportQuestion({
        categoryId,
        title,
        content,
        tags: tags.split(",").map((item) => item.trim()).filter(Boolean),
      })
      toast.success(t("supportPublic.toast.questionCreated"))
      router.push(`/support/questions/${question.id}`)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <SupportShell section="ask" title={t("supportPublic.ask.title")} description={t("supportPublic.ask.description")}>
      <div className="mx-auto max-w-3xl rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
        <div className="grid gap-4">
          <LabeledField label={t("supportPublic.ask.category")}>
            <OptionCombobox
              value={String(categoryId || "")}
              onChange={(value) => setCategoryId(Number(value))}
              options={categories.map((item) => ({ value: String(item.id), label: item.name }))}
              placeholder={t("supportPublic.ask.categoryPlaceholder")}
              searchPlaceholder={t("supportPublic.ask.categorySearch")}
              emptyText={t("supportPublic.ask.categoryEmpty")}
            />
          </LabeledField>
          <LabeledField label={t("supportPublic.ask.questionTitle")}>
            <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder={t("supportPublic.ask.questionTitlePlaceholder")} className="bg-card" />
          </LabeledField>
          <LabeledField label={t("supportPublic.ask.content")}>
            <Textarea value={content} onChange={(event) => setContent(event.target.value)} rows={9} placeholder={t("supportPublic.ask.contentPlaceholder")} className="bg-card" />
          </LabeledField>
          <LabeledField label={t("supportPublic.ask.tags")}>
            <Input value={tags} onChange={(event) => setTags(event.target.value)} placeholder={t("supportPublic.ask.tagsPlaceholder")} className="bg-card" />
          </LabeledField>
          <div className="flex justify-end">
            <Button disabled={submitting || !title.trim() || !content.trim()} onClick={() => void submit()}>
              {submitting ? t("supportPublic.actions.publishing") : t("supportPublic.actions.publishQuestion")}
            </Button>
          </div>
        </div>
      </div>
    </SupportShell>
  )
}

export function SupportLoginPage() {
  const t = useI18n()
  const router = useRouter()
  const [mode, setMode] = useState<"login" | "register">("login")
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const submit = async () => {
    if (submitting) return
    setSubmitting(true)
    try {
      await (mode === "login"
        ? loginSupportCustomer({ email, password })
        : registerSupportCustomer({ name, email, password }))
      toast.success(t("supportPublic.toast.loggedIn"))
      router.push("/support/questions")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <SupportShell section="login" title={t("supportPublic.login.title")} description={t("supportPublic.login.description")}>
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
    </SupportShell>
  )
}

function SupportShell({ section, title, description, children }: { section: "questions" | "ask" | "login"; title: string; description: string; children?: ReactNode }) {
  return (
    <SupportPageShell section={section}>
      <SupportPageContent className="py-10 sm:py-12">
        <div className="mb-7">
          <p className="text-sm font-medium text-primary">{title}</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
          {description ? <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground sm:text-base">{description}</p> : null}
        </div>
        {children}
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
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/support/help" className="hover:text-foreground">{t("supportPublic.help.title")}</Link>
        <ChevronRightIcon className="size-3.5" />
        <span className="truncate">{page.title}</span>
      </div>
      <h1 className="mt-6 text-balance text-3xl font-bold tracking-tight sm:text-4xl">{page.title}</h1>
      <div className="mt-5 text-xs text-muted-foreground">{t("supportPublic.help.updatedAt", { date: formatDateTime(page.publishedAt || page.updatedAt) })}</div>
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
    <a href={`/support/help/${item.slug || item.id}/`} className="block border-t px-1 py-3 first:border-t-0 hover:bg-muted/60">
      <div className="line-clamp-1 font-medium text-primary">{item.title}</div>
      <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">{item.summary || t("supportPublic.help.openPage")}</p>
    </a>
  )
}

function QuestionRow({ item }: { item: SupportQuestion }) {
  return (
    <Link href={`/support/questions/${item.id}`} className="block border-t px-1 py-3 first:border-t-0 hover:bg-muted/60">
      <div className="flex items-start justify-between gap-3">
        <div className="line-clamp-1 font-medium">{item.title}</div>
        <QuestionStatusBadge status={item.status} />
      </div>
      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{item.content}</p>
      <div className="mt-2 flex gap-3 text-xs text-muted-foreground">
        <span><MessageCircleMoreIcon className="mr-1 inline size-3" />{item.answerCount}</span>
        <span><ThumbsUpIcon className="mr-1 inline size-3" />{item.voteCount}</span>
      </div>
    </Link>
  )
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
  const headings = useMemo(() => contentType === "html"
    ? Array.from(content.matchAll(/<h([23])[^>]*>([\s\S]*?)<\/h\1>/gi)).map((match, index) => {
        const title = match[2].replace(/<[^>]+>/g, "").trim()
        return { level: Number(match[1]), title, id: articleHeadingId(title, index) }
      })
    : Array.from(content.matchAll(/^(#{2,3})\s+(.+)$/gm)).map((match, index) => {
        const title = markdownHeadingText(match[2])
        return { level: match[1].length, title, id: articleHeadingId(title, index) }
      }), [content, contentType])
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

function CategoryRail({ categories, active, onChange }: { categories: SupportCategory[]; active: number | "all"; onChange: (value: number | "all") => void }) {
  const t = useI18n()
  return (
    <aside className="content-start rounded-2xl border bg-card p-3 shadow-sm">
      <Button className="w-full justify-start" variant={active === "all" ? "default" : "ghost"} onClick={() => onChange("all")}>{t("supportPublic.common.allCategories")}</Button>
      <div className="mt-1 grid gap-1">
        {categories.map((item) => (
          <Button className="w-full justify-start" key={item.id} variant={active === item.id ? "default" : "ghost"} onClick={() => onChange(item.id)}>{item.name}</Button>
        ))}
      </div>
    </aside>
  )
}

function AnswerCard({ answer, questionId, onChanged }: { answer: SupportAnswer; questionId: number; onChanged: () => void }) {
  const t = useI18n()
  return (
    <Card className={cn("rounded-2xl border-border bg-card shadow-sm", answer.isBestAnswer && "border-emerald-300 ring-2 ring-emerald-100 dark:border-emerald-700 dark:ring-emerald-950")}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="font-medium">{answer.authorName || t("supportPublic.common.user")}</div>
            <div className="mt-1 text-xs text-muted-foreground">{formatDateTime(answer.createdAt)}</div>
          </div>
          {answer.isBestAnswer && <Badge className="bg-emerald-600 text-white"><CheckCircle2Icon /> {t("supportPublic.answer.best")}</Badge>}
        </div>
        <div className="mt-4 whitespace-pre-wrap text-sm leading-7">{answer.content}</div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => void ensureSupportLogin().then(() => voteSupportAnswer(answer.id)).then(onChanged)}>
            <ThumbsUpIcon /> {answer.voteCount}
          </Button>
          {!answer.isBestAnswer && (
            <Button variant="outline" size="sm" onClick={() => void ensureSupportLogin().then(() => acceptSupportAnswer(questionId, answer.id)).then(onChanged)}>
              {t("supportPublic.actions.accept")}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

async function ensureSupportLogin() {
  if (!readSession()?.accessToken) {
    window.location.href = "/support/login"
    throw new Error("login required")
  }
  await fetchSupportMe()
}
