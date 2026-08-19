"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"

import { DashboardPage } from "@/components/dashboard-page"
import { OptionCombobox } from "@/components/option-combobox"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import {
  acceptSupportAnswerAdmin,
  createSupportAnswerAdmin,
  fetchSupportArticleCategoriesAllAdmin,
  fetchSupportArticlesAdmin,
  fetchSupportQuestionAdmin,
  fetchSupportQuestionCategoriesAllAdmin,
  fetchSupportQuestionsAdmin,
  moderateSupportQuestionAdmin,
  saveSupportArticleAdmin,
  saveSupportArticleCategoryAdmin,
  saveSupportQuestionCategoryAdmin,
  type AdminSupportArticle,
  type AdminSupportCategory,
  type AdminSupportQuestion,
  type AdminSupportQuestionDetail,
} from "@/lib/api/admin"

export default function DashboardSupportPage() {
  const [articleCategories, setArticleCategories] = useState<AdminSupportCategory[]>([])
  const [questionCategories, setQuestionCategories] = useState<AdminSupportCategory[]>([])
  const [articles, setArticles] = useState<AdminSupportArticle[]>([])
  const [questions, setQuestions] = useState<AdminSupportQuestion[]>([])

  const reload = async () => {
    const [articleCategoryList, questionCategoryList, articlePage, questionPage] = await Promise.all([
      fetchSupportArticleCategoriesAllAdmin(),
      fetchSupportQuestionCategoriesAllAdmin(),
      fetchSupportArticlesAdmin({ limit: 20 }),
      fetchSupportQuestionsAdmin({ limit: 20 }),
    ])
    setArticleCategories(articleCategoryList)
    setQuestionCategories(questionCategoryList)
    setArticles(articlePage.results)
    setQuestions(questionPage.results)
  }

  useEffect(() => {
    void reload()
  }, [])

  return (
    <DashboardPage>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">支持中心</h1>
        <p className="mt-1 text-sm text-muted-foreground">管理公开帮助文章、FAQ 社区分类、问题审核和客服回答。</p>
      </div>
      <Tabs defaultValue="articles">
        <TabsList>
          <TabsTrigger value="articles">帮助文章</TabsTrigger>
          <TabsTrigger value="questions">FAQ 社区</TabsTrigger>
          <TabsTrigger value="categories">分类</TabsTrigger>
        </TabsList>
        <TabsContent value="articles" className="mt-4">
          <ArticleManager categories={articleCategories} articles={articles} onChanged={reload} />
        </TabsContent>
        <TabsContent value="questions" className="mt-4">
          <QuestionManager questions={questions} onChanged={reload} />
        </TabsContent>
        <TabsContent value="categories" className="mt-4">
          <CategoryManager articleCategories={articleCategories} questionCategories={questionCategories} onChanged={reload} />
        </TabsContent>
      </Tabs>
    </DashboardPage>
  )
}

function ArticleManager({ categories, articles, onChanged }: { categories: AdminSupportCategory[]; articles: AdminSupportArticle[]; onChanged: () => Promise<void> }) {
  const [categoryId, setCategoryId] = useState("")
  const [title, setTitle] = useState("")
  const [slug, setSlug] = useState("")
  const [summary, setSummary] = useState("")
  const [content, setContent] = useState("")

  const submit = async () => {
    await saveSupportArticleAdmin({
      categoryId: Number(categoryId),
      title,
      slug,
      summary,
      content,
      contentType: "markdown",
      status: "published",
      sortNo: 0,
      tags: [],
    })
    toast.success("文章已保存")
    setTitle("")
    setSlug("")
    setSummary("")
    setContent("")
    await onChanged()
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
      <Card>
        <CardHeader><CardTitle className="text-base">新增文章</CardTitle></CardHeader>
        <CardContent className="grid gap-3">
          <OptionCombobox value={categoryId} onChange={setCategoryId} options={categories.map((item) => ({ value: String(item.id), label: item.name }))} placeholder="选择分类" />
          <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="标题" />
          <Input value={slug} onChange={(event) => setSlug(event.target.value)} placeholder="slug" />
          <Input value={summary} onChange={(event) => setSummary(event.target.value)} placeholder="摘要" />
          <Textarea value={content} onChange={(event) => setContent(event.target.value)} rows={8} placeholder="Markdown 内容" />
          <Button onClick={() => void submit()}>保存文章</Button>
        </CardContent>
      </Card>
      <div className="grid content-start gap-3">
        {articles.map((item) => (
          <Card key={item.id}>
            <CardContent className="flex items-start justify-between gap-3 p-4">
              <div>
                <div className="font-medium">{item.title}</div>
                <div className="mt-1 text-sm text-muted-foreground">{item.categoryName || "未分类"} · {item.viewCount} 次浏览</div>
              </div>
              <Badge variant={item.status === "published" ? "default" : "outline"}>{item.status}</Badge>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

function QuestionManager({ questions, onChanged }: { questions: AdminSupportQuestion[]; onChanged: () => Promise<void> }) {
  const [detail, setDetail] = useState<AdminSupportQuestionDetail | null>(null)
  const [answer, setAnswer] = useState("")

  const open = async (id: number) => {
    setDetail(await fetchSupportQuestionAdmin(id))
  }

  const reply = async () => {
    if (!detail) {
      return
    }
    await createSupportAnswerAdmin(detail.question.id, answer)
    toast.success("回答已发布")
    setAnswer("")
    await open(detail.question.id)
    await onChanged()
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_420px]">
      <div className="grid content-start gap-3">
        {questions.map((item) => (
          <Card key={item.id} className="cursor-pointer" onClick={() => void open(item.id)}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-medium">{item.title}</div>
                  <div className="mt-1 text-sm text-muted-foreground">{item.customerName || "用户"} · {item.answerCount} 个回答</div>
                </div>
                <Badge variant={item.status === "resolved" ? "default" : "outline"}>{item.status}</Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">问题处理</CardTitle></CardHeader>
        <CardContent className="grid gap-3">
          {detail ? (
            <>
              <div>
                <div className="font-medium">{detail.question.title}</div>
                <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{detail.question.content}</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => void moderateSupportQuestionAdmin(detail.question.id, "hidden").then(onChanged)}>隐藏</Button>
                <Button variant="outline" onClick={() => void moderateSupportQuestionAdmin(detail.question.id, "closed").then(onChanged)}>关闭</Button>
              </div>
              <div className="grid gap-2 border-t pt-3">
                {detail.answers.map((item) => (
                  <div key={item.id} className="rounded-md border p-3 text-sm">
                    <div className="flex justify-between gap-2">
                      <span className="font-medium">{item.authorName || item.authorType}</span>
                      {item.isBestAnswer ? <Badge>最佳</Badge> : <Button size="sm" variant="outline" onClick={() => void acceptSupportAnswerAdmin(detail.question.id, item.id).then(() => open(detail.question.id))}>设为最佳</Button>}
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-muted-foreground">{item.content}</p>
                  </div>
                ))}
              </div>
              <Textarea value={answer} onChange={(event) => setAnswer(event.target.value)} rows={5} placeholder="客服回答" />
              <Button onClick={() => void reply()}>发布回答</Button>
            </>
          ) : (
            <div className="text-sm text-muted-foreground">选择一个问题查看详情</div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function CategoryManager({ articleCategories, questionCategories, onChanged }: { articleCategories: AdminSupportCategory[]; questionCategories: AdminSupportCategory[]; onChanged: () => Promise<void> }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <CategoryEditor title="帮助文章分类" categories={articleCategories} save={(payload) => saveSupportArticleCategoryAdmin(payload)} onChanged={onChanged} />
      <CategoryEditor title="FAQ 问题分类" categories={questionCategories} save={(payload) => saveSupportQuestionCategoryAdmin(payload)} onChanged={onChanged} />
    </div>
  )
}

function CategoryEditor({ title, categories, save, onChanged }: { title: string; categories: AdminSupportCategory[]; save: (payload: Partial<AdminSupportCategory>) => Promise<unknown>; onChanged: () => Promise<void> }) {
  const [name, setName] = useState("")
  const [slug, setSlug] = useState("")

  const submit = async () => {
    await save({ name, slug, status: 1, sortNo: 0 })
    toast.success("分类已保存")
    setName("")
    setSlug("")
    await onChanged()
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent className="grid gap-3">
        <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
          <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="分类名" />
          <Input value={slug} onChange={(event) => setSlug(event.target.value)} placeholder="slug" />
          <Button onClick={() => void submit()}>新增</Button>
        </div>
        <div className="grid gap-2">
          {categories.map((item) => <div key={item.id} className="rounded-md border p-3 text-sm">{item.name} <span className="text-muted-foreground">/{item.slug}</span></div>)}
        </div>
      </CardContent>
    </Card>
  )
}
