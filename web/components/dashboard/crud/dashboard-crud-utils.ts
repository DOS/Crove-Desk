import type { ReactNode } from "react"

export type DashboardCrudQueryValue = string | number | undefined

export type DashboardCrudQueryFilter = {
  name: string
  trim?: boolean
  allValue?: string | number
  valueType?: "string" | "number"
}

export type DashboardCrudFilterStateConfig<
  TValue extends string | number = string | number,
> = {
  name: string
  defaultValue: TValue
}

export type DashboardCrudPageResult<T> = {
  results: T[]
  page: {
    page: number
    limit: number
    total: number
  }
}

export type DashboardCrudFormValue =
  | string
  | number
  | boolean
  | ReadonlyArray<string | number>
  | undefined

export type DashboardCrudFormOption = {
  value: string
  label: string
}

export type DashboardCrudFormInputValue = string | boolean | string[]

export type DashboardCrudFormCustomRenderContext = {
  name: string
  label: string
  value: DashboardCrudFormInputValue
  values: Record<string, DashboardCrudFormInputValue>
  setValue: (name: string, value: DashboardCrudFormInputValue) => void
}

export type DashboardCrudFormField<TItem = unknown> = {
  name: string
  label: string
  type?:
    | "text"
    | "textarea"
    | "number"
    | "select"
    | "multiSelect"
    | "switch"
    | "checkbox"
    | "password"
    | "json"
    | "code"
    | "custom"
    | "section"
    | "group"
  placeholder?: string
  defaultValue?: DashboardCrudFormValue
  description?: string
  required?: boolean
  requiredMessage?: string
  trim?: boolean
  normalizeInput?: (value: string) => string
  valueType?: "string" | "number" | "boolean"
  min?: number
  max?: number
  step?: number
  pattern?: RegExp
  patternMessage?: string
  options?: ReadonlyArray<DashboardCrudFormOption>
  loadOptions?: () => Promise<ReadonlyArray<DashboardCrudFormOption>>
  colSpan?: 1 | 2
  rows?: number
  language?: string
  validateJson?: boolean
  valueFromItem?: (item: TItem) => DashboardCrudFormValue
  render?: (context: DashboardCrudFormCustomRenderContext) => ReactNode
}

export type DashboardCrudActionRule<TItem> = {
  visible?: (item: TItem) => boolean
  disabled?: (item: TItem) => boolean
}

export function buildDashboardCrudQuery({
  values,
  filters,
  page,
  limit,
}: {
  values: Record<string, string | number | undefined>
  filters: DashboardCrudQueryFilter[]
  page: number
  limit: number
}): Record<string, DashboardCrudQueryValue> {
  const query: Record<string, DashboardCrudQueryValue> = {}

  filters.forEach((filter) => {
    const rawValue = values[filter.name]
    const value =
      filter.trim && typeof rawValue === "string" ? rawValue.trim() : rawValue

    if (
      value === undefined ||
      value === "" ||
      (filter.allValue !== undefined && String(value) === String(filter.allValue))
    ) {
      return
    }

    if (filter.valueType === "number") {
      const numberValue = Number(value)
      if (Number.isFinite(numberValue)) {
        query[filter.name] = numberValue
      }
      return
    }

    query[filter.name] = value
  })

  query.page = page
  query.limit = limit
  return query
}

export function buildDashboardCrudInitialFilters(
  filters: ReadonlyArray<DashboardCrudFilterStateConfig>
): Record<string, string | number | undefined> {
  return Object.fromEntries(
    filters.map((filter) => [filter.name, filter.defaultValue])
  ) as Record<string, string | number | undefined>
}

export function normalizeDashboardCrudPageResult<T>(
  result: Partial<DashboardCrudPageResult<T>> | null | undefined,
  page: number,
  limit: number
): DashboardCrudPageResult<T> {
  return {
    results: Array.isArray(result?.results) ? result.results : [],
    page: {
      page: result?.page?.page ?? page,
      limit: result?.page?.limit ?? limit,
      total: result?.page?.total ?? 0,
    },
  }
}

export function buildDashboardCrudFormValues<TItem>(
  fields: ReadonlyArray<DashboardCrudFormField<TItem>>,
  item?: TItem | null
): Record<string, DashboardCrudFormInputValue> {
  return Object.fromEntries(
    fields.map((field) => {
      let value: unknown = field.defaultValue ?? getDashboardCrudFormDefaultValue(field)
      if (item) {
        if (field.valueFromItem) {
          value = field.valueFromItem(item)
        } else if (typeof item === "object" && item && field.name in item) {
          value = (item as Record<string, unknown>)[field.name]
        }
      }
      return [field.name, normalizeDashboardCrudFormInputValue(field, value)]
    })
  )
}

export function normalizeDashboardCrudSubmitValues<TItem>(
  fields: ReadonlyArray<DashboardCrudFormField<TItem>>,
  values: Record<string, DashboardCrudFormInputValue>
): Record<string, string | number | boolean | string[] | number[]> {
  const output: Record<string, string | number | boolean | string[] | number[]> = {}

  fields.forEach((field) => {
    if (field.type === "section" || field.type === "group") {
      return
    }

    const rawValue = values[field.name] ?? getDashboardCrudFormDefaultValue(field)
    if (field.type === "switch" || field.type === "checkbox" || field.valueType === "boolean") {
      output[field.name] = Boolean(rawValue)
      return
    }
    if (field.type === "multiSelect") {
      const list = Array.isArray(rawValue) ? rawValue : []
      if (field.valueType === "number") {
        output[field.name] = list
          .map((value) => Number(value))
          .filter((value) => Number.isFinite(value))
        return
      }
      output[field.name] = list.map(String)
      return
    }
    const rawText = typeof rawValue === "string" ? rawValue : String(rawValue ?? "")
    const text = field.trim ? rawText.trim() : rawText
    if (field.type === "number" || field.valueType === "number") {
      const numberValue = Number(text)
      output[field.name] = Number.isFinite(numberValue) ? numberValue : 0
      return
    }
    output[field.name] = text
  })

  return output
}

function getDashboardCrudFormDefaultValue<TItem>(
  field: DashboardCrudFormField<TItem>
): DashboardCrudFormInputValue {
  if (field.type === "switch" || field.type === "checkbox") {
    return false
  }
  if (field.type === "multiSelect") {
    return []
  }
  return ""
}

function normalizeDashboardCrudFormInputValue<TItem>(
  field: DashboardCrudFormField<TItem>,
  value: unknown
): DashboardCrudFormInputValue {
  if (value === undefined || value === null) {
    return getDashboardCrudFormDefaultValue(field)
  }
  if (field.type === "switch" || field.type === "checkbox" || field.valueType === "boolean") {
    return value === true || value === "true" || value === 1 || value === "1"
  }
  if (field.type === "multiSelect") {
    if (!Array.isArray(value)) return []
    return value
      .filter((item) => item !== undefined && item !== null)
      .map((item) => String(item))
  }
  return String(value)
}

export function isDashboardCrudActionVisible<TItem>(
  action: DashboardCrudActionRule<TItem>,
  item: TItem
) {
  return action.visible ? action.visible(item) : true
}

export function isDashboardCrudActionDisabled<TItem>(
  action: DashboardCrudActionRule<TItem>,
  item: TItem
) {
  return action.disabled ? action.disabled(item) : false
}
