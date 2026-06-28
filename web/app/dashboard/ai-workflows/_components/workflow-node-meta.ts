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
  label: string
}

const workflowNodeMetaByType: Record<string, WorkflowNodeMeta> = {
  start: { icon: PlayCircleIcon, tone: "blue", label: "入口" },
  conversation_understanding: { icon: MessageCircleIcon, tone: "indigo", label: "理解" },
  reply_policy: { icon: ShieldCheckIcon, tone: "violet", label: "策略" },
  knowledge_retrieve: { icon: BookOpenIcon, tone: "emerald", label: "知识" },
  answerability_gate: { icon: HelpCircleIcon, tone: "cyan", label: "判断" },
  llm_reply: { icon: BotIcon, tone: "indigo", label: "生成" },
  condition: { icon: GitBranchIcon, tone: "cyan", label: "分支" },
  analyze_conversation: { icon: SearchIcon, tone: "blue", label: "分析" },
  prepare_ticket_draft: { icon: ClipboardListIcon, tone: "amber", label: "工单" },
  human_confirm: { icon: UserCheckIcon, tone: "amber", label: "确认" },
  create_ticket: { icon: TicketIcon, tone: "rose", label: "工单" },
  handoff_to_human: { icon: HeadphonesIcon, tone: "amber", label: "人工" },
  send_reply: { icon: SendIcon, tone: "emerald", label: "发送" },
  end: { icon: FlagIcon, tone: "slate", label: "结束" },
}

export function getWorkflowNodeMeta(type: string): WorkflowNodeMeta {
  return workflowNodeMetaByType[type] ?? { icon: FileTextIcon, tone: "slate", label: "节点" }
}

export function getWorkflowNodeAccentClass(tone: WorkflowNodeTone) {
  const classes: Record<WorkflowNodeTone, string> = {
    blue: "border-blue-200/80 bg-blue-50 text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/50 dark:text-blue-300",
    cyan: "border-cyan-200/80 bg-cyan-50 text-cyan-700 dark:border-cyan-900/60 dark:bg-cyan-950/50 dark:text-cyan-300",
    emerald: "border-emerald-200/80 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/50 dark:text-emerald-300",
    indigo: "border-indigo-200/80 bg-indigo-50 text-indigo-700 dark:border-indigo-900/60 dark:bg-indigo-950/50 dark:text-indigo-300",
    amber: "border-amber-200/80 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/50 dark:text-amber-300",
    violet: "border-violet-200/80 bg-violet-50 text-violet-700 dark:border-violet-900/60 dark:bg-violet-950/50 dark:text-violet-300",
    rose: "border-rose-200/80 bg-rose-50 text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/50 dark:text-rose-300",
    slate: "border-slate-200/80 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300",
  }
  return classes[tone]
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
