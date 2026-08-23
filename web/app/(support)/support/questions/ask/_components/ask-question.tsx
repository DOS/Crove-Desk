"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { LoaderCircleIcon } from "lucide-react"
import { toast } from "sonner"

import { ContentEditor } from "@/components/content-editor"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { SupportPageContent, SupportPageShell } from "@/app/(support)/support/_components/support-page-shell"
import { useSupportAuth } from "@/app/(support)/support/_components/support-auth-provider"
import { ensureSupportLogin, supportQuestionHref } from "@/app/(support)/support/_components/support-question-route"
import { useI18n } from "@/i18n/provider"
import { createSupportQuestion, fetchSupportQuestionCategories, type SupportCategory } from "@/lib/api/support"
import type { ContentValue } from "@/components/content-editor"

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

          {formError ? <div role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{formError}</div> : null}

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
