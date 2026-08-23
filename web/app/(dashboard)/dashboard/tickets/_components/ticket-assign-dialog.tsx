"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, type Resolver, useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod/v4"

import { OptionCombobox } from "@/components/option-combobox"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldContent, FieldError, FieldLabel } from "@/components/ui/field"
import { Textarea } from "@/components/ui/textarea"
import {
  fetchAgentProfilesAll,
  type AdminAgentProfile,
} from "@/lib/api/admin"
import { useI18n } from "@/i18n/provider"
import { assignTicket } from "@/lib/api/ticket"

type TFunction = (key: string, values?: Record<string, string | number>) => string

function createSchema(t: TFunction) {
  return z.object({
  toUserId: z.string().trim().min(1, t("ticket.assigneeRequired")),
  reason: z.string().trim(),
  })
}

type FormValues = {
  toUserId: string
  reason: string
}

const emptyForm: FormValues = {
  toUserId: "",
  reason: "",
}

type TicketAssignDialogProps = {
  open: boolean
  ticketId: number | null
  currentAssigneeId?: number
  onOpenChange: (open: boolean) => void
  onSuccess?: () => Promise<void> | void
}

export function TicketAssignDialog({
  open,
  ticketId,
  currentAssigneeId,
  onOpenChange,
  onSuccess,
}: TicketAssignDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open ? (
        <TicketAssignDialogBody
          key={ticketId ?? "ticket-assign"}
          ticketId={ticketId}
          currentAssigneeId={currentAssigneeId}
          onOpenChange={onOpenChange}
          onSuccess={onSuccess}
        />
      ) : null}
    </Dialog>
  )
}

function TicketAssignDialogBody({
  ticketId,
  currentAssigneeId,
  onOpenChange,
  onSuccess,
}: Omit<TicketAssignDialogProps, "open">) {
  const t = useI18n()
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(false)
  const [agents, setAgents] = useState<AdminAgentProfile[]>([])
  const activeRef = useRef(false)

  const schema = useMemo(() => createSchema(t), [t])
  const resolver = useMemo(
    () => zodResolver(schema) as Resolver<FormValues>,
    [schema],
  )
  const form = useForm<FormValues>({
    resolver,
    defaultValues: emptyForm,
  })

  const {
    control,
    handleSubmit,
    register,
    reset,
    formState: { errors },
  } = form

  useEffect(() => {
    activeRef.current = true
    return () => {
      activeRef.current = false
    }
  }, [])

  useEffect(() => {
    reset({
      toUserId: currentAssigneeId ? String(currentAssigneeId) : "",
      reason: "",
    })
  }, [currentAssigneeId, reset, ticketId])

  useEffect(() => {
    setLoading(true)
    fetchAgentProfilesAll()
      .then((agentData) => {
        if (!activeRef.current) {
          return
        }
        setAgents(Array.isArray(agentData) ? agentData : [])
      })
      .catch((error) => {
        if (!activeRef.current) {
          return
        }
        toast.error(error instanceof Error ? error.message : t("ticket.loadAssigneesFailed"))
      })
      .finally(() => {
        if (activeRef.current) {
          setLoading(false)
        }
      })
  }, [t])

  async function onFormSubmit(values: FormValues) {
    if (!ticketId) {
      toast.error(t("ticket.selectTicket"))
      return
    }
    setSaving(true)
    try {
      await assignTicket({
        ticketId,
        toUserId: Number(values.toUserId),
        reason: values.reason.trim() || undefined,
      })
      if (!activeRef.current) {
        return
      }
      toast.success(t("ticket.assigneeUpdated"))
      if (!activeRef.current) {
        return
      }
      onOpenChange(false)
      await onSuccess?.()
    } catch (error) {
      if (!activeRef.current) {
        return
      }
      toast.error(error instanceof Error ? error.message : t("ticket.assignFailed"))
    } finally {
      if (activeRef.current) {
        setSaving(false)
      }
    }
  }

  return (
    <DialogContent className="max-w-lg gap-0 p-0 sm:max-w-lg">
      <DialogHeader className="px-6 pt-6">
        <DialogTitle>{t("ticket.assignTitle")}</DialogTitle>
      </DialogHeader>
      <form onSubmit={handleSubmit(onFormSubmit)}>
        <div className="space-y-4 p-6">
          <Field data-invalid={!!errors.toUserId}>
            <FieldLabel>{t("ticket.assignee")}</FieldLabel>
            <FieldContent>
              <Controller
                control={control}
                name="toUserId"
                render={({ field }) => (
                  <OptionCombobox
                    value={field.value}
                    onChange={field.onChange}
                    placeholder={loading ? t("ticket.loading") : t("ticket.selectHandler")}
                    options={agents.map((agent) => ({
                      value: String(agent.userId),
                      label:
                        agent.displayName ||
                        agent.nickname ||
                        agent.username ||
                        t("ticket.agentFallback", { id: agent.userId }),
                    }))}
                  />
                )}
              />
              <FieldError errors={[errors.toUserId]} />
            </FieldContent>
          </Field>
          <Field data-invalid={!!errors.reason}>
            <FieldLabel>{t("ticket.assignReason")}</FieldLabel>
            <FieldContent>
              <Textarea rows={4} placeholder={t("ticket.assignReasonPlaceholder")} {...register("reason")} />
              <FieldError errors={[errors.reason]} />
            </FieldContent>
          </Field>
        </div>
        <DialogFooter className="mx-0 mb-0 px-6 py-4">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t("ticket.cancel")}
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? t("ticket.submitting") : t("ticket.confirmAssign")}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  )
}
