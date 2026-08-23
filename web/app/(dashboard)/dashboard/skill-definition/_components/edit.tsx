"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo, useState } from "react";
import { Controller, type Resolver, useForm } from "react-hook-form";
import { z } from "zod/v4";

import { ContentEditor } from "@/components/content-editor";
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
  fetchMCPCatalog,
  fetchSkillDefinition,
  type CreateSkillDefinitionPayload,
  type MCPToolCatalogItem,
  type SkillDefinition,
} from "@/lib/api/admin";
import { useI18n } from "@/i18n/provider";
 
type TFunction = (key: string, values?: Record<string, string | number>) => string;

type SkillEditDialogProps = {
  open: boolean;
  saving: boolean;
  itemId: number | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: CreateSkillDefinitionPayload) => Promise<void>;
};

const emptyForm: EditForm = {
  name: "",
  description: "",
  instruction: "",
  examplesText: "",
  remark: "",
};

function createSkillFormSchema(t: TFunction) {
  return z.object({
    name: z.string().trim().min(1, t("skillDefinition.nameRequired")),
    description: z.string().trim(),
    instruction: z.string().trim().min(1, t("skillDefinition.instructionRequired")),
    examplesText: z.string().trim(),
    remark: z.string().trim(),
  });
}

type EditForm = {
  name: string;
  description: string;
  instruction: string;
  examplesText: string;
  remark: string;
};

function buildForm(item: SkillDefinition | null): EditForm {
  if (!item) {
    return emptyForm;
  }

  return {
    name: item.name,
    description: item.description ?? "",
    instruction: item.instruction ?? "",
    examplesText: (item.examples ?? []).join("\n"),
    remark: item.remark ?? "",
  };
}

function buildPayload(
  form: EditForm,
  toolWhitelist: string[],
): CreateSkillDefinitionPayload {
  return {
    name: form.name.trim(),
    description: form.description.trim(),
    instruction: form.instruction.trim(),
    examples: form.examplesText
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean),
    toolWhitelist,
    remark: form.remark.trim(),
  };
}

export function EditDialog({
  open,
  saving,
  itemId,
  onOpenChange,
  onSubmit,
}: SkillEditDialogProps) {
  if (!open) {
    return null;
  }

  return (
    <SkillEditDialogBody
      key={itemId ? `edit-${itemId}` : "create"}
      open={open}
      saving={saving}
      itemId={itemId}
      onOpenChange={onOpenChange}
      onSubmit={onSubmit}
    />
  );
}

type SkillEditDialogBodyProps = SkillEditDialogProps;

function SkillEditDialogBody({
  open,
  saving,
  itemId,
  onOpenChange,
  onSubmit,
}: SkillEditDialogBodyProps) {
  const t = useI18n();
  const formId = "skill-definition-edit-form";
  const [loading, setLoading] = useState(false);
  const [toolCatalog, setToolCatalog] = useState<MCPToolCatalogItem[]>([]);
  const [selectedToolWhitelist, setSelectedToolWhitelist] = useState<
    string[]
  >([]);
  const [toolCodeToAdd, setToolCodeToAdd] = useState("");
  const skillFormSchema = useMemo(() => createSkillFormSchema(t), [t]);
  const editFormResolver = useMemo(
    () => zodResolver(skillFormSchema) as Resolver<EditForm>,
    [skillFormSchema],
  );
  const form = useForm<EditForm>({
    resolver: editFormResolver,
    defaultValues: emptyForm,
  });

  const {
    handleSubmit,
    reset,
    register,
    control,
    formState: { errors },
  } = form;

  useEffect(() => {
    async function loadDetail() {
      if (!itemId) {
        reset(emptyForm);
        setSelectedToolWhitelist([]);
        setToolCodeToAdd("");
        return;
      }

      setLoading(true);
      try {
        const data = await fetchSkillDefinition(itemId);
        reset(buildForm(data));
        setSelectedToolWhitelist(data.toolWhitelist ?? []);
        setToolCodeToAdd("");
      } catch (error) {
        console.error("Failed to load skill definition:", error);
      } finally {
        setLoading(false);
      }
    }

    void loadDetail();
  }, [itemId, reset]);

  useEffect(() => {
    async function loadToolCatalog() {
      try {
        const data = await fetchMCPCatalog();
        setToolCatalog(data);
      } catch (error) {
        console.error("Failed to load MCP tool catalog:", error);
      }
    }

    void loadToolCatalog();
  }, []);

  async function onFormSubmit(values: EditForm) {
    await onSubmit(buildPayload(values, selectedToolWhitelist));
  }

  const toolOptions = useMemo(
    () =>
      toolCatalog.map((item) => ({
        value: item.toolCode,
        label: `${item.title || item.toolName} · ${item.toolCode}`,
      })),
    [toolCatalog],
  );

  const addableToolOptions = useMemo(
    () =>
      toolOptions.filter(
        (option) => !selectedToolWhitelist.includes(option.value),
      ),
    [selectedToolWhitelist, toolOptions],
  );

  const selectedToolOptions = useMemo(
    () =>
      selectedToolWhitelist
        .map((toolCode) => toolOptions.find((option) => option.value === toolCode))
        .filter(
          (option): option is { value: string; label: string } => !!option,
        ),
    [selectedToolWhitelist, toolOptions],
  );

  function handleAddToolWhitelist(toolCode: string) {
    if (!toolCode || selectedToolWhitelist.includes(toolCode)) {
      return;
    }
    setSelectedToolWhitelist((prev) => [...prev, toolCode]);
    setToolCodeToAdd("");
  }

  function handleRemoveToolWhitelist(toolCode: string) {
    setSelectedToolWhitelist((prev) =>
      prev.filter((item) => item !== toolCode),
    );
  }

  return (
    <ProjectDialog
      open={open}
      onOpenChange={onOpenChange}
      title={itemId ? t("skillDefinition.editTitle") : t("skillDefinition.createTitle")}
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
            {t("skillDefinition.cancel")}
          </Button>
          <Button type="submit" form={formId} disabled={saving || loading}>
            {saving ? t("skillDefinition.saving") : itemId ? t("skillDefinition.save") : t("skillDefinition.create")}
          </Button>
        </>
      }
    >
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-muted-foreground">{t("skillDefinition.loading")}</div>
        </div>
      ) : (
        <form
          id={formId}
          onSubmit={handleSubmit(onFormSubmit)}
          className="space-y-4"
        >
         <Field data-invalid={!!errors.name}>
            <FieldLabel htmlFor="skill-name">{t("skillDefinition.name")}</FieldLabel>
            <FieldContent>
              <Input
                id="skill-name"
                placeholder={t("skillDefinition.namePlaceholder")}
                aria-invalid={!!errors.name}
                {...register("name")}
              />
              <FieldError errors={[errors.name]} />
            </FieldContent>
          </Field>

          <Field data-invalid={!!errors.description}>
            <FieldLabel htmlFor="skill-description">{t("skillDefinition.description")}</FieldLabel>
            <FieldContent>
              <Textarea
                id="skill-description"
                rows={3}
                placeholder={t("skillDefinition.descriptionPlaceholder")}
                aria-invalid={!!errors.description}
                {...register("description")}
              />
              <FieldError errors={[errors.description]} />
            </FieldContent>
          </Field>

          <Field data-invalid={!!errors.instruction}>
            <FieldLabel>{t("skillDefinition.instruction")}</FieldLabel>
            <FieldContent>
              <Controller
                control={control}
                name="instruction"
                render={({ field }) => (
                  <ContentEditor
                    value={{ mode: "markdown", raw: field.value ?? "" }}
                    onChange={(next) => field.onChange(next.raw)}
                    placeholder={t("skillDefinition.instructionPlaceholder")}
                    disabled={saving || loading}
                    allowedModes={["markdown"]}
                    height={360}
                  />
                )}
              />
              <FieldError errors={[errors.instruction]} />
            </FieldContent>
          </Field>

          <Field data-invalid={!!errors.examplesText}>
            <FieldLabel htmlFor="skill-examples">{t("skillDefinition.examples")}</FieldLabel>
            <FieldContent>
              <Textarea
                id="skill-examples"
                rows={5}
                placeholder={t("skillDefinition.examplesPlaceholder")}
                aria-invalid={!!errors.examplesText}
                {...register("examplesText")}
              />
              <FieldError errors={[errors.examplesText]} />
            </FieldContent>
          </Field>

          <Field>
            <FieldLabel>{t("skillDefinition.toolWhitelist")}</FieldLabel>
            <FieldContent className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <OptionCombobox
                    value={toolCodeToAdd}
                    options={addableToolOptions}
                    placeholder={t("skillDefinition.selectTool")}
                    searchPlaceholder={t("skillDefinition.searchTool")}
                    emptyText={t("skillDefinition.emptyTool")}
                    onChange={handleAddToolWhitelist}
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  disabled={!toolCodeToAdd}
                  onClick={() => handleAddToolWhitelist(toolCodeToAdd)}
                >
                  {t("skillDefinition.add")}
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {selectedToolOptions.length === 0 ? (
                  <span className="text-sm text-muted-foreground">
                    {t("skillDefinition.inheritAgentTools")}
                  </span>
                ) : (
                  selectedToolOptions.map((option) => (
                    <Button
                      key={option.value}
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleRemoveToolWhitelist(option.value)}
                      className="justify-start"
                    >
                      {option.label}
                    </Button>
                  ))
                )}
              </div>
            </FieldContent>
          </Field>

          <Field data-invalid={!!errors.remark}>
            <FieldLabel htmlFor="skill-remark">{t("skillDefinition.remark")}</FieldLabel>
            <FieldContent>
              <Textarea
                id="skill-remark"
                rows={3}
                placeholder={t("skillDefinition.remarkPlaceholder")}
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
