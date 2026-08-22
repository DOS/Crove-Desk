"use client"

import { toast } from "sonner"

import { useI18n } from "@/i18n/provider"
import { createTicketFromConversation } from "@/lib/api/ticket"
import { EditDialog } from "./edit"

type ConversationSeed = {
  id: number
  customerName: string
  customerId?: number
  lastMessageSummary?: string
  currentAssigneeId?: number
}

type CreateTicketFromConversationDialogProps = {
  open: boolean
  conversation: ConversationSeed | null
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export function CreateTicketFromConversationDialog({
  open,
  conversation,
  onOpenChange,
  onSuccess,
}: CreateTicketFromConversationDialogProps) {
  const t = useI18n()
  const initialValues = conversation
    ? {
        title: conversation.customerName || "",
        description: conversation.lastMessageSummary || "",
        currentAssigneeId: conversation.currentAssigneeId || undefined,
      }
    : undefined

  return (
    <EditDialog
      open={open}
      saving={false}
      itemId={null}
      onOpenChange={onOpenChange}
      fixedConversationId={conversation?.id}
      fixedCustomerId={conversation?.customerId}
      initialValues={initialValues}
      titleOverride={t("ticket.conversationToTicket")}
      descriptionOverride={t("ticket.conversationToTicketDescription")}
      onSubmit={async (payload) => {
        if (!conversation?.id) {
          throw new Error(t("ticket.conversationMissing"))
        }
        await createTicketFromConversation({
          conversationId: conversation.id,
          title: payload.title,
          description: payload.description,
          currentAssigneeId: payload.currentAssigneeId,
          tagIds: payload.tagIds,
        })
        toast.success(t("ticket.createSuccess"))
        onSuccess?.()
      }}
    />
  )
}
