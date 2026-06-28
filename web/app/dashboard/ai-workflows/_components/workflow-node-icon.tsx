import { cn } from "@/lib/utils"
import { FileTextIcon, type LucideIcon } from "lucide-react"
import * as LucideIcons from "lucide-react"

const lucideIconComponents = LucideIcons as unknown as Record<string, LucideIcon>

export function WorkflowNodeIcon({
  icon,
  size = "md",
  className,
}: {
  icon?: string
  size?: "sm" | "md"
  className?: string
}) {
  const Icon = icon ? lucideIconComponents[icon] ?? FileTextIcon : FileTextIcon

  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-lg bg-[#2575FC] text-white shadow-sm",
        size === "md" ? "size-7" : "size-6",
        className
      )}
    >
      <Icon className={size === "md" ? "size-4" : "size-3.5"} />
    </span>
  )
}
