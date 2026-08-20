"use client"

import { useEffect, useMemo, useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, Resolver, useForm } from "react-hook-form"
import { z } from "zod/v4"

import { ProjectDialog } from "@/components/project-dialog"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldContent,
  FieldError,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { type AIConfig, type CreateAIConfigPayload, fetchAIConfig } from "@/lib/api/admin"
import {
  AIModelType,
  AIProvider,
} from "@/lib/generated/enums"
import { useI18n } from "@/i18n/provider"
import { OptionCombobox } from "@/components/option-combobox"

type AIConfigEditDialogProps = {
  open: boolean
  saving: boolean
  itemId: number | null
  onOpenChange: (open: boolean) => void
  onSubmit: (payload: CreateAIConfigPayload) => Promise<void>
}

type TFunction = (key: string, values?: Record<string, string | number>) => string

function getProviderOptions(t: TFunction) {
  return [{ value: String(AIProvider.OpenAI), label: t("aiConfig.providerOpenAI") }]
}

function getModelTypeOptions(t: TFunction) {
  return [
    { value: String(AIModelType.LLM), label: t("aiConfig.modelTypeLlm") },
    { value: String(AIModelType.Embedding), label: t("aiConfig.modelTypeEmbedding") },
    { value: String(AIModelType.Rerank), label: t("aiConfig.modelTypeRerank") },
  ]
}

const emptyForm: EditForm = {
  name: "",
  provider: AIProvider.OpenAI,
  baseUrl: "",
  apiKey: "",
  modelType: AIModelType.LLM,
  modelName: "",
  dimension: "0",
  maxContextTokens: "0",
  maxOutputTokens: "0",
  timeoutMs: "120000",
  maxRetryCount: "0",
  rpmLimit: "0",
  tpmLimit: "0",
  remark: "",
}

type EditForm = {
  name: string
  provider: string
  baseUrl: string
  apiKey: string
  modelType: string
  modelName: string
  dimension: string
  maxContextTokens: string
  maxOutputTokens: string
  timeoutMs: string
  maxRetryCount: string
  rpmLimit: string
  tpmLimit: string
  remark: string
}

function buildForm(item: AIConfig | null): EditForm {
  if (!item) {
    return emptyForm
  }

  return {
    name: item.name,
    provider: item.provider,
    baseUrl: item.baseUrl,
    apiKey: "",
    modelType: item.modelType,
    modelName: item.modelName,
    dimension: String(item.dimension),
    maxContextTokens: String(item.maxContextTokens),
    maxOutputTokens: String(item.maxOutputTokens),
    timeoutMs: String(item.timeoutMs),
    maxRetryCount: String(item.maxRetryCount),
    rpmLimit: String(item.rpmLimit),
    tpmLimit: String(item.tpmLimit),
    remark: item.remark ?? "",
  }
}

function buildPayload(form: EditForm): CreateAIConfigPayload {
  return {
    name: form.name.trim(),
    provider: form.provider,
    baseUrl: form.baseUrl.trim(),
    apiKey: form.apiKey.trim(),
    modelType: form.modelType,
    modelName: form.modelName.trim(),
    dimension: Number(form.dimension),
    maxContextTokens: Number(form.maxContextTokens),
    maxOutputTokens: Number(form.maxOutputTokens),
    timeoutMs: Number(form.timeoutMs),
    maxRetryCount: Number(form.maxRetryCount),
    rpmLimit: Number(form.rpmLimit),
    tpmLimit: Number(form.tpmLimit),
    remark: form.remark.trim(),
  }
}

export function EditDialog({
  open,
  saving,
  itemId,
  onOpenChange,
  onSubmit,
}: AIConfigEditDialogProps) {
  if (!open) {
    return null
  }

  return (
    <AIConfigEditDialogBody
      key={itemId ? `edit-${itemId}` : "create"}
      open={open}
      saving={saving}
      itemId={itemId}
      onOpenChange={onOpenChange}
      onSubmit={onSubmit}
    />
  )
}

type AIConfigEditDialogBodyProps = AIConfigEditDialogProps

function AIConfigEditDialogBody({
  open,
  saving,
  itemId,
  onOpenChange,
  onSubmit,
}: AIConfigEditDialogBodyProps) {
  const formId = "ai-config-edit-form"
  const t = useI18n()
  const [loading, setLoading] = useState(false)
  const providerOptions = useMemo(() => getProviderOptions(t), [t])
  const modelTypeOptions = useMemo(() => getModelTypeOptions(t), [t])
  const aiConfigFormSchema = useMemo(
    () =>
      z.object({
        name: z.string().trim().min(1, t("aiConfig.nameRequired")),
        provider: z.string().trim().min(1, t("aiConfig.providerRequired")),
        baseUrl: z.string().trim().min(1, t("aiConfig.baseUrlRequired")),
        apiKey: z.string().trim(),
        modelType: z.string().trim().min(1, t("aiConfig.modelTypeRequired")),
        modelName: z.string().trim().min(1, t("aiConfig.modelNameRequired")),
        dimension: z.string().trim().regex(/^\d+$/, t("aiConfig.dimensionInvalid")),
        maxContextTokens: z.string().trim().regex(/^\d+$/, t("aiConfig.maxContextInvalid")),
        maxOutputTokens: z.string().trim().regex(/^\d+$/, t("aiConfig.maxOutputInvalid")),
        timeoutMs: z.string().trim().regex(/^\d+$/, t("aiConfig.timeoutInvalid")),
        maxRetryCount: z.string().trim().regex(/^\d+$/, t("aiConfig.retryInvalid")),
        rpmLimit: z.string().trim().regex(/^\d+$/, t("aiConfig.rpmInvalid")),
        tpmLimit: z.string().trim().regex(/^\d+$/, t("aiConfig.tpmInvalid")),
        remark: z.string().trim(),
      }),
    [t],
  )
  const editFormResolver = useMemo(
    () => zodResolver(aiConfigFormSchema as never) as Resolver<EditForm>,
    [aiConfigFormSchema],
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
    watch,
    formState: { errors },
  } = form

  const modelType = watch("modelType")

  useEffect(() => {
    async function loadDetail() {
      if (!itemId) {
        reset(emptyForm)
        return
      }
      setLoading(true)
      try {
        const data = await fetchAIConfig(itemId)
        reset(buildForm(data))
      } catch (error) {
        console.error("Failed to load AI config:", error)
      } finally {
        setLoading(false)
      }
    }
    void loadDetail()
  }, [itemId, reset])

  async function onFormSubmit(values: EditForm) {
    await onSubmit(buildPayload(values))
  }

  return (
    <ProjectDialog
      open={open}
      onOpenChange={onOpenChange}
      title={itemId ? t("aiConfig.editTitle") : t("aiConfig.createTitle")}
      size="xl"
      footer={
        <>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            {t("aiConfig.cancel")}
          </Button>
          <Button type="submit" form={formId} disabled={saving || loading}>
            {saving ? t("aiConfig.saving") : itemId ? t("aiConfig.save") : t("aiConfig.create")}
          </Button>
        </>
      }
    >
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-muted-foreground">{t("aiConfig.loading")}</div>
        </div>
      ) : (
        <form id={formId} onSubmit={handleSubmit(onFormSubmit)} className="space-y-4">
          <Field data-invalid={!!errors.name}>
            <FieldLabel htmlFor="ai-config-name">{t("aiConfig.name")}</FieldLabel>
            <FieldContent>
              <Input
                id="ai-config-name"
                placeholder={t("aiConfig.namePlaceholder")}
                aria-invalid={!!errors.name}
                {...register("name")}
              />
              <FieldError errors={[errors.name]} />
            </FieldContent>
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field data-invalid={!!errors.provider}>
              <FieldLabel>{t("aiConfig.provider")}</FieldLabel>
              <FieldContent>
                <Controller
                  control={control}
                  name="provider"
                  render={({ field }) => (
                    <OptionCombobox
                      value={field.value}
                      options={providerOptions}
                      placeholder={t("aiConfig.selectProvider")}
                      searchPlaceholder={t("aiConfig.searchProvider")}
                      emptyText={t("aiConfig.emptyProvider")}
                      onChange={field.onChange}
                    />
                  )}
                />
                <FieldError errors={[errors.provider]} />
              </FieldContent>
            </Field>

            <Field data-invalid={!!errors.modelType}>
              <FieldLabel>{t("aiConfig.modelType")}</FieldLabel>
              <FieldContent>
                <Controller
                  control={control}
                  name="modelType"
                  render={({ field }) => (
                    <OptionCombobox
                      value={field.value}
                      options={modelTypeOptions}
                      placeholder={t("aiConfig.selectModelType")}
                      searchPlaceholder={t("aiConfig.searchModelType")}
                      emptyText={t("aiConfig.emptyModelType")}
                      onChange={field.onChange}
                    />
                  )}
                />
                <FieldError errors={[errors.modelType]} />
              </FieldContent>
            </Field>
          </div>

          <Field data-invalid={!!errors.baseUrl}>
            <FieldLabel htmlFor="ai-config-base-url">{t("aiConfig.baseUrl")}</FieldLabel>
            <FieldContent>
              <Input
                id="ai-config-base-url"
                placeholder={t("aiConfig.baseUrlPlaceholder")}
                aria-invalid={!!errors.baseUrl}
                {...register("baseUrl")}
              />
              <FieldError errors={[errors.baseUrl]} />
            </FieldContent>
          </Field>

          <Field data-invalid={!!errors.apiKey}>
            <FieldLabel htmlFor="ai-config-api-key">API Key</FieldLabel>
            <FieldContent>
              <Input
                id="ai-config-api-key"
                type="password"
                placeholder={t("aiConfig.apiKeyPlaceholder")}
                aria-invalid={!!errors.apiKey}
                {...register("apiKey")}
              />
              <FieldError errors={[errors.apiKey]} />
            </FieldContent>
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field data-invalid={!!errors.modelName}>
              <FieldLabel htmlFor="ai-config-model-name">{t("aiConfig.modelName")}</FieldLabel>
              <FieldContent>
                <Input
                  id="ai-config-model-name"
                  placeholder={t("aiConfig.modelNamePlaceholder")}
                  aria-invalid={!!errors.modelName}
                  {...register("modelName")}
                />
                <FieldError errors={[errors.modelName]} />
              </FieldContent>
            </Field>

            <Field data-invalid={!!errors.dimension}>
              <FieldLabel htmlFor="ai-config-dimension">{t("aiConfig.dimensionLabel")}</FieldLabel>
              <FieldContent>
                <Input
                  id="ai-config-dimension"
                  type="number"
                  min={0}
                  step={1}
                  disabled={modelType !== AIModelType.Embedding}
                  aria-invalid={!!errors.dimension}
                  {...register("dimension")}
                />
                <FieldError errors={[errors.dimension]} />
              </FieldContent>
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field data-invalid={!!errors.maxContextTokens}>
              <FieldLabel htmlFor="ai-config-max-context">{t("aiConfig.maxContextTokens")}</FieldLabel>
              <FieldContent>
                <Input
                  id="ai-config-max-context"
                  type="number"
                  min={0}
                  step={1}
                  aria-invalid={!!errors.maxContextTokens}
                  {...register("maxContextTokens")}
                />
                <FieldError errors={[errors.maxContextTokens]} />
              </FieldContent>
            </Field>

            <Field data-invalid={!!errors.maxOutputTokens}>
              <FieldLabel htmlFor="ai-config-max-output">{t("aiConfig.maxOutputTokens")}</FieldLabel>
              <FieldContent>
                <Input
                  id="ai-config-max-output"
                  type="number"
                  min={0}
                  step={1}
                  aria-invalid={!!errors.maxOutputTokens}
                  {...register("maxOutputTokens")}
                />
                <FieldError errors={[errors.maxOutputTokens]} />
              </FieldContent>
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field data-invalid={!!errors.timeoutMs}>
              <FieldLabel htmlFor="ai-config-timeout">{t("aiConfig.timeoutMs")}</FieldLabel>
              <FieldContent>
                <Input
                  id="ai-config-timeout"
                  type="number"
                  min={0}
                  step={1}
                  aria-invalid={!!errors.timeoutMs}
                  {...register("timeoutMs")}
                />
                <FieldError errors={[errors.timeoutMs]} />
              </FieldContent>
            </Field>

            <Field data-invalid={!!errors.maxRetryCount}>
              <FieldLabel htmlFor="ai-config-retry">{t("aiConfig.maxRetryCount")}</FieldLabel>
              <FieldContent>
                <Input
                  id="ai-config-retry"
                  type="number"
                  min={0}
                  step={1}
                  aria-invalid={!!errors.maxRetryCount}
                  {...register("maxRetryCount")}
                />
                <FieldError errors={[errors.maxRetryCount]} />
              </FieldContent>
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field data-invalid={!!errors.rpmLimit}>
              <FieldLabel htmlFor="ai-config-rpm">{t("aiConfig.rpmLimit")}</FieldLabel>
              <FieldContent>
                <Input
                  id="ai-config-rpm"
                  type="number"
                  min={0}
                  step={1}
                  aria-invalid={!!errors.rpmLimit}
                  {...register("rpmLimit")}
                />
                <FieldError errors={[errors.rpmLimit]} />
              </FieldContent>
            </Field>

            <Field data-invalid={!!errors.tpmLimit}>
              <FieldLabel htmlFor="ai-config-tpm">{t("aiConfig.tpmLimit")}</FieldLabel>
              <FieldContent>
                <Input
                  id="ai-config-tpm"
                  type="number"
                  min={0}
                  step={1}
                  aria-invalid={!!errors.tpmLimit}
                  {...register("tpmLimit")}
                />
                <FieldError errors={[errors.tpmLimit]} />
              </FieldContent>
            </Field>
          </div>

          <Field data-invalid={!!errors.remark}>
            <FieldLabel htmlFor="ai-config-remark">{t("aiConfig.remark")}</FieldLabel>
            <FieldContent>
              <Textarea
                id="ai-config-remark"
                placeholder={t("aiConfig.remarkPlaceholder")}
                rows={3}
                aria-invalid={!!errors.remark}
                {...register("remark")}
              />
              <FieldError errors={[errors.remark]} />
            </FieldContent>
          </Field>
        </form>
      )}
    </ProjectDialog>
  )
}
