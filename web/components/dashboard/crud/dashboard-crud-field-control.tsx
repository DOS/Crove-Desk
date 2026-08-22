"use client"

import { useState } from "react"
import { CheckIcon, ChevronsUpDownIcon } from "lucide-react"
import type {
  FieldError as HookFormFieldError,
  UseFormReturn,
} from "react-hook-form"
import { Controller, type Control, type UseFormRegister } from "react-hook-form"

import { OptionCombobox } from "@/components/option-combobox"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Field,
  FieldContent,
  FieldError,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { useI18n } from "@/i18n/provider"
import { cn } from "@/lib/utils"
import type {
  DashboardCrudFormField,
  DashboardCrudFormInputValue,
  DashboardCrudFormOption,
} from "./dashboard-crud-utils"

export function DashboardCrudFieldControl<TItem>({
  field,
  control,
  form,
  register,
  error,
}: {
  field: DashboardCrudFormField<TItem>
  control: Control<Record<string, DashboardCrudFormInputValue>>
  form: UseFormReturn<
    Record<string, DashboardCrudFormInputValue>,
    undefined,
    Record<string, DashboardCrudFormInputValue>
  >
  register: UseFormRegister<Record<string, DashboardCrudFormInputValue>>
  error?: HookFormFieldError
}) {
  const inputId = `dashboard-crud-field-${field.name}`

  if (field.type === "section" || field.type === "group") {
    return (
      <div className="md:col-span-2">
        <div className="border-t pt-4">
          <div className="text-sm font-medium">{field.label}</div>
          {field.description ? (
            <div className="mt-1 text-sm text-muted-foreground">
              {field.description}
            </div>
          ) : null}
        </div>
      </div>
    )
  }

  return (
    <Field
      data-invalid={!!error}
      className={cn(
        (field.colSpan === 2 ||
          ["textarea", "json", "code", "custom"].includes(field.type ?? "")) &&
          "md:col-span-2"
      )}
    >
      <FieldLabel
        htmlFor={
          ["select", "multiSelect", "switch", "checkbox", "custom"].includes(
            field.type ?? ""
          )
            ? undefined
            : inputId
        }
      >
        {field.label}
      </FieldLabel>
      <FieldContent>
        {field.type === "select" ? (
          <Controller
            control={control}
            name={field.name}
            render={({ field: controllerField }) => (
              <OptionCombobox
                value={String(controllerField.value ?? "")}
                options={[...(field.options ?? [])]}
                placeholder={field.placeholder ?? field.label}
                onChange={controllerField.onChange}
              />
            )}
          />
        ) : field.type === "multiSelect" ? (
          <Controller
            control={control}
            name={field.name}
            render={({ field: controllerField }) => (
              <DashboardCrudMultiSelect
                value={
                  Array.isArray(controllerField.value)
                    ? controllerField.value
                    : []
                }
                options={[...(field.options ?? [])]}
                placeholder={field.placeholder ?? field.label}
                onChange={controllerField.onChange}
              />
            )}
          />
        ) : field.type === "switch" ? (
          <Controller
            control={control}
            name={field.name}
            render={({ field: controllerField }) => (
              <Switch
                checked={Boolean(controllerField.value)}
                onCheckedChange={controllerField.onChange}
                aria-label={field.label}
              />
            )}
          />
        ) : field.type === "checkbox" ? (
          <Controller
            control={control}
            name={field.name}
            render={({ field: controllerField }) => (
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <Checkbox
                  checked={Boolean(controllerField.value)}
                  onCheckedChange={controllerField.onChange}
                  aria-label={field.label}
                />
                <span>{field.description ?? field.label}</span>
              </label>
            )}
          />
        ) : field.type === "custom" && field.render ? (
          <Controller
            control={control}
            name={field.name}
            render={({ field: controllerField }) => (
              <>
                {field.render?.({
                  name: field.name,
                  label: field.label,
                  value: controllerField.value,
                  values: form.watch(),
                  setValue: (name, value) =>
                    form.setValue(name, value, {
                      shouldDirty: true,
                      shouldValidate: true,
                    }),
                })}
              </>
            )}
          />
        ) : field.type === "textarea" ? (
          <Textarea
            id={inputId}
            rows={field.rows ?? 4}
            placeholder={field.placeholder}
            aria-invalid={!!error}
            {...register(field.name)}
          />
        ) : field.type === "json" || field.type === "code" ? (
          <Textarea
            id={inputId}
            rows={field.rows ?? 8}
            placeholder={field.placeholder}
            aria-invalid={!!error}
            spellCheck={false}
            className="font-mono text-xs leading-5"
            {...register(field.name)}
          />
        ) : field.normalizeInput ? (
          <Controller
            control={control}
            name={field.name}
            render={({ field: controllerField }) => (
              <Input
                id={inputId}
                type="text"
                placeholder={field.placeholder}
                aria-invalid={!!error}
                value={String(controllerField.value ?? "")}
                onChange={(event) => controllerField.onChange(field.normalizeInput!(event.target.value))}
              />
            )}
          />
        ) : (
          <Input
            id={inputId}
            type={
              field.type === "number"
                ? "number"
                : field.type === "password"
                  ? "password"
                  : "text"
            }
            min={field.type === "number" ? field.min : undefined}
            max={field.type === "number" ? field.max : undefined}
            step={field.type === "number" ? field.step : undefined}
            placeholder={field.placeholder}
            aria-invalid={!!error}
            {...register(field.name)}
          />
        )}
        {field.description && field.type !== "checkbox" ? (
          <div className="text-sm text-muted-foreground">{field.description}</div>
        ) : null}
        <FieldError errors={error ? [error] : []} />
      </FieldContent>
    </Field>
  )
}

function DashboardCrudMultiSelect({
  value,
  options,
  placeholder,
  onChange,
}: {
  value: string[]
  options: DashboardCrudFormOption[]
  placeholder: string
  onChange: (value: string[]) => void
}) {
  const t = useI18n()
  const [open, setOpen] = useState(false)
  const selectedOptions = options.filter((option) => value.includes(option.value))
  const selectedText =
    selectedOptions.length > 0
      ? selectedOptions.map((option) => option.label).join(", ")
      : placeholder

  function toggleValue(nextValue: string) {
    if (value.includes(nextValue)) {
      onChange(value.filter((item) => item !== nextValue))
      return
    }
    onChange([...value, nextValue])
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            role="combobox"
            className="w-full justify-between font-normal"
          />
        }
      >
        <span className="truncate">{selectedText}</span>
        <ChevronsUpDownIcon className="ml-2 size-4 shrink-0 opacity-50" />
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
        <Command>
          <CommandInput placeholder={t("common.searchKeyword")} />
          <CommandList>
            <CommandEmpty>{t("common.emptyOptions")}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => {
                const checked = value.includes(option.value)
                return (
                  <CommandItem
                    key={option.value}
                    value={`${option.label} ${option.value}`}
                    onSelect={() => toggleValue(option.value)}
                  >
                    <CheckIcon
                      className={cn(
                        "mr-2 size-4 shrink-0",
                        checked ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <span className="truncate">{option.label}</span>
                  </CommandItem>
                )
              })}
            </CommandGroup>
          </CommandList>
        </Command>
        {selectedOptions.length > 0 ? (
          <div className="flex flex-wrap gap-1 border-t p-2">
            {selectedOptions.slice(0, 8).map((option) => (
              <Badge key={option.value} variant="secondary">
                {option.label}
              </Badge>
            ))}
            {selectedOptions.length > 8 ? (
              <Badge variant="outline">+{selectedOptions.length - 8}</Badge>
            ) : null}
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  )
}
