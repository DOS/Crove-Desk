"use client"

import { ChevronDownIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useI18n } from "@/i18n/provider"

import {
  CONTENT_MODE_OPTIONS,
  type ContentMode,
} from "./types"

type EditorModeSwitchProps = {
  value: ContentMode
  allowedModes?: ReadonlyArray<ContentMode>
  disabled?: boolean
  onChange: (nextMode: ContentMode) => void
}

export function EditorModeSwitch({
  value,
  allowedModes = CONTENT_MODE_OPTIONS,
  disabled = false,
  onChange,
}: EditorModeSwitchProps) {
  const t = useI18n()
  const MODE_OPTIONS: Array<{ value: ContentMode; label: string }> = [
    { value: "markdown", label: t("editor.modeLabelMarkdown") },
    { value: "html", label: t("editor.modeLabelRichText") },
  ]
  const options = MODE_OPTIONS.filter((option) => allowedModes.includes(option.value))
  const activeLabel = options.find((option) => option.value === value)?.label ?? value

  if (options.length <= 1) {
    return null
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button type="button" variant="outline" size="sm" className="mx-0.5 h-7 min-w-24 justify-between gap-2 bg-background px-2 text-xs font-medium shadow-none" />}
        disabled={disabled}
        aria-label={t("editor.modeSwitchLabel")}
      >
        <span>{activeLabel}</span>
        <ChevronDownIcon className="size-3.5 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-32">
        <DropdownMenuRadioGroup
          value={value}
          onValueChange={(nextMode) => {
            if (nextMode !== value) {
              onChange(nextMode as ContentMode)
            }
          }}
        >
          {options.map((option) => (
            <DropdownMenuRadioItem key={option.value} value={option.value} disabled={disabled}>
              {option.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
