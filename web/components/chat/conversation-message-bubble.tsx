"use client"

import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

export type ConversationMessageVariant =
  | "customer"
  | "agent"
  | "ai"
  | "system"
  | "recalled"

type ConversationMessageBubbleProps = {
  variant: ConversationMessageVariant
  children: ReactNode
  className?: string
}

function getBubbleClassName(variant: ConversationMessageVariant) {
  switch (variant) {
    case "customer":
      return "border-border/70 bg-muted/60 text-foreground shadow-sm"
    case "system":
      return "border-dashed border-border bg-muted/60 text-muted-foreground"
    case "ai":
      return "border-primary/15 bg-primary/5 text-foreground shadow-sm"
    case "agent":
      return "border-transparent bg-emerald-600 text-white shadow-sm"
    case "recalled":
      return "border-dashed border-border/70 bg-muted/40 text-muted-foreground"
    default:
      return "border-border/70 bg-muted/60 text-foreground shadow-sm"
  }
}

export function ConversationMessageBubble({
  variant,
  children,
  className,
}: ConversationMessageBubbleProps) {
  return (
    <div
      className={cn(
        "w-fit max-w-full rounded-2xl border px-4 py-3 text-sm leading-6",
        getBubbleClassName(variant),
        className,
      )}
    >
      {children}
    </div>
  )
}
