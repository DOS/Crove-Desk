"use client"

import { ChannelIcon } from "@/components/channel-icon";
import { ScrollArea } from "@/components/ui/scroll-area";
import { IMConversationStatus } from "@/lib/generated/enums";
import { useAgentConversationsStore } from "@/lib/stores/agent-conversations";
import { formatDateTime } from "@/lib/utils";
import { useI18n } from "@/i18n/provider";

type ConversationListProps = {
  onAfterSelect?: () => void
}

export function ConversationList({ onAfterSelect }: ConversationListProps) {
  const t = useI18n()
  const conversations = useAgentConversationsStore((state) => state.conversations)
  const loading = useAgentConversationsStore((state) => state.conversationsLoading)
  const selectedId = useAgentConversationsStore((state) => state.selectedConversationId)
  const selectConversation = useAgentConversationsStore((state) => state.selectConversation)

  return (
    <ScrollArea className="overflow-auto">
      {loading ? (
        <div className="p-6 text-center text-sm text-muted-foreground">
          {t("conversation.loading")}
        </div>
      ) : conversations.length > 0 ? (
        conversations.map((conversation) => {
          const isSelected = selectedId === conversation.id
          const displayTitle = conversation.title && conversation.title !== conversation.customerName
            ? conversation.title
            : null

          return (
            <div
              key={conversation.id}
              className={`cursor-pointer border-b border-border/80 px-3 py-2.5 transition-colors hover:bg-muted/40 ${
                isSelected ? "bg-accent/70" : ""
              }`}
              onClick={() => {
                void selectConversation(conversation.id).then(
                  () => {
                    onAfterSelect?.()
                  },
                  () => {},
                )
              }}
            >
              <div className="overflow-hidden space-y-1">
                <div className="flex items-center justify-between gap-1.5">
                  <div className="flex items-center gap-1.5 min-w-0 flex-1">
                    <span
                      className="flex size-5 shrink-0 items-center justify-center rounded bg-muted text-muted-foreground"
                      title={conversation.channelName || conversation.channelType || "Channel"}
                    >
                      <ChannelIcon channelType={conversation.channelType} className="size-3" />
                    </span>
                    <span className="truncate font-semibold text-xs text-foreground">
                      {conversation.customerName ||
                        t("conversation.customerFallback", {
                          id: conversation.customerId || conversation.id,
                        })}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-[11px] text-muted-foreground">
                      {conversation.lastMessageAt
                        ? formatDateTime(conversation.lastMessageAt)
                        : t("conversation.noTime")}
                    </span>
                    {conversation.agentUnreadCount > 0 ? (
                      <div className="flex size-4 shrink-0 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
                        {conversation.agentUnreadCount > 99
                          ? "99+"
                          : conversation.agentUnreadCount}
                      </div>
                    ) : null}
                  </div>
                </div>

                {displayTitle ? (
                  <div className="truncate text-xs font-medium text-foreground/90">
                    {displayTitle}
                  </div>
                ) : null}

                <div className="truncate text-xs text-muted-foreground">
                  {conversation.lastMessageSummary || t("conversation.noLatestMessage")}
                </div>

                {conversation.status === IMConversationStatus.Pending &&
                conversation.currentTeamName ? (
                  <div className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground">
                    <span className="rounded-md bg-muted px-1.5 py-0.5 font-medium">
                      {t("conversation.teamOnDuty", {
                        name: conversation.currentTeamName,
                      })}
                    </span>
                  </div>
                ) : null}
              </div>
            </div>
          )
        })
      ) : (
        <div className="p-6 text-center text-sm text-muted-foreground">
          {t("conversation.empty")}
        </div>
      )}
    </ScrollArea>
  )
}
