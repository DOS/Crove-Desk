"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
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
  deleteSupportQuestionCategoryAdmin,
  fetchSupportQuestionAdmin,
  fetchSupportQuestionCategoriesAllAdmin,
  fetchSupportQuestionCategoriesAdmin,
  fetchSupportQuestionsAdmin,
  moderateSupportQuestionAdmin,
  saveSupportQuestionCategoryAdmin,
  updateSupportQuestionCategorySortAdmin,
  type AdminSupportCategory,
  type AdminSupportQuestion,
  type AdminSupportQuestionDetail,
} from "@/lib/api/admin"
import { useI18n } from "@/i18n/provider"
import { formatDateTime } from "@/lib/utils"
import { normalizeSupportSlug, supportSlugPattern } from "@/lib/support-slug"

type CategoryPayload = Pick<
  AdminSupportCategory,
  "name" | "slug" | "description" | "status" | "remark"
>

export function DashboardSupportFaqCategoryAdmin() {
  const t = useI18n()
  const categoryStatusOptions = [
    { value: "all", label: t("supportFaqCategory.allStatuses") },
    { value: "0", label: t("supportFaqCategory.enabled") },
    { value: "1", label: t("supportFaqCategory.disabled") },
  ]
  const crudFormLabels = {
    create: t("supportFaqCategory.create"),
    save: t("supportFaqCategory.save"),
    saving: t("supportFaqCategory.saving"),
    cancel: t("supportFaqCategory.cancel"),
    loadingDetail: t("supportFaqCategory.loadingDetail"),
    required: t("supportFaqCategory.required"),
    invalidNumber: t("supportFaqCategory.invalidNumber"),
    minValue: (min: number) => t("supportFaqCategory.minValue", { min }),
    maxValue: (max: number) => t("supportFaqCategory.maxValue", { max }),
  }

  return (
    <DashboardCrudPage<AdminSupportCategory, CategoryPayload>
      filters={[
        { name: "name", label: t("supportFaqCategory.name"), placeholder: t("supportFaqCategory.searchName"), defaultValue: "", trim: true, className: "w-full sm:w-72" },
        { name: "status", label: t("supportFaqCategory.allStatuses"), placeholder: t("supportFaqCategory.allStatuses"), type: "select", defaultValue: "all", allValue: "all", valueType: "number", options: categoryStatusOptions, className: "w-full sm:w-36" },
      ]}
      columns={[
        { key: "name", label: t("supportFaqCategory.name"), render: (item) => <div><div className="font-medium">{item.name}</div><div className="mt-1 text-sm text-muted-foreground">{item.description || t("supportFaqCategory.noDescription")}</div></div> },
        { key: "slug", label: "Slug", className: "w-48", render: (item) => <span className="font-mono text-sm">{item.slug}</span> },
        { key: "status", label: t("supportFaqCategory.status"), className: "w-28", render: (item) => <Badge variant={item.status === 0 ? "default" : "outline"}>{item.status === 0 ? t("supportFaqCategory.enabled") : t("supportFaqCategory.disabled")}</Badge> },
      ]}
      fetchList={fetchSupportQuestionCategoriesAdmin}
      getItemId={(item) => item.id}
      createItem={(payload) => saveSupportQuestionCategoryAdmin(payload)}
      updateItem={(item, payload) => saveSupportQuestionCategoryAdmin({ id: item.id, ...payload })}
      deleteItem={(item) => deleteSupportQuestionCategoryAdmin(item.id)}
      deleteConfirm={(item) => ({ title: t("supportFaqCategory.confirmDeleteTitle"), description: t("supportFaqCategory.confirmDeleteDescription", { name: item.name }), confirmText: t("supportFaqCategory.delete"), variant: "destructive" })}
      sort={{
        enabled: true,
        onReorder: (items) => updateSupportQuestionCategorySortAdmin(items.map((item) => item.id)),
        successMessage: t("supportFaqCategory.sortUpdated"),
        errorMessage: t("supportFaqCategory.sortUpdateFailed"),
        handleLabel: t("supportFaqCategory.dragSort", { name: "" }),
      }}
      form={{
        fields: [
          { name: "name", label: t("supportFaqCategory.name"), placeholder: t("supportFaqCategory.namePlaceholder"), required: true, trim: true },
          { name: "slug", label: "Slug", placeholder: t("supportFaqCategory.slugPlaceholder"), required: true, trim: true, normalizeInput: normalizeSupportSlug, pattern: supportSlugPattern, patternMessage: t("supportFaqCategory.slugPatternMessage") },
          { name: "description", label: t("supportFaqCategory.description"), placeholder: t("supportFaqCategory.descriptionPlaceholder"), type: "textarea", rows: 3, trim: true },
          { name: "status", label: t("supportFaqCategory.status"), type: "select", defaultValue: "0", valueType: "number", required: true, options: categoryStatusOptions.filter((item) => item.value !== "all"), valueFromItem: (item) => String(item.status) },
          { name: "remark", label: t("supportFaqCategory.remark"), placeholder: t("supportFaqCategory.remarkPlaceholder"), type: "textarea", rows: 3, trim: true },
        ],
        transformSubmitValues: (values) => ({ name: String(values.name), slug: normalizeSupportSlug(String(values.slug)), description: String(values.description ?? ""), status: Number(values.status), remark: String(values.remark ?? "") }),
        labels: { ...crudFormLabels, createTitle: t("supportFaqCategory.createTitle"), editTitle: t("supportFaqCategory.editTitle") },
      }}
      labels={{
        refresh: t("supportFaqCategory.refresh"), create: t("supportFaqCategory.new"), query: t("supportFaqCategory.query"), loading: t("supportFaqCategory.loading"), empty: t("supportFaqCategory.empty"), actions: t("supportFaqCategory.actions"), edit: t("supportFaqCategory.edit"), delete: t("supportFaqCategory.delete"), processing: t("supportFaqCategory.processing"), moreActions: (item) => t("supportFaqCategory.moreActions", { name: item.name }), loadFailed: t("supportFaqCategory.loadFailed"), saveFailed: t("supportFaqCategory.saveFailed"), deleteFailed: t("supportFaqCategory.deleteFailed"), created: (payload) => t("supportFaqCategory.created", { name: payload.name }), updated: (item) => t("supportFaqCategory.updated", { name: item.name }), deleted: (item) => t("supportFaqCategory.deleted", { name: item.name }),
      }}
    />
  )
}

export function DashboardSupportFaqAdmin() {
  const t = useI18n()
  const [categories, setCategories] = useState<AdminSupportCategory[]>([])
  const [questions, setQuestions] = useState<AdminSupportQuestion[]>([])
  const [categoryId, setCategoryId] = useState<number | "all">("all")
  const [status, setStatus] = useState("all")
  const [detail, setDetail] = useState<AdminSupportQuestionDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [answer, setAnswer] = useState("")

  const questionStatusOptions = useMemo(
    () => [
      { value: "all", label: t("supportQuestionAdmin.allStatuses") },
      { value: "pending", label: t("supportQuestionAdmin.statusPending") },
      { value: "normal", label: t("supportQuestionAdmin.statusNormal") },
      { value: "resolved", label: t("supportQuestionAdmin.statusResolved") },
      { value: "closed", label: t("supportQuestionAdmin.statusClosed") },
      { value: "hidden", label: t("supportQuestionAdmin.statusHidden") },
    ],
    [t]
  )

  const questionStatusLabel = useCallback(
    (st: string) => questionStatusOptions.find((item: { value: string; label: string }) => item.value === st)?.label ?? st,
    [questionStatusOptions]
  )

  const reloadQuestions = useCallback(async () => {
    setLoading(true)
    try {
      const page = await fetchSupportQuestionsAdmin({ categoryId: categoryId === "all" ? undefined : categoryId, status: status === "all" ? undefined : status, limit: 50 })
      setQuestions(page.results)
    } finally {
      setLoading(false)
    }
  }, [categoryId, status])

  useEffect(() => { void fetchSupportQuestionCategoriesAllAdmin().then(setCategories) }, [])
  useEffect(() => { void reloadQuestions() }, [reloadQuestions])

  const openQuestion = async (id: number) => setDetail(await fetchSupportQuestionAdmin(id))
  const refreshDetail = async () => { if (detail) setDetail(await fetchSupportQuestionAdmin(detail.question.id)) }

  const moderate = async (nextStatus: string) => {
    if (!detail) return
    await moderateSupportQuestionAdmin(detail.question.id, nextStatus)
    toast.success(t("supportQuestionAdmin.statusUpdated"))
    await Promise.all([refreshDetail(), reloadQuestions()])
  }

  const reply = async () => {
    if (!detail || !answer.trim()) return
    await createSupportAnswerAdmin(detail.question.id, answer.trim())
    setAnswer("")
    toast.success(t("supportQuestionAdmin.answerPublished"))
    await Promise.all([refreshDetail(), reloadQuestions()])
  }

  return (
    <DashboardPage>
      <div className="flex flex-wrap items-center gap-2 border-b pb-3">
        <div className="w-full sm:w-44">
          <OptionCombobox
            value={String(categoryId)}
            onChange={(value) => setCategoryId(value === "all" ? "all" : Number(value))}
            placeholder={t("supportQuestionAdmin.allCategories")}
            options={[{ value: "all", label: t("supportQuestionAdmin.allCategories") }, ...categories.map((item) => ({ value: String(item.id), label: item.name }))]}
          />
        </div>
        <div className="w-full sm:w-36">
          <OptionCombobox
            value={status}
            onChange={setStatus}
            placeholder={t("supportQuestionAdmin.allStatuses")}
            options={questionStatusOptions}
          />
        </div>
        <Button variant="outline" onClick={() => void reloadQuestions()} disabled={loading}>{t("common.refresh")}</Button>
      </div>

      <div className="overflow-hidden rounded-md border">
        {questions.map((question) => (
          <button key={question.id} type="button" className="flex w-full items-center gap-4 border-b px-4 py-3 text-left last:border-b-0 hover:bg-muted/50" onClick={() => void openQuestion(question.id)}>
            <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted"><MessageSquareTextIcon className="size-4 text-muted-foreground" /></span>
            <span className="min-w-0 flex-1"><span className="block truncate font-medium">{question.title}</span><span className="mt-1 block text-sm text-muted-foreground">{question.userName || t("supportQuestionAdmin.userFallback")} · {question.categoryName || t("supportQuestionAdmin.uncategorized")} · {formatDateTime(question.createdAt)}</span></span>
            <span className="hidden text-sm text-muted-foreground sm:block">{t("supportQuestionAdmin.answersCount", { count: question.answerCount })}</span>
            <Badge variant={question.status === "resolved" ? "default" : "outline"}>{questionStatusLabel(question.status)}</Badge>
          </button>
        ))}
        {!loading && questions.length === 0 ? <div className="py-16 text-center text-sm text-muted-foreground">{t("supportQuestionAdmin.empty")}</div> : null}
        {loading ? <div className="py-16 text-center text-sm text-muted-foreground">{t("supportQuestionAdmin.loading")}</div> : null}
      </div>

      <ProjectDialog open={Boolean(detail)} onOpenChange={(open) => { if (!open) setDetail(null) }} title={detail?.question.title ?? t("supportQuestionAdmin.title")} description={detail ? `${detail.question.userName || t("supportQuestionAdmin.userFallback")} · ${detail.question.categoryName || t("supportQuestionAdmin.uncategorized")} · ${formatDateTime(detail.question.createdAt)}` : undefined} size="xl" allowFullscreen>
        {detail ? (
          <div className="grid gap-5">
            <div className="flex flex-wrap items-center gap-2"><Badge variant={detail.question.status === "resolved" ? "default" : "outline"}>{questionStatusLabel(detail.question.status)}</Badge><span className="text-sm text-muted-foreground">{t("supportQuestionAdmin.votesAndViews", { votes: detail.question.voteCount, views: detail.question.viewCount })}</span></div>
            <p className="whitespace-pre-wrap text-sm leading-7">{detail.question.content}</p>
            <div className="flex flex-wrap gap-2 border-y py-3"><Button variant="outline" onClick={() => void moderate("normal")}>{t("supportQuestionAdmin.moderateNormal")}</Button><Button variant="outline" onClick={() => void moderate("closed")}>{t("supportQuestionAdmin.moderateClose")}</Button><Button variant="destructive" onClick={() => void moderate("hidden")}>{t("supportQuestionAdmin.moderateHide")}</Button></div>
            <Card><CardHeader><CardTitle className="text-base">{t("supportQuestionAdmin.answersCount", { count: detail.answers.length })}</CardTitle></CardHeader><CardContent className="grid gap-3">{detail.answers.map((item) => <div key={item.id} className="rounded-md border p-3"><div className="flex items-center justify-between gap-3"><span className="text-sm font-medium">{item.authorName || item.authorType}</span>{item.isBestAnswer ? <Badge>{t("supportQuestionAdmin.bestAnswer")}</Badge> : <Button size="sm" variant="outline" onClick={() => void acceptSupportAnswerAdmin(detail.question.id, item.id).then(refreshDetail)}>{t("supportQuestionAdmin.setBest")}</Button>}</div><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{item.content}</p></div>)}</CardContent></Card>
            <div className="grid gap-2"><Textarea value={answer} onChange={(event) => setAnswer(event.target.value)} rows={5} placeholder={t("supportQuestionAdmin.replyPlaceholder")} /><div className="flex justify-end"><Button onClick={() => void reply()} disabled={!answer.trim()}>{t("supportQuestionAdmin.publishReply")}</Button></div></div>
          </div>
        ) : null}
      </ProjectDialog>
    </DashboardPage>
  )
}
