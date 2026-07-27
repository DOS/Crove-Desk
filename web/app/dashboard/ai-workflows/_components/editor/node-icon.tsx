import {
  BookOpenIcon,
  BotIcon,
  CircleHelpIcon,
  ClipboardListIcon,
  FlagIcon,
  GitBranchIcon,
  HeadphonesIcon,
  MessageCircleIcon,
  PlayCircleIcon,
  SearchIcon,
  SendIcon,
  ShieldCheckIcon,
  TicketIcon,
  UserCheckIcon,
  type LucideIcon,
} from "lucide-react"

const icons: Record<string, LucideIcon> = {
  PlayCircleIcon,
  MessageCircleIcon,
  ShieldCheckIcon,
  BookOpenIcon,
  HelpCircleIcon: CircleHelpIcon,
  BotIcon,
  GitBranchIcon,
  SearchIcon,
  ClipboardListIcon,
  UserCheckIcon,
  TicketIcon,
  HeadphonesIcon,
  SendIcon,
  FlagIcon,
}

export function WorkflowNodeIcon({
  name,
  className,
}: {
  name?: string
  className?: string
}) {
  const Icon = icons[name ?? ""] ?? GitBranchIcon
  return <Icon className={className} />
}

