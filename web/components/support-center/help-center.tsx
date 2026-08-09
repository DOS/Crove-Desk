"use client"

import {
  ArrowRightIcon,
  BookOpenIcon,
  BotIcon,
  ChevronDownIcon,
  CircleHelpIcon,
  FileTextIcon,
  HeadphonesIcon,
  LightbulbIcon,
  MessageCircleMoreIcon,
  SearchIcon,
  SparklesIcon,
  TicketCheckIcon,
  WrenchIcon,
  type LucideIcon,
} from "lucide-react"
import { useMemo, useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

type Category = {
  id: string
  title: string
  description: string
  icon: LucideIcon
  accent: string
  articles: number
}

type Article = {
  title: string
  description: string
  category: string
  readTime: string
}

type Question = {
  question: string
  answer: string
  category: string
}

const categories: Category[] = [
  { id: "getting-started", title: "快速开始", description: "部署、登录和首次配置", icon: SparklesIcon, accent: "bg-sky-500/10 text-sky-600 dark:text-sky-400", articles: 8 },
  { id: "ai", title: "AI 与模型配置", description: "模型、AI Agent 与工作流", icon: BotIcon, accent: "bg-violet-500/10 text-violet-600 dark:text-violet-400", articles: 12 },
  { id: "knowledge", title: "知识库与检索", description: "FAQ、文档与回答质量", icon: BookOpenIcon, accent: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400", articles: 10 },
  { id: "conversation", title: "会话与工单", description: "转人工、分配与问题闭环", icon: TicketCheckIcon, accent: "bg-amber-500/10 text-amber-600 dark:text-amber-400", articles: 9 },
  { id: "integration", title: "渠道接入", description: "Web Widget 与第三方渠道", icon: MessageCircleMoreIcon, accent: "bg-rose-500/10 text-rose-600 dark:text-rose-400", articles: 11 },
  { id: "troubleshooting", title: "故障排查", description: "定位常见配置与运行问题", icon: WrenchIcon, accent: "bg-slate-500/10 text-slate-600 dark:text-slate-400", articles: 14 },
]

const articles: Article[] = [
  { title: "用 Docker Compose 在 10 分钟内启动 AgentDesk", description: "了解启动依赖、管理后台入口和首次检查项。", category: "getting-started", readTime: "5 分钟" },
  { title: "如何配置第一个 AI Agent", description: "连接模型、知识库和转人工策略，完成一条可运行的服务流程。", category: "ai", readTime: "6 分钟" },
  { title: "FAQ 知识库和文档知识库有什么区别？", description: "按内容形态选择更适合的知识沉淀方式。", category: "knowledge", readTime: "4 分钟" },
  { title: "将 Web Widget 嵌入你的网站", description: "创建 Web 渠道、复制嵌入代码并完成上线前验证。", category: "integration", readTime: "7 分钟" },
  { title: "用户请求人工客服后会发生什么？", description: "理解接入池、客服状态、分配规则和上下文交接。", category: "conversation", readTime: "4 分钟" },
  { title: "Widget 能打开但不能发送消息怎么办？", description: "从渠道状态、域名配置和浏览器网络逐项排查。", category: "troubleshooting", readTime: "6 分钟" },
]

const questions: Question[] = [
  { question: "AgentDesk 适合哪些业务场景？", answer: "它适合希望把 AI 首次响应、知识库检索、人工接管和工单跟进连接起来的客服与服务团队。", category: "getting-started" },
  { question: "聊天模型可用，但知识库为什么没有命中？", answer: "通常需要检查 Embedding 模型、索引状态、检索阈值，以及 AI Agent 是否已绑定正确的知识库。", category: "knowledge" },
  { question: "如何把会话转给人工客服？", answer: "AI 或客服可以发起转人工；系统会依据服务时间、客服状态、团队和分配规则处理接入。", category: "conversation" },
  { question: "嵌入 Widget 时，channelId 是做什么的？", answer: "它标识一个具体 Web 渠道，并决定客户会话使用的渠道配置、品牌信息和身份校验策略。", category: "integration" },
]

export function SupportHelpCenter() {
  const [query, setQuery] = useState("")
  const [activeCategory, setActiveCategory] = useState("all")
  const [openQuestion, setOpenQuestion] = useState(0)

  const normalizedQuery = query.trim().toLocaleLowerCase()
  const matches = useMemo(() => {
    const matchesCategory = (category: string) => activeCategory === "all" || category === activeCategory
    return {
      articles: articles.filter((article) => matchesCategory(article.category) && `${article.title} ${article.description}`.toLocaleLowerCase().includes(normalizedQuery)),
      questions: questions.filter((question) => matchesCategory(question.category) && `${question.question} ${question.answer}`.toLocaleLowerCase().includes(normalizedQuery)),
    }
  }, [activeCategory, normalizedQuery])

  const isFiltering = activeCategory !== "all" || normalizedQuery.length > 0

  return (
    <main className="min-h-svh overflow-hidden bg-[#f7f9fc] text-foreground dark:bg-background">
      <header className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8">
        <a href="/support" className="flex items-center gap-2.5 font-semibold tracking-tight">
          <span className="grid size-8 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm"><CircleHelpIcon className="size-[18px]" /></span>
          <span>AgentDesk <span className="font-normal text-muted-foreground">帮助中心</span></span>
        </a>
        <div className="flex items-center gap-1 sm:gap-2">
          <Button variant="ghost" className="hidden sm:inline-flex" onClick={() => document.getElementById("popular-questions")?.scrollIntoView({ behavior: "smooth" })}>常见问题</Button>
          <Button variant="outline" onClick={() => document.getElementById("contact-support")?.scrollIntoView({ behavior: "smooth" })}><HeadphonesIcon /> 联系支持</Button>
        </div>
      </header>

      <section className="relative border-y border-sky-100 bg-[radial-gradient(circle_at_50%_-30%,#ddecff,transparent_55%)] px-5 py-15 sm:px-8 sm:py-20 dark:border-border dark:bg-[radial-gradient(circle_at_50%_-30%,rgba(36,117,252,.26),transparent_55%)]">
        <div className="relative mx-auto max-w-3xl text-center">
          <Badge variant="secondary" className="mb-5 bg-white/70 px-3 py-1 text-primary shadow-sm dark:bg-card/80">产品使用与接入指南</Badge>
          <h1 className="text-balance text-3xl font-semibold tracking-tight sm:text-5xl">今天想解决什么问题？</h1>
          <p className="mx-auto mt-4 max-w-xl text-pretty text-sm leading-6 text-muted-foreground sm:text-base">从快速部署到 AI 配置、渠道接入和故障排查，帮你更快用好 AgentDesk。</p>
          <div className="relative mx-auto mt-8 max-w-2xl">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索问题，例如：如何接入 Web Widget？" className="h-13 rounded-2xl border-white bg-white pl-12 pr-4 text-base shadow-[0_12px_30px_rgba(36,117,252,.12)] focus-visible:ring-primary/25 dark:border-border dark:bg-card" />
          </div>
          <div className="mt-4 flex flex-wrap justify-center gap-x-3 gap-y-1 text-xs text-muted-foreground"><span>热门搜索：</span><button className="hover:text-primary" onClick={() => setQuery("部署")}>部署</button><button className="hover:text-primary" onClick={() => setQuery("知识库")}>知识库</button><button className="hover:text-primary" onClick={() => setQuery("Widget")}>Web Widget</button></div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
        <section aria-labelledby="category-title">
          <div className="mb-5 flex items-end justify-between gap-4"><div><p className="text-sm font-medium text-primary">按任务浏览</p><h2 id="category-title" className="mt-1 text-2xl font-semibold tracking-tight">找到对应的使用指南</h2></div><span className="hidden text-sm text-muted-foreground sm:block">6 个主题 · 64 篇指南</span></div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {categories.map((category) => { const Icon = category.icon; const active = activeCategory === category.id; return <button key={category.id} type="button" onClick={() => setActiveCategory(active ? "all" : category.id)} className={cn("group rounded-2xl border bg-card p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-3 focus-visible:ring-ring/50", active ? "border-primary ring-2 ring-primary/15" : "border-border")}><div className="flex items-start justify-between gap-4"><span className={cn("grid size-10 place-items-center rounded-xl", category.accent)}><Icon className="size-5" /></span><ArrowRightIcon className={cn("mt-1 size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5", active && "text-primary")} /></div><h3 className="mt-5 font-medium">{category.title}</h3><p className="mt-1 text-sm text-muted-foreground">{category.description}</p><p className="mt-4 text-xs font-medium text-muted-foreground">{category.articles} 篇指南</p></button> })}
          </div>
        </section>

        <section className="mt-14" aria-labelledby="article-title">
          <div className="mb-5 flex items-end justify-between gap-4"><div><p className="text-sm font-medium text-primary">推荐阅读</p><h2 id="article-title" className="mt-1 text-2xl font-semibold tracking-tight">{isFiltering ? "搜索结果" : "从这里开始"}</h2></div>{isFiltering && <Button variant="ghost" size="sm" onClick={() => { setQuery(""); setActiveCategory("all") }}>清除筛选</Button>}</div>
          {matches.articles.length ? <div className="grid gap-3 lg:grid-cols-2">{matches.articles.map((article) => <Card key={article.title} className="gap-0 border border-border py-0 shadow-none transition-shadow hover:shadow-md"><CardContent className="flex items-center gap-4 p-5"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-muted text-muted-foreground"><FileTextIcon className="size-5" /></span><div className="min-w-0 flex-1"><h3 className="font-medium">{article.title}</h3><p className="mt-1 line-clamp-1 text-sm text-muted-foreground">{article.description}</p><p className="mt-2 text-xs text-muted-foreground">阅读约 {article.readTime}</p></div><Button variant="ghost" size="icon" aria-label={`查看 ${article.title}`}><ArrowRightIcon /></Button></CardContent></Card>)}</div> : <EmptyState />}
        </section>

        <section id="popular-questions" className="mt-14 grid gap-8 lg:grid-cols-[0.78fr_1.22fr] lg:items-start" aria-labelledby="faq-title">
          <div className="rounded-3xl bg-slate-900 p-7 text-slate-50 dark:bg-primary"><LightbulbIcon className="size-6 text-sky-300" /><p className="mt-8 text-sm font-medium text-sky-200">常见问题</p><h2 id="faq-title" className="mt-2 text-2xl font-semibold tracking-tight">把高频问题，变成一次自助解决。</h2><p className="mt-3 text-sm leading-6 text-slate-300">我们整理了首次使用、知识库、转人工和渠道接入中的典型问题。</p></div>
          <div className="divide-y divide-border rounded-2xl border bg-card px-5">{matches.questions.length ? matches.questions.map((item, index) => { const expanded = openQuestion === index; return <div key={item.question}><button type="button" className="flex w-full items-center justify-between gap-5 py-5 text-left font-medium" onClick={() => setOpenQuestion(expanded ? -1 : index)} aria-expanded={expanded}>{item.question}<ChevronDownIcon className={cn("size-4 shrink-0 text-muted-foreground transition-transform", expanded && "rotate-180")} /></button>{expanded && <p className="pb-5 pr-8 text-sm leading-6 text-muted-foreground">{item.answer}</p>}</div> }) : <EmptyState compact />}</div>
        </section>

        <section id="contact-support" className="mt-14 rounded-3xl border border-primary/15 bg-primary/[0.055] p-6 sm:flex sm:items-center sm:justify-between sm:p-8">
          <div><p className="text-sm font-medium text-primary">仍然没有找到答案？</p><h2 className="mt-1 text-2xl font-semibold tracking-tight">让我们一起定位问题</h2><p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">此处为前端演示入口。接入后将根据默认支持渠道，带你进入在线咨询。</p></div>
          <Button size="lg" className="mt-5 sm:mt-0" onClick={() => window.alert("演示模式：后续将跳转到配置的在线支持渠道。")}>在线咨询 <ArrowRightIcon /></Button>
        </section>
      </div>
    </main>
  )
}

function EmptyState({ compact = false }: { compact?: boolean }) {
  return <div className={cn("rounded-2xl border border-dashed bg-card p-8 text-center text-sm text-muted-foreground", compact && "border-0 p-5")}>没有找到相关内容。试试更换关键词，或清除当前筛选条件。</div>
}
