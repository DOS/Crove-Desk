"use client"

import { useEffect, useMemo, useState } from "react"
import { MessageSquareTextIcon } from "lucide-react"
import { toast } from "sonner"

import { DashboardCrudPage } from "@/components/dashboard/crud"
import { DashboardPage } from "@/components/dashboard-page"
import { OptionCombobox } from "@/components/option-combobox"
import { ProjectDialog } from "@/components/project-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import {
  acceptSupportAnswerAdmin,
  createSupportAnswerAdmin,
  deleteSupportArticleAdmin,
  deleteSupportArticleCategoryAdmin,
  deleteSupportQuestionCategoryAdmin,
  fetchSupportArticleAdmin,
  fetchSupportArticleCategoriesAllAdmin,
  fetchSupportArticleCategoriesAdmin,
  fetchSupportArticlesAdmin,
  fetchSupportQuestionAdmin,
  fetchSupportQuestionCategoriesAllAdmin,
  fetchSupportQuestionCategoriesAdmin,
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
import { formatDateTime } from "@/lib/utils"

const categoryStatusOptions = [
  { value: "all", label: "全部状态" },
  { value: "1", label: "启用" },
  { value: "2", label: "停用" },
]

const articleStatusOptions = [
  { value: "all", label: "全部状态" },
  { value: "draft", label: "草稿" },
  { value: "published", label: "已发布" },
  { value: "hidden", label: "已隐藏" },
]

const questionStatusOptions = [
  { value: "all", label: "全部状态" },
  { value: "pending", label: "待审核" },
  { value: "normal", label: "正常" },
  { value: "resolved", label: "已解决" },
  { value: "closed", label: "已关闭" },
  { value: "hidden", label: "已隐藏" },
]

type ArticlePayload = Pick<
  AdminSupportArticle,
  "categoryId" | "title" | "slug" | "summary" | "contentType" | "content" | "status" | "sortNo" | "tags"
>

type CategoryPayload = Pick<
  AdminSupportCategory,
  "name" | "slug" | "description" | "sortNo" | "status" | "remark"
>

function articleStatusLabel(status: string) {
  return articleStatusOptions.find((item) => item.value === status)?.label ?? status
}

function questionStatusLabel(status: string) {
  return questionStatusOptions.find((item) => item.value === status)?.label ?? status
}

const crudFormLabels = {
  create: "新建",
  save: "保存",
  saving: "保存中...",
  cancel: "取消",
  loadingDetail: "正在加载详情...",
  required: "此项不能为空",
  invalidNumber: "请输入有效数字",
  minValue: (min: number) => `不能小于 ${min}`,
  maxValue: (max: number) => `不能大于 ${max}`,
}

export function DashboardSupportHelpAdmin() {
  const [categories, setCategories] = useState<AdminSupportCategory[]>([])
  const [categoryManagerOpen, setCategoryManagerOpen] = useState(false)

  const reloadCategories = () => fetchSupportArticleCategoriesAllAdmin().then(setCategories)

  useEffect(() => { void reloadCategories() }, [])

  const categoryOptions = useMemo(
    () => categories.map((item) => ({ value: String(item.id), label: item.name })),
    [categories]
  )

  return (
    <DashboardPage>
      <div className="flex justify-end">
        <Button variant="outline" onClick={() => setCategoryManagerOpen(true)}>管理帮助分类</Button>
      </div>
    <DashboardCrudPage<AdminSupportArticle, ArticlePayload>
      layout="fragment"
      filters={[
        { name: "title", label: "文章标题", placeholder: "搜索文章标题", defaultValue: "", trim: true, className: "w-full sm:w-72" },
        { name: "categoryId", label: "全部分类", placeholder: "全部分类", type: "select", defaultValue: "all", allValue: "all", valueType: "number", options: [{ value: "all", label: "全部分类" }, ...categoryOptions], className: "w-full sm:w-44" },
        { name: "status", label: "全部状态", placeholder: "全部状态", type: "select", defaultValue: "all", allValue: "all", options: articleStatusOptions, className: "w-full sm:w-36" },
      ]}
      columns={[
        {
          key: "article",
          label: "文章",
          render: (item) => (
            <div className="min-w-0">
              <div className="font-medium">{item.title}</div>
              <div className="mt-1 line-clamp-1 text-sm text-muted-foreground">{item.summary || "暂无摘要"}</div>
            </div>
          ),
        },
        { key: "category", label: "分类", className: "w-40", render: (item) => <Badge variant="outline">{item.categoryName || "未分类"}</Badge> },
        { key: "status", label: "状态", className: "w-28", render: (item) => <Badge variant={item.status === "published" ? "default" : "outline"}>{articleStatusLabel(item.status)}</Badge> },
        { key: "views", label: "浏览量", className: "w-24", render: (item) => item.viewCount },
        { key: "updatedAt", label: "更新时间", className: "w-44", render: (item) => formatDateTime(item.updatedAt) },
      ]}
      fetchList={fetchSupportArticlesAdmin}
      getItemId={(item) => item.id}
      createItem={(payload) => saveSupportArticleAdmin(payload)}
      updateItem={(item, payload) => saveSupportArticleAdmin({ id: item.id, ...payload })}
      deleteItem={(item) => deleteSupportArticleAdmin(item.id)}
      deleteConfirm={(item) => ({ title: "删除文章", description: `确定删除“${item.title}”吗？`, confirmText: "删除", variant: "destructive" })}
      form={{
        fetchDetail: fetchSupportArticleAdmin,
        fields: [
          { name: "title", label: "标题", placeholder: "请输入文章标题", required: true, trim: true },
          { name: "slug", label: "Slug", placeholder: "例如 getting-started", required: true, trim: true, pattern: /^[a-z0-9]+(?:-[a-z0-9]+)*$/, patternMessage: "仅支持小写字母、数字和连字符" },
          { name: "categoryId", label: "分类", type: "select", required: true, valueType: "number", options: categoryOptions, valueFromItem: (item) => String(item.categoryId) },
          { name: "status", label: "状态", type: "select", required: true, defaultValue: "draft", options: articleStatusOptions.filter((item) => item.value !== "all") },
          { name: "summary", label: "摘要", placeholder: "用于文章列表和搜索结果", type: "textarea", rows: 3, trim: true },
          { name: "content", label: "正文", placeholder: "支持 Markdown", type: "textarea", rows: 16, required: true },
          { name: "sortNo", label: "排序", type: "number", defaultValue: "0", min: 0, valueType: "number" },
        ],
        transformSubmitValues: (values, context) => ({
          categoryId: Number(values.categoryId),
          title: String(values.title),
          slug: String(values.slug),
          summary: String(values.summary ?? ""),
          contentType: "markdown",
          content: String(values.content),
          status: String(values.status),
          sortNo: Number(values.sortNo || 0),
          tags: context.item?.tags ?? [],
        }),
        labels: { ...crudFormLabels, createTitle: "新建帮助文章", editTitle: "编辑帮助文章" },
      }}
      labels={{
        refresh: "刷新", create: "新建文章", query: "查询", loading: "正在加载文章...", empty: "暂无帮助文章", actions: "操作", edit: "编辑", delete: "删除", processing: "处理中...", moreActions: (item) => `更多操作：${item.title}`, loadFailed: "文章加载失败", saveFailed: "文章保存失败", deleteFailed: "文章删除失败", created: (payload) => `文章“${payload.title}”已创建`, updated: (item) => `文章“${item.title}”已更新`, deleted: (item) => `文章“${item.title}”已删除`,
      }}
    />
      <ProjectDialog
        open={categoryManagerOpen}
        onOpenChange={(open) => {
          setCategoryManagerOpen(open)
          if (!open) void reloadCategories()
        }}
        title="帮助中心分类"
        description="分类与帮助文章保持在同一个管理入口中。"
        size="xl"
        allowFullscreen
      >
        <SupportArticleCategoryManager />
      </ProjectDialog>
    </DashboardPage>
  )
}

function SupportArticleCategoryManager() {
  return (
    <DashboardCrudPage<AdminSupportCategory, CategoryPayload>
      layout="fragment"
      filters={[
        { name: "name", label: "分类名称", placeholder: "搜索分类名称", defaultValue: "", trim: true, className: "w-full sm:w-72" },
        { name: "status", label: "全部状态", placeholder: "全部状态", type: "select", defaultValue: "all", allValue: "all", valueType: "number", options: categoryStatusOptions, className: "w-full sm:w-36" },
      ]}
      columns={[
        { key: "name", label: "分类名称", render: (item) => <div><div className="font-medium">{item.name}</div><div className="mt-1 text-sm text-muted-foreground">{item.description || "暂无说明"}</div></div> },
        { key: "slug", label: "Slug", className: "w-44", render: (item) => <span className="font-mono text-sm">{item.slug}</span> },
        { key: "status", label: "状态", className: "w-24", render: (item) => <Badge variant={item.status === 1 ? "default" : "outline"}>{item.status === 1 ? "启用" : "停用"}</Badge> },
        { key: "sortNo", label: "排序", className: "w-20", render: (item) => item.sortNo },
      ]}
      fetchList={fetchSupportArticleCategoriesAdmin}
      getItemId={(item) => item.id}
      createItem={(payload) => saveSupportArticleCategoryAdmin(payload)}
      updateItem={(item, payload) => saveSupportArticleCategoryAdmin({ id: item.id, ...payload })}
      deleteItem={(item) => deleteSupportArticleCategoryAdmin(item.id)}
      deleteConfirm={(item) => ({ title: "删除帮助分类", description: `确定删除“${item.name}”吗？请先确认该分类下没有文章。`, confirmText: "删除", variant: "destructive" })}
      form={{
        fields: [
          { name: "name", label: "分类名称", placeholder: "请输入分类名称", required: true, trim: true },
          { name: "slug", label: "Slug", placeholder: "例如 getting-started", required: true, trim: true, pattern: /^[a-z0-9]+(?:-[a-z0-9]+)*$/, patternMessage: "仅支持小写字母、数字和连字符" },
          { name: "description", label: "分类说明", type: "textarea", rows: 3, trim: true },
          { name: "status", label: "状态", type: "select", defaultValue: "1", valueType: "number", required: true, options: categoryStatusOptions.filter((item) => item.value !== "all"), valueFromItem: (item) => String(item.status) },
          { name: "sortNo", label: "排序", type: "number", defaultValue: "0", min: 0, valueType: "number" },
          { name: "remark", label: "备注", type: "textarea", rows: 3, trim: true },
        ],
        transformSubmitValues: (values) => ({ name: String(values.name), slug: String(values.slug), description: String(values.description ?? ""), status: Number(values.status), sortNo: Number(values.sortNo || 0), remark: String(values.remark ?? "") }),
        labels: { ...crudFormLabels, createTitle: "新建帮助分类", editTitle: "编辑帮助分类" },
      }}
      labels={{ refresh: "刷新", create: "新建分类", query: "查询", loading: "正在加载分类...", empty: "暂无帮助分类", actions: "操作", edit: "编辑", delete: "删除", processing: "处理中...", moreActions: (item) => `更多操作：${item.name}`, loadFailed: "分类加载失败", saveFailed: "分类保存失败", deleteFailed: "分类删除失败", created: (payload) => `分类“${payload.name}”已创建`, updated: (item) => `分类“${item.name}”已更新`, deleted: (item) => `分类“${item.name}”已删除` }}
    />
  )
}

export function DashboardSupportFaqCategoryAdmin() {
  return (
    <DashboardCrudPage<AdminSupportCategory, CategoryPayload>
      filters={[
        { name: "name", label: "分类名称", placeholder: "搜索分类名称", defaultValue: "", trim: true, className: "w-full sm:w-72" },
        { name: "status", label: "全部状态", placeholder: "全部状态", type: "select", defaultValue: "all", allValue: "all", valueType: "number", options: categoryStatusOptions, className: "w-full sm:w-36" },
      ]}
      columns={[
        { key: "name", label: "分类名称", render: (item) => <div><div className="font-medium">{item.name}</div><div className="mt-1 text-sm text-muted-foreground">{item.description || "暂无说明"}</div></div> },
        { key: "slug", label: "Slug", className: "w-48", render: (item) => <span className="font-mono text-sm">{item.slug}</span> },
        { key: "status", label: "状态", className: "w-28", render: (item) => <Badge variant={item.status === 1 ? "default" : "outline"}>{item.status === 1 ? "启用" : "停用"}</Badge> },
        { key: "sortNo", label: "排序", className: "w-24", render: (item) => item.sortNo },
      ]}
      fetchList={fetchSupportQuestionCategoriesAdmin}
      getItemId={(item) => item.id}
      createItem={(payload) => saveSupportQuestionCategoryAdmin(payload)}
      updateItem={(item, payload) => saveSupportQuestionCategoryAdmin({ id: item.id, ...payload })}
      deleteItem={(item) => deleteSupportQuestionCategoryAdmin(item.id)}
      deleteConfirm={(item) => ({ title: "删除 FAQ 分类", description: `确定删除“${item.name}”吗？仍被问题使用的分类不能删除。`, confirmText: "删除", variant: "destructive" })}
      form={{
        fields: [
          { name: "name", label: "分类名称", placeholder: "请输入分类名称", required: true, trim: true },
          { name: "slug", label: "Slug", placeholder: "例如 account-security", required: true, trim: true, pattern: /^[a-z0-9]+(?:-[a-z0-9]+)*$/, patternMessage: "仅支持小写字母、数字和连字符" },
          { name: "description", label: "分类说明", placeholder: "说明该分类包含的问题范围", type: "textarea", rows: 3, trim: true },
          { name: "status", label: "状态", type: "select", defaultValue: "1", valueType: "number", required: true, options: categoryStatusOptions.filter((item) => item.value !== "all"), valueFromItem: (item) => String(item.status) },
          { name: "sortNo", label: "排序", type: "number", defaultValue: "0", min: 0, valueType: "number" },
          { name: "remark", label: "备注", placeholder: "仅后台可见", type: "textarea", rows: 3, trim: true },
        ],
        transformSubmitValues: (values) => ({ name: String(values.name), slug: String(values.slug), description: String(values.description ?? ""), status: Number(values.status), sortNo: Number(values.sortNo || 0), remark: String(values.remark ?? "") }),
        labels: { ...crudFormLabels, createTitle: "新建 FAQ 分类", editTitle: "编辑 FAQ 分类" },
      }}
      labels={{
        refresh: "刷新", create: "新建分类", query: "查询", loading: "正在加载分类...", empty: "暂无 FAQ 分类", actions: "操作", edit: "编辑", delete: "删除", processing: "处理中...", moreActions: (item) => `更多操作：${item.name}`, loadFailed: "分类加载失败", saveFailed: "分类保存失败", deleteFailed: "分类删除失败", created: (payload) => `分类“${payload.name}”已创建`, updated: (item) => `分类“${item.name}”已更新`, deleted: (item) => `分类“${item.name}”已删除`,
      }}
    />
  )
}

export function DashboardSupportFaqAdmin() {
  const [categories, setCategories] = useState<AdminSupportCategory[]>([])
  const [questions, setQuestions] = useState<AdminSupportQuestion[]>([])
  const [categoryId, setCategoryId] = useState<number | "all">("all")
  const [status, setStatus] = useState("all")
  const [detail, setDetail] = useState<AdminSupportQuestionDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [answer, setAnswer] = useState("")

  const reloadQuestions = async () => {
    setLoading(true)
    try {
      const page = await fetchSupportQuestionsAdmin({ categoryId: categoryId === "all" ? undefined : categoryId, status: status === "all" ? undefined : status, limit: 50 })
      setQuestions(page.results)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void fetchSupportQuestionCategoriesAllAdmin().then(setCategories) }, [])
  useEffect(() => { void reloadQuestions() }, [categoryId, status])

  const openQuestion = async (id: number) => setDetail(await fetchSupportQuestionAdmin(id))
  const refreshDetail = async () => { if (detail) setDetail(await fetchSupportQuestionAdmin(detail.question.id)) }

  const moderate = async (nextStatus: string) => {
    if (!detail) return
    await moderateSupportQuestionAdmin(detail.question.id, nextStatus)
    toast.success("问题状态已更新")
    await Promise.all([refreshDetail(), reloadQuestions()])
  }

  const reply = async () => {
    if (!detail || !answer.trim()) return
    await createSupportAnswerAdmin(detail.question.id, answer.trim())
    setAnswer("")
    toast.success("回答已发布")
    await Promise.all([refreshDetail(), reloadQuestions()])
  }

  return (
    <DashboardPage>
      <div className="flex flex-wrap items-center gap-2 border-b pb-3">
        <div className="w-full sm:w-44">
          <OptionCombobox
            value={String(categoryId)}
            onChange={(value) => setCategoryId(value === "all" ? "all" : Number(value))}
            placeholder="全部分类"
            options={[{ value: "all", label: "全部分类" }, ...categories.map((item) => ({ value: String(item.id), label: item.name }))]}
          />
        </div>
        <div className="w-full sm:w-36">
          <OptionCombobox
            value={status}
            onChange={setStatus}
            placeholder="全部状态"
            options={questionStatusOptions}
          />
        </div>
        <Button variant="outline" onClick={() => void reloadQuestions()} disabled={loading}>刷新</Button>
      </div>

      <div className="overflow-hidden rounded-md border">
        {questions.map((question) => (
          <button key={question.id} type="button" className="flex w-full items-center gap-4 border-b px-4 py-3 text-left last:border-b-0 hover:bg-muted/50" onClick={() => void openQuestion(question.id)}>
            <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted"><MessageSquareTextIcon className="size-4 text-muted-foreground" /></span>
            <span className="min-w-0 flex-1"><span className="block truncate font-medium">{question.title}</span><span className="mt-1 block text-sm text-muted-foreground">{question.userName || "用户"} · {question.categoryName || "未分类"} · {formatDateTime(question.createdAt)}</span></span>
            <span className="hidden text-sm text-muted-foreground sm:block">{question.answerCount} 个回答</span>
            <Badge variant={question.status === "resolved" ? "default" : "outline"}>{questionStatusLabel(question.status)}</Badge>
          </button>
        ))}
        {!loading && questions.length === 0 ? <div className="py-16 text-center text-sm text-muted-foreground">暂无符合条件的问题</div> : null}
        {loading ? <div className="py-16 text-center text-sm text-muted-foreground">正在加载问题...</div> : null}
      </div>

      <ProjectDialog open={Boolean(detail)} onOpenChange={(open) => { if (!open) setDetail(null) }} title={detail?.question.title ?? "问题处理"} description={detail ? `${detail.question.userName || "用户"} · ${detail.question.categoryName || "未分类"} · ${formatDateTime(detail.question.createdAt)}` : undefined} size="xl" allowFullscreen>
        {detail ? (
          <div className="grid gap-5">
            <div className="flex flex-wrap items-center gap-2"><Badge variant={detail.question.status === "resolved" ? "default" : "outline"}>{questionStatusLabel(detail.question.status)}</Badge><span className="text-sm text-muted-foreground">{detail.question.voteCount} 赞 · {detail.question.viewCount} 浏览</span></div>
            <p className="whitespace-pre-wrap text-sm leading-7">{detail.question.content}</p>
            <div className="flex flex-wrap gap-2 border-y py-3"><Button variant="outline" onClick={() => void moderate("normal")}>恢复正常</Button><Button variant="outline" onClick={() => void moderate("closed")}>关闭问题</Button><Button variant="destructive" onClick={() => void moderate("hidden")}>隐藏问题</Button></div>
            <Card><CardHeader><CardTitle className="text-base">回答（{detail.answers.length}）</CardTitle></CardHeader><CardContent className="grid gap-3">{detail.answers.map((item) => <div key={item.id} className="rounded-md border p-3"><div className="flex items-center justify-between gap-3"><span className="text-sm font-medium">{item.authorName || item.authorType}</span>{item.isBestAnswer ? <Badge>最佳答案</Badge> : <Button size="sm" variant="outline" onClick={() => void acceptSupportAnswerAdmin(detail.question.id, item.id).then(refreshDetail)}>设为最佳</Button>}</div><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{item.content}</p></div>)}</CardContent></Card>
            <div className="grid gap-2"><Textarea value={answer} onChange={(event) => setAnswer(event.target.value)} rows={5} placeholder="输入客服回答" /><div className="flex justify-end"><Button onClick={() => void reply()} disabled={!answer.trim()}>发布回答</Button></div></div>
          </div>
        ) : null}
      </ProjectDialog>
    </DashboardPage>
  )
}
