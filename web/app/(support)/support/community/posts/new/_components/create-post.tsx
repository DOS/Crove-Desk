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
import { ensureSupportLogin } from "@/app/(support)/support/_components/support-community-route"
import { useI18n } from "@/i18n/provider"
import { createPost, fetchCategories, postHref, type Category } from "@/lib/api/support-community"
import type { ContentValue } from "@/components/content-editor"

export function CreatePost() {
  const t = useI18n()
  const router = useRouter()
  const { ready, session } = useSupportAuth()
  const [categories, setCategories] = useState<Category[]>([])
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
      router.replace("/support/login?next=%2Fsupport%2Fcommunity%2Fposts%2Fnew")
    }
  }, [ready, router, session])

  const loadCategories = useCallback(() => {
    setCategoriesLoading(true)
    setCategoriesFailed(false)
    void fetchCategories()
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
      setFormError(t("supportPublic.createPost.categoryRequired"))
      return
    }
    if (!title.trim()) {
      setFormError(t("supportPublic.createPost.titleRequired"))
      return
    }
    if (!content.raw.trim()) {
      setFormError(t("supportPublic.createPost.contentRequired"))
      return
    }
    setFormError("")
    setSubmitting(true)
    try {
      await ensureSupportLogin()
      const post = await createPost({
        categoryId,
        title,
        contentType: content.mode,
        content: content.raw,
        tags: tags.split(",").map((item) => item.trim()).filter(Boolean),
      })
      toast.success(t("supportPublic.toast.postCreated"))
      window.location.assign(postHref(post.id))
    } catch (error) {
      const message = error instanceof Error ? error.message : t("api.requestFailed")
      setFormError(message)
    } finally {
      setSubmitting(false)
    }
  }

  if (!ready || !session) {
    return (
      <SupportPageShell section="community">
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
    <SupportPageShell section="community">
      <SupportPageContent className="py-8 sm:py-10" width="docs">
        <form
        className="w-full rounded-md bg-card p-4 sm:p-5"
        onSubmit={(event) => {
          event.preventDefault()
          void submit()
        }}
      >
        <div className="mb-3 border-b pb-3">
          <h1 className="text-lg font-medium">{t("supportPublic.createPost.formTitle")}</h1>
        </div>

        <div className="grid gap-3">
          <fieldset aria-label={t("supportPublic.createPost.category")}>
            <legend className="sr-only">{t("supportPublic.createPost.category")}</legend>
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
            {categoriesFailed ? <button type="button" className="mt-2 text-xs text-destructive underline-offset-4 hover:underline" onClick={loadCategories}>{t("supportPublic.createPost.categoriesFailed")}</button> : null}
          </fieldset>

          <Input id="support-post-title" value={title} onChange={(event) => { setTitle(event.target.value); setFormError("") }} placeholder={t("supportPublic.createPost.postTitlePlaceholder")} className="rounded-md bg-card" disabled={submitting} aria-label={t("supportPublic.createPost.postTitle")} />

          <div className="grid min-w-0 gap-2" role="group" aria-labelledby="support-post-content-label">
            <span id="support-post-content-label" className="sr-only">{t("supportPublic.createPost.content")}</span>
            <ContentEditor
              value={content}
              onChange={handleContentChange}
              placeholder={t("supportPublic.createPost.contentPlaceholder")}
              disabled={submitting}
              allowedModes={["html", "markdown"]}
              height={420}
              className="min-w-0"
            />
          </div>

          <Input id="support-post-tags" value={tags} onChange={(event) => setTags(event.target.value)} placeholder={t("supportPublic.createPost.tagsPlaceholder")} className="rounded-md bg-card" disabled={submitting} aria-label={t("supportPublic.createPost.tags")} />

          {formError ? <div role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{formError}</div> : null}

          <div className="flex justify-end pt-1">
            <Button type="submit" disabled={submitting || categoriesLoading || categoriesFailed}>
              {submitting ? t("supportPublic.actions.publishing") : t("supportPublic.actions.publishPost")}
            </Button>
          </div>
        </div>
        </form>
      </SupportPageContent>
    </SupportPageShell>
  )
}
