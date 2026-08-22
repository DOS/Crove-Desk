"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo, useState } from "react";
import { Controller, type Resolver, useForm } from "react-hook-form";
import { z } from "zod/v4";

import { OptionCombobox } from "@/components/option-combobox";
import { ProjectDialog } from "@/components/project-dialog";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldContent,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  fetchKnowledgeBase,
  type CreateKnowledgeBasePayload,
  type KnowledgeBase,
} from "@/lib/api/admin";
import { useI18n } from "@/i18n/provider";
import {
  KnowledgeAnswerMode,
  KnowledgeBaseType,
  KnowledgeChunkProvider,
} from "@/lib/generated/enums";

type KnowledgeBaseEditDialogProps = {
  open: boolean;
  saving: boolean;
  itemId: number | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: CreateKnowledgeBasePayload) => Promise<void>;
};

const emptyForm: EditForm = {
  name: "",
  description: "",
  knowledgeType: KnowledgeBaseType.Document,
  defaultTopK: "5",
  defaultScoreThreshold: "0.2",
  defaultRerankLimit: "10",
  chunkProvider: KnowledgeChunkProvider.Structured,
  chunkTargetTokens: "300",
  chunkMaxTokens: "400",
  chunkOverlapTokens: "40",
  answerMode: String(KnowledgeAnswerMode.Strict),
  remark: "",
};

type TFunction = (key: string, values?: Record<string, string | number>) => string;

function createKnowledgeBaseFormSchema(t: TFunction) {
  return z.object({
  name: z.string().trim().min(1, t("knowledge.nameRequired")).max(100, t("knowledge.nameMax")),
  description: z.string().trim().max(500, t("knowledge.descriptionMax")),
  knowledgeType: z.string().trim().min(1, t("knowledge.typeRequired")),
  defaultTopK: z.string().trim().min(1, t("knowledge.topKRequired")),
  defaultScoreThreshold: z.string().trim().min(1, t("knowledge.scoreRequired")),
  defaultRerankLimit: z.string().trim().min(1, t("knowledge.rerankRequired")),
  chunkProvider: z.string().trim().min(1, t("knowledge.chunkProviderRequired")),
  chunkTargetTokens: z.string().trim().min(1, t("knowledge.targetTokensRequired")),
  chunkMaxTokens: z.string().trim().min(1, t("knowledge.maxTokensRequired")),
  chunkOverlapTokens: z.string().trim().min(1, t("knowledge.overlapTokensRequired")),
  answerMode: z.string().trim().min(1, t("knowledge.answerModeRequired")),
  remark: z.string().trim().max(500, t("knowledge.remarkMax")),
  });
}

type EditForm = {
  name: string;
  description: string;
  knowledgeType: string;
  defaultTopK: string;
  defaultScoreThreshold: string;
  defaultRerankLimit: string;
  chunkProvider: string;
  chunkTargetTokens: string;
  chunkMaxTokens: string;
  chunkOverlapTokens: string;
  answerMode: string;
  remark: string;
};

function getKnowledgeTypeOptions(t: TFunction) {
  return [
    { value: KnowledgeBaseType.Document, label: t("knowledge.typeDocument") },
    { value: KnowledgeBaseType.FAQ, label: t("knowledge.typeFAQ") },
  ];
}

function getChunkProviderOptions(t: TFunction) {
  return [
    { value: KnowledgeChunkProvider.Fixed, label: t("knowledge.chunkFixed") },
    { value: KnowledgeChunkProvider.Structured, label: t("knowledge.chunkStructured") },
    { value: KnowledgeChunkProvider.Semantic, label: t("knowledge.chunkSemantic") },
  ];
}

function getAnswerModeOptions(t: TFunction) {
  return [
    { value: String(KnowledgeAnswerMode.Strict), label: t("knowledge.answerStrict") },
    { value: String(KnowledgeAnswerMode.Assist), label: t("knowledge.answerAssist") },
  ];
}

function buildForm(item: KnowledgeBase | null): EditForm {
  if (!item) {
    return emptyForm;
  }

  return {
    name: item.name,
    description: item.description || "",
    knowledgeType: item.knowledgeType || KnowledgeBaseType.Document,
    defaultTopK: String(item.defaultTopK),
    defaultScoreThreshold: String(item.defaultScoreThreshold),
    defaultRerankLimit: String(item.defaultRerankLimit),
    chunkProvider: item.chunkProvider,
    chunkTargetTokens: String(item.chunkTargetTokens),
    chunkMaxTokens: String(item.chunkMaxTokens),
    chunkOverlapTokens: String(item.chunkOverlapTokens),
    answerMode: String(item.answerMode),
    remark: item.remark || "",
  };
}

function buildPayload(form: EditForm): CreateKnowledgeBasePayload {
  return {
    name: form.name.trim(),
    description: form.description.trim(),
    knowledgeType: form.knowledgeType,
    defaultTopK: Number(form.defaultTopK),
    defaultScoreThreshold: Number(form.defaultScoreThreshold),
    defaultRerankLimit: Number(form.defaultRerankLimit),
    chunkProvider: form.chunkProvider,
    chunkTargetTokens: Number(form.chunkTargetTokens),
    chunkMaxTokens: Number(form.chunkMaxTokens),
    chunkOverlapTokens: Number(form.chunkOverlapTokens),
    answerMode: Number(form.answerMode),
    remark: form.remark.trim(),
  };
}

export function EditDialog({
  open,
  saving,
  itemId,
  onOpenChange,
  onSubmit,
}: KnowledgeBaseEditDialogProps) {
  if (!open) {
    return null;
  }

  return (
    <KnowledgeBaseFormDialogBody
      key={itemId ? `edit-${itemId}` : "create"}
      open={open}
      itemId={itemId}
      saving={saving}
      onOpenChange={onOpenChange}
      onSubmit={onSubmit}
    />
  );
}

type KnowledgeBaseFormDialogBodyProps = {
  open: boolean;
  saving: boolean;
  itemId: number | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: CreateKnowledgeBasePayload) => Promise<void>;
};

function KnowledgeBaseFormDialogBody({
  open,
  saving,
  itemId,
  onOpenChange,
  onSubmit,
}: KnowledgeBaseFormDialogBodyProps) {
  const t = useI18n();
  const formId = "knowledge-base-edit-form";
  const [loading, setLoading] = useState(false);
  const knowledgeBaseFormSchema = useMemo(() => createKnowledgeBaseFormSchema(t), [t]);
  const editFormResolver = useMemo(
    () => zodResolver(knowledgeBaseFormSchema) as Resolver<EditForm>,
    [knowledgeBaseFormSchema],
  );
  const knowledgeTypeOptions = useMemo(() => getKnowledgeTypeOptions(t), [t]);
  const chunkProviderOptions = useMemo(() => getChunkProviderOptions(t), [t]);
  const answerModeOptions = useMemo(() => getAnswerModeOptions(t), [t]);
  const form = useForm<EditForm>({
    resolver: editFormResolver,
    defaultValues: buildForm(null),
  });
  const {
    control,
    handleSubmit,
    reset,
    register,
    watch,
    formState: { errors },
  } = form;
  const knowledgeType = watch("knowledgeType");
  const isFAQKnowledgeBase = knowledgeType === KnowledgeBaseType.FAQ;

  useEffect(() => {
    if (!open) {
      return;
    }

    if (itemId === null) {
      reset(buildForm(null));
      return;
    }

    let cancelled = false;

    async function loadItem() {
      try {
        setLoading(true);
        const data = await fetchKnowledgeBase(itemId!);
        if (!cancelled) {
          reset(buildForm(data));
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to load knowledge base:", error);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadItem();

    return () => {
      cancelled = true;
    };
  }, [open, itemId, reset]);

  async function onFormSubmit(values: EditForm) {
    const payload = buildPayload(values);
    await onSubmit(payload);
  }

  return (
    <ProjectDialog
      open={open}
      onOpenChange={onOpenChange}
      title={itemId ? t("knowledge.editBaseTitle") : t("knowledge.createBaseTitle")}
      size="lg"
      footer={
        <>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving || loading}
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
        <div className="flex items-center justify-center py-8">
          <div className="text-sm text-muted-foreground">{t("knowledge.loading")}</div>
        </div>
      ) : (
        <form
          id={formId}
          onSubmit={handleSubmit(onFormSubmit)}
          className="space-y-4"
        >
          <Field data-invalid={!!errors.knowledgeType}>
            <FieldLabel htmlFor="kb-knowledge-type">{t("knowledge.knowledgeType")}</FieldLabel>
            <FieldContent>
              <Controller
                control={control}
                name="knowledgeType"
                render={({ field }) => (
                  <OptionCombobox
                    value={field.value}
                    options={knowledgeTypeOptions}
                    placeholder={t("knowledge.selectKnowledgeType")}
                    searchPlaceholder={t("knowledge.searchKnowledgeType")}
                    emptyText={t("knowledge.emptyKnowledgeType")}
                    onChange={field.onChange}
                  />
                )}
              />
              <FieldError errors={[errors.knowledgeType]} />
            </FieldContent>
          </Field>

          <Field data-invalid={!!errors.name}>
            <FieldLabel htmlFor="kb-name">{t("knowledge.name")}</FieldLabel>
            <FieldContent>
              <Input
                id="kb-name"
                placeholder={t("knowledge.namePlaceholder")}
                aria-invalid={!!errors.name}
                {...register("name")}
              />
              <FieldError errors={[errors.name]} />
            </FieldContent>
          </Field>

          <Field data-invalid={!!errors.description}>
            <FieldLabel htmlFor="kb-description">{t("knowledge.description")}</FieldLabel>
            <FieldContent>
              <Textarea
                id="kb-description"
                placeholder={t("knowledge.descriptionPlaceholder")}
                rows={3}
                aria-invalid={!!errors.description}
                {...register("description")}
              />
              <FieldError errors={[errors.description]} />
            </FieldContent>
          </Field>

          {!isFAQKnowledgeBase ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            <Field data-invalid={!!errors.chunkProvider}>
              <FieldLabel htmlFor="kb-chunk-provider">{t("knowledge.chunkProvider")}</FieldLabel>
              <FieldContent>
                <Controller
                  control={control}
                  name="chunkProvider"
                  render={({ field }) => (
                    <OptionCombobox
                      value={field.value}
                      options={chunkProviderOptions}
                      placeholder={t("knowledge.selectChunkProvider")}
                      searchPlaceholder={t("knowledge.searchChunkProvider")}
                      emptyText={t("knowledge.emptyChunkProvider")}
                      onChange={field.onChange}
                    />
                  )}
                />
                <FieldError errors={[errors.chunkProvider]} />
              </FieldContent>
            </Field>
            <Field data-invalid={!!errors.chunkTargetTokens}>
              <FieldLabel htmlFor="kb-chunk-target-tokens">
                {t("knowledge.targetToken")}
              </FieldLabel>
              <FieldContent>
                <Input
                  id="kb-chunk-target-tokens"
                  type="number"
                  min="1"
                  max="2000"
                  aria-invalid={!!errors.chunkTargetTokens}
                  {...register("chunkTargetTokens")}
                />
                <FieldError errors={[errors.chunkTargetTokens]} />
              </FieldContent>
            </Field>
            <Field data-invalid={!!errors.chunkMaxTokens}>
              <FieldLabel htmlFor="kb-chunk-max-tokens">{t("knowledge.maxToken")}</FieldLabel>
              <FieldContent>
                <Input
                  id="kb-chunk-max-tokens"
                  type="number"
                  min="1"
                  max="4000"
                  aria-invalid={!!errors.chunkMaxTokens}
                  {...register("chunkMaxTokens")}
                />
                <FieldError errors={[errors.chunkMaxTokens]} />
              </FieldContent>
            </Field>
            <Field data-invalid={!!errors.chunkOverlapTokens}>
              <FieldLabel htmlFor="kb-chunk-overlap-tokens">
                {t("knowledge.overlapToken")}
              </FieldLabel>
              <FieldContent>
                <Input
                  id="kb-chunk-overlap-tokens"
                  type="number"
                  min="0"
                  max="500"
                  aria-invalid={!!errors.chunkOverlapTokens}
                  {...register("chunkOverlapTokens")}
                />
                <FieldError errors={[errors.chunkOverlapTokens]} />
              </FieldContent>
            </Field>
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            <Field data-invalid={!!errors.defaultTopK}>
              <FieldLabel htmlFor="kb-default-top-k">{t("knowledge.defaultTopK")}</FieldLabel>
              <FieldContent>
                <Input
                  id="kb-default-top-k"
                  type="number"
                  min="1"
                  max="100"
                  aria-invalid={!!errors.defaultTopK}
                  {...register("defaultTopK")}
                />
                <FieldError errors={[errors.defaultTopK]} />
              </FieldContent>
            </Field>
            <Field data-invalid={!!errors.defaultScoreThreshold}>
              <FieldLabel htmlFor="kb-default-score-threshold">
                {t("knowledge.defaultScoreThreshold")}
              </FieldLabel>
              <FieldContent>
                <Input
                  id="kb-default-score-threshold"
                  type="number"
                  min="0"
                  max="1"
                  step="0.1"
                  aria-invalid={!!errors.defaultScoreThreshold}
                  {...register("defaultScoreThreshold")}
                />
                <FieldError errors={[errors.defaultScoreThreshold]} />
              </FieldContent>
            </Field>
            <Field data-invalid={!!errors.defaultRerankLimit}>
              <FieldLabel htmlFor="kb-default-rerank-limit">
                {t("knowledge.defaultRerankLimit")}
              </FieldLabel>
              <FieldContent>
                <Input
                  id="kb-default-rerank-limit"
                  type="number"
                  min="0"
                  max="100"
                  aria-invalid={!!errors.defaultRerankLimit}
                  {...register("defaultRerankLimit")}
                />
                <FieldError errors={[errors.defaultRerankLimit]} />
              </FieldContent>
            </Field>
            <Field data-invalid={!!errors.answerMode}>
              <FieldLabel htmlFor="kb-answer-mode">{t("knowledge.answerMode")}</FieldLabel>
              <FieldContent>
                <Controller
                  control={control}
                  name="answerMode"
                  render={({ field }) => (
                    <OptionCombobox
                      value={field.value}
                      options={answerModeOptions}
                      placeholder={t("knowledge.selectAnswerMode")}
                      searchPlaceholder={t("knowledge.searchAnswerMode")}
                      emptyText={t("knowledge.emptyAnswerMode")}
                      onChange={field.onChange}
                    />
                  )}
                />
                <FieldError errors={[errors.answerMode]} />
              </FieldContent>
            </Field>
          </div>

          <Field data-invalid={!!errors.remark}>
            <FieldLabel htmlFor="kb-remark">{t("knowledge.remark")}</FieldLabel>
            <FieldContent>
              <Textarea
                id="kb-remark"
                placeholder={t("knowledge.remarkPlaceholder")}
                rows={2}
                aria-invalid={!!errors.remark}
                {...register("remark")}
              />
              <FieldError errors={[errors.remark]} />
            </FieldContent>
          </Field>
        </form>
      )}
    </ProjectDialog>
  );
}
