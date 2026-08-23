"use client"

import { useEffect, useMemo, useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, type Resolver, useForm } from "react-hook-form"
import { z } from "zod/v4"

import { ProjectDialog } from "@/components/project-dialog"
import { ContentEditor } from "@/components/content-editor"
import { OptionCombobox } from "@/components/option-combobox"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldContent,
  FieldError,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  type KnowledgeDocument,
  type CreateKnowledgeDocumentPayload,
  type KnowledgeDirectory,
  fetchKnowledgeDocument,
  fetchKnowledgeDirectories,
} from "@/lib/api/admin"
import {
  KnowledgeDocumentContentType,
} from "@/lib/generated/enums"
import { useI18n } from "@/i18n/provider"

type DocumentEditDialogProps = {
  open: boolean
  saving: boolean
  itemId: number | null
  knowledgeBaseId: number | null
  initialDirectoryId?: number
  onOpenChange: (open: boolean) => void
  onSubmit: (payload: CreateKnowledgeDocumentPayload) => Promise<void>
}

const emptyForm: EditForm = {
  directoryId: "0",
  title: "",
  contentType: KnowledgeDocumentContentType.Markdown,
  content: "",
}

type TFunction = (key: string, values?: Record<string, string | number>) => string

function createKnowledgeDocumentFormSchema(t: TFunction) {
  return z.object({
  directoryId: z.string().trim(),
  title: z.string().trim().min(1, t("knowledge.documentTitleRequired")).max(255, t("knowledge.documentTitleMax")),
  contentType: z.string().trim().min(1, t("knowledge.contentTypeRequired")),
  content: z.string().trim().min(1, t("knowledge.contentRequired")),
  })
}

type EditForm = {
  directoryId: string
  title: string
  contentType: string
  content: string
}

type DirectoryOption = { value: string; label: string }

function flattenDirectoryOptions(items: KnowledgeDirectory[], depth = 0): DirectoryOption[] {
  return items.flatMap((item) => [
    { value: String(item.id), label: `${depth > 0 ? "  " : ""}${item.name}` },
    ...flattenDirectoryOptions(item.children || [], depth + 1),
  ])
}

function buildForm(item: KnowledgeDocument | null, initialDirectoryId = 0): EditForm {
  if (!item) {
    return { ...emptyForm, directoryId: String(initialDirectoryId) }
  }

  return {
    directoryId: String(item.directoryId || 0),
    title: item.title,
    contentType: item.contentType || KnowledgeDocumentContentType.Markdown,
    content: item.content || "",
  }
}

function buildPayload(form: EditForm, knowledgeBaseId: number): CreateKnowledgeDocumentPayload {
  return {
    knowledgeBaseId,
    directoryId: Number(form.directoryId),
    title: form.title.trim(),
    contentType: form.contentType,
    content: form.content.trim(),
  }
}

export function DocumentEditDialog({
  open,
  saving,
  itemId,
  knowledgeBaseId,
  initialDirectoryId = 0,
  onOpenChange,
  onSubmit,
}: DocumentEditDialogProps) {
  if (!open || !knowledgeBaseId) {
    return null
  }

  return (
    <DocumentFormDialogBody
      key={itemId ? `edit-${itemId}` : "create"}
      itemId={itemId}
      knowledgeBaseId={knowledgeBaseId}
      initialDirectoryId={initialDirectoryId}
      saving={saving}
      onOpenChange={onOpenChange}
      onSubmit={onSubmit}
    />
  )
}

type DocumentFormDialogBodyProps = {
  saving: boolean
  itemId: number | null
  knowledgeBaseId: number
  initialDirectoryId: number
  onOpenChange: (open: boolean) => void
  onSubmit: (payload: CreateKnowledgeDocumentPayload) => Promise<void>
}

function DocumentFormDialogBody({
  saving,
  itemId,
  knowledgeBaseId,
  initialDirectoryId,
  onOpenChange,
  onSubmit,
}: DocumentFormDialogBodyProps) {
  const t = useI18n()
  const formId = "knowledge-document-edit-form"
  const [loading, setLoading] = useState(false)
  const [directories, setDirectories] = useState<KnowledgeDirectory[]>([])
  const knowledgeDocumentFormSchema = useMemo(() => createKnowledgeDocumentFormSchema(t), [t])
  const editFormResolver = useMemo(
    () => zodResolver(knowledgeDocumentFormSchema) as Resolver<EditForm>,
    [knowledgeDocumentFormSchema],
  )
  const form = useForm<EditForm>({
    resolver: editFormResolver,
    defaultValues: emptyForm,
  })
  const {
    control,
    handleSubmit,
    reset,
    register,
    setValue,
    watch,
    formState: { errors },
  } = form

  const contentType = watch("contentType")
  const content = watch("content")
  const directoryOptions = useMemo(
    () => [
      { value: "0", label: t("knowledge.rootContent") },
      ...flattenDirectoryOptions(directories),
    ],
    [directories, t],
  )

  useEffect(() => {
    async function loadDetail() {
      if (!itemId) {
        reset(buildForm(null, initialDirectoryId))
        return
      }
      setLoading(true)
      try {
        const data = await fetchKnowledgeDocument(itemId)
        reset(buildForm(data))
      } catch (error) {
        console.error("Failed to load knowledge document:", error)
      } finally {
        setLoading(false)
      }
    }
    void loadDetail()
  }, [itemId, initialDirectoryId, reset])

  useEffect(() => {
    let cancelled = false
    async function loadDirectories() {
      try {
        const data = await fetchKnowledgeDirectories(knowledgeBaseId)
        if (!cancelled) {
          setDirectories(data)
        }
      } catch (error) {
        console.error("Failed to load knowledge directories:", error)
      }
    }
    void loadDirectories()
    return () => {
      cancelled = true
    }
  }, [knowledgeBaseId])

  async function onFormSubmit(values: EditForm) {
    const payload = buildPayload({ ...values, contentType, content }, knowledgeBaseId)
    await onSubmit(payload)
  }

  return (
    <ProjectDialog
      open={true}
      onOpenChange={onOpenChange}
      title={itemId ? t("knowledge.editDocumentTitle") : t("knowledge.createDocumentTitle")}
      size="xl"
      allowFullscreen
      footer={
        <>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            {t("knowledge.cancel")}
          </Button>
          <Button type="submit" form={formId} disabled={saving || loading}>
            {saving ? t("knowledge.saving") : itemId ? t("knowledge.save") : t("knowledge.create")}
          </Button>
        </>
      }
    >
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-muted-foreground">{t("knowledge.loading")}</div>
        </div>
      ) : (
        <form id={formId} onSubmit={handleSubmit(onFormSubmit)} className="space-y-4">
          <Field data-invalid={!!errors.directoryId}>
            <FieldLabel>{t("knowledge.directory")}</FieldLabel>
            <FieldContent>
              <Controller
                control={control}
                name="directoryId"
                render={({ field }) => (
                  <OptionCombobox
                    value={field.value}
                    onChange={(value) => field.onChange(value ?? "0")}
                    options={directoryOptions}
                    placeholder={t("knowledge.selectDirectory")}
                    searchPlaceholder={t("knowledge.searchDirectory")}
                    emptyText={t("knowledge.emptyDirectory")}
                  />
                )}
              />
              <FieldError errors={[errors.directoryId]} />
            </FieldContent>
          </Field>

          <Field data-invalid={!!errors.title}>
            <FieldLabel htmlFor="doc-title">{t("knowledge.documentTitle")}</FieldLabel>
            <FieldContent>
              <Input
                id="doc-title"
                placeholder={t("knowledge.documentTitlePlaceholder")}
                aria-invalid={!!errors.title}
                {...register("title")}
              />
              <FieldError errors={[errors.title]} />
            </FieldContent>
          </Field>

          <Field data-invalid={!!errors.content}>
            <FieldLabel htmlFor="doc-content">{t("knowledge.content")}</FieldLabel>
            <FieldContent>
              <Controller
                control={control}
                name="content"
                render={({ field }) => (
                  <ContentEditor
                    value={{
                      mode:
                        contentType === KnowledgeDocumentContentType.HTML
                          ? KnowledgeDocumentContentType.HTML
                          : KnowledgeDocumentContentType.Markdown,
                      raw: field.value ?? "",
                    }}
                    onChange={(next) => {
                      field.onChange(next.raw)
                      setValue("contentType", next.mode, {
                        shouldDirty: true,
                        shouldValidate: true,
                      })
                    }}
                    placeholder={t("knowledge.contentPlaceholder")}
                    disabled={saving}
                  />
                )}
              />
              <FieldError errors={[errors.content]} />
            </FieldContent>
          </Field>

        </form>
      )}
    </ProjectDialog>
  )
}
