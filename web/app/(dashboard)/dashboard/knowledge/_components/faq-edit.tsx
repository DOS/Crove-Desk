"use client";

import { useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, type Resolver } from "react-hook-form";
import { z } from "zod/v4";

import { ProjectDialog } from "@/components/project-dialog";
import { OptionCombobox } from "@/components/option-combobox";
import { Button } from "@/components/ui/button";
import { Field, FieldContent, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  fetchKnowledgeFAQ,
  fetchKnowledgeDirectories,
  type CreateKnowledgeFAQPayload,
  type KnowledgeDirectory,
  type KnowledgeFAQ,
} from "@/lib/api/admin";
import { useI18n } from "@/i18n/provider";

type FAQEditDialogProps = {
  open: boolean;
  saving: boolean;
  itemId: number | null;
  knowledgeBaseId: number | null;
  initialDirectoryId?: number;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: CreateKnowledgeFAQPayload) => Promise<void>;
};

type TFunction = (key: string, values?: Record<string, string | number>) => string;

function createFormSchema(t: TFunction) {
  return z.object({
  directoryId: z.string().trim(),
  question: z.string().trim().min(1, t("knowledge.faqQuestionRequired")).max(500, t("knowledge.faqQuestionMax")),
  answer: z.string().trim().min(1, t("knowledge.faqAnswerRequired")),
  similarQuestionsText: z.string(),
  remark: z.string().trim().max(500, t("knowledge.remarkMax")),
  });
}

type EditForm = {
  directoryId: string;
  question: string;
  answer: string;
  similarQuestionsText: string;
  remark: string;
};

const emptyForm: EditForm = {
  directoryId: "0",
  question: "",
  answer: "",
  similarQuestionsText: "",
  remark: "",
};

type DirectoryOption = { value: string; label: string };

function flattenDirectoryOptions(items: KnowledgeDirectory[], depth = 0): DirectoryOption[] {
  return items.flatMap((item) => [
    { value: String(item.id), label: `${depth > 0 ? "  " : ""}${item.name}` },
    ...flattenDirectoryOptions(item.children || [], depth + 1),
  ]);
}

function buildForm(item: KnowledgeFAQ | null, initialDirectoryId = 0): EditForm {
  if (!item) {
    return { ...emptyForm, directoryId: String(initialDirectoryId) };
  }
  return {
    directoryId: String(item.directoryId || 0),
    question: item.question,
    answer: item.answer,
    similarQuestionsText: (item.similarQuestions ?? []).join("\n"),
    remark: item.remark ?? "",
  };
}

function buildPayload(form: EditForm, knowledgeBaseId: number): CreateKnowledgeFAQPayload {
  return {
    knowledgeBaseId,
    directoryId: Number(form.directoryId),
    question: form.question.trim(),
    answer: form.answer.trim(),
    similarQuestions: form.similarQuestionsText
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean),
    remark: form.remark.trim(),
  };
}

export function FAQEditDialog({
  open,
  saving,
  itemId,
  knowledgeBaseId,
  initialDirectoryId = 0,
  onOpenChange,
  onSubmit,
}: FAQEditDialogProps) {
  if (!open || !knowledgeBaseId) {
    return null;
  }
  return (
    <FAQEditDialogBody
      key={itemId ? `edit-${itemId}` : "create"}
      open={open}
      saving={saving}
      itemId={itemId}
      knowledgeBaseId={knowledgeBaseId}
      initialDirectoryId={initialDirectoryId}
      onOpenChange={onOpenChange}
      onSubmit={onSubmit}
    />
  );
}

type FAQEditDialogBodyProps = {
  open: boolean;
  saving: boolean;
  itemId: number | null;
  knowledgeBaseId: number;
  initialDirectoryId: number;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: CreateKnowledgeFAQPayload) => Promise<void>;
};

function FAQEditDialogBody({
  open,
  saving,
  itemId,
  knowledgeBaseId,
  initialDirectoryId,
  onOpenChange,
  onSubmit,
}: FAQEditDialogBodyProps) {
  const t = useI18n();
  const [loading, setLoading] = useState(false);
  const [directories, setDirectories] = useState<KnowledgeDirectory[]>([]);
  const formId = "knowledge-faq-edit-form";
  const formSchema = useMemo(() => createFormSchema(t), [t]);
  const resolver = useMemo(
    () => zodResolver(formSchema) as Resolver<EditForm>,
    [formSchema],
  );
  const form = useForm<EditForm>({
    resolver,
    defaultValues: emptyForm,
  });
  const {
    handleSubmit,
    reset,
    register,
    formState: { errors },
  } = form;
  const directoryOptions = useMemo(
    () => [
      { value: "0", label: t("knowledge.rootContent") },
      ...flattenDirectoryOptions(directories),
    ],
    [directories, t],
  );

  useEffect(() => {
    async function loadDetail() {
      if (!itemId) {
        reset(buildForm(null, initialDirectoryId));
        return;
      }
      setLoading(true);
      try {
        const data = await fetchKnowledgeFAQ(itemId);
        reset(buildForm(data));
      } finally {
        setLoading(false);
      }
    }
    if (open) {
      void loadDetail();
    }
  }, [itemId, initialDirectoryId, open, reset]);

  useEffect(() => {
    if (!open) {
      return;
    }
    let cancelled = false;
    async function loadDirectories() {
      try {
        const data = await fetchKnowledgeDirectories(knowledgeBaseId);
        if (!cancelled) {
          setDirectories(data);
        }
      } catch (error) {
        console.error("Failed to load knowledge directories:", error);
      }
    }
    void loadDirectories();
    return () => {
      cancelled = true;
    };
  }, [knowledgeBaseId, open]);

  async function onFormSubmit(values: EditForm) {
    await onSubmit(buildPayload(values, knowledgeBaseId));
  }

  return (
    <ProjectDialog
      open={open}
      onOpenChange={onOpenChange}
      title={itemId ? t("knowledge.editFAQTitle") : t("knowledge.createFAQTitle")}
      allowFullscreen
      size="xl"
      footer={
        <>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            {t("knowledge.cancel")}
          </Button>
          <Button type="submit" form={formId} disabled={saving || loading}>
            {saving ? t("knowledge.saving") : itemId ? t("knowledge.save") : t("knowledge.create")}
          </Button>
        </>
      }
    >
      {loading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">{t("knowledge.loading")}</div>
      ) : (
        <form id={formId} onSubmit={handleSubmit(onFormSubmit)} className="space-y-4">
          <Field data-invalid={!!errors.directoryId}>
            <FieldLabel>{t("knowledge.directory")}</FieldLabel>
            <FieldContent>
              <OptionCombobox
                value={form.watch("directoryId")}
                onChange={(value) => form.setValue("directoryId", value ?? "0", { shouldDirty: true })}
                options={directoryOptions}
                placeholder={t("knowledge.selectDirectory")}
                searchPlaceholder={t("knowledge.searchDirectory")}
                emptyText={t("knowledge.emptyDirectory")}
              />
              <FieldError errors={[errors.directoryId]} />
            </FieldContent>
          </Field>

          <Field data-invalid={!!errors.question}>
            <FieldLabel htmlFor="faq-question">{t("knowledge.standardQuestion")}</FieldLabel>
            <FieldContent>
              <Input id="faq-question" placeholder={t("knowledge.questionPlaceholder")} {...register("question")} />
              <FieldError errors={[errors.question]} />
            </FieldContent>
          </Field>

          <Field data-invalid={!!errors.answer}>
            <FieldLabel htmlFor="faq-answer">{t("knowledge.answer")}</FieldLabel>
            <FieldContent>
              <Textarea id="faq-answer" rows={8} placeholder={t("knowledge.answerPlaceholder")} {...register("answer")} />
              <FieldError errors={[errors.answer]} />
            </FieldContent>
          </Field>

          <Field>
            <FieldLabel htmlFor="faq-similar-questions">{t("knowledge.similarQuestions")}</FieldLabel>
            <FieldContent>
              <Textarea
                id="faq-similar-questions"
                rows={5}
                placeholder={t("knowledge.similarQuestionsPlaceholder")}
                {...register("similarQuestionsText")}
              />
            </FieldContent>
          </Field>

          <Field data-invalid={!!errors.remark}>
            <FieldLabel htmlFor="faq-remark">{t("knowledge.remark")}</FieldLabel>
            <FieldContent>
              <Textarea id="faq-remark" rows={3} placeholder={t("knowledge.remarkPlaceholder")} {...register("remark")} />
              <FieldError errors={[errors.remark]} />
            </FieldContent>
          </Field>
        </form>
      )}
    </ProjectDialog>
  );
}
