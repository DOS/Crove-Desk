"use client";

import { CheckCheckIcon, EyeIcon, MessageCircleMoreIcon } from "lucide-react";
import Image from "next/image";
import { useEffect } from "react";

import { ConversationMessageBubble } from "@/components/chat/conversation-message-bubble";
import {
  ConversationMessageRow,
} from "@/components/chat/conversation-message-row";
import {
  ConversationMessageScroller,
  ConversationMessageScrollerItem,
} from "@/components/chat/conversation-message-scroller";
import { ImMessageHTML } from "@/components/im-message-html";
import { useImageLightbox } from "@/components/image-lightbox";
import { ProjectDialog } from "@/components/project-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  type AdminConversation,
  type AdminConversationDetail,
  type AdminMessage,
} from "@/lib/api/admin";
import {
  parseMessageAssetPayload,
  renderIMMessageHTML,
} from "@/lib/im-message";
import { formatDateTime } from "@/lib/utils";
import { useI18n } from "@/i18n/provider";

type ConversationDetailDialogProps = {
  open: boolean;
  loading: boolean;
  saving: boolean;
  readOnly?: boolean;
  item: AdminConversation | null;
  detail: AdminConversationDetail | null;
  messages?: AdminMessage[] | null;
  /** Whether older messages are available through cursor pagination. */
  messagesHasMore?: boolean;
  loadingMoreMessages?: boolean;
  onLoadMoreMessages?: () => void | Promise<void>;
  onOpenChange: (open: boolean) => void;
  onOpenAssign: () => void;
  onDispatch: () => Promise<void>;
  onOpenTransfer: () => void;
  onRead: () => Promise<void>;
  onOpenClose: () => void;
};

function getStatusMeta(
  status: number,
  t: (key: string, values?: Record<string, string | number>) => string
) {
  switch (status) {
    case 1:
      return { label: t("conversation.filterAiServing"), variant: "secondary" as const };
    case 2:
      return { label: t("conversation.filterPending"), variant: "outline" as const };
    case 3:
      return { label: t("conversation.filterActive"), variant: "secondary" as const };
    case 4:
      return { label: t("conversation.filterClosed"), variant: "outline" as const };
    default:
      return { label: t("conversationMonitor.unknown"), variant: "outline" as const };
  }
}

function getServiceModeLabel(
  mode: number,
  t: (key: string, values?: Record<string, string | number>) => string
) {
  switch (mode) {
    case 1:
      return t("conversationMonitor.serviceAi");
    case 2:
      return t("conversationMonitor.serviceHuman");
    case 3:
      return t("conversationMonitor.serviceAiFirst");
    default:
      return t("conversationMonitor.serviceUndefined");
  }
}

function getSenderLabel(
  message: AdminMessage,
  t: (key: string, values?: Record<string, string | number>) => string
) {
  switch (message.senderType) {
    case "agent":
      return message.senderName || t("conversationMonitor.senderAgent");
    case "customer":
      return message.senderName || t("conversationMonitor.senderCustomer");
    case "ai":
      return "AI";
    case "system":
      return t("conversationMonitor.senderSystem");
    default:
      return message.senderType;
  }
}

function getMessageContent(message: AdminMessage) {
  return message.content || message.payload || "-";
}

function getImageMessageUrl(message: AdminMessage) {
  return parseMessageAssetPayload(message.payload)?.url || "";
}

function getParticipantIdentity(
  participant: NonNullable<AdminConversationDetail["participants"]>[number],
) {
  return participant.participantId || participant.externalParticipantId || "-";
}

function getMessageAlign(message: AdminMessage): "start" | "end" {
  return message.senderType === "customer" || message.senderType === "system"
    ? "start"
    : "end";
}

function getMessageVariant(message: AdminMessage) {
  switch (message.senderType) {
    case "agent":
      return "agent" as const;
    case "ai":
      return "ai" as const;
    case "system":
      return "system" as const;
    default:
      return "customer" as const;
  }
}

function getMessageHtmlClassName(message: AdminMessage, isRecalled: boolean) {
  if (isRecalled) {
    return message.senderType === "agent" || message.senderType === "ai"
      ? "text-emerald-800 [&_p]:text-emerald-800"
      : "text-muted-foreground [&_p]:text-muted-foreground";
  }
  if (message.senderType === "agent") {
    return "[&_p]:text-white [&_a]:text-white [&_a]:underline [&_img]:rounded-md";
  }
  return "[&_a]:text-foreground [&_a]:underline [&_img]:rounded-md";
}

function getRecalledBubbleClassName(message: AdminMessage) {
  return message.senderType === "agent" || message.senderType === "ai"
    ? "border-dashed border-emerald-200 bg-emerald-50 text-emerald-800"
    : "border-dashed border-border/70 bg-muted/40 text-muted-foreground";
}

export function ConversationDetailDialog({
  open,
  loading,
  saving,
  readOnly = false,
  item,
  detail,
  messages: rawMessages,
  messagesHasMore = false,
  loadingMoreMessages = false,
  onLoadMoreMessages,
  onOpenChange,
  onOpenAssign,
  onDispatch,
  onOpenTransfer,
  onRead,
  onOpenClose,
}: ConversationDetailDialogProps) {
  const t = useI18n();
  const messages = Array.isArray(rawMessages) ? rawMessages : [];
  const currentConversation = detail ?? item;
  const isClosedConversation = currentConversation?.status === 4;
  const isPendingConversation = currentConversation?.status === 2;
  const statusMeta = currentConversation
    ? getStatusMeta(currentConversation.status, t)
    : null;
  const { open: openImageLightbox, close: closeImageLightbox } =
    useImageLightbox();

  useEffect(() => {
    if (!open) {
      closeImageLightbox();
    }
  }, [open, closeImageLightbox]);

  return (
    <ProjectDialog
      open={open}
      onOpenChange={onOpenChange}
      title={
        <div className="flex items-center gap-3">
          <span>{currentConversation?.customerName || t("conversationMonitor.detailFallbackTitle")}</span>

          <div>
            {statusMeta ? (
              <Badge variant={statusMeta.variant}>{statusMeta.label}</Badge>
            ) : null}
          </div>
        </div>
      }
      size="xl"
      // allowFullscreen
      defaultFullscreen
      bodyScrollable={false}
      bodyClassName="flex min-h-0 flex-1 flex-col overflow-hidden p-0"
      contentClassName="h-[calc(100vh-40px)] max-h-[calc(100vh-40px)]"
      footer={
        <div className="flex w-full flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-muted-foreground">
            {currentConversation
              ? t("conversationMonitor.lastActivePrefix", {
                  time: formatDateTime(currentConversation.lastMessageAt),
                })
              : t("conversationMonitor.noConversationInfo")}
          </div>
          {readOnly ? (
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {t("common.close")}
            </Button>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={onOpenAssign}
                disabled={saving || !currentConversation || currentConversation.status !== 2}
              >
                <MessageCircleMoreIcon />
                {saving ? t("conversationMonitor.processing") : t("conversationMonitor.assign")}
              </Button>
              <Button
                variant="outline"
                onClick={() => void onDispatch()}
                disabled={
                  saving || !currentConversation || !isPendingConversation
                }
              >
                <MessageCircleMoreIcon />
                {saving ? t("conversationMonitor.processing") : t("conversationMonitor.retryDispatch")}
              </Button>
              <Button
                variant="outline"
                onClick={() => void onRead()}
                disabled={saving || !currentConversation}
              >
                <CheckCheckIcon />
                {saving ? t("conversationMonitor.processing") : t("conversationMonitor.markRead")}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={onOpenTransfer}
                disabled={saving || !currentConversation || currentConversation.status !== 3}
              >
                <MessageCircleMoreIcon />
                {saving ? t("conversationMonitor.processing") : t("conversationMonitor.transfer")}
              </Button>
              {!isClosedConversation ? (
                <Button
                  variant="outline"
                  onClick={onOpenClose}
                  disabled={saving || !currentConversation}
                >
                  <EyeIcon />
                  {saving ? t("conversationMonitor.processing") : t("conversationMonitor.close")}
                </Button>
              ) : null}
            </div>
          )}
        </div>
      }
    >
      {loading ? (
        <div className="flex min-h-0 flex-1 items-center justify-center text-sm text-muted-foreground">
          {t("conversationMonitor.loadingDetail")}
        </div>
      ) : currentConversation ? (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden border-t md:flex-row">
          <aside className="flex max-h-[46%] w-full shrink-0 flex-col overflow-hidden border-b bg-muted/20 md:h-full md:max-h-none md:w-90 md:border-r md:border-b-0">
            <div className="space-y-4 p-6">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <InfoItem
                  label={t("conversationMonitor.columnServiceMode")}
                  value={getServiceModeLabel(currentConversation.serviceMode, t)}
                />
                <InfoItem
                  label={t("conversationMonitor.currentAssignee")}
                  value={currentConversation.currentAssigneeName || "-"}
                />
                <InfoItem
                  label={t("conversation.channelId")}
                  value={`${currentConversation.channelId || "-"}`}
                />
                <InfoItem
                  label={t("conversationMonitor.agentUnread")}
                  value={`${currentConversation.agentUnreadCount}`}
                />
                <InfoItem
                  label={t("conversationMonitor.customerUnread")}
                  value={`${currentConversation.customerUnreadCount}`}
                />
                <InfoItem
                  label={t("conversationMonitor.columnLastActive")}
                  value={formatDateTime(currentConversation.lastMessageAt)}
                  fullWidth
                />
                <InfoItem
                  label={t("conversationMonitor.closedAt")}
                  value={formatDateTime(currentConversation.closedAt)}
                  fullWidth
                />
              </div>
            </div>

            <Separator />

            <ScrollArea className="min-h-0 flex-1">
              <div className="space-y-4 p-6">
                <section className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">
                      {t("conversationMonitor.participants")}
                    </p>
                    <span className="text-xs text-muted-foreground">
                      {t("conversationMonitor.participantCount", {
                        count: detail?.participants?.length ?? 0,
                      })}
                    </span>
                  </div>
                  {detail?.participants?.length ? (
                    <div className="space-y-3">
                      {detail.participants.map((participant) => (
                        <div
                          key={participant.id}
                          className="rounded-lg border bg-background p-3"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-sm font-medium">
                              {participant.participantType || "-"}
                            </span>
                          </div>
                          <div className="mt-1 text-sm text-muted-foreground">
                            {t("conversationMonitor.participantIdentity", {
                              value: getParticipantIdentity(participant),
                            })}
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {t("conversationMonitor.participantJoinedAt", {
                              time: formatDateTime(participant.joinedAt),
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-lg border border-dashed bg-background p-4 text-sm text-muted-foreground">
                      {t("conversationMonitor.emptyParticipants")}
                    </div>
                  )}
                </section>
              </div>
            </ScrollArea>
          </aside>

          <section className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-background">
            <ConversationMessageScroller
              key={currentConversation.id}
              className="min-h-0 flex-1"
              hasMoreOlder={messagesHasMore}
              loadingOlder={loadingMoreMessages}
              onLoadOlder={onLoadMoreMessages}
              topSlot={
                messagesHasMore ? (
                  <div className="flex min-h-8 flex-col items-center justify-center py-2 text-xs text-muted-foreground">
                    {loadingMoreMessages
                      ? t("conversationMonitor.loadingOlder")
                      : t("conversationMonitor.loadOlderHint")}
                  </div>
                ) : null
              }
            >
              {messages.length ? (
                messages.map((message) => (
                  <ConversationMessageScrollerItem
                    key={message.id}
                    messageId={`${message.id}`}
                  >
                    <ConversationMonitorMessage
                      message={message}
                      onImagePreview={openImageLightbox}
                    />
                  </ConversationMessageScrollerItem>
                ))
              ) : (
                <div className="flex h-full min-h-80 items-center justify-center rounded-xl border border-dashed bg-background text-sm text-muted-foreground">
                  {t("conversationMonitor.emptyMessages")}
                </div>
              )}
            </ConversationMessageScroller>
          </section>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 items-center justify-center text-sm text-muted-foreground">
          {t("conversationMonitor.emptyDetail")}
        </div>
      )}
    </ProjectDialog>
  );
}

type ConversationMonitorMessageProps = {
  message: AdminMessage;
  onImagePreview: (src: string, alt?: string) => void;
};

function ConversationMonitorMessage({
  message,
  onImagePreview,
}: ConversationMonitorMessageProps) {
  const t = useI18n();
  const isRecalled = Boolean(message.recalledAt) || message.sendStatus === 6;
  const isHtmlMessage =
    !isRecalled &&
    (message.messageType === "html" || message.messageType === "attachment");
  const isImageMessage = !isRecalled && message.messageType === "image";
  const isSystem = message.senderType === "system";
  const align = getMessageAlign(message);
  const variant = isRecalled ? "recalled" : getMessageVariant(message);
  const htmlClassName = getMessageHtmlClassName(message, isRecalled);

  return (
    <ConversationMessageRow
      align={align}
      centered={isSystem}
      header={
        <>
          <span>{getSenderLabel(message, t)}</span>
          <span>·</span>
          <span>{formatDateTime(message.sentAt)}</span>
          {isRecalled ? (
            <>
              <span>·</span>
              <span>{t("conversationMonitor.messageRecalled")}</span>
            </>
          ) : null}
        </>
      }
      footer={t("conversationMonitor.readStatus", {
        agent: message.agentRead
          ? t("conversationMonitor.read")
          : t("conversationMonitor.unread"),
        customer: message.customerRead
          ? t("conversationMonitor.read")
          : t("conversationMonitor.unread"),
      })}
    >
      <ConversationMessageBubble
        variant={variant}
        className={isRecalled ? getRecalledBubbleClassName(message) : undefined}
      >
        {isRecalled ? (
          <div className={htmlClassName}>
            {t("conversationMonitor.messageRecalledBody")}
          </div>
        ) : isHtmlMessage ? (
          <ImMessageHTML
            html={renderIMMessageHTML(message)}
            className={`${htmlClassName} [&_img]:max-w-full [&_img]:cursor-zoom-in`}
            onImageClick={onImagePreview}
          />
        ) : isImageMessage ? (
          <MessageImage
            src={getImageMessageUrl(message)}
            alt={getMessageContent(message)}
            onPreview={onImagePreview}
          />
        ) : (
          <div className="whitespace-pre-wrap break-words">
            {getMessageContent(message)}
          </div>
        )}
      </ConversationMessageBubble>
    </ConversationMessageRow>
  );
}

type InfoItemProps = {
  label: string;
  value: string;
  fullWidth?: boolean;
};

function InfoItem({ label, value, fullWidth = false }: InfoItemProps) {
  return (
    <div className={fullWidth ? "col-span-2" : undefined}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 break-all font-medium">{value || "-"}</p>
    </div>
  );
}

type MessageImageProps = {
  src: string;
  alt: string;
  onPreview: (src: string, alt?: string) => void;
};

function MessageImage({ src, alt, onPreview }: MessageImageProps) {
  const t = useI18n();
  if (!src) {
    return (
      <div className="text-sm whitespace-pre-wrap break-words">
        {alt || t("conversationMonitor.imageFallback")}
      </div>
    );
  }

  return (
    <button
      type="button"
      className="block cursor-zoom-in"
      onClick={() => onPreview(src, alt)}
    >
      <Image
        src={src}
        alt={alt || t("conversationMonitor.messageImageAlt")}
        width={480}
        height={360}
        className="max-h-64 w-auto max-w-full rounded-md object-contain"
        unoptimized
      />
    </button>
  );
}
