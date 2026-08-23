"use client"

import { useMemo, useState } from "react"
import { toast } from "sonner"

import { TagBadges, TagSelector } from "@/components/tag-selector"
import {
  addConversationTag,
  removeConversationTag,
  type AgentConversation,
  type AgentConversationTag,
} from "@/lib/api/agent"
import { type TagTree } from "@/lib/api/admin"
import { useI18n } from "@/i18n/provider"

type ConversationTagPickerProps = {
  conversation: AgentConversation
  availableTags: TagTree[]
  loading?: boolean
  onTagsChange: (tags: AgentConversationTag[]) => void
}

export function ConversationTagPicker({
  conversation,
  availableTags,
  loading = false,
  onTagsChange,
}: ConversationTagPickerProps) {
  const t = useI18n()
  const [pendingTagId, setPendingTagId] = useState<number | null>(null)

  const selectedValues = useMemo(
    () => (conversation.tags ?? []).map((item) => item.id),
    [conversation.tags]
  )
  const selectedTagIds = useMemo(
    () => new Set(selectedValues),
    [selectedValues]
  )

  async function handleChange(nextTagIds: number[]) {
    if (pendingTagId !== null) {
      return
    }

    const tagId =
      nextTagIds.find((id) => !selectedTagIds.has(id)) ??
      selectedValues.find((id) => !nextTagIds.includes(id))

    if (!tagId) {
      return
    }

    const exists = selectedTagIds.has(tagId)
    const currentTags = conversation.tags ?? []
    const nextTags = exists
      ? currentTags.filter((item) => item.id !== tagId)
      : [...currentTags, { id: tagId, name: "" }]

    setPendingTagId(tagId)
    try {
      if (exists) {
        await removeConversationTag({
          conversationId: conversation.id,
          tagId,
        })
      } else {
        await addConversationTag({
          conversationId: conversation.id,
          tagId,
        })
      }
      onTagsChange(nextTags)
      toast.success(exists ? t("conversation.tagRemoved") : t("conversation.tagAdded"))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("conversation.tagUpdateFailed"))
    } finally {
      setPendingTagId(null)
    }
  }

  return (
    <TagSelector
      mode="multiple"
      value={selectedValues}
      onChange={(value) => void handleChange(value)}
      tags={availableTags}
      loading={loading}
      pendingTagId={pendingTagId}
      placeholder={t("conversation.edit")}
      triggerText={t("conversation.edit")}
      searchPlaceholder={t("conversation.searchTags")}
      loadingText={t("conversation.loadingTags")}
      emptyText={t("conversation.emptyTags")}
      align="end"
      showSelectedBadges={false}
      triggerVariant="ghost"
      triggerSize="sm"
      triggerClassName="h-7 w-auto shrink-0 justify-start gap-1 px-2 text-xs"
      contentClassName="w-72"
    />
  )
}

type ConversationTagBadgesProps = {
  tags?: AgentConversationTag[]
  availableTags?: TagTree[]
}

export function ConversationTagBadges({
  tags,
  availableTags = [],
}: ConversationTagBadgesProps) {
  if (!tags || tags.length === 0) {
    return null
  }

  return (
    <TagBadges
      ids={tags.map((tag) => tag.id)}
      tags={availableTags}
      fallbackTags={tags}
    />
  )
}
