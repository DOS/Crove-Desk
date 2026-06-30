"use client"

import { useState, type ReactNode } from "react"
import { CheckIcon, ChevronsUpDownIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { useI18n } from "@/i18n/provider"

export type ComboboxOption = {
  value: string
  label: string
  subtitle?: string
  description?: string
}

type OptionComboboxProps = {
  value: string
  options: ComboboxOption[]
  placeholder: string
  searchPlaceholder?: string
  emptyText?: string
  disabled?: boolean
  triggerClassName?: string
  preserveExternalSelection?: boolean
  onChange: (value: string) => void
  renderOptionAction?: (option: ComboboxOption) => ReactNode
}

export function OptionCombobox({
  value,
  options,
  placeholder,
  searchPlaceholder,
  emptyText,
  disabled = false,
  triggerClassName,
  preserveExternalSelection = false,
  onChange,
  renderOptionAction,
}: OptionComboboxProps) {
  const t = useI18n()
  const [open, setOpen] = useState(false)
  const selectedLabel =
    options.find((option) => option.value === value)?.label ?? placeholder

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            role="combobox"
            className={cn("m-0 w-full justify-between font-normal", triggerClassName)}
            disabled={disabled}
          />
        }
      >
        <span className="truncate">{selectedLabel}</span>
        <ChevronsUpDownIcon className="ml-2 size-4 shrink-0 opacity-50" />
      </PopoverTrigger>
      <PopoverContent
        className="w-(--radix-popover-trigger-width) p-0"
        align="start"
        data-workflow-preserve-selection={preserveExternalSelection ? true : undefined}
      >
        <Command>
          <CommandInput placeholder={searchPlaceholder ?? t("common.searchKeyword")} />
          <CommandList>
            <CommandEmpty>{emptyText ?? t("common.emptyOptions")}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={`${option.label} ${option.value} ${option.subtitle ?? ""} ${option.description ?? ""}`}
                  onSelect={() => {
                    onChange(option.value)
                    setOpen(false)
                  }}
                >
                  <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
                    <div className="flex min-w-0 items-start">
                      <CheckIcon
                        className={cn(
                          "mr-2 mt-0.5 size-4 shrink-0",
                          option.value === value ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <span className="min-w-0">
                        <span className="block truncate">{option.label}</span>
                        {option.subtitle ? (
                          <span className="mt-0.5 block truncate font-mono text-[11px] leading-4 text-slate-500">
                            {option.subtitle}
                          </span>
                        ) : null}
                        {option.description ? (
                          <span className="mt-0.5 line-clamp-2 text-xs leading-4 text-muted-foreground">
                            {option.description}
                          </span>
                        ) : null}
                      </span>
                    </div>
                    {renderOptionAction ? (
                      <div
                        className="shrink-0"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={(event) => event.stopPropagation()}
                      >
                        {renderOptionAction(option)}
                      </div>
                    ) : null}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
