import {
  BookOpenIcon,
  BotIcon,
  ClipboardListIcon,
  FileTextIcon,
  FlagIcon,
  GitBranchIcon,
  HeadphonesIcon,
  HelpCircleIcon,
  MessageCircleIcon,
  PlayCircleIcon,
  SearchIcon,
  SendIcon,
  ShieldCheckIcon,
  TicketIcon,
  UserCheckIcon,
  type LucideIcon,
} from "lucide-react"

export type WorkflowNodeMeta = {
  icon: LucideIcon
}

const workflowNodeMetaByType: Record<string, WorkflowNodeMeta> = {
  start: { icon: PlayCircleIcon },
  conversation_understanding: { icon: MessageCircleIcon },
  reply_policy: { icon: ShieldCheckIcon },
  knowledge_retrieve: { icon: BookOpenIcon },
  answerability_gate: { icon: HelpCircleIcon },
  llm_reply: { icon: BotIcon },
  condition: { icon: GitBranchIcon },
  analyze_conversation: { icon: SearchIcon },
  prepare_ticket_draft: { icon: ClipboardListIcon },
  human_confirm: { icon: UserCheckIcon },
  create_ticket: { icon: TicketIcon },
  handoff_to_human: { icon: HeadphonesIcon },
  send_reply: { icon: SendIcon },
  end: { icon: FlagIcon },
}

export function getWorkflowNodeMeta(type: string): WorkflowNodeMeta {
  return workflowNodeMetaByType[type] ?? { icon: FileTextIcon }
}
