import {
  GlobeIcon,
  MailIcon,
  MessageCircleIcon,
  MessagesSquareIcon,
  MessageSquareMoreIcon,
  SendIcon,
} from "lucide-react"

export type ChannelIconProps = {
  channelType?: string
  className?: string
}

export function ChannelIcon({ channelType, className = "size-3.5" }: ChannelIconProps) {
  switch (channelType) {
    case "email":
      return <MailIcon className={className} />
    case "telegram":
      return <SendIcon className={className} />
    case "zalo_oa":
      return <MessageCircleIcon className={className} />
    case "discord":
      return <MessagesSquareIcon className={className} />
    case "messenger":
      return <MessageCircleIcon className={className} />
    case "wxwork_kf":
      return <MessageSquareMoreIcon className={className} />
    case "wechat_mp":
      return <MessagesSquareIcon className={className} />
    case "web":
    default:
      return <GlobeIcon className={className} />
  }
}
