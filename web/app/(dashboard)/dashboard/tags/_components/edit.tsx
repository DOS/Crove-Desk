"use client";

import { useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, Resolver, useForm } from "react-hook-form";
import { z } from "zod/v4";

import { ProjectDialog } from "@/components/project-dialog";
import { TagSelector } from "@/components/tag-selector";
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
  type CreateTagPayload,
  fetchTag,
  fetchTagsAll,
  type Tag,
  type TagTree,
} from "@/lib/api/admin";
import { useI18n } from "@/i18n/provider";

type TagFormDialogProps = {
  open: boolean;
  saving: boolean;
  itemId: number | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: CreateTagPayload) => Promise<void>;
};

const emptyForm: EditForm = {
  parentId: "0",
  name: "",
  remark: "",
};

type EditForm = {
  parentId: string;
  name: string;
  remark: string;
};

function buildForm(item: Tag | null): EditForm {
  if (!item) {
    return emptyForm;
  }

  return {
    parentId: String(item.parentId),
    name: item.name,
    remark: item.remark,
  };
}

function buildPayload(form: EditForm): CreateTagPayload {
  return {
    parentId: Number(form.parentId),
    name: form.name.trim(),
    remark: form.remark.trim(),
    status: 0,
  };
}

export function EditDialog({
  open,
  saving,
  itemId,
  onOpenChange,
  onSubmit,
}: TagFormDialogProps) {
  if (!open) {
    return null;
  }

  return (
    <TagFormDialogBody
      key={itemId ? `edit-${itemId}` : "create"}
      open={open}
      itemId={itemId}
      saving={saving}
      onOpenChange={onOpenChange}
      onSubmit={onSubmit}
    />
  );
}

type TagFormDialogBodyProps = {
  open: boolean;
  saving: boolean;
  itemId: number | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: CreateTagPayload) => Promise<void>;
};

function TagFormDialogBody({
  open,
  saving,
  itemId,
  onOpenChange,
  onSubmit,
}: TagFormDialogBodyProps) {
  const t = useI18n();
  const formId = "tag-edit-form";
  const [loading, setLoading] = useState(false);
  const [parentTags, setParentTags] = useState<TagTree[]>([]);

  const tagFormSchema = useMemo(
    () =>
      z.object({
        parentId: z.string(),
        name: z.string().trim().min(1, t("tag.nameRequired")),
        remark: z.string(),
      }),
    [t],
  );
  const editFormResolver = useMemo(
    () => zodResolver(tagFormSchema as never) as Resolver<EditForm>,
    [tagFormSchema],
  );
  const form = useForm<EditForm>({
    resolver: editFormResolver,
    defaultValues: emptyForm,
  });
  const {
    control,
    handleSubmit,
    reset,
    register,
    formState: { errors },
  } = form;

  useEffect(() => {
    async function loadParentTags() {
      try {
        const data = await fetchTagsAll();
        setParentTags(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error("Failed to load parent tags:", error);
      }
    }
    void loadParentTags();
  }, [itemId]);

  useEffect(() => {
    async function loadDetail() {
      if (!itemId) {
        reset(emptyForm);
        return;
      }
      setLoading(true);
      try {
        const data = await fetchTag(itemId);
        reset(buildForm(data));
      } catch (error) {
        console.error("Failed to load tag:", error);
      } finally {
        setLoading(false);
      }
    }
    void loadDetail();
  }, [itemId, reset]);

  async function onFormSubmit(values: EditForm) {
    const payload = buildPayload(values);
    await onSubmit(payload);
  }

  return (
    <ProjectDialog
      open={open}
      onOpenChange={onOpenChange}
      title={itemId ? t("tag.editTitle") : t("tag.createTitle")}
      size="md"
      allowFullscreen
      footer={
        <>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            {t("tag.cancel")}
          </Button>
          <Button type="submit" form={formId} disabled={saving || loading}>
            {saving ? t("tag.saving") : itemId ? t("tag.save") : t("tag.create")}
          </Button>
        </>
      }
    >
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-muted-foreground">{t("tag.loadingDetail")}</div>
        </div>
      ) : (
        <form
          id={formId}
          onSubmit={handleSubmit(onFormSubmit)}
          className="space-y-4"
        >
          <Field data-invalid={!!errors.parentId}>
            <FieldLabel htmlFor="tag-parent-id">{t("tag.parent")}</FieldLabel>
            <FieldContent>
              <Controller
                control={control}
                name="parentId"
                render={({ field }) => (
                  <TagSelector
                    mode="single"
                    value={Number(field.value)}
                    onChange={(value) => field.onChange(String(value))}
                    tags={parentTags}
                    placeholder={t("tag.rootParent")}
                    searchPlaceholder={t("tag.searchParent")}
                    emptyText={t("tag.emptyParent")}
                    disabled={saving}
                    rootOption={{ value: 0, label: t("tag.rootParent") }}
                    excludeIds={itemId ? [itemId] : undefined}
                  />
                )}
              />
              <FieldError errors={[errors.parentId]} />
            </FieldContent>
          </Field>
          <Field data-invalid={!!errors.name}>
            <FieldLabel htmlFor="tag-name">{t("tag.name")}</FieldLabel>
            <FieldContent>
              <Input
                id="tag-name"
                placeholder={t("tag.namePlaceholder")}
                aria-invalid={!!errors.name}
                {...register("name")}
              />
              <FieldError errors={[errors.name]} />
            </FieldContent>
          </Field>
          <Field data-invalid={!!errors.remark}>
            <FieldLabel htmlFor="tag-remark">{t("tag.remark")}</FieldLabel>
            <FieldContent>
              <Textarea
                id="tag-remark"
                placeholder={t("tag.remarkPlaceholder")}
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
  );
}
