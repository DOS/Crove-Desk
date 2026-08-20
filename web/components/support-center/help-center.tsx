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
  HomeIcon,
  MenuIcon,
  MessageCircleMoreIcon,
  SearchIcon,
  ThumbsDownIcon,
  ThumbsUpIcon,
  XIcon,
} from "lucide-react"
import { MdPreview } from "md-editor-rt"
import Link from "next/link"
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation"
import { useTheme } from "next-themes"
import { useEffect, useMemo, useState, type ReactNode } from "react"
import { toast } from "sonner"

import { OptionCombobox } from "@/components/option-combobox"
import { useImageLightboxOptional } from "@/components/image-lightbox"
import { SafeRichHTML } from "@/components/safe-rich-html"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useI18n } from "@/i18n/provider"
import {
  acceptSupportAnswer,
  createSupportAnswer,
  createSupportQuestion,
  fetchSupportHelpPage,
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
import { cn, formatDateTime } from "@/lib/utils"

const pageBackground =
  "bg-[#f7f9fc] dark:bg-background"

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
    <SupportFrame>
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

      <div className="mx-auto max-w-[var(--support-shell-max-width)] px-5 py-10 sm:px-6 sm:py-14 md:px-8 lg:px-10">
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
      </div>
    </SupportFrame>
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
  const { resolvedTheme } = useTheme()
  const pathname = usePathname()
  const [page, setPage] = useState<SupportHelpPage | null>(null)
  const [pages, setPages] = useState<SupportHelpPage[]>([])
  const [query, setQuery] = useState("")
  const [searchResults, setSearchResults] = useState<SupportHelpPage[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [navigationOpen, setNavigationOpen] = useState(false)
  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  const slug = useMemo(() => {
    const parts = pathname.split("/").filter(Boolean)
    const helpIndex = parts.findIndex((part, index) => part === "help" && parts[index - 1] === "support")
    return helpIndex >= 0 ? decodeURIComponent(parts[helpIndex + 1] || "") : ""
  }, [pathname])

  useEffect(() => {
    void fetchSupportHelpPages({ limit: 500 })
      .then(async (list) => {
        setFailed(false)
        setPages(list.results)
        const target = slug || list.results[0]?.slug || String(list.results[0]?.id || "")
        if (!target) {
          setPage(null)
          setExpanded(new Set())
          return
        }
        const detail = await fetchSupportHelpPage(target)
        setPage(detail)
        setExpanded(new Set([...helpPageAncestorIds(list.results, detail.id), detail.id]))
        if (!slug && detail.slug) {
          window.history.replaceState(null, "", `/support/help/${detail.slug}/`)
        }
      })
      .catch(() => {
        setPage(null)
        setFailed(true)
      })
      .finally(() => setLoading(false))
  }, [slug])

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
      navigation={<HelpNavigation pages={visiblePages} rootPages={visiblePages.filter((item) => !item.parentId)} searchResults={searchResults} title={query} expanded={expanded} selectedPageId={page?.id ?? 0} loading={loading || searchLoading} failed={failed} onTitleChange={(value) => { setQuery(value); setSearchResults([]); setSearchLoading(Boolean(value.trim())) }} onExpandedChange={setExpanded} onSelect={() => setNavigationOpen(false)} linkMode />}
      toc={<PublicArticleToc content={page?.content ?? ""} contentType={page?.contentType} />}
    >
      {page ? <HelpArticle page={page} pages={pages} previewId="support-help-page-detail-preview" theme={resolvedTheme} /> : <div className="grid min-h-[60svh] place-items-center"><EmptyState text={loading ? t("supportPublic.loading.page") : failed ? t("supportPublic.empty.pageNotFound") : t("supportPublic.empty.noPages")} /></div>}
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
    <SupportShell title={t("supportPublic.questions.title")} description={t("supportPublic.questions.description")}>
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
    return <SupportShell title={t("supportPublic.questions.detailTitle")} description={t("supportPublic.loading.question")} />
  }

  return (
    <SupportShell title={question.title} description={`${question.categoryName || t("supportPublic.common.uncategorized")} · ${question.userName || t("supportPublic.common.user")}`}>
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
    <SupportShell title={t("supportPublic.ask.title")} description={t("supportPublic.ask.description")}>
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
    <SupportShell title={t("supportPublic.login.title")} description={t("supportPublic.login.description")}>
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

function SupportFrame({ children }: { children: ReactNode }) {
  return (
    <main className={cn("min-h-svh overflow-hidden text-foreground", pageBackground)}>
      <SupportHeader />
      {children}
    </main>
  )
}

function SupportShell({ title, description, children }: { title: string; description: string; children?: ReactNode }) {
  return (
    <SupportFrame>
      <div className="mx-auto max-w-[var(--support-shell-max-width)] px-5 py-10 sm:px-6 sm:py-12 md:px-8 lg:px-10">
        <div className="mb-7">
          <p className="text-sm font-medium text-primary">{title}</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
          {description ? <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground sm:text-base">{description}</p> : null}
        </div>
        {children}
      </div>
    </SupportFrame>
  )
}

function SupportHeader() {
  const t = useI18n()
  return (
    <header className="mx-auto flex h-16 max-w-[var(--support-shell-max-width)] items-center justify-between px-5 sm:px-6 md:px-8 lg:px-10">
      <Link href="/support" className="flex items-center gap-2.5 font-semibold tracking-tight">
        <span className="grid size-8 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm">
          <CircleHelpIcon className="size-[18px]" />
        </span>
        <span>
          AgentDesk <span className="font-normal text-muted-foreground">{t("supportPublic.home.badge")}</span>
        </span>
      </Link>
      <nav className="flex items-center gap-1 sm:gap-2">
        <Link className={cn(buttonVariants({ variant: "ghost" }), "hidden sm:inline-flex")} href="/support/help">{t("supportPublic.nav.help")}</Link>
        <Link className={cn(buttonVariants({ variant: "ghost" }), "hidden sm:inline-flex")} href="/support/questions">{t("supportPublic.nav.questions")}</Link>
        <Link className={buttonVariants({ variant: "outline" })} href="/support/login">
          <HeadphonesIcon />
          <span>{t("supportPublic.nav.login")}</span>
        </Link>
      </nav>
    </header>
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
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex h-14 max-w-[var(--support-docs-max-width)] items-center gap-3 px-4 sm:px-6 md:px-8 xl:px-6">
          {navigation ? (
            <Button variant="ghost" size="icon" className="xl:hidden" onClick={() => onNavigationOpenChange(true)} aria-label={t("supportPublic.a11y.openNavigation")}>
              <MenuIcon />
            </Button>
          ) : null}
          <Link href="/support" className="flex shrink-0 items-center gap-2 font-semibold tracking-tight">
            <span className="grid size-7 place-items-center rounded-lg bg-primary text-primary-foreground"><BookOpenIcon className="size-4" /></span>
            <span>AgentDesk</span>
            <span className="hidden border-l pl-2 font-normal text-muted-foreground sm:inline">{t("supportPublic.help.title")}</span>
          </Link>
          <nav className="ml-auto flex items-center gap-1">
            <Link className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "hidden sm:inline-flex")} href="/support"><HomeIcon />{t("supportPublic.nav.home")}</Link>
            <Link className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "hidden sm:inline-flex")} href="/support/questions">{t("supportPublic.nav.questions")}</Link>
            <Link className={buttonVariants({ variant: "outline", size: "sm" })} href="/support/questions/ask">{t("supportPublic.actions.askQuestion")}</Link>
          </nav>
        </div>
      </header>

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
  onSelect,
  linkMode = false,
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
  onSelect: (item: SupportHelpPage) => void
  linkMode?: boolean
}) {
  const t = useI18n()
  return (
    <div className="p-4">
      <SupportSearchInput value={title} onChange={onTitleChange} placeholder={t("supportPublic.help.searchPlaceholder")} compact />
      <div className="mt-4 grid gap-0.5">
        {title.trim() ? searchResults.map((page) => (
          <a key={page.id} href={`/support/help/${page.slug || page.id}/`} onClick={() => onSelect(page)} className={cn("rounded-lg px-2.5 py-2 text-sm transition-colors hover:bg-muted", selectedPageId === page.id && "bg-primary/10 text-primary")}>
            <span className="block truncate font-medium">{page.title}</span>
            {page.summary ? <span className="mt-1 block line-clamp-2 text-xs leading-5 text-muted-foreground">{page.summary}</span> : null}
          </a>
        )) : rootPages.map((page) => (
          <PublicHelpPageNode key={page.id} page={page} depth={0} pages={pages} expanded={expanded} selectedPageId={selectedPageId} onToggle={(id) => {
            const next = new Set(expanded)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            onExpandedChange(next)
          }} onSelect={onSelect} linkMode={linkMode} />
        ))}
        {loading ? <div className="px-2 py-8 text-center text-sm text-muted-foreground">{t("supportPublic.loading.navigation")}</div> : null}
        {!loading && (title.trim() ? !searchResults.length : !pages.length) ? <EmptyState text={failed ? t("supportPublic.empty.pagesFailed") : t("supportPublic.empty.noPagesMatched")} compact /> : null}
      </div>
    </div>
  )
}

function HelpArticle({ page, pages, previewId, theme }: { page: SupportHelpPage; pages: SupportHelpPage[]; previewId: string; theme?: string }) {
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
      button.className = "absolute right-2 top-2 rounded-md border border-border bg-background/90 px-2 py-1 text-xs text-muted-foreground opacity-0 shadow-sm transition-opacity group-hover:opacity-100 focus:opacity-100"
      button.textContent = t("supportPublic.help.copyCode")
      button.setAttribute("aria-label", t("supportPublic.help.copyCode"))
      const copy = () => void navigator.clipboard.writeText(block.querySelector("code")?.textContent || block.textContent || "").then(() => toast.success(t("supportPublic.toast.codeCopied")))
      button.addEventListener("click", copy)
      block.appendChild(button)
      cleanup.push(() => { button.removeEventListener("click", copy); button.remove() })
    })
    container.querySelectorAll<HTMLImageElement>("img").forEach((image) => {
      if (!lightbox) return
      image.classList.add("cursor-zoom-in")
      const open = () => lightbox.open(image.currentSrc || image.src, image.alt)
      image.addEventListener("click", open)
      cleanup.push(() => image.removeEventListener("click", open))
    })
    return () => cleanup.forEach((dispose) => dispose())
  }, [lightbox, page.content, previewId, t])
  return (
    <article className="mx-auto max-w-[var(--support-article-width)]">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/support/help" className="hover:text-foreground">{t("supportPublic.help.title")}</Link>
        <ChevronRightIcon className="size-3.5" />
        <span className="truncate">{page.title}</span>
      </div>
      <h1 className="mt-6 text-balance text-3xl font-bold tracking-tight sm:text-4xl">{page.title}</h1>
      <div className="mt-5 text-xs text-muted-foreground">{t("supportPublic.help.updatedAt", { date: formatDateTime(page.publishedAt || page.updatedAt) })}</div>
      <div className="support-markdown">
        {page.contentType === "html" ? <div id={previewId}><SafeRichHTML html={page.content} className="support-rich-html text-base leading-8" /></div> : <MdPreview id={previewId} modelValue={page.content} theme={theme === "dark" ? "dark" : "light"} noMermaid noKatex noHighlight />}
      </div>
      <ChildPageLinks pages={pages.filter((item) => item.parentId === page.id)} />
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
        {previousPage ? <ArticlePager page={previousPage} direction="previous" /> : <span />}
        {nextPage ? <ArticlePager page={nextPage} direction="next" /> : null}
      </nav> : null}
    </article>
  )
}

function ArticlePager({ page, direction }: { page: SupportHelpPage; direction: "previous" | "next" }) {
  const t = useI18n()
  return <a href={`/support/help/${page.slug || page.id}/`} className={cn("group rounded-xl border px-4 py-3 transition-colors hover:border-primary/40 hover:bg-muted/50", direction === "next" && "text-right")}>
    <span className="text-xs text-muted-foreground">{t(`supportPublic.help.${direction}`)}</span>
    <span className="mt-1 flex items-center justify-between gap-3 text-sm font-medium text-primary">{direction === "previous" ? <ChevronRightIcon className="size-4 rotate-180" /> : null}<span className={cn("truncate", direction === "next" && "ml-auto")}>{page.title}</span>{direction === "next" ? <ChevronRightIcon className="size-4" /> : null}</span>
  </a>
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
  onSelect,
  linkMode = false,
}: {
  page: SupportHelpPage
  depth: number
  pages: SupportHelpPage[]
  expanded: Set<number>
  selectedPageId: number
  onToggle: (id: number) => void
  onSelect: (item: SupportHelpPage) => void
  linkMode?: boolean
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
        {linkMode ? (
          <a href={`/support/help/${page.slug || page.id}/`} className="flex min-w-0 flex-1 items-center gap-2 py-1.5 text-left" onClick={() => onSelect(page)} aria-current={selected ? "page" : undefined}>
            {hasChildren ? (open ? <FolderOpenIcon className="size-4 shrink-0" /> : <FolderIcon className="size-4 shrink-0" />) : <FileTextIcon className="size-3.5 shrink-0 opacity-70" />}
            <span className="truncate">{page.title}</span>
          </a>
        ) : (
          <button type="button" className="flex min-w-0 flex-1 items-center gap-2 py-1.5 text-left" onClick={() => onSelect(page)} aria-current={selected ? "page" : undefined}>
            {hasChildren ? (open ? <FolderOpenIcon className="size-4 shrink-0" /> : <FolderIcon className="size-4 shrink-0" />) : <FileTextIcon className="size-3.5 shrink-0 opacity-70" />}
            <span className="truncate">{page.title}</span>
          </button>
        )}
      </div>
      {open && hasChildren ? (
        <div className="relative before:absolute before:inset-y-1 before:w-px before:bg-border/80" style={{ marginLeft: `${depth * 16 + 17}px` }}>
          <div style={{ marginLeft: `${-(depth * 16 + 17)}px` }}>
            {children.map((child) => (
              <PublicHelpPageNode key={child.id} page={child} depth={depth + 1} pages={pages} expanded={expanded} selectedPageId={selectedPageId} onToggle={onToggle} onSelect={onSelect} linkMode={linkMode} />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}

function helpPageAncestorIds(pages: SupportHelpPage[], pageId: number) {
  const ancestors: number[] = []
  const pagesById = new Map(pages.map((item) => [item.id, item]))
  const visited = new Set<number>()
  let parentId = pagesById.get(pageId)?.parentId ?? 0
  while (parentId && !visited.has(parentId)) {
    ancestors.push(parentId)
    visited.add(parentId)
    parentId = pagesById.get(parentId)?.parentId ?? 0
  }
  return ancestors
}

function ChildPageLinks({ pages }: { pages: SupportHelpPage[] }) {
  const t = useI18n()
  if (!pages.length) return null
  return (
    <div className="mt-8 border-t pt-5">
      <h3 className="mb-3 font-semibold">{t("supportPublic.help.childPages")}</h3>
      <div className="grid gap-2 sm:grid-cols-2">
        {pages.map((page) => (
          <a key={page.id} href={`/support/help/${page.slug || page.id}/`} className="rounded-xl border p-3 transition hover:bg-muted/60">
            <span className="font-medium">{page.title}</span>
            {page.summary ? <span className="mt-1 block text-sm text-muted-foreground">{page.summary}</span> : null}
          </a>
        ))}
      </div>
    </div>
  )
}

function PublicArticleToc({ content, contentType = "markdown" }: { content: string; contentType?: string }) {
  const t = useI18n()
  const headings = contentType === "html"
    ? Array.from(content.matchAll(/<h([23])[^>]*>([\s\S]*?)<\/h\1>/gi)).map((match, index) => {
        const title = match[2].replace(/<[^>]+>/g, "").trim()
        return { level: Number(match[1]), title, id: articleHeadingId(title, index) }
      })
    : Array.from(content.matchAll(/^(#{2,3})\s+(.+)$/gm)).map((match, index) => {
        const title = match[2].replace(/[*_`]/g, "")
        return { level: match[1].length, title, id: articleHeadingId(title, index) }
      })
  return (
    <aside className="sticky top-14 max-h-[calc(100svh-3.5rem)] overflow-y-auto px-5 py-12">
      <div>
        <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("supportPublic.help.toc")}</div>
        {headings.length ? headings.map((item, index) => (
          <a key={`${item.title}-${index}`} href={`#${item.id}`} className={cn("block border-l py-1.5 pl-3 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-foreground", item.level === 3 && "pl-6")}>
            <span className="line-clamp-3">{item.title}</span>
          </a>
        )) : <div className="text-sm text-muted-foreground">{t("supportPublic.help.noToc")}</div>}
      </div>
    </aside>
  )
}

function articleHeadingId(title: string, index: number) {
  const normalized = title.trim().toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "")
  return `section-${index + 1}-${normalized || "heading"}`
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

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border bg-card p-4 shadow-sm">
      <div className="text-2xl font-semibold">{value}</div>
      <div className="mt-1 text-sm text-muted-foreground">{label}</div>
    </div>
  )
}

function QuestionStatusBadge({ status }: { status: string }) {
  const t = useI18n()
  if (status === "resolved") {
    return <Badge className="bg-emerald-600 text-white"><CheckCircle2Icon /> {t("supportPublic.status.resolved")}</Badge>
  }
  if (status === "closed") {
    return <Badge variant="outline">{t("supportPublic.status.closed")}</Badge>
  }
  return <Badge variant="secondary">{t("supportPublic.status.normal")}</Badge>
}

function SupportSearchInput({
  value,
  onChange,
  placeholder,
  compact = false,
  hero = false,
}: {
  value: string
  onChange: (value: string) => void
  placeholder: string
  compact?: boolean
  hero?: boolean
}) {
  return (
    <div className="relative flex-1">
      <SearchIcon className={cn("pointer-events-none absolute top-1/2 -translate-y-1/2 text-muted-foreground", hero ? "left-4 size-5" : "left-3 size-4")} />
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={cn(
          "bg-card",
          hero && "h-13 rounded-2xl border-white bg-white pl-12 pr-4 text-base shadow-[0_12px_30px_rgba(36,117,252,.12)] focus-visible:ring-primary/25 dark:border-border dark:bg-card",
          compact && "h-9 pl-9",
          !hero && !compact && "h-11 pl-9"
        )}
        placeholder={placeholder}
      />
    </div>
  )
}

function LabeledField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-2">
      <span className="text-sm font-medium">{label}</span>
      {children}
    </label>
  )
}

function EmptyState({ text, compact = false }: { text: string; compact?: boolean }) {
  return (
    <div className={cn("rounded-2xl border border-dashed bg-card p-8 text-center text-sm text-muted-foreground", compact && "border-0 p-5")}>
      {text}
    </div>
  )
}

async function ensureSupportLogin() {
  if (!readSession()?.accessToken) {
    window.location.href = "/support/login"
    throw new Error("login required")
  }
  await fetchSupportMe()
}
