import "@flowgram.ai/free-layout-editor/index.css"

import {
  useNodeRender,
  WorkflowNodeRenderer,
  type WorkflowNodeProps,
} from "@flowgram.ai/free-layout-editor"
import {
  BotIcon,
  CircleStopIcon,
  DatabaseIcon,
  GitBranchIcon,
  MessageSquareTextIcon,
  SendIcon,
  UserRoundIcon,
} from "lucide-react"
import type { ComponentType } from "react"

import { cn } from "@/lib/utils"

const iconByType: Record<string, ComponentType<{ className?: string }>> = {
  start: UserRoundIcon,
  conversation_understanding: BotIcon,
  reply_policy: MessageSquareTextIcon,
  condition: GitBranchIcon,
  knowledge_retrieve: DatabaseIcon,
  answerability_gate: GitBranchIcon,
  llm_reply: BotIcon,
  human_confirm: UserRoundIcon,
  create_ticket: MessageSquareTextIcon,
  handoff_to_human: UserRoundIcon,
  send_reply: SendIcon,
  end: CircleStopIcon,
}

export function FlowgramNodeRenderer(props: WorkflowNodeProps) {
  const { selected, node } = useNodeRender()
  const nodeType = String(node.flowNodeType ?? "")
  const Icon = iconByType[nodeType] ?? BotIcon
  const nodeJSON = node.toJSON?.() as { data?: { title?: string }; title?: string } | undefined
  const title = nodeJSON?.data?.title || nodeJSON?.title || nodeType || "节点"

  return (
    <WorkflowNodeRenderer
      node={props.node}
      className={cn(
        "w-[260px] rounded-md border bg-background shadow-sm transition-colors",
        selected ? "border-primary ring-2 ring-primary/15" : "border-border"
      )}
      style={{ padding: 0 }}
    >
      <div className="flex items-start gap-3 p-3">
        <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md border bg-muted">
          <Icon className="size-4 text-muted-foreground" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium leading-5">{title}</div>
          <div className="mt-1 truncate text-xs text-muted-foreground">{nodeType}</div>
        </div>
      </div>
    </WorkflowNodeRenderer>
  )
}
