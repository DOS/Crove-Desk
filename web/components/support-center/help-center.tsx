"use client"

import {
  ArrowRightIcon,
  BookOpenIcon,
  CheckCircle2Icon,
  CircleHelpIcon,
  HeadphonesIcon,
  MessageCircleMoreIcon,
  SearchIcon,
  ThumbsUpIcon,
} from "lucide-react"
import Link from "next/link"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { useEffect, useState, type ReactNode } from "react"
import { toast } from "sonner"

import { OptionCombobox } from "@/components/option-combobox"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  acceptSupportAnswer,
  createSupportAnswer,
  createSupportQuestion,
  fetchSupportArticle,
  fetchSupportArticleCategories,
  fetchSupportArticles,
  fetchSupportMe,
  fetchSupportQuestion,
  fetchSupportQuestionCategories,
  fetchSupportQuestions,
  loginSupportCustomer,
  registerSupportCustomer,
  submitSupportArticleFeedback,
  voteSupportAnswer,
  voteSupportQuestion,
  type SupportAnswer,
  type SupportArticle,
  type SupportCategory,
  type SupportQuestion,
} from "@/lib/api/support"
import { readSession } from "@/lib/auth"
import { cn } from "@/lib/utils"

export function SupportHelpCenter() {
  const [articles, setArticles] = useState<SupportArticle[]>([])
  const [questions, setQuestions] = useState<SupportQuestion[]>([])
  const [query, setQuery] = useState("")

  useEffect(() => {
    void Promise.all([
      fetchSupportArticles({ limit: 6 }),
      fetchSupportQuestions({ limit: 6 }),
    ]).then(([articlePage, questionPage]) => {
      setArticles(articlePage.results)
      setQuestions(questionPage.results)
    }).catch(() => {
      setArticles([])
      setQuestions([])
    })
  }, [])

  return (
    <main className="min-h-svh bg-[#f7f9fc] text-foreground dark:bg-background">
      <SupportHeader />
      <section className="border-y bg-card px-5 py-12 sm:px-8">
        <div className="mx-auto max-w-5xl">
          <Badge variant="secondary">AgentDesk 支持中心</Badge>
          <h1 className="mt-4 max-w-3xl text-3xl font-semibold tracking-tight sm:text-5xl">
            文档、社区问答和在线咨询集中在这里。
          </h1>
          <div className="mt-7 flex max-w-2xl gap-2">
            <div className="relative flex-1">
              <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={query} onChange={(event) => setQuery(event.target.value)} className="pl-9" placeholder="搜索文章或问题" />
            </div>
            <Link className={buttonVariants()} href={`/support/questions${query ? `?title=${encodeURIComponent(query)}` : ""}`}>
              搜索
            </Link>
          </div>
          <div className="mt-8 grid gap-3 md:grid-cols-3">
            <SupportEntryCard href="/support/help" icon={<BookOpenIcon />} title="帮助中心" description="官方指南、部署文档和故障排查。" />
            <SupportEntryCard href="/support/questions" icon={<CircleHelpIcon />} title="FAQ 社区" description="浏览问题、登录后提问和回答。" />
            <SupportEntryCard href="/support/chat" icon={<HeadphonesIcon />} title="在线咨询" description="仍然无法解决时进入客服会话。" />
          </div>
        </div>
      </section>
      <div className="mx-auto grid max-w-5xl gap-8 px-5 py-10 sm:px-8 lg:grid-cols-2">
        <section>
          <SectionTitle title="推荐文章" href="/support/help" />
          <div className="mt-4 grid gap-3">
            {articles.length ? articles.map((item) => <ArticleRow key={item.id} item={item} />) : <EmptyState text="暂无已发布文章" />}
          </div>
        </section>
        <section>
          <SectionTitle title="热门问题" href="/support/questions" />
          <div className="mt-4 grid gap-3">
            {questions.length ? questions.map((item) => <QuestionRow key={item.id} item={item} />) : <EmptyState text="暂无社区问题" />}
          </div>
        </section>
      </div>
    </main>
  )
}

export function SupportHelpList() {
  const [categories, setCategories] = useState<SupportCategory[]>([])
  const [articles, setArticles] = useState<SupportArticle[]>([])
  const [categoryId, setCategoryId] = useState<number | "all">("all")
  const [title, setTitle] = useState("")

  useEffect(() => {
    void fetchSupportArticleCategories().then(setCategories)
  }, [])

  useEffect(() => {
    void fetchSupportArticles({ categoryId: categoryId === "all" ? undefined : categoryId, title, limit: 20 }).then((page) => setArticles(page.results))
  }, [categoryId, title])

  return (
    <SupportShell title="帮助中心" description="查看官方使用指南、部署说明和排障文档。">
      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
        <CategoryRail categories={categories} active={categoryId} onChange={setCategoryId} />
        <div>
          <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="搜索文章标题" />
          <div className="mt-4 grid gap-3">
            {articles.length ? articles.map((item) => <ArticleRow key={item.id} item={item} />) : <EmptyState text="没有找到文章" />}
          </div>
        </div>
      </div>
    </SupportShell>
  )
}

export function SupportArticleDetail() {
  const params = useParams<{ slug: string }>()
  const [article, setArticle] = useState<SupportArticle | null>(null)

  useEffect(() => {
    if (params.slug) {
      void fetchSupportArticle(params.slug).then(setArticle)
    }
  }, [params.slug])

  if (!article) {
    return <SupportShell title="帮助中心" description="正在加载文章..." />
  }

  return (
    <SupportShell title={article.title} description={article.summary || article.categoryName}>
      <article className="rounded-md border bg-card p-6">
        <div className="mb-5 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          {article.categoryName && <Badge variant="outline">{article.categoryName}</Badge>}
          <span>{article.publishedAt || article.updatedAt}</span>
        </div>
        <div className="whitespace-pre-wrap text-sm leading-7">{article.content}</div>
        <div className="mt-8 flex gap-2 border-t pt-5">
          <Button variant="outline" onClick={() => void submitSupportArticleFeedback(article.id, true).then(() => toast.success("感谢反馈"))}>
            <ThumbsUpIcon /> 有帮助
          </Button>
          <Link className={buttonVariants({ variant: "outline" })} href="/support/questions/ask">
            我要提问
          </Link>
        </div>
      </article>
    </SupportShell>
  )
}

export function SupportQuestionList() {
  const searchParams = useSearchParams()
  const [categories, setCategories] = useState<SupportCategory[]>([])
  const [questions, setQuestions] = useState<SupportQuestion[]>([])
  const [categoryId, setCategoryId] = useState<number | "all">("all")
  const [title, setTitle] = useState(searchParams.get("title") || "")
  const [status, setStatus] = useState("all")

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
    <SupportShell title="FAQ 社区" description="登录用户可以提问、回答、点赞并采纳最佳答案。">
      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
        <CategoryRail categories={categories} active={categoryId} onChange={setCategoryId} />
        <div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="搜索问题标题" />
            <div className="flex gap-2">
              <Button variant={status === "all" ? "default" : "outline"} onClick={() => setStatus("all")}>全部</Button>
              <Button variant={status === "normal" ? "default" : "outline"} onClick={() => setStatus("normal")}>未解决</Button>
              <Button variant={status === "resolved" ? "default" : "outline"} onClick={() => setStatus("resolved")}>已解决</Button>
              <Link className={buttonVariants()} href="/support/questions/ask">提问</Link>
            </div>
          </div>
          <div className="mt-4 grid gap-3">
            {questions.length ? questions.map((item) => <QuestionRow key={item.id} item={item} />) : <EmptyState text="没有找到问题" />}
          </div>
        </div>
      </div>
    </SupportShell>
  )
}

export function SupportQuestionDetail() {
  const params = useParams<{ id: string }>()
  const [question, setQuestion] = useState<SupportQuestion | null>(null)
  const [answers, setAnswers] = useState<SupportAnswer[]>([])
  const [content, setContent] = useState("")

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
    if (!question) {
      return
    }
    await ensureSupportLogin()
    await createSupportAnswer({ questionId: question.id, content })
    setContent("")
    toast.success("回答已发布")
    reload()
  }

  if (!question) {
    return <SupportShell title="问题详情" description="正在加载问题..." />
  }

  return (
    <SupportShell title={question.title} description={`${question.categoryName || "未分类"} · ${question.userName || "用户"}`}>
      <div className="grid gap-4">
        <Card>
          <CardContent className="p-5">
            <div className="whitespace-pre-wrap text-sm leading-7">{question.content}</div>
            <div className="mt-5 flex flex-wrap items-center gap-2">
              {question.status === "resolved" && <Badge><CheckCircle2Icon className="size-3" /> 已解决</Badge>}
              <Button variant="outline" size="sm" onClick={() => void ensureSupportLogin().then(() => voteSupportQuestion(question.id)).then(reload)}>
                <ThumbsUpIcon /> {question.voteCount}
              </Button>
            </div>
          </CardContent>
        </Card>
        <div className="grid gap-3">
          {answers.map((answer) => (
            <Card key={answer.id} className={cn(answer.isBestAnswer && "border-emerald-500")}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between text-sm">
                  <span>{answer.authorName || "用户"} · {answer.createdAt}</span>
                  {answer.isBestAnswer && <Badge>最佳答案</Badge>}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="whitespace-pre-wrap text-sm leading-7">{answer.content}</div>
                <div className="mt-4 flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => void ensureSupportLogin().then(() => voteSupportAnswer(answer.id)).then(reload)}>
                    <ThumbsUpIcon /> {answer.voteCount}
                  </Button>
                  {!answer.isBestAnswer && (
                    <Button variant="outline" size="sm" onClick={() => void ensureSupportLogin().then(() => acceptSupportAnswer(question.id, answer.id)).then(reload)}>
                      采纳
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardHeader><CardTitle className="text-base">提交回答</CardTitle></CardHeader>
          <CardContent>
            <Textarea value={content} onChange={(event) => setContent(event.target.value)} rows={6} placeholder="写下你的回答" />
            <Button className="mt-3" onClick={() => void submitAnswer()}>发布回答</Button>
          </CardContent>
        </Card>
      </div>
    </SupportShell>
  )
}

export function SupportAskQuestion() {
  const router = useRouter()
  const [categories, setCategories] = useState<SupportCategory[]>([])
  const [categoryId, setCategoryId] = useState(0)
  const [title, setTitle] = useState("")
  const [content, setContent] = useState("")
  const [tags, setTags] = useState("")

  useEffect(() => {
    void fetchSupportQuestionCategories().then((items) => {
      setCategories(items)
      setCategoryId(items[0]?.id ?? 0)
    })
  }, [])

  const submit = async () => {
    await ensureSupportLogin()
    const question = await createSupportQuestion({
      categoryId,
      title,
      content,
      tags: tags.split(",").map((item) => item.trim()).filter(Boolean),
    })
    toast.success("问题已发布")
    router.push(`/support/questions/${question.id}`)
  }

  return (
    <SupportShell title="提出问题" description="登录后提交问题，社区成员和客服可参与回答。">
      <Card>
        <CardContent className="grid gap-4 p-5">
          <OptionCombobox
            value={String(categoryId || "")}
            onChange={(value) => setCategoryId(Number(value))}
            options={categories.map((item) => ({ value: String(item.id), label: item.name }))}
            placeholder="选择分类"
            searchPlaceholder="搜索分类"
            emptyText="暂无分类"
          />
          <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="问题标题" />
          <Textarea value={content} onChange={(event) => setContent(event.target.value)} rows={9} placeholder="详细描述你的问题、环境和已尝试的排查步骤" />
          <Input value={tags} onChange={(event) => setTags(event.target.value)} placeholder="标签，用英文逗号分隔" />
          <Button onClick={() => void submit()}>发布问题</Button>
        </CardContent>
      </Card>
    </SupportShell>
  )
}

export function SupportLoginPage() {
  const router = useRouter()
  const [mode, setMode] = useState<"login" | "register">("login")
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")

  const submit = async () => {
    await (mode === "login"
      ? await loginSupportCustomer({ email, password })
      : await registerSupportCustomer({ name, email, password }))
    toast.success("已登录")
    router.push("/support/questions")
  }

  return (
    <SupportShell title="登录支持中心" description="登录后可以提问、回答、点赞和采纳最佳答案。">
      <Card className="mx-auto max-w-md">
        <CardContent className="grid gap-4 p-5">
          {mode === "register" && <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="姓名" />}
          <Input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="邮箱" />
          <Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="密码，至少 8 位" />
          <Button onClick={() => void submit()}>{mode === "login" ? "登录" : "注册并登录"}</Button>
          <Button variant="ghost" onClick={() => setMode(mode === "login" ? "register" : "login")}>
            {mode === "login" ? "没有账号，去注册" : "已有账号，去登录"}
          </Button>
        </CardContent>
      </Card>
    </SupportShell>
  )
}

function SupportHeader() {
  return (
    <header className="mx-auto flex h-16 max-w-5xl items-center justify-between px-5 sm:px-8">
      <Link href="/support" className="flex items-center gap-2 font-semibold">
        <span className="grid size-8 place-items-center rounded-md bg-primary text-primary-foreground"><CircleHelpIcon className="size-4" /></span>
        AgentDesk 支持中心
      </Link>
      <nav className="flex items-center gap-1">
        <Link className={buttonVariants({ variant: "ghost" })} href="/support/help">帮助</Link>
        <Link className={buttonVariants({ variant: "ghost" })} href="/support/questions">FAQ</Link>
        <Link className={buttonVariants({ variant: "outline" })} href="/support/login">登录</Link>
      </nav>
    </header>
  )
}

function SupportShell({ title, description, children }: { title: string; description: string; children?: ReactNode }) {
  return (
    <main className="min-h-svh bg-[#f7f9fc] text-foreground dark:bg-background">
      <SupportHeader />
      <div className="mx-auto max-w-5xl px-5 py-8 sm:px-8">
        <div className="mb-7">
          <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{description}</p>
        </div>
        {children}
      </div>
    </main>
  )
}

function SupportEntryCard({ href, icon, title, description }: { href: string; icon: ReactNode; title: string; description: string }) {
  return (
    <Link href={href} className="rounded-md border bg-background p-5 transition-colors hover:bg-muted/60">
      <div className="grid size-10 place-items-center rounded-md bg-primary/10 text-primary">{icon}</div>
      <div className="mt-4 font-medium">{title}</div>
      <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>
    </Link>
  )
}

function SectionTitle({ title, href }: { title: string; href: string }) {
  return (
    <div className="flex items-center justify-between">
      <h2 className="text-xl font-semibold">{title}</h2>
      <Link className={buttonVariants({ variant: "ghost" })} href={href}>查看全部 <ArrowRightIcon /></Link>
    </div>
  )
}

function ArticleRow({ item }: { item: SupportArticle }) {
  return (
    <Link href={`/support/help/${item.slug || item.id}`} className="rounded-md border bg-card p-4 transition-colors hover:bg-muted/60">
      <div className="font-medium">{item.title}</div>
      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{item.summary || item.categoryName}</p>
    </Link>
  )
}

function QuestionRow({ item }: { item: SupportQuestion }) {
  return (
    <Link href={`/support/questions/${item.id}`} className="rounded-md border bg-card p-4 transition-colors hover:bg-muted/60">
      <div className="flex items-start justify-between gap-3">
        <div className="font-medium">{item.title}</div>
        {item.status === "resolved" && <Badge variant="secondary">已解决</Badge>}
      </div>
      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{item.content}</p>
      <div className="mt-3 flex gap-3 text-xs text-muted-foreground">
        <span><MessageCircleMoreIcon className="mr-1 inline size-3" />{item.answerCount}</span>
        <span><ThumbsUpIcon className="mr-1 inline size-3" />{item.voteCount}</span>
      </div>
    </Link>
  )
}

function CategoryRail({ categories, active, onChange }: { categories: SupportCategory[]; active: number | "all"; onChange: (value: number | "all") => void }) {
  return (
    <aside className="grid content-start gap-2">
      <Button variant={active === "all" ? "default" : "outline"} onClick={() => onChange("all")}>全部分类</Button>
      {categories.map((item) => (
        <Button key={item.id} variant={active === item.id ? "default" : "outline"} onClick={() => onChange(item.id)}>{item.name}</Button>
      ))}
    </aside>
  )
}

function EmptyState({ text }: { text: string }) {
  return <div className="rounded-md border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">{text}</div>
}

async function ensureSupportLogin() {
  if (!readSession()?.accessToken) {
    window.location.href = "/support/login"
    throw new Error("login required")
  }
  await fetchSupportMe()
}
