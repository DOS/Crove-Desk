"use client"

import { OptionCombobox } from "@/components/option-combobox"

import {
  createRefValue,
  refField,
  refNodeId,
  type WorkflowVariableRef,
  type WorkflowVariableSelector,
} from "./workflow-utils"

export function VariableSelector({
  value,
  variables,
  onChange,
  placeholder = "选择变量",
}: {
  value?: WorkflowVariableSelector
  variables: WorkflowVariableRef[]
  onChange: (value: WorkflowVariableSelector) => void
  placeholder?: string
}) {
  const selected = value ? `${refNodeId(value)}.${refField(value)}` : ""
  const options = variables.map((variable) => ({
    value: `${variable.nodeId}.${variable.field}`,
    label: `${variable.nodeName}.${variable.label || variable.field}`,
    description: variable.description,
  }))

  return (
    <OptionCombobox
      value={selected}
      options={options}
      placeholder={placeholder}
      onChange={(next) => {
        const variable = variables.find((item) => `${item.nodeId}.${item.field}` === next)
        if (variable) {
          onChange(createRefValue(variable.nodeId, variable.field))
        }
      }}
    />
  )
}
