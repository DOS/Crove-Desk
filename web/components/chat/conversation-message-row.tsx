"use client"

import type { ReactNode } from "react"

import {
  Message,
  MessageAvatar,
  MessageContent,
  MessageFooter,
  MessageHeader,
} from "@/components/ui/message"
import { cn } from "@/lib/utils"

type ConversationMessageRowProps = {
  align: "start" | "end"
  centered?: boolean
  header?: ReactNode
  footer?: ReactNode
  avatar?: ReactNode
  children: ReactNode
  className?: string
  avatarClassName?: string
  contentClassName?: string
  headerClassName?: string
  footerClassName?: string
}

export function ConversationMessageRow({
  align,
  centered = false,
  header,
  footer,
  avatar,
  children,
  className,
  avatarClassName,
  contentClassName,
  headerClassName,
  footerClassName,
}: ConversationMessageRowProps) {
  if (centered) {
    return (
      <Message
        align="start"
        className={cn("justify-center", className)}
      >
        <MessageContent className={cn("w-fit max-w-[85%] items-center", contentClassName)}>
          {header ? (
            <MessageHeader className={cn("justify-center text-center", headerClassName)}>
              {header}
            </MessageHeader>
          ) : null}
          {children}
          {footer ? (
            <MessageFooter className={cn("justify-center text-center", footerClassName)}>
              {footer}
            </MessageFooter>
          ) : null}
        </MessageContent>
      </Message>
    )
  }

  return (
    <Message align={align} className={className}>
      {avatar ? (
        <MessageAvatar
          className={cn(
            "self-start group-has-data-[slot=message-footer]/message:translate-y-0 bg-transparent",
            avatarClassName,
          )}
        >
          {avatar}
        </MessageAvatar>
      ) : null}
      <MessageContent
        className={cn(
          "max-w-[85%]",
          align === "end" ? "items-end" : "items-start",
          contentClassName,
        )}
      >
        {header ? (
          <MessageHeader
            className={cn(
              "gap-2 px-0",
              align === "end" ? "justify-end text-right" : "justify-start text-left",
              headerClassName,
            )}
          >
            {header}
          </MessageHeader>
        ) : null}
        {children}
        {footer ? (
          <MessageFooter
            className={cn(
              "gap-2 px-0",
              align === "end" ? "justify-end text-right" : "justify-start text-left",
              footerClassName,
            )}
          >
            {footer}
          </MessageFooter>
        ) : null}
      </MessageContent>
    </Message>
  )
}
