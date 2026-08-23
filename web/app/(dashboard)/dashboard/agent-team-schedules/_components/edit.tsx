"use client"
import { zodResolver } from "@hookform/resolvers/zod"
import { useCallback, useEffect, useMemo, useState } from "react"
import { Controller, type Resolver, useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod/v4"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Field,
  FieldContent,
  FieldError,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { OptionCombobox } from "@/components/option-combobox"
import { Textarea } from "@/components/ui/textarea"
import {
  type AdminAgentTeam,
  type AdminAgentTeamSchedule,
  type CreateAdminAgentTeamSchedulePayload,
  fetchAgentTeamSchedule,
  fetchAgentTeamsAll,
} from "@/lib/api/admin"
import { useI18n } from "@/i18n/provider"

type TFunction = (key: string, values?: Record<string, string | number>) => string

type ScheduleEditDialogProps = {
  open: boolean
  saving: boolean
  itemId: number | null
  defaultValues?: Partial<CreateAdminAgentTeamSchedulePayload> | null
  onOpenChange: (open: boolean) => void
  onSubmit: (payload: CreateAdminAgentTeamSchedulePayload) => Promise<void>
  onDelete?: (id: number) => Promise<void>
}

const emptyForm: EditForm = {
  teamId: "",
  startAt: "",
  endAt: "",
  remark: "",
}

type EditForm = {
  teamId: string
  startAt: string
  endAt: string
  remark: string
}

function createEditFormSchema(t: TFunction) {
  return z.object({
  teamId: z.string().trim().regex(/^\d+$/, t("agentTeamSchedule.teamRequired")),
  startAt: z.string().trim().min(1, t("agentTeamSchedule.startRequired")),
  endAt: z.string().trim().min(1, t("agentTeamSchedule.endRequired")),
  remark: z.string().trim(),
}).superRefine((value, ctx) => {
  const startAt = parseDateTimeLocal(value.startAt)
  const endAt = parseDateTimeLocal(value.endAt)
  if (!startAt || !endAt) {
    return
  }
  if (!endAt || endAt <= startAt) {
    ctx.addIssue({
      code: "custom",
      path: ["endAt"],
      message: t("agentTeamSchedule.endAfterStart"),
    })
    return
  }
  if (!isSameLocalDay(startAt, endAt)) {
    ctx.addIssue({
      code: "custom",
      path: ["endAt"],
      message: t("agentTeamSchedule.singleDayOnly"),
    })
  }
  if (startAt < startOfLocalDay(new Date())) {
    ctx.addIssue({
      code: "custom",
      path: ["startAt"],
      message: t("agentTeamSchedule.historyReadonly"),
    })
  }
})
}

function toDateTimeLocal(value?: string) {
  if (!value) {
    return ""
  }
  return value.replace(" ", "T").slice(0, 16)
}

function parseDateTimeLocal(value: string) {
  const ret = new Date(value)
  return Number.isNaN(ret.getTime()) ? null : ret
}

function startOfLocalDay(value: Date) {
  const ret = new Date(value)
  ret.setHours(0, 0, 0, 0)
  return ret
}

function isSameLocalDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function todayDateTimeLocalMin() {
  const today = startOfLocalDay(new Date())
  const month = String(today.getMonth() + 1).padStart(2, "0")
  const day = String(today.getDate()).padStart(2, "0")
  return `${today.getFullYear()}-${month}-${day}T00:00`
}

function buildForm(item: AdminAgentTeamSchedule | null, defaultValues?: Partial<CreateAdminAgentTeamSchedulePayload> | null): EditForm {
  if (!item) {
    return {
      teamId: defaultValues?.teamId ? String(defaultValues.teamId) : emptyForm.teamId,
      startAt: toDateTimeLocal(defaultValues?.startAt),
      endAt: toDateTimeLocal(defaultValues?.endAt),
      remark: defaultValues?.remark ?? emptyForm.remark,
    }
  }
  return {
    teamId: String(item.teamId),
    startAt: toDateTimeLocal(item.startAt),
    endAt: toDateTimeLocal(item.endAt),
    remark: item.remark || "",
  }
}

function buildPayload(form: EditForm): CreateAdminAgentTeamSchedulePayload {
  return {
    teamId: Number(form.teamId),
    startAt: form.startAt.trim(),
    endAt: form.endAt.trim(),
    remark: form.remark.trim(),
  }
}

export function EditDialog({
  open,
  saving,
  itemId,
  defaultValues,
  onOpenChange,
  onSubmit,
  onDelete,
}: ScheduleEditDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open ? (
        <ScheduleEditDialogBody
          key={itemId ? `edit-${itemId}` : "create"}
          itemId={itemId}
          defaultValues={defaultValues}
          saving={saving}
          onOpenChange={onOpenChange}
          onSubmit={onSubmit}
          onDelete={onDelete}
        />
      ) : null}
    </Dialog>
  )
}

type ScheduleEditDialogBodyProps = Omit<ScheduleEditDialogProps, "open">

function ScheduleEditDialogBody({
  saving,
  itemId,
  defaultValues,
  onOpenChange,
  onSubmit,
  onDelete,
}: ScheduleEditDialogBodyProps) {
  const t = useI18n()
  const [teams, setTeams] = useState<AdminAgentTeam[]>([])
  const [loading, setLoading] = useState(false)
  const loadOptions = useCallback(async () => {
    try {
      const teamsData = await fetchAgentTeamsAll()
      setTeams(teamsData)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("agentTeamSchedule.loadOptionsFailed"))
    }
  }, [t])
  const editFormSchema = useMemo(() => createEditFormSchema(t), [t])
  const editFormResolver = useMemo(
    () => zodResolver(editFormSchema) as Resolver<EditForm>,
    [editFormSchema],
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
    formState: { errors },
  } = form
  const minDateTime = todayDateTimeLocalMin()

  useEffect(() => {
    async function loadDetail() {
      if (!itemId) {
        reset(buildForm(null, defaultValues))
        return
      }
      setLoading(true)
      try {
        const data = await fetchAgentTeamSchedule(itemId)
        reset(buildForm(data))
      } catch (error) {
        toast.error(error instanceof Error ? error.message : t("agentTeamSchedule.loadDetailFailed"))
      } finally {
        setLoading(false)
      }
    }
    void loadDetail()
  }, [defaultValues, itemId, reset, t])

  useEffect(() => {
    void loadOptions()
  }, [loadOptions])

  async function onFormSubmit(values: EditForm) {
    await onSubmit(buildPayload(values))
  }

  return (
    <DialogContent className="max-w-xl gap-0 p-0 sm:max-w-xl">
      <DialogHeader className="px-6 pt-6">
        <DialogTitle>{itemId ? t("agentTeamSchedule.editTitle") : t("agentTeamSchedule.createTitle")}</DialogTitle>
      </DialogHeader>
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-muted-foreground">{t("agentTeamSchedule.loading")}</div>
        </div>
      ) : (
        <form onSubmit={handleSubmit(onFormSubmit)}>
          <div className="space-y-4 p-6">
            <div className="grid grid-cols-1 gap-4">
              <Field data-invalid={!!errors.teamId}>
                <FieldLabel>{t("agentTeamSchedule.team")}</FieldLabel>
                <FieldContent>
                  <Controller
                    control={control}
                    name="teamId"
                    render={({ field }) => (
                      <OptionCombobox
                        value={field.value}
                        options={teams.map((team) => ({
                          value: String(team.id),
                          label: team.name,
                        }))}
                        placeholder={t("agentTeamSchedule.teamRequired")}
                        searchPlaceholder={t("agentTeamSchedule.searchTeam")}
                        emptyText={t("agentTeamSchedule.emptyTeam")}
                        onChange={field.onChange}
                      />
                    )}
                  />
                  <FieldError errors={[errors.teamId]} />
                </FieldContent>
              </Field>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field data-invalid={!!errors.startAt}>
                <FieldLabel htmlFor="agent-team-schedule-start-at">{t("agentTeamSchedule.startTime")}</FieldLabel>
                <FieldContent>
                  <Input id="agent-team-schedule-start-at" type="datetime-local" min={minDateTime} {...register("startAt")} />
                  <FieldError errors={[errors.startAt]} />
                </FieldContent>
              </Field>
              <Field data-invalid={!!errors.endAt}>
                <FieldLabel htmlFor="agent-team-schedule-end-at">{t("agentTeamSchedule.endTime")}</FieldLabel>
                <FieldContent>
                  <Input id="agent-team-schedule-end-at" type="datetime-local" min={minDateTime} {...register("endAt")} />
                  <FieldError errors={[errors.endAt]} />
                </FieldContent>
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="agent-team-schedule-remark">{t("agentTeamSchedule.remark")}</FieldLabel>
              <FieldContent>
                <Textarea id="agent-team-schedule-remark" rows={4} placeholder={t("agentTeamSchedule.remarkPlaceholder")} {...register("remark")} />
              </FieldContent>
            </Field>
          </div>
          <DialogFooter className="mx-0 mb-0 px-6 py-4">
            {itemId && onDelete ? (
              <Button type="button" variant="destructive" onClick={() => void onDelete(itemId)} disabled={saving}>
                {t("agentTeamSchedule.delete")}
              </Button>
            ) : null}
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              {t("agentTeamSchedule.cancel")}
            </Button>
            <Button type="submit" disabled={saving || loading}>
              {saving ? t("agentTeamSchedule.saving") : t("agentTeamSchedule.save")}
            </Button>
          </DialogFooter>
        </form>
      )}
    </DialogContent>
  )
}
