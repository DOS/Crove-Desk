"use client"

import { CheckIcon, ChevronsUpDownIcon, CircleDotIcon, UserCheckIcon, UserIcon, UserMinusIcon } from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { useI18n } from "@/i18n/provider"
import { fetchAgentProfilesAll, type AdminAgentProfile } from "@/lib/api/admin"
import { assignAgentConversation, type AgentConversation } from "@/lib/api/agent"
import { readSession } from "@/lib/auth"
import { useAgentConversationsStore } from "@/lib/stores/agent-conversations"
import { cn } from "@/lib/utils"

export type AssigneeSelectorProps = {
  conversation: AgentConversation
  variant?: "header" | "sidebar" | "compact"
  className?: string
}

export function AssigneeSelector({
  conversation,
  variant = "sidebar",
  className,
}: AssigneeSelectorProps) {
  const t = useI18n()
  const [open, setOpen] = useState(false)
  const [agents, setAgents] = useState<AdminAgentProfile[]>([])
  const [loadingAgents, setLoadingAgents] = useState(false)
  const [updating, setUpdating] = useState(false)
  const loadConversations = useAgentConversationsStore((s) => s.loadConversations)

  const currentSession = useMemo(() => readSession(), [])
  const currentUserId = currentSession?.user?.id ?? 0

  const loadAgents = useCallback(async () => {
    if (agents.length > 0) return
    setLoadingAgents(true)
    try {
      const data = await fetchAgentProfilesAll()
      setAgents(Array.isArray(data) ? data : [])
    } catch {
      // Ignore background load error
    } finally {
      setLoadingAgents(false)
    }
  }, [agents.length])

  useEffect(() => {
    if (open) {
      void loadAgents()
    }
  }, [loadAgents, open])

  const currentAssignee = useMemo(() => {
    if (!conversation.currentAssigneeId) return null
    return (
      agents.find((a) => a.userId === conversation.currentAssigneeId) || {
        userId: conversation.currentAssigneeId,
        displayName: conversation.currentAssigneeName || `Agent #${conversation.currentAssigneeId}`,
        avatar: "",
      }
    )
  }, [agents, conversation.currentAssigneeId, conversation.currentAssigneeName])

  const isAssignedToMe = currentUserId > 0 && conversation.currentAssigneeId === currentUserId

  const handleSelectAssignee = async (targetUserId: number) => {
    if (updating || targetUserId === conversation.currentAssigneeId) {
      setOpen(false)
      return
    }

    setUpdating(true)
    try {
      await assignAgentConversation(
        conversation.id,
        targetUserId,
        targetUserId === 0
          ? "Unassigned from workbench"
          : targetUserId === currentUserId
            ? "Self-assigned"
            : "Reassigned from workbench",
      )
      toast.success(t("conversation.assignSuccess"))
      setOpen(false)
      await loadConversations()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("conversation.assignFailed"))
    } finally {
      setUpdating(false)
    }
  }

  // Variant: Header Quick Badge
  if (variant === "header") {
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button
              variant="ghost"
              size="sm"
              disabled={updating}
              className={cn(
                "h-6 px-2 text-xs font-medium rounded-md gap-1 transition-colors hover:bg-muted cursor-pointer",
                conversation.currentAssigneeId > 0
                  ? isAssignedToMe
                    ? "bg-primary/10 text-primary hover:bg-primary/15"
                    : "bg-muted/70 text-foreground hover:bg-muted"
                  : "bg-amber-500/10 text-amber-700 hover:bg-amber-500/20 dark:text-amber-300",
                className,
              )}
            />
          }
        >
          {conversation.currentAssigneeId > 0 ? (
            <>
              <UserCheckIcon className="size-3 shrink-0 opacity-70" />
              <span className="truncate max-w-28">
                {isAssignedToMe ? `${t("conversation.assignee")}: You` : `@${conversation.currentAssigneeName || "Agent"}`}
              </span>
            </>
          ) : (
            <>
              <UserIcon className="size-3 shrink-0 opacity-70" />
              <span>{t("conversation.takeIt")}</span>
            </>
          )}
          <ChevronsUpDownIcon className="size-2.5 opacity-50 ml-0.5" />
        </PopoverTrigger>
        <PopoverContent align="start" className="w-56 p-0 shadow-md">
          <AssigneeCommandList
            agents={agents}
            currentAssigneeId={conversation.currentAssigneeId}
            currentUserId={currentUserId}
            currentSessionUser={currentSession?.user}
            loading={loadingAgents}
            updating={updating}
            onSelect={handleSelectAssignee}
            t={t}
          />
        </PopoverContent>
      </Popover>
    )
  }

  // Variant: Sidebar Row
  return (
    <div className={cn("flex items-center justify-between gap-2.5 text-sm leading-snug", className)}>
      <span className="w-17 shrink-0 text-xs text-muted-foreground">{t("conversation.assignee")}</span>
      <div className="min-w-0 flex-1">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger
            render={
              <button
                type="button"
                disabled={updating}
                className="flex w-full items-center justify-between gap-1.5 rounded-md px-2 py-1 text-left text-xs transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer border border-border/50 bg-background/50"
              />
            }
          >
            <div className="flex min-w-0 items-center gap-1.5">
              {currentAssignee && conversation.currentAssigneeId > 0 ? (
                <>
                  <Avatar className="size-4 shrink-0">
                    <AvatarImage src={currentAssignee.avatar} />
                    <AvatarFallback className="text-[9px] bg-primary/10 text-primary">
                      {currentAssignee.displayName.slice(0, 1).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="truncate font-medium text-foreground">
                    {currentAssignee.displayName}
                    {isAssignedToMe ? " (you)" : ""}
                  </span>
                </>
              ) : (
                <>
                  <UserMinusIcon className="size-3.5 shrink-0 text-muted-foreground" />
                  <span className="text-muted-foreground">{t("conversation.unassigned")}</span>
                </>
              )}
            </div>
            <ChevronsUpDownIcon className="size-3 shrink-0 opacity-50" />
          </PopoverTrigger>
          <PopoverContent align="end" className="w-60 p-0 shadow-md">
          <AssigneeCommandList
            agents={agents}
            currentAssigneeId={conversation.currentAssigneeId}
            currentUserId={currentUserId}
            currentSessionUser={currentSession?.user}
            loading={loadingAgents}
            updating={updating}
            onSelect={handleSelectAssignee}
            t={t}
          />
        </PopoverContent>
      </Popover>
      </div>
    </div>
  )
}

function AssigneeCommandList({
  agents,
  currentAssigneeId,
  currentUserId,
  currentSessionUser,
  loading,
  updating,
  onSelect,
  t,
}: {
  agents: AdminAgentProfile[]
  currentAssigneeId: number
  currentUserId: number
  currentSessionUser?: { id: number; username: string; nickname?: string; avatar?: string }
  loading: boolean
  updating: boolean
  onSelect: (userId: number) => void
  t: (key: string) => string
}) {
  return (
    <Command className="rounded-lg border-none">
      <CommandInput placeholder={t("conversation.searchAssignee")} className="h-8.5 text-xs" />
      <CommandList className="max-h-64">
        <CommandEmpty className="py-3 text-center text-xs text-muted-foreground">
          {loading ? t("conversation.loading") : t("conversation.emptyAssignee")}
        </CommandEmpty>

        <CommandGroup>
          {/* Option: Unassigned */}
          <CommandItem
            value="unassigned none"
            onSelect={() => onSelect(0)}
            disabled={updating}
            className="flex items-center justify-between text-xs py-1.5 cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <UserMinusIcon className="size-4 text-muted-foreground shrink-0" />
              <span>{t("conversation.unassigned")}</span>
            </div>
            {currentAssigneeId === 0 ? <CheckIcon className="size-3.5 text-primary" /> : null}
          </CommandItem>

          {/* Option: Assign to me */}
          {currentUserId > 0 ? (
            <CommandItem
              value={`me ${currentSessionUser?.nickname || currentSessionUser?.username || ""}`}
              onSelect={() => onSelect(currentUserId)}
              disabled={updating}
              className="flex items-center justify-between text-xs py-1.5 cursor-pointer"
            >
              <div className="flex items-center gap-2 min-w-0">
                <Avatar className="size-4 shrink-0">
                  <AvatarImage src={currentSessionUser?.avatar} />
                  <AvatarFallback className="text-[9px] bg-primary/10 text-primary">
                    {(currentSessionUser?.nickname || currentSessionUser?.username || "U").slice(0, 1).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="truncate font-medium">
                  {currentSessionUser?.nickname || currentSessionUser?.username} (you)
                </span>
              </div>
              {currentAssigneeId === currentUserId ? <CheckIcon className="size-3.5 text-primary" /> : null}
            </CommandItem>
          ) : null}
        </CommandGroup>

        {agents.length > 0 ? (
          <>
            <CommandSeparator />
            <CommandGroup heading="Team Members">
              {agents
                .filter((a) => a.userId !== currentUserId)
                .map((agent) => {
                  const isSelected = agent.userId === currentAssigneeId
                  return (
                    <CommandItem
                      key={agent.userId}
                      value={`${agent.displayName} ${agent.username || ""} ${agent.agentCode || ""}`}
                      onSelect={() => onSelect(agent.userId)}
                      disabled={updating}
                      className="flex items-center justify-between text-xs py-1.5 cursor-pointer"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Avatar className="size-4 shrink-0">
                          <AvatarImage src={agent.avatar} />
                          <AvatarFallback className="text-[9px] bg-primary/10 text-primary">
                            {agent.displayName.slice(0, 1).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className="truncate">{agent.displayName}</span>
                        {agent.serviceStatus === 0 ? (
                          <CircleDotIcon className="size-2 shrink-0 text-emerald-500 fill-emerald-500" />
                        ) : null}
                      </div>
                      {isSelected ? <CheckIcon className="size-3.5 text-primary" /> : null}
                    </CommandItem>
                  )
                })}
            </CommandGroup>
          </>
        ) : null}
      </CommandList>
    </Command>
  )
}
