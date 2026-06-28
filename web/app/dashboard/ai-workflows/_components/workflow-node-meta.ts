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

export type WorkflowNodeTone =
  | "blue"
  | "cyan"
  | "emerald"
  | "indigo"
  | "amber"
  | "violet"
  | "rose"
  | "slate"

export type WorkflowNodeMeta = {
  icon: LucideIcon
  tone: WorkflowNodeTone
}

const workflowNodeMetaByType: Record<string, WorkflowNodeMeta> = {
  start: { icon: PlayCircleIcon, tone: "blue" },
  conversation_understanding: { icon: MessageCircleIcon, tone: "indigo" },
  reply_policy: { icon: ShieldCheckIcon, tone: "violet" },
  knowledge_retrieve: { icon: BookOpenIcon, tone: "emerald" },
  answerability_gate: { icon: HelpCircleIcon, tone: "cyan" },
  llm_reply: { icon: BotIcon, tone: "indigo" },
  condition: { icon: GitBranchIcon, tone: "cyan" },
  analyze_conversation: { icon: SearchIcon, tone: "blue" },
  prepare_ticket_draft: { icon: ClipboardListIcon, tone: "amber" },
  human_confirm: { icon: UserCheckIcon, tone: "amber" },
  create_ticket: { icon: TicketIcon, tone: "rose" },
  handoff_to_human: { icon: HeadphonesIcon, tone: "amber" },
  send_reply: { icon: SendIcon, tone: "emerald" },
  end: { icon: FlagIcon, tone: "slate" },
}

export function getWorkflowNodeMeta(type: string): WorkflowNodeMeta {
  return workflowNodeMetaByType[type] ?? { icon: FileTextIcon, tone: "slate" }
}

export function getWorkflowNodeIconClass(tone: WorkflowNodeTone) {
  const classes: Record<WorkflowNodeTone, string> = {
    blue: "bg-blue-500 text-white shadow-blue-500/20",
    cyan: "bg-cyan-500 text-white shadow-cyan-500/20",
    emerald: "bg-emerald-500 text-white shadow-emerald-500/20",
    indigo: "bg-indigo-500 text-white shadow-indigo-500/20",
    amber: "bg-amber-500 text-white shadow-amber-500/20",
    violet: "bg-violet-500 text-white shadow-violet-500/20",
    rose: "bg-rose-500 text-white shadow-rose-500/20",
    slate: "bg-slate-600 text-white shadow-slate-600/20",
  }
  return classes[tone]
}
