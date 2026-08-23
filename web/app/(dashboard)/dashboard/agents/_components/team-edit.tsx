"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckIcon, ChevronsUpDownIcon } from "lucide-react";
import { Controller, type Resolver, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod/v4";

import {
  type AdminAgentTeam,
  type CreateAdminAgentTeamPayload,
  fetchAgentTeam,
  fetchUsersAll,
  type AdminUser,
} from "@/lib/api/admin";
import { OptionCombobox } from "@/components/option-combobox";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
  FieldContent,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/i18n/provider";
import { Status } from "@/lib/generated/enums";

type TFunction = (key: string, values?: Record<string, string | number>) => string;

type TeamEditDialogProps = {
  open: boolean;
  saving: boolean;
  itemId: number | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: CreateAdminAgentTeamPayload) => Promise<void>;
};

const emptyForm: EditForm = {
  name: "",
  leaderUserId: "0",
  status: String(Status.Ok),
  description: "",
  remark: "",
};

type EditForm = {
  name: string;
  leaderUserId: string;
  status: string;
  description: string;
  remark: string;
};

function createEditFormSchema(t: TFunction) {
  return z.object({
  name: z.string().trim().min(1, t("agentProfile.teamNameRequired")),
  leaderUserId: z.string().trim().regex(/^\d+$/, t("agentProfile.leaderInvalid")),
  status: z.enum([String(Status.Ok), String(Status.Disabled)], {
    message: t("agentProfile.teamStatusRequired"),
  }),
  description: z.string().trim(),
  remark: z.string().trim(),
  });
}

function getStatusOptions(t: TFunction) {
  return [
    { value: String(Status.Ok), label: t("agentProfile.enabled") },
    { value: String(Status.Disabled), label: t("agentProfile.disabled") },
  ];
}

function buildForm(item: AdminAgentTeam | null): EditForm {
  if (!item) {
    return emptyForm;
  }
  return {
    name: item.name,
    leaderUserId: String(item.leaderUserId),
    status: String(item.status),
    description: item.description || "",
    remark: item.remark || "",
  };
}

function buildPayload(form: EditForm): CreateAdminAgentTeamPayload {
  return {
    name: form.name.trim(),
    leaderUserId: Number(form.leaderUserId),
    status: Number(form.status),
    description: form.description.trim(),
    remark: form.remark.trim(),
  };
}

export function EditDialog({
  open,
  saving,
  itemId,
  onOpenChange,
  onSubmit,
}: TeamEditDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open ? (
        <TeamEditDialogBody
          key={itemId ? `edit-${itemId}` : "create"}
          itemId={itemId}
          saving={saving}
          onOpenChange={onOpenChange}
          onSubmit={onSubmit}
        />
      ) : null}
    </Dialog>
  );
}

type TeamEditDialogBodyProps = Omit<TeamEditDialogProps, "open">;

function TeamEditDialogBody({
  saving,
  itemId,
  onOpenChange,
  onSubmit,
}: TeamEditDialogBodyProps) {
  const t = useI18n();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [userSelectOpen, setUserSelectOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const userOptions = users.map((user) => ({
    value: String(user.id),
    label: `${user.nickname || user.username} (${user.username})`,
  }));
  const statusOptions = useMemo(() => getStatusOptions(t), [t]);
  const loadUsers = useCallback(async () => {
    try {
      const data = await fetchUsersAll();
      setUsers(data);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("agentProfile.loadUsersFailed"));
    }
  }, [t]);
  const editFormSchema = useMemo(() => createEditFormSchema(t), [t]);
  const editFormResolver = useMemo(
    () => zodResolver(editFormSchema) as Resolver<EditForm>,
    [editFormSchema],
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
    async function loadDetail() {
      if (!itemId) {
        reset(emptyForm);
        return;
      }
      setLoading(true);
      try {
        const data = await fetchAgentTeam(itemId);
        reset(buildForm(data));
      } catch (error) {
        toast.error(error instanceof Error ? error.message : t("agentProfile.loadTeamDetailFailed"));
      } finally {
        setLoading(false);
      }
    }
    void loadDetail();
  }, [itemId, reset, t]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  async function onFormSubmit(values: EditForm) {
    await onSubmit(buildPayload(values));
  }

  return (
    <DialogContent className="max-w-xl gap-0 p-0 sm:max-w-xl">
      <DialogHeader className="px-6 pt-6">
        <DialogTitle>{itemId ? t("agentProfile.teamEditTitle") : t("agentProfile.teamCreateTitle")}</DialogTitle>
      </DialogHeader>
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-muted-foreground">{t("agentProfile.loading")}</div>
        </div>
      ) : (
        <form onSubmit={handleSubmit(onFormSubmit)}>
          <div className="space-y-4 p-6">
            <Field data-invalid={!!errors.name}>
              <FieldLabel htmlFor="agent-team-name">{t("agentProfile.teamName")}</FieldLabel>
              <FieldContent>
                <Input
                  id="agent-team-name"
                  placeholder={t("agentProfile.teamNamePlaceholder")}
                  {...register("name")}
                />
                <FieldError errors={[errors.name]} />
              </FieldContent>
            </Field>
            <Field data-invalid={!!errors.leaderUserId}>
              <FieldLabel>{t("agentProfile.leader")}</FieldLabel>
              <FieldContent>
                <Controller
                  control={control}
                  name="leaderUserId"
                  render={({ field }) => (
                    <Popover open={userSelectOpen} onOpenChange={setUserSelectOpen}>
                      <PopoverTrigger
                        render={
                          <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={userSelectOpen}
                            className="w-full justify-between font-normal"
                          />
                        }
                      >
                        <span className="truncate">
                          {field.value === "0"
                            ? t("agentProfile.noLeader")
                            : userOptions.find((option) => option.value === field.value)?.label ?? t("agentProfile.selectLeader")}
                        </span>
                        <ChevronsUpDownIcon className="ml-2 size-4 shrink-0 opacity-50" />
                      </PopoverTrigger>
                      <PopoverContent className="w-[var(--radix-popper-anchor-width)] p-0" align="start">
                        <Command>
                          <CommandInput placeholder={t("agentProfile.searchUser")} />
                          <CommandList>
                            <CommandEmpty>{t("agentProfile.emptyUser")}</CommandEmpty>
                            <CommandGroup>
                              <CommandItem
                                value={t("agentProfile.noLeader")}
                                onSelect={() => {
                                  field.onChange("0");
                                  setUserSelectOpen(false);
                                }}
                              >
                                <CheckIcon
                                  className={`mr-2 size-4 ${field.value === "0" ? "opacity-100" : "opacity-0"}`}
                                />
                                {t("agentProfile.noLeader")}
                              </CommandItem>
                              {userOptions.map((option) => (
                                <CommandItem
                                  key={option.value}
                                  value={option.label}
                                  onSelect={() => {
                                    field.onChange(option.value);
                                    setUserSelectOpen(false);
                                  }}
                                >
                                  <CheckIcon
                                    className={`mr-2 size-4 ${
                                      field.value === option.value ? "opacity-100" : "opacity-0"
                                    }`}
                                  />
                                  {option.label}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  )}
                />
                <FieldError errors={[errors.leaderUserId]} />
              </FieldContent>
            </Field>
            <Field data-invalid={!!errors.status}>
              <FieldLabel>{t("agentProfile.status")}</FieldLabel>
              <FieldContent>
                <Controller
                  control={control}
                  name="status"
                  render={({ field }) => (
                    <OptionCombobox
                      options={statusOptions}
                      value={field.value}
                      onChange={field.onChange}
                      placeholder={t("agentProfile.selectStatus")}
                      searchPlaceholder={t("agentProfile.searchStatus")}
                      emptyText={t("agentProfile.emptyStatus")}
                    />
                  )}
                />
                <FieldError errors={[errors.status]} />
              </FieldContent>
            </Field>
            <Field>
              <FieldLabel htmlFor="agent-team-description">{t("agentProfile.description")}</FieldLabel>
              <FieldContent>
                <Input
                  id="agent-team-description"
                  placeholder={t("agentProfile.descriptionPlaceholder")}
                  {...register("description")}
                />
              </FieldContent>
            </Field>
            <Field>
              <FieldLabel htmlFor="agent-team-remark">{t("agentProfile.remark")}</FieldLabel>
              <FieldContent>
                <Textarea
                  id="agent-team-remark"
                  rows={4}
                  placeholder={t("agentProfile.remarkPlaceholder")}
                  {...register("remark")}
                />
              </FieldContent>
            </Field>
          </div>
          <DialogFooter className="mx-0 mb-0 px-6 py-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              {t("agentProfile.cancel")}
            </Button>
            <Button type="submit" disabled={saving || loading}>
              {saving ? t("agentProfile.saving") : t("agentProfile.save")}
            </Button>
          </DialogFooter>
        </form>
      )}
    </DialogContent>
  );
}
