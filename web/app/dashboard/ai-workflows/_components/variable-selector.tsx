"use client"

import { OptionCombobox } from "@/components/option-combobox"

import type { WorkflowVariableRef, WorkflowVariableSelector } from "./workflow-utils"

export function VariableSelector({
  value,
  variables,
  onChange,
}: {
  value?: WorkflowVariableSelector
  variables: WorkflowVariableRef[]
  onChange: (value: WorkflowVariableSelector) => void
}) {
  const options = variables.map((item) => ({
    value: `${item.nodeId}.${item.field}`,
    label: `${item.nodeName}.${item.label || item.field} · ${item.type}`,
  }))
  const selectedValue = value?.nodeId && value.field ? `${value.nodeId}.${value.field}` : ""

  return (
    <OptionCombobox
      value={selectedValue}
      options={options}
      placeholder="选择变量"
      searchPlaceholder="搜索变量"
      emptyText="没有可用上游变量"
      onChange={(nextValue) => {
        const [nodeId, ...fieldParts] = nextValue.split(".")
        onChange({ nodeId, field: fieldParts.join(".") })
      }}
    />
  )
}
